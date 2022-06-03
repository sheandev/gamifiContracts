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
 *  @notice ICombatant is interface of combatant token
 */
interface ICombatant {
    enum TypeId {
        SOLDIER,
        PILOT,
        GENERAL
    }

    struct CombatantBox {
        TypeId typeId;
        uint256 activeTime;
    }

    function getCombatantBoxOf(uint256 tokenId)
        external
        view
        returns (CombatantBox calldata);

    function getLimitStakingOf(TypeId typeId) external pure returns (uint256);

    function setStatusCombatantBox(uint256 tokenId, uint256 startTime) external;

    function tokenOfOwnerByIndex(address owner, uint256 index)
        external
        view
        returns (uint256);

    function mint(address owner) external;
}

/**
 *  @title  Dev Non-fungible token
 *
 *  @author Gamifi Team
 *
 *  @notice This smart contract create the token ERC721 for Operation. These tokens initially are minted
 *          by the all user and using open more combatant type with only 25 000 GMI
 */
contract MysteriousBoxes is
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    ERC721EnumerableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;
    using StringsUpgradeable for uint256;

    uint256 public constant MAX_BATCH = 10;
    uint256 public constant TOTAL_SUPPLY = 500;

    /**
     *  @notice pricePerNFTBox uint256 is price of mysterious box.
     */
    uint256 public pricePerNFTBox;

    /**
     *  @notice tokenCounter uint256 (counter). This is the counter for store
     *          current token ID value in storage.
     */
    uint256 public tokenCounter;

    /**
     *  @notice _stakedAmount uint256 is amount of staked token for burn.
     */
    uint256 private _stakedAmount;

    /**
     *  @notice receiver is address of account for receive token
     */
    address public receiver;

    /**
     *  @notice baseURI store the value of the ipfs url of NFT images
     */
    string public baseURI;

    /**
     *  @notice paymentToken is interface of payment token.
     */
    IERC20Upgradeable public paymentToken;

    /**
     *  @notice rarities is interface of NFT for mint
     */
    ICombatant public combatant;

    /**
     *  @notice admins mapping from token ID to isAdmin status
     */
    mapping(address => bool) public admins;

    /**
     *  @notice isOpened mapping from token ID to opened status of box
     */
    mapping(uint256 => bool) public isOpened;
    modifier onlyAdminOrOwner() {
        require(
            (owner() == _msgSender() || admins[_msgSender()]),
            "Ownable: caller is not an admin"
        );
        _;
    }

    event SetAdmin(address indexed user, bool indexed allow);
    event SetReceiver(address indexed user, uint256 indexed time);
    event SetPricePerNFTBox(uint256 indexed priceOld, uint256 indexed priceNew);
    event Bought(
        address indexed caller,
        uint256 indexed times,
        uint256 indexed timestamp
    );
    event Opened(
        address indexed caller,
        uint256 indexed tokenId,
        uint256 indexed timestamp
    );
    event Deposit(
        address indexed caller,
        uint256 indexed amount,
        uint256 indexed timestamp
    );
    event Withdraw(
        address indexed caller,
        uint256 indexed amount,
        uint256 indexed timestamp
    );

    /**
     *  @notice Initialize new logic contract.
     */
    function initialize(
        address owner_,
        string memory name_,
        string memory symbol_,
        address paymentToken_,
        address combatant_
    ) public initializer {
        ERC721Upgradeable.__ERC721_init(name_, symbol_);
        OwnableUpgradeable.__Ownable_init();
        paymentToken = IERC20Upgradeable(paymentToken_);
        combatant = ICombatant(combatant_);
        transferOwnership(owner_);
        pricePerNFTBox = 25000e18;
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
        uint256 isOpened_ = isOpenBox(tokenId) ? 1 : 0;

        return
            bytes(currentBaseURI).length > 0
                ? string(
                    abi.encodePacked(currentBaseURI, "/", isOpened_, ".json")
                )
                : ".json";
    }

    /**
     *  @notice Check account whether it is open or unopen
     *
     *  @dev    All caller can call this function.
     */
    function isOpenBox(uint256 tokenId) public view returns (bool) {
        return isOpened[tokenId];
    }

    /**
     *  @notice Check account whether it is the admin role.
     *
     *  @dev    All caller can call this function.
     */
    function isAdmin(address account) public view returns (bool) {
        return admins[account];
    }

    /**
     *  @notice Replace the admin role by another address.
     *
     *  @dev    Only owner can call this function.
     */
    function setAdmin(address user, bool allow) public onlyOwner {
        admins[user] = allow;
        emit SetAdmin(user, allow);
    }

    /**
     *  @notice Replace receiver by another address.
     *
     *  @dev    Only owner can call this function.
     */
    function setReceiver(address account) public onlyOwner {
        receiver = account;
        emit SetReceiver(account, block.timestamp);
    }

    /**
     *  @notice Replace the admin role by another address.
     *
     *  @dev    Only owner can call this function.
     */
    function setPricePerNFTBox(uint256 amount) public onlyOwner {
        uint256 pricePerNFTBoxOld = pricePerNFTBox;
        pricePerNFTBox = amount;
        emit SetPricePerNFTBox(pricePerNFTBoxOld, pricePerNFTBox);
    }

    /**
     *  @notice Deposit token into contract for burn
     *
     *  @dev    Only admin can call this function.
     */
    function deposit(uint256 amount) public onlyAdminOrOwner {
        require(amount > 0, "At least a mount greater than zero");
        paymentToken.safeTransferFrom(_msgSender(), address(this), amount);
        _stakedAmount += amount;
        emit Deposit(_msgSender(), amount, block.timestamp);
    }

    /**
     *  @notice Withdraw token from contract if end
     *
     *  @dev    Only admin can call this function.
     */
    function withdraw(uint256 amount) public onlyAdminOrOwner {
        require(receiver != address(0), "Invalid receiver");
        uint256 balanceToken = paymentToken.balanceOf(address(this));
        require(
            amount > 0 && balanceToken >= amount,
            "Amount or current balance is invalid"
        );

        paymentToken.safeTransfer(receiver, amount);
        _stakedAmount -= amount;
        emit Withdraw(_msgSender(), amount, block.timestamp);
    }

    /**
     *  @notice Buy any combatant box that caller request directly.
     *
     *  @dev    Only caller who not owned this NFT call this function.
     */
    function open(uint256 tokenId) public nonReentrant {
        require(ownerOf(tokenId) == _msgSender(), "This token is not own !");
        require(!isOpened[tokenId], "Your NFT is opened !");
        isOpened[tokenId] = true;
        combatant.mint(_msgSender());

        emit Opened(_msgSender(), tokenId, block.timestamp);
    }

    /**
     *  @notice Buy any mysterious box that caller request directly.
     */
    function buy(uint256 _times) public nonReentrant {
        require(tokenCounter + _times <= TOTAL_SUPPLY, "Sold out");

        require(
            _stakedAmount >= _times * pricePerNFTBox,
            "Admin not enough token in contract to burn"
        );

        require(
            _times > 0 && _times <= MAX_BATCH,
            "Too many mysterious boxes!"
        );

        // request token
        paymentToken.safeTransferFrom(
            _msgSender(),
            address(this),
            pricePerNFTBox * _times
        );

        // burn
        paymentToken.transfer(address(1), pricePerNFTBox * _times * 2);
        _stakedAmount -= pricePerNFTBox * _times;

        // mint
        for (uint256 i = 0; i < _times; i++) {
            uint256 tokenId = tokenCounter;
            _mint(_msgSender(), tokenId);
            isOpened[tokenId] = false;
            tokenCounter++;
        }

        emit Bought(_msgSender(), _times, block.timestamp);
    }
}
