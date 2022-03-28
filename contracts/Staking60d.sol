// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IMemberCard {
    function getMemberCardActive(uint256 tokenId) external view returns (bool);

    function consumeMembership(uint256 tokenId) external;

    function ownerOf(uint256 tokenId) external view returns (address);

    function isMember(address user) external view returns (bool);
}

contract Staking60d is Context, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    struct UserHistory {
        uint256 amount;
        uint256 timestamp;
    }

    struct UserInfo {
        uint256 amount;
        uint256 lastClaim;
        uint256 indexLength;
        uint256 pendingRewards;
        UserHistory[] userHistory;
    }

    mapping(address => UserInfo) public userInfo;

    address private _owner;

    uint256 private _stakedAmount;
    IERC20 private _stakeToken;
    IERC20 private _rewardToken;
    uint256 private _rewardRate;
    uint256 private _timeStarted;
    uint256 private _poolDuration;
    uint256 private _maxStakedAmount;

    uint256 private _bonusMultiplier;
    address private memberCard;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    constructor() {}

    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    function getTimeStarted() public view returns (uint256) {
        return _timeStarted;
    }

    function getPoolDuration() public view returns (uint256) {
        return _poolDuration;
    }

    function getStakeToken() public view returns (address) {
        return address(_stakeToken);
    }

    function initialize(
        address owner_,
        IERC20 stakeToken,
        IERC20 rewardToken,
        address _memberCard,
        uint256 timeStarted
    ) public initializer {
        _setOwner(owner_);
        memberCard = _memberCard;
        _stakeToken = stakeToken;
        _rewardToken = rewardToken;
        _timeStarted = timeStarted;
        _rewardRate = 47564687975;
        _poolDuration = 60 * 60 * 24 * 60;
        _maxStakedAmount = 40000000 * 1e18;
        _bonusMultiplier = 120;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function renounceOwnership() public virtual onlyOwner {
        _setOwner(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(
            newOwner != address(0),
            "Ownable: new owner is the zero address"
        );
        _setOwner(newOwner);
    }

    function _setOwner(address newOwner) private {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function getStakedAmount() public view returns (uint256) {
        return _stakedAmount;
    }

    function getMaxStakedAmount() public view returns (uint256) {
        return _maxStakedAmount;
    }

    function getUserAmount(address user) public view returns (uint256) {
        return userInfo[user].amount;
    }

    function setRewardRate(uint256 rewardRate) public onlyOwner {
        _rewardRate = rewardRate;
    }

    function setStartTime(uint256 timeStarted) public onlyOwner {
        _timeStarted = timeStarted;
    }

    function setPoolDuration(uint256 poolDuration) public onlyOwner {
        _poolDuration = poolDuration;
    }

    function setBonusMultiplier(uint256 bonusMultiplier) public onlyOwner {
        _bonusMultiplier = bonusMultiplier;
    }

    function pendingRewards(address _user) public view returns (uint256) {
        bool bonus = IMemberCard(memberCard).isMember(_user);
        UserInfo memory user = userInfo[_user];
        if (_timeStarted <= block.timestamp) {
            uint256 amount = user
                .amount
                .mul(
                    min(block.timestamp, _timeStarted.add(_poolDuration)).sub(
                        user.lastClaim
                    )
                )
                .mul(_rewardRate)
                .div(1e18);
            amount = amount + user.pendingRewards;
            if (bonus) {
                amount = amount * _bonusMultiplier;
                amount = amount / 100;
            }
            return amount;
        } else {
            return 0;
        }
    }

    function deposit(uint256 _amount) public nonReentrant {
        UserInfo storage user = userInfo[_msgSender()];
        if (user.amount > 0) {
            if (_timeStarted <= block.timestamp) {
                uint256 pending = user
                    .amount
                    .mul(
                        min(block.timestamp, _timeStarted.add(_poolDuration))
                            .sub(user.lastClaim)
                    )
                    .mul(_rewardRate)
                    .div(1e18);
                if (pending > 0) {
                    user.pendingRewards = user.pendingRewards + pending;
                }
            }
        }
        user.lastClaim = block.timestamp;
        if (_amount > 0) {
            require(
                _stakedAmount.add(_amount) <= _maxStakedAmount,
                "Staking: Max staking limit has been reached."
            );
            require(
                _timeStarted.add(_poolDuration) >= block.timestamp,
                "Staking: Staking has already ended."
            );
            user.amount = user.amount.add(_amount);
            _stakedAmount = _stakedAmount.add(_amount);
            _stakeToken.safeTransferFrom(_msgSender(), address(this), _amount);
            user.indexLength = user.indexLength.add(1);
            user.userHistory.push(UserHistory(user.amount, block.timestamp));
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a < b) return a;
        else return b;
    }

    function withdraw(uint256 _amount) public nonReentrant {
        require(
            _timeStarted.add(_poolDuration) <= block.timestamp,
            "Staking: StakingPool has not expired yet.."
        );
        bool bonus = IMemberCard(memberCard).isMember(_msgSender());
        UserInfo storage user = userInfo[_msgSender()];
        if (user.amount > 0) {
            if (_timeStarted <= block.timestamp) {
                uint256 pending = user
                    .amount
                    .mul(
                        min(block.timestamp, _timeStarted.add(_poolDuration))
                            .sub(user.lastClaim)
                    )
                    .mul(_rewardRate)
                    .div(1e18);
                pending = pending + user.pendingRewards;
                if (pending > 0) {
                    if (bonus) {
                        pending = pending * _bonusMultiplier;
                        pending = pending / 100;
                    }
                    user.pendingRewards = 0;
                    _rewardToken.safeTransfer(_msgSender(), pending);
                }
            }
        }

        user.lastClaim = block.timestamp;
        if (_amount > 0) {
            require(
                user.amount >= _amount,
                "Staking: Cannot unstake more than staked amount."
            );

            user.amount = user.amount.sub(_amount);
            _stakedAmount = _stakedAmount.sub(_amount);
            _stakeToken.safeTransfer(_msgSender(), _amount);
            user.indexLength = user.indexLength.add(1);
            user.userHistory.push(UserHistory(user.amount, block.timestamp));
        }
    }

    function EmergencyWithdraw() public onlyOwner nonReentrant {
        if (_rewardToken == _stakeToken) {
            _rewardToken.safeTransfer(
                owner(),
                _rewardToken.balanceOf(address(this)).sub(_stakedAmount)
            );
        } else {
            _rewardToken.safeTransfer(
                owner(),
                _rewardToken.balanceOf(address(this))
            );
        }
    }

    
}
