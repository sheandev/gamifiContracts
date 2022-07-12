// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract VestingV2 is Initializable, OwnableUpgradeable {
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

    mapping(bytes32 => Vest) private _vests;
    mapping(address => uint256) private _nonce;

    event InitiateVests(
        address[] indexed accounts,
        uint256[] amounts,
        uint256 tgePercent,
        uint256 indexed _cliff,
        uint256 indexed _linear
    );
    event Claim(address indexed account, uint256 indexed tokenClaimable);

    function initialize(address owner_, IERC20Upgradeable _token)
        public
        initializer
    {
        OwnableUpgradeable.__Ownable_init();
        _transferOwnership(owner_);
        token = _token;
    }

    function getClaimable(address owner_) public view returns (uint256) {
        uint256 tokenClaimable;
        for (uint256 i = 0; i < _nonce[owner_]; i++) {
            tokenClaimable += getClaimableForNonce(owner_, i);
        }
        return tokenClaimable;
    }

    function getClaimableForNonce(address owner_, uint256 nonce)
        public
        view
        returns (uint256)
    {
        bytes32 index = getVestId(owner_, nonce);
        uint256 tokenClaimable;
        uint256 currentTime = block.timestamp;
        if (
            currentTime >= _vests[index].start.add(_vests[index].cliff) &&
            currentTime <=
            _vests[index].start.add(_vests[index].cliff).add(
                _vests[index].linear
            )
        ) {
            uint256 timePassed = currentTime.sub(
                (_vests[index].start).add(_vests[index].cliff)
            );
            tokenClaimable = (
                (_vests[index].amount - _vests[index].initial)
                    .mul(timePassed)
                    .div(_vests[index].linear)
            ).add(_vests[index].initial).sub(_vests[index].claimed);
        } else if (
            currentTime >
            _vests[index].start.add(_vests[index].cliff).add(
                _vests[index].linear
            )
        ) {
            tokenClaimable = _vests[index].amount.sub(_vests[index].claimed);
        }
        return tokenClaimable;
    }

    function claim() external {
        uint256 tokenClaimable;
        for (uint256 i = 0; i < _nonce[_msgSender()]; i++) {
            uint256 tokenClaimableForNone = getClaimableForNonce(_msgSender(), i);
            tokenClaimable += tokenClaimableForNone;
            bytes32 index = getVestId(_msgSender(), i);
            _vests[index].claimed = _vests[index].claimed.add(
                tokenClaimableForNone
            );
        }
        token.safeTransfer(_msgSender(), tokenClaimable);

        emit Claim(_msgSender(), tokenClaimable);
    }

    function initiateVests(
        address[] memory accounts,
        uint256[] memory amounts,
        uint256 tgePercent,
        uint256 totalAmount,
        uint256 cliff,
        uint256 linear
    ) external {
        require(accounts.length > 0 && accounts.length == amounts.length, "Vesting: Inconsistent length");
        require(tgePercent < 100, "Vesting: Bad Percent");

        uint256 amount = 0;
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "Vesting: Invalid account");
            amount += amounts[i];
            uint256 initial = amounts[i].mul(tgePercent).div(100);
            _initiateVest(accounts[i], amounts[i], initial, cliff, linear);
        }

        require(amount == totalAmount, "Vesting: Bad totalAmount");
        token.safeTransferFrom(_msgSender(), address(this), totalAmount);

        emit InitiateVests(accounts, amounts, tgePercent, cliff, linear);
    }

    function _initiateVest(
        address owner_,
        uint256 amount,
        uint256 initial,
        uint256 cliff,
        uint256 linear
    ) private {
        bytes32 index = getVestId(owner_, _nonce[owner_]);
        _vests[index] = Vest(
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

    function getVest(bytes32 index) external view returns (Vest memory) {
        return _vests[index];
    }
}
