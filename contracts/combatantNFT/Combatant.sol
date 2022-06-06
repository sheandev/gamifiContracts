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
import "./ICombatant.sol";

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

contract Combatant is
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    ERC721EnumerableUpgradeable,
    ICombatant
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;
    using StringsUpgradeable for uint256;

    uint256 public constant MAX_BATCH = 10;
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
     *  @notice mapping from token ID to CombatantInfo
     */
    mapping(uint256 => CombatantInfo) public combatantInfos;

    /**
     *  @notice currentIndexes mapping from TypeId to curent index of this combatant
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
        string memory typeId = uint256(combatantInfos[tokenId].typeId)
            .toString();

        return
            bytes(currentBaseURI).length > 0
                ? string(abi.encodePacked(currentBaseURI, "/", typeId, ".json"))
                : ".json";
    }

    /**
     *  @notice Get all information of combatant from token ID.
     */
    function getCombatantInfoOf(uint256 tokenId)
        public
        view
        override
        returns (CombatantInfo memory)
    {
        return combatantInfos[tokenId];
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
    function tokensOfOwnerByType(address owner, uint256 typeID)
        public
        view
        override
        returns (uint256[] memory)
    {
        uint256 allTokens = balanceOf(owner);

        uint256 typedTokens = 0;
        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            CombatantInfo memory info = getCombatantInfoOf(tokenId);
            if (info.typeId == TypeId(typeID)) {
                typedTokens++;
            }
        }

        uint256[] memory typedIds = new uint256[](typedTokens);
        uint256 typedCounter = 0;
        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            CombatantInfo memory info = getCombatantInfoOf(tokenId);
            if (info.typeId == TypeId(typeID)) {
                typedIds[typedCounter] = tokenId;
                typedCounter++;
            }
        }

        return typedIds;
    }

    /**
     *  @notice Mint a combatant when call from mysterious box.
     *
     *  @dev    Only admin can call this function.
     */
    function mint(address owner) external override onlyAdminOrOwner {
        uint256 tokenId = tokenCounter;
        uint256 seed = rander.random(tokenId);
        TypeId typeId = randomTypeId(seed);
        combatantInfos[tokenId].typeId = typeId;
        if (typeId == TypeId.GENERAL) {
            combatantInfos[tokenId].useCounter = 1;
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
                block.timestamp > combatantInfos[tokenId].lockedExpireTime && !combatantInfos[tokenId].isLocked,
                "In unlockTime: you should stake it before transfer !"
            );
        }
    }

    function lockToken(uint256 tokenId, uint256 duration) external override onlyAdminOrOwner {
        combatantInfos[tokenId].lockedExpireTime = block.timestamp + duration;
        combatantInfos[tokenId].isLocked = true;
        emit LockToken(tokenId, combatantInfos[tokenId].lockedExpireTime);
    }

    function unlockToken(uint256 tokenId) external override onlyAdminOrOwner {
        combatantInfos[tokenId].isLocked = false;
        emit UnlockToken(tokenId);
    }

    function useForWhitelist(uint256 tokenId) public onlyAdminOrOwner {
        require(combatantInfos[tokenId].useCounter > 0, "NFT has been used");
        combatantInfos[tokenId].useCounter--;

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
        internal
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
    function selectTraits(uint256 seed) internal view returns (uint8 t) {
        seed >>= 16;
        t = selectTrait(uint16(seed & 0xFFFF), 0);
    }
}