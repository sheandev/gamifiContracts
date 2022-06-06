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
     *  @notice Set an account to be contract admin.
     *
     *  @dev    Only owner can call this function.
     */
    function setAdmin(address _account, bool _allow) public onlyOwner {
        require(_account != address(0), "Invalid address");
        admins[_account] = _allow;
        emit SetAdmin(_account, _allow);
    }

    /**
     *  @notice Replace price nft box.
     *
     *  @dev    Only owner or admin can call this function.
     */
    function setPricePerNFTBox(uint256 amount) public onlyAdminOrOwner {
        require(amount > 0, "Invalid amount");
        uint256 pricePerNFTBoxOld = pricePerNFTBox;
        pricePerNFTBox = amount;
        emit SetPricePerNFTBox(pricePerNFTBoxOld, pricePerNFTBox);
    }

    /**
     *  @notice Withdraw token from contract if end
     *
     *  @dev    Only owner or admin can call this function.
     */
    function withdraw(address receiver, uint256 amount) public onlyAdminOrOwner {
        require(receiver != address(0), "Invalid receiver");
        uint256 balanceToken = paymentToken.balanceOf(address(this));
        require(
            amount > 0 && balanceToken >= amount,
            "Amount or current balance is invalid"
        );

        paymentToken.safeTransfer(receiver, amount);
        emit Withdraw(_msgSender(), amount, block.timestamp);
    }

    /**
     *  @notice Open a mysterious box.
     *
     *  @dev    Only NFT holder can call this function.
     */
    function open(uint256 tokenId) public nonReentrant {
        require(ownerOf(tokenId) == _msgSender(), "This token is not own !");
        require(!isOpened[tokenId], "Your NFT is opened !");
        isOpened[tokenId] = true;
        combatant.mint(_msgSender());

        emit Opened(_msgSender(), tokenId, block.timestamp);
    }

    /**
     *  @notice Buy mysterious boxs.
     *
     *  @dev    Anyone can call this function.
     */
    function buy(uint256 _times) public nonReentrant {
        require(tokenCounter + _times <= TOTAL_SUPPLY, "Sold out");
        require(
            _times > 0 && _times <= MAX_BATCH,
            "Too many mysterious boxes!"
        );

        uint256 payAmount = _times * pricePerNFTBox;
        require(
            paymentToken.balanceOf(address(this)) >= payAmount,
            "Admin not enough token in contract to burn"
        );

        // request token
        paymentToken.safeTransferFrom(
            _msgSender(),
            address(this),
            payAmount
        );

        // burn
        paymentToken.transfer(address(1), payAmount * 2);

        // mint
        for (uint256 i = 0; i < _times; i++) {
            _mint(_msgSender(), tokenCounter);
            isOpened[tokenCounter] = false;
            tokenCounter++;
        }

        emit Bought(_msgSender(), _times, block.timestamp);
    }
}