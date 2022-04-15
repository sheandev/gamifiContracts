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
/**
 *  @title  Dev Non-fungible token
 *
 *  @author Gamifi Team
 *
 *  @notice This smart contract create the token ERC721 for Operation. These tokens initially are minted
 *          by the all user and using at all staking pool of system operation. It includes 3 category: 
 *            - Novice Fighter       : is the lower-level  NFT for upgrade to 40% bonus rewards 
 *            - Accomplished General : is the middle-level NFT for upgrade to 60% bonus rewards 
 *            - Powerful Leader      : is the top-level    NFT for upgrade to 80% bonus rewards 
 *          The contract here by is implemented to initial some NFT for logic divided bonus rewards.
 */
contract NewNFT is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable, ERC721EnumerableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;
    using StringsUpgradeable for uint256;

    enum Category { NOVICE_FIGHTER, ACCOMPLISHED_GENERAL, POWERFUL_LEADER }

    struct Card {
        Category category;
        uint256 expireTime;
    }
    
    /**
     *  @notice NOVICE_FIGHTER_PRICE       is the price of lower-level NFT
     *          ACCOMPLISHED_GENERAL_PRICE is the price of middle-level NFT
     *          POWERFUL_LEADER_PRICE      is the price of top-level NFT
     *          BONUS_EXPIRE_TIME          is the duration for bonus expired time
     */
    uint256 public constant NOVICE_FIGHTER_PRICE = 10e18;
    uint256 public constant ACCOMPLISHED_GENERAL_PRICE = 15e18;
    uint256 public constant POWERFUL_LEADER_PRICE = 20e18;
    uint256 public constant BONUS_EXPIRE_TIME = 365 days;
    
    /**
     *  @notice _tokenCounter uint256 (counter). This is the counter for store 
     *          current token ID value in storage.
     */
    uint256 public _tokenCounter;

    /**
     *  @notice _treasury store the address of the TreasuryManager contract
     */
    address private _treasury;

    /**
     *  @notice baseURI store the value of the ipfs url of NFT images
     */
    string public baseURI;

    /**
     *  @notice _cards mapping from token ID to Card
     */
    mapping(uint256 => Card) private _cards;

    /**
     *  @notice indexes mapping from token ID to index of each Card category
     */
    mapping(uint256 => uint256) private indexes;

    /**
     *  @notice currentIndexes mapping from Catergory to curent index of this category
     */
    mapping(Category => uint256) private currentIndexes;

    /**
     *  @notice _frozen mapping from token ID to frozen status
     */
    mapping(uint256 => bool) public _frozen;

    /**
     *  @notice _admins mapping from token ID to isAdmin status
     */
    mapping(address => bool) public _admins;

    /**
     *  @notice _paymentToken IERC20Upgradeable is interface of payment token
     */
    IERC20Upgradeable public _paymentToken;

    event SetAdmin(address indexed user, bool indexed allow);
    event SetTreasury(address indexed oldTreasury, address indexed newTreasury);
    event SetFreezeStatus(uint256 indexed tokenId, bool indexed frozen);
    event Actived(uint256 indexed tokenId, uint256 indexed time);
    event Bought(Category category, uint256 indexed tokenId, address to);

    /**
     *  @notice Initialize new logic contract.
     */
    function initialize(address owner_, string memory name_, string memory symbol_, address paymentToken_, address treasury_) public initializer {
        ERC721Upgradeable.__ERC721_init(name_, symbol_);
        OwnableUpgradeable.__Ownable_init();
        _paymentToken = IERC20Upgradeable(paymentToken_);
        transferOwnership(owner_);
        _treasury = treasury_;
    }

    modifier onlyAdmin() {
        require((owner() == _msgSender() || _admins[_msgSender()]), "Ownable: caller is not an admin");
        _;
    }

    modifier onlyCard(address user) {
        require(balanceOf(user) == 0, "NFT: caller or receiver had an NFT Card.");
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
    function setBaseURI(string memory _newURI) public onlyOwner {
        baseURI = _newURI;
    }

    /**
     *  @notice Mapping token ID to base URI in ipfs storage
     *
     *  @dev    All caller can call this function.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token.");
        
        string memory currentBaseURI = _baseURI();
        string memory folder = uint256(_cards[tokenId].category).toString();
        
        return bytes(currentBaseURI).length > 0
            ? string(abi.encodePacked(currentBaseURI, "/", folder, "/", indexes[tokenId].toString(), ".json")) : ".json";
    }

    /**
     *  @notice Get expired bonus time of token ID.
     *
     *  @dev    All caller can call this function.
     */
    function getExpireTime(uint256 tokenId) public view returns(uint256) {
        return _cards[tokenId].expireTime;
    }

    /**
     *  @notice Get address of TreasuryManager.
     *
     *  @dev    All caller can call this function.
     */
    function getTreasury() public view returns(address) {
        return _treasury;
    }

    /**
     *  @notice Get category of token ID.
     *
     *  @dev    All caller can call this function.
     */
    function getCategory(uint256 tokenId) public view returns(Category) {
        return _cards[tokenId].category;
    }

    /**
     *  @notice Get all information of token ID.
     *
     *  @dev    All caller can call this function.
     */
    function getCard(uint256 tokenId) public view returns(Card memory) {
        return _cards[tokenId];
    }

    /**
     *  @notice Get current index of category.
     *
     *  @dev    All caller can call this function.
     */
    function getCurrentIndexes(Category category) public view returns(uint256) {
        return currentIndexes[category];
    }

    /**
     *  @notice Get price of category.
     *
     *  @dev    All caller can call this function.
     */
    function getPrice(Category category) public pure returns (uint256) {
        if (category == Category.NOVICE_FIGHTER) {
            return NOVICE_FIGHTER_PRICE;
        }

        if (category == Category.ACCOMPLISHED_GENERAL) {
            return ACCOMPLISHED_GENERAL_PRICE;
        }

        return POWERFUL_LEADER_PRICE;
    }
    
    /**
     *  @notice Check token ID whether it is actived.
     *
     *  @dev    All caller can call this function.
     */
    function isActive(uint256 tokenId) public view returns(bool) {
        bool active = (_cards[tokenId].expireTime > block.timestamp && !_frozen[tokenId]);
        return active;
    }

    // /**
    //  *  @notice Check all token ID in caller account whether it is actived.
    //  *
    //  *  @dev    All caller can call this function.
    //  */
    // function isOnlyCard(address user) public view returns(bool) {
    //     uint256 balance = balanceOf(user);
    //     uint256 tid;
    //     for (uint256 i = 0; i < balance; i++){
    //         tid = tokenOfOwnerByIndex(user, 0);
    //         bool allow = isActive(tid);
    //         if (allow) {
    //             return false;
    //         }
    //     }
    //     return true;
    // }

    /**
     *  @notice Check account whether it is the admin role.
     *
     *  @dev    All caller can call this function.
     */
    function isAdmin(address account) public view returns(bool) {
        return  _admins[account];
    }

    /**
     *  @notice Replace the admin role by another address.
     *
     *  @dev    Only owner can call this function.
     */
    function setAdmin(address user, bool allow) public onlyOwner {
        _admins[user] = allow;
        emit SetAdmin(user, allow);
    }

    /**
     *  @notice set treasury to change TreasuryManager address.
     *
     *  @dev    Only admin can call this function.
     */
    function setTreasury(address account) public onlyAdmin {
        address oldTreasury = _treasury;
        _treasury = account;
        emit SetTreasury(oldTreasury, _treasury);
    }

    /**
     *  @notice Set freeze status to change logic.
     *
     *  @dev    Only admin can call this function.
     */
    function setFreezeStatus(uint256 tokenId, bool frozen) public onlyAdmin {
        _frozen[tokenId] = frozen;
        emit SetFreezeStatus(tokenId, frozen);
    }

    /**
     *  @notice Active to renew expire bonus time for top-level NFT.
     *
     *  @dev    Only admin can call this function.
     */
    function activate(uint256 tokenId) public onlyAdmin {
        require(_cards[tokenId].category == Category.POWERFUL_LEADER, "This NFT always active !");
        _cards[tokenId].expireTime = block.timestamp + BONUS_EXPIRE_TIME;
        _frozen[tokenId] = false;
        emit Actived(tokenId, _cards[tokenId].expireTime);
    }

    /**
     *  @notice Buy any category that caller request directly.
     *
     *  @dev    Only caller who not owned this NFT call this function.
     */
    function buy(Category category) public nonReentrant onlyCard(_msgSender()) {
        uint256 tokenId = _tokenCounter;
        uint256 index = currentIndexes[category];

        _paymentToken.safeTransferFrom(_msgSender(), _treasury, getPrice(category));

        _cards[tokenId].category = category;
        if (category == Category.POWERFUL_LEADER) {
            _cards[tokenId].expireTime = block.timestamp + BONUS_EXPIRE_TIME;
        }

        _mint(_msgSender(), tokenId);
        indexes[tokenId] = index;
        currentIndexes[category]++;
        _tokenCounter++;

        emit Bought(category, tokenId, _msgSender());
    }
}
