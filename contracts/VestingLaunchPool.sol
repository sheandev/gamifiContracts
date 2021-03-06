// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract VestingLaunchPool is Initializable, OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public token;

    struct Vest {
        address owner;
        uint256 amount;
        uint256 stakeType;
        uint256 start;
        uint256 initial;
        uint256 cliff;
        uint256 linear;
        uint256 claimed;
    }

    mapping(bytes32 => Vest) private _vests;
    mapping(address => uint256) private _nonce;

    event InitiateVests(address[] indexed accounts, uint256[] amounts, uint256[] initials, uint256 stakeType, uint256 indexed _cliff, uint256 indexed _linear);
    event Claim(address indexed account, uint256 indexed tokenClaimable);

    function initialize(address owner_, IERC20Upgradeable _token) public initializer {
        OwnableUpgradeable.__Ownable_init();
        _transferOwnership(owner_);
        token = _token;
    }

    function getClaimable(address owner_, uint256 nonce)
        public
        view
        virtual
        returns (uint256)
    {
        bytes32 index = getVestId(owner_, nonce);
        uint256 tokenClaimable;
        if (
            block.timestamp >= _vests[index].start.add(_vests[index].cliff) &&
            block.timestamp <=
            _vests[index].start.add(_vests[index].cliff).add(
                _vests[index].linear
            )
        ) {
            uint256 timePassed =
                block.timestamp.sub(
                    (_vests[index].start).add(_vests[index].cliff)
                );
            tokenClaimable = (
                (_vests[index].amount - _vests[index].initial)
                    .mul(timePassed)
                    .div(_vests[index].linear)
            )
                .add(_vests[index].initial)
                .sub(_vests[index].claimed);
        } else if (
            block.timestamp >
            _vests[index].start.add(_vests[index].cliff).add(
                _vests[index].linear
            )
        ) {
            tokenClaimable = _vests[index].amount.sub(_vests[index].claimed);
        }
        return tokenClaimable;
    }

    function claim(address owner_, uint256 nonce) public virtual {
        uint256 tokenClaimable = getClaimable(owner_, nonce);
        bytes32 index = getVestId(owner_, nonce);
        _vests[index].claimed = _vests[index].claimed.add(tokenClaimable);
        token.safeTransfer(owner_, tokenClaimable);

        emit Claim(owner_, tokenClaimable);
    }

    function initiateVests(
        address[] memory accounts,
        uint256[] memory amounts,
        uint256[] memory initials,
        uint256 stakeType,
        uint256 totalAmount,
        uint256 cliff,
        uint256 linear
    ) public virtual {
        require(accounts.length > 0, "Vesting: Bad length");
        require(accounts.length == amounts.length && amounts.length == initials.length, "Vesting: Mismatched inputs");

        uint256 amount = 0;
        for(uint256 i = 0; i < accounts.length; i++)
        {
            amount += amounts[i];
            initiateVest(accounts[i], amounts[i], stakeType, initials[i], cliff, linear);
        }

        require(amount == totalAmount, "Vesting: Bad totalAmount");  
        token.safeTransferFrom(_msgSender(), address(this), totalAmount);

        emit InitiateVests(accounts, amounts, initials, stakeType, cliff, linear);
    }

    function initiateVest(
        address owner_,
        uint256 amount,
        uint256 stakeType,
        uint256 initial,
        uint256 cliff,
        uint256 linear
    ) public virtual returns (bytes32) {
        require(
            initial < amount,
            "Vesting: initial amount should be less than total amount."
        );
        bytes32 index = getVestId(owner_, _nonce[owner_]);
        _vests[index] = Vest(
            owner_,
            amount,
            stakeType,
            block.timestamp,
            initial,
            cliff,
            linear,
            0
        );
        _nonce[owner_]++;
        return index;
    }

    function getVestId(address user, uint256 nonce)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(user, nonce));
    }

    function getNonce(address user) public view returns (uint256) {
        return _nonce[user];
    }

    function getVest(bytes32 index) public view virtual returns (Vest memory) {
        return _vests[index];
    }

    function getVestType(bytes32 index) public view virtual returns (uint256) {
        return _vests[index].stakeType;
    }
}
