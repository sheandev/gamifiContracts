// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "./IDuke.sol";

/**
 *  @title  Dev Non-fungible token
 *
 *  @author Gamifi Team
 *
 *  @notice This smart contract create the token ERC721 for Operation. These tokens initially are minted
 *          by the all user and using at all staking pool of system operation. It includes 3 category:
 *            - Soldier       : is the lower-level  NFT for upgrade to 50% APY
 *            - Pilot         : is the middle-level NFT for upgrade to 75% APY
 *            - General       : is the top-level    NFT for upgrade to 150% APY
 *          The contract here by is implemented to initial some NFT for logic divided APY.
 */

interface IRand {
    function random(uint256 tokenId) external view returns (uint256);
}

contract Duke is
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    ERC721EnumerableUpgradeable,
    IDuke
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using StringsUpgradeable for uint256;

    uint256 public constant MAX_BATCH = 10;
    uint256 public constant TOTAL_SUPPLY = 500;
    uint256 public constant SOLDIER_SUPPLY = 375;
    uint256 public constant PILOT_SUPPLY = 100;
    uint256 public constant GENERAL_SUPPLY = 25;

    /**
     *  @notice rarities is list of probabilities for each trait type
     */
    uint8[][3] public rarities;

    /**
     *  @notice aliases is list of aliases for Walker's Alias algorithm
     */
    uint8[][3] public aliases;

    /**
     *  @notice tokenCounter uint256 (counter). This is the counter for store
     *          current token ID value in storage.
     */
    uint256 public tokenCounter;

    /**
     *  @notice baseURI store the value of the ipfs url of NFT images
     */
    string public baseURI;

    /**
     *  @notice baseURI store the value of the ipfs url of NFT images
     */
    IRand public rander;

    /**
     *  @notice mapping from token ID to DukeInfo
     */
    mapping(uint256 => DukeInfo) public dukeInfos;

    /**
     *  @notice currentIndexes mapping from TypeId to curent index of this duke
     */
    mapping(TypeId => uint256) public currentIndexes;

    /**
     *  @notice admins mapping from token ID to isAdmin status
     */
    mapping(address => bool) public admins;

    modifier onlyAdminOrOwner() {
        require(
            (owner() == _msgSender() || admins[_msgSender()]),
            "Ownable: caller is not an admin"
        );
        _;
    }

    event SetAdmin(address indexed user, bool indexed allow);
    event LockToken(uint256 indexed tokenId, uint256 indexed lockedExpireTime);
    event UnlockToken(uint256 indexed tokenId);
    event UsedForWhitelist(uint256 indexed tokenId);
    event SetUseCounter(uint256 indexed tokenId, uint256 indexed counter);
    event SetContracts(address indexed randomizer);

    /**
     *  @notice Initialize new logic contract.
     */
    function initialize(
        address owner_,
        string memory name_,
        string memory symbol_,
        address rander_
    ) public initializer {
        ERC721Upgradeable.__ERC721_init(name_, symbol_);
        OwnableUpgradeable.__Ownable_init();
        transferOwnership(owner_);
        rander = IRand(rander_);

        rarities[0] = [255, 153, 38];
        aliases[0] = [0, 0, 0];
    }

    /**
     *  @notice Return current base URI.
     */
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    /**
     *  @notice Replace current base URI by new base URI.
     *
     *  @dev    Only owner can call this function.
     */
    function setBaseURI(string memory _newURI) public onlyOwner {
        baseURI = _newURI;
    }

    /**
     *  @notice Set an account to be contract admin.
     *
     *  @dev    Only owner can call this function.
     */
    function setAdmin(address user, bool allow) public onlyOwner {
        require(user != address(0), "Invalid address");
        admins[user] = allow;
        emit SetAdmin(user, allow);
    }

    function setUseCounter(uint256 tokenId, uint256 useCounter)
        public
        onlyAdminOrOwner
    {
        require(
            dukeInfos[tokenId].typeId == TypeId.GENERAL,
            "NFT is not GENERAL"
        );
        dukeInfos[tokenId].useCounter = useCounter;

        emit SetUseCounter(tokenId, useCounter);
    }

    /**
     *  @notice Set contract random address.
     *
     *  @dev    Only owner can call this function.
     */
    function setContracts(address _randomizer) external onlyOwner {
        require(_randomizer != address(0), "Invalid contract address");
        rander = IRand(_randomizer);
        emit SetContracts(_randomizer);
    }

    /**
     *  @notice Mapping token ID to base URI in ipfs storage
     *
     *  @dev    All caller can call this function.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token."
        );

        string memory currentBaseURI = _baseURI();
        string memory typeId = uint256(dukeInfos[tokenId].typeId)
            .toString();

        return
            bytes(currentBaseURI).length > 0
                ? string(abi.encodePacked(currentBaseURI, "/", typeId, ".json"))
                : ".json";
    }

    /**
     *  @notice Get all information of duke from token ID.
     */
    function getDukeInfoOf(uint256 tokenId)
        public
        view
        override
        returns (DukeInfo memory)
    {
        return dukeInfos[tokenId];
    }

    /**
     *  @notice Get limit staking from type ID.
     */
    function getSupplyOf(TypeId typeId) public pure returns (uint256) {
        if (typeId == TypeId.GENERAL) {
            return GENERAL_SUPPLY;
        }

        if (typeId == TypeId.PILOT) {
            return PILOT_SUPPLY;
        }

        return SOLDIER_SUPPLY;
    }

    /**
     *  @notice Get list token ID of owner address.
     */
    function tokensOfOwner(address owner)
        public
        view
        returns (uint256[] memory)
    {
        uint256 count = balanceOf(owner);
        uint256[] memory ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
        return ids;
    }

    /**
     *  @notice Get list token ID by type of owner address.
     */
    function tokensOfOwnerByType(address owner, TypeId typeID)
        public
        view
        override
        returns (uint256[] memory)
    {
        uint256 allTokens = balanceOf(owner);

        uint256 typedTokens = 0;
        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            DukeInfo memory info = getDukeInfoOf(tokenId);
            if (info.typeId == typeID) {
                typedTokens++;
            }
        }

        uint256[] memory typedIds = new uint256[](typedTokens);
        uint256 typedCounter = 0;
        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            DukeInfo memory info = getDukeInfoOf(tokenId);
            if (info.typeId == typeID) {
                typedIds[typedCounter] = tokenId;
                typedCounter++;
            }
        }

        return typedIds;
    }

    /**
     *  @notice Get list token ID is active of owner address.
     */
    function getNFTActiveOfOwner(address owner)
        public
        view
        returns (uint256[] memory)
    {
        uint256 allTokens = balanceOf(owner);

        uint256 typedTokens = 0;
        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            bool allow = getMemberCardActive(tokenId);
            if (allow) {
                 typedTokens++;
            }
        }

        uint256 typedCounter = 0;
        uint256[] memory typedIds = new uint256[](typedTokens);
        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            bool allow = getMemberCardActive(tokenId);
            if (allow) {
                typedIds[typedCounter] = tokenId;
                typedCounter++;
            }
        }

        return typedIds;
    }

    function getMemberCardActive(uint256 tokenId) public view returns (bool) {
        return dukeInfos[tokenId].useCounter > 0;
    }

    function isMember(address owner) external view returns (bool) {
        uint256 allTokens = balanceOf(owner);

        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            bool allow = getMemberCardActive(tokenId);
            if (allow) {
                return true;
            }
        }
        return false;
    }

    /**
     *  @notice Mint a duke when call from mysterious box.
     *
     *  @dev    Only admin can call this function.
     */
    function mint(address owner) external override onlyAdminOrOwner {
        require(tokenCounter < TOTAL_SUPPLY, "Sold out");

        uint256 tokenId = tokenCounter;
        uint256 seed = rander.random(tokenId);
        TypeId _typeId = randomTypeId(seed);
        dukeInfos[tokenId].typeId = _typeId;
        if (_typeId == TypeId.GENERAL) {
            dukeInfos[tokenId].useCounter = 1;
        }
        _mint(owner, tokenId);
        tokenCounter++;
    }

    /**
     * @dev Hook that is called before any token transfer. This includes minting
     * and burning.
     *
     * Calling conditions:
     *
     * - When `from` and `to` are both non-zero, ``from``'s `tokenId` will be
     * transferred to `to`.
     * - When `from` is zero, `tokenId` will be minted for `to`.
     * - When `to` is zero, ``from``'s `tokenId` will be burned.
     * - `from` and `to` are never both zero.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId);
        if (from != address(0) && to != address(0) && from != to) {
            require(
                block.timestamp > dukeInfos[tokenId].lockedExpireTime &&
                    !dukeInfos[tokenId].isLocked,
                "In unlockTime: you should stake it before transfer !"
            );
        }
    }

    function lockToken(uint256 tokenId, uint256 duration)
        external
        override
        onlyAdminOrOwner
    {
        dukeInfos[tokenId].lockedExpireTime = block.timestamp + duration;
        dukeInfos[tokenId].isLocked = true;
        emit LockToken(tokenId, dukeInfos[tokenId].lockedExpireTime);
    }

    function unlockToken(uint256 tokenId) external override onlyAdminOrOwner {
        dukeInfos[tokenId].isLocked = false;
        emit UnlockToken(tokenId);
    }

    function consumeMembership(uint256 tokenId) public onlyAdminOrOwner {
        require(dukeInfos[tokenId].useCounter > 0, "NFT has been used");
        dukeInfos[tokenId].useCounter--;

        emit UsedForWhitelist(tokenId);
    }

    /**
     *  @notice Random a lucky number for create new NFT.
     */
    function randomTypeId(uint256 seed) private returns (TypeId) {
        uint8 result = selectTraits(seed);

        TypeId[3] memory flags = [TypeId.SOLDIER, TypeId.PILOT, TypeId.GENERAL];

        // Return correct type
        for (uint8 i = 0; i < flags.length; i++) {
            if (
                TypeId(result) == flags[i] &&
                currentIndexes[flags[i]] < getSupplyOf(flags[i])
            ) {
                currentIndexes[flags[i]]++;
                return flags[i];
            }
        }

        // Always returns valid avalue
        for (uint256 i = 0; i < flags.length; i++) {
            if (currentIndexes[flags[i]] < getSupplyOf(flags[i])) {
                return flags[i];
            }
        }

        return TypeId.SOLDIER;
    }

    /**
     *  @notice A.J. Walker's Alias Algorithm to get random corresponding rate.
     */
    function selectTrait(uint16 seed, uint8 traitType)
        private
        view
        returns (uint8)
    {
        uint8 trait = uint8(seed) % uint8(rarities[traitType].length);
        if (seed >> 8 < rarities[traitType][trait]) return trait;
        return aliases[traitType][trait];
    }

    /**
     *  @notice A.J. Walker's Alias Algorithm to avoid overflow.
     */
    function selectTraits(uint256 seed) private view returns (uint8 t) {
        seed >>= 16;
        t = selectTrait(uint16(seed & 0xFFFF), 0);
    }
}
