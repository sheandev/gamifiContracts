// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract VestingV2 is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct Vest {
        address owner;
        uint256 amount;
        uint256 start;
        uint256 initial;
        uint256 cliff;
        uint256 linear;
        uint256 claimed;
    }

    IERC20Upgradeable public token;

    mapping(bytes32 => Vest) public vests;
    mapping(address => uint256) private _nonce;

    bool public isVestingStarted;

    event InitializedVests(
        address[] indexed accounts,
        uint256[] amounts,
        uint256 tgePercent,
        uint256 indexed _cliff,
        uint256 indexed _linear
    );
    event Claimed(address indexed account, uint256 indexed tokenClaimable);

    function initialize(address owner_, IERC20Upgradeable _token)
        public
        initializer
    {
        __Ownable_init();
        __ReentrancyGuard_init();

        _transferOwnership(owner_);
        token = _token;
    }

    function getClaimable(address _account) public view returns (uint256) {
        uint256 tokenClaimable;
        for (uint256 i = 0; i < _nonce[_account]; i++) {
            tokenClaimable += getClaimableForNonce(_account, i);
        }

        return tokenClaimable;
    }

    function getClaimableForNonce(address _account, uint256 nonce)
        public
        view
        returns (uint256)
    {
        bytes32 index = getVestId(_account, nonce);
        Vest memory vest = vests[index];

        uint256 tokenClaimable;
        uint256 currentTime = block.timestamp;
        uint256 vestStart = vest.start.add(vest.cliff);
        uint256 vestEnd = vest.start.add(vest.cliff).add(vest.linear);

        if (currentTime >= vestStart && currentTime <= vestEnd) {
            uint256 timePassed = currentTime.sub((vest.start).add(vest.cliff));
            tokenClaimable = (
                vest.amount
                    .sub(vest.initial)
                    .mul(timePassed)
                    .div(vest.linear)
            ).add(vest.initial).sub(vest.claimed);
        } else if (currentTime > vestEnd) {
            tokenClaimable = vest.amount.sub(vest.claimed);
        }

        return tokenClaimable;
    }

    function claim() external nonReentrant {
        uint256 tokenClaimable;

        for (uint256 i = 0; i < _nonce[_msgSender()]; i++) {
            uint256 tokenClaimableForNone = getClaimableForNonce(
                _msgSender(),
                i
            );
            tokenClaimable += tokenClaimableForNone;
            bytes32 index = getVestId(_msgSender(), i);
            vests[index].claimed = vests[index].claimed.add(
                tokenClaimableForNone
            );
        }

        token.safeTransfer(_msgSender(), tokenClaimable);

        emit Claimed(_msgSender(), tokenClaimable);
    }

    function initiateVests(
        address[] memory accounts,
        uint256[] memory amounts,
        uint256 tgePercent,
        uint256 totalAmount,
        uint256 cliff,
        uint256 linear
    ) external {
        require(
            accounts.length > 0 && accounts.length == amounts.length,
            "Vesting: Inconsistent length"
        );
        require(tgePercent < 100, "Vesting: Bad Percent");

        uint256 amount = 0;
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "Vesting: Invalid account");
            amount += amounts[i];
            uint256 initial = amounts[i].mul(tgePercent).div(100);
            _initiateVest(accounts[i], amounts[i], initial, cliff, linear);
        }

        require(amount == totalAmount, "Vesting: Bad total amount");

        isVestingStarted = true;
        token.safeTransferFrom(_msgSender(), address(this), totalAmount);

        emit InitializedVests(accounts, amounts, tgePercent, cliff, linear);
    }

    function _initiateVest(
        address owner_,
        uint256 amount,
        uint256 initial,
        uint256 cliff,
        uint256 linear
    ) private {
        bytes32 index = getVestId(owner_, _nonce[owner_]);
        vests[index] = Vest(
            owner_,
            amount,
            block.timestamp,
            initial,
            cliff,
            linear,
            0
        );
        _nonce[owner_]++;
    }

    function getVestId(address user, uint256 nonce)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(user, nonce));
    }

    function getNonce(address user) external view returns (uint256) {
        return _nonce[user];
    }
}
