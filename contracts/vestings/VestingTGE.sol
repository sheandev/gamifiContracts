// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../libraries/Formula.sol";

contract VestingTGE is Initializable, OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public token;

    struct Vest {
        address owner;
        uint256 amount;
        uint256 start;
        uint256 initial;
        uint256 cliff;
        uint256 linear;
        uint256 claimed;
    }

    event InitiateVests(address[] indexed accounts, uint256[] amounts, uint256 tgePercent, uint256 _totalAmount, uint256 indexed _cliff, uint256 indexed _linear);
    event Claim(address indexed account, uint256 indexed tokenClaimable);

    mapping(address => Vest) public vests;

    bool public isVestingStarted;

    function initialize(address owner_, IERC20Upgradeable _token) public initializer {
        OwnableUpgradeable.__Ownable_init();
        _transferOwnership(owner_);
        token = _token;
    }

    function getClaimable(address _account) public view returns (uint256) {
        Vest memory _vest = vests[_account];
        uint256 tokenClaimable;
        uint256 timestamp = block.timestamp; // solhint-disable-line not-rely-on-time

        if (
            timestamp >= _vest.start.add(_vest.cliff) &&
            timestamp <=
            _vest.start.add(_vest.cliff).add(
                _vest.linear
            )
        ) {
            uint256 timePassed = timestamp.sub(
                (_vest.start).add(_vest.cliff)
            );
            tokenClaimable = (
                (_vest.amount - _vest.initial)
                    .mul(timePassed)
                    .div(_vest.linear)
            ).add(_vest.initial).sub(_vest.claimed);
        } else if (
            timestamp >
            _vest.start.add(_vest.cliff).add(
                _vest.linear
            )
        ) {
            tokenClaimable = _vest.amount.sub(_vest.claimed);
        }
        return tokenClaimable;
    }

    function claim() external {
        Vest storage _vest = vests[_msgSender()];
        uint256 tokenClaimable = getClaimable(_msgSender());
        require(tokenClaimable > 0, "Vesting: No token to claim");
        _vest.claimed = _vest.claimed.add(tokenClaimable);
        token.safeTransfer(_msgSender(), tokenClaimable);

        emit Claim(_msgSender(), tokenClaimable);
    }

    function initiateVests(address[] memory accounts, uint256[] memory amounts, uint256 tgePercent, uint256 _totalAmount, uint256 _cliff, uint256 _linear) external onlyOwner {
        require(accounts.length > 0 && amounts.length > 0, "Vesting: Bad length"); // solhint-disable-line reason-string
        require(accounts.length == amounts.length, "Vesting: Mismatched inputs"); // solhint-disable-line reason-string
        require(tgePercent < 100, "Vesting: Bad Percent");
        require(_totalAmount > 0, "Vesting: _totalAmount must be > 0"); // solhint-disable-line reason-string

        uint256 amount = 0;
        token.safeTransferFrom(_msgSender(), address(this), _totalAmount);
        for (uint256 i = 0; i < accounts.length; i++) {
            amount = amount.add(amounts[i]);
            uint256 initial = amounts[i].mul(tgePercent).div(100);
            initiateVest(accounts[i], amounts[i], initial, _cliff, _linear);
        }
        require(amount == _totalAmount, "Vesting: Bad totalAmount");  

        isVestingStarted = true;

        emit InitiateVests(accounts, amounts, tgePercent, _totalAmount, _cliff, _linear);
    }

    function initiateVest(address owner_, uint256 amount, uint256 initial, uint256 cliff, uint256 linear) private {
        require(owner_ != address(0), "Vesting: owner_ is the zero address"); // solhint-disable-line reason-string
        require(initial < amount, "Vesting: initial amount should be less than total amount."); // solhint-disable-line reason-string

        vests[owner_] = Vest(
            owner_,
            amount,
            block.timestamp, // solhint-disable-line not-rely-on-time
            initial,
            cliff,
            linear,
            0
        );
    }
}
