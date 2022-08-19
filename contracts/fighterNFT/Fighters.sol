// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "./IFighters.sol";

interface IRandomizer {
    function random(uint256 tokenId) external view returns (uint256);
}

contract Fighters is
    IFighters,
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    ERC721EnumerableUpgradeable
{
    using StringsUpgradeable for uint256;

    uint256 public constant TYPE_AMOUNT      = 10;
    uint256 public constant TYPED_SUPPLY     = 10;
    uint256 public constant MAX_TOTAL_SUPPLY = 100;

    /**
     *  @notice address of randomizer contract
     */
    IRandomizer public randomizer;

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
     *  @notice mapping from token ID to fighter info
     */
    mapping(uint256 => FighterInfo) public fighters;

    /**
     *  @notice mapping from type ID to it's current supply
     */
    mapping(TypeId => uint256) public currentSupplies;

    /**
     *  @notice admins mapping from token ID to isAdmin status
     */
    mapping(address => bool) public admins;

    event SetAdmin(address indexed account, bool indexed allow);
    event SetRandomizer(address indexed randomizer);
    event ConsumedMembership(uint256 indexed tokenId, uint256 indexed counter);
    event MintedFighter(
        address indexed to,
        uint256 indexed tokenId,
        TypeId indexed typeId
    );

    /**
     *  @notice Initialize contract.
     */
    function initialize(
        address owner_,
        string memory name_,
        string memory symbol_,
        IRandomizer randomizer_
    ) public initializer {
        __ERC721_init(name_, symbol_);
        __Ownable_init();

        randomizer = randomizer_;
        transferOwnership(owner_);
    }

    modifier onlyAdmin() {
        require(
            (owner() == _msgSender() || admins[_msgSender()]),
            "Ownable: caller is not an admin"
        );
        _;
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
    function setBaseURI(string memory _newURI) external onlyOwner {
        baseURI = _newURI;
    }

    /**
     *  @notice Mapping token ID to base URI in ipfs storage
     *
     *  @dev    All caller can call this function.
     */
    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(
            _exists(_tokenId),
            "ERC721Metadata: URI query for nonexistent token."
        );

        string memory currentBaseURI = _baseURI();
        string memory typeId = uint256(fighters[_tokenId].typeId).toString();

        return
            bytes(currentBaseURI).length > 0
                ? string(abi.encodePacked(currentBaseURI, "/", typeId, ".json"))
                : ".json";
    }

    /**
     *  @notice Set an account to be contract admin.
     *
     *  @dev    Only owner can call this function.
     */
    function setAdmin(address _account, bool _allow) external onlyOwner {
        require(_account != address(0), "Invalid address");
        admins[_account] = _allow;
        emit SetAdmin(_account, _allow);
    }

        /**
     *  @notice Set contract randomizer address.
     *
     *  @dev    Only owner can call this function.
     */
    function setRandomizer(address _randomizer) external onlyOwner {
        require(_randomizer != address(0), "Invalid contract address");
        rander = IRand(_randomizer);
        emit SetRandomizer(_randomizer);
    }

    function consumeMembership(uint256 _tokenId) external override onlyAdmin {
        require(fighters[_tokenId].useCounter > 0, "Fighter has been used");
        fighters[_tokenId].useCounter--;

        emit ConsumedMembership(_tokenId, fighters[_tokenId].useCounter);
    }

    /**
     *  @notice Mint a fighter one.
     *
     *  @dev    Only admin can call this function.
     */
    function mint(address _to) external override onlyAdmin {
        require(tokenCounter < MAX_TOTAL_SUPPLY, "Exceeds max token supply");

        uint256 tokenId = tokenCounter;

        TypeId typeId = randomTypeId(seed);
        fighters[tokenId].typeId = typeId;
        fighters[tokenId].useCounter = 3;

        _mint(_to, tokenId);
        tokenCounter++;

        emit MintedFighter(_to, tokenId, typeId);
    }

    /**
     *  @notice Get all information of fighter from token ID.
     */
    function getFighterInfoOf(uint256 tokenId)
        public
        view
        override
        returns (FighterInfo memory)
    {
        return fighters[tokenId];
    }


    /**
     *  @notice Get list token ID of owner address.
     */
    function tokensOfOwner(address _owner)
        public
        view
        returns (uint256[] memory)
    {
        uint256 count = balanceOf(_owner);
        uint256[] memory ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return ids;
    }

    /**
     *  @notice Get list token ID by type of owner address.
     */
    function tokensOfOwnerByType(address _owner, TypeId _typeId)
        external
        view
        override
        returns (uint256[] memory)
    {
        uint256 allTokens = balanceOf(_owner);

        uint256 typedTokens = 0;
        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(_owner, i);
            FighterInfo memory info = getFighterInfoOf(tokenId);
            if (info.typeId == _typeId) {
                typedTokens++;
            }
        }

        uint256[] memory tokenIds = new uint256[](typedTokens);
        uint256 typedCounter = 0;
        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(_owner, i);
            FighterInfo memory info = getFighterInfoOf(tokenId);
            if (info.typeId == _typeId) {
                tokenIds[typedCounter] = tokenId;
                typedCounter++;
            }
        }

        return tokenIds;
    }

    /**
     *  @notice Get list token ID that is active of owner address.
     */
    function getActiveTokensOfOwner(address _owner)
        external
        view
        returns (uint256[] memory)
    {
        uint256 allTokens = balanceOf(_owner);

        uint256 activeTotal = 0;
        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(_owner, i);
            bool allow = getMemberCardActive(tokenId);
            if (allow) {
                activeTotal++;
            }
        }

        uint256 activeCounter = 0;
        uint256[] memory tokenIds = new uint256[](activeTotal);
        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(_owner, i);
            bool allow = getMemberCardActive(tokenId);
            if (allow) {
                tokenIds[activeCounter] = tokenId;
                activeCounter++;
            }
        }

        return tokenIds;
    }

    function getMemberCardActive(uint256 _tokenId) public view returns (bool) {
        return fighters[_tokenId].useCounter > 0;
    }

    function isMember(address _owner) external view returns (bool) {
        uint256 allTokens = balanceOf(_owner);

        for (uint256 i = 0; i < allTokens; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(_owner, i);
            bool allow = getMemberCardActive(tokenId);
            if (allow) {
                return true;
            }
        }

        return false;
    }

    /**
     *  @notice Random fighter type id
     */
    function _randomTypeId(uint256 seed) private returns (TypeId) {
        TypeId[3] memory flags = [TypeId.SOLDIER, TypeId.PILOT, TypeId.GENERAL];

        // Return correct type
        for (uint8 i = 0; i < TYPE_AMOUNT; i++) {
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
                fighters[tokenId].useCounter == 0,
                "Please consume the membership"
            );
        }
    }
}
