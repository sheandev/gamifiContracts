// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "hardhat/console.sol";

/**
 *  @title  Dev Staking Pool
 *
 *  @author Gamifi Team
 *
 *  @notice This smart contract is created for staking pool for all user can stake amount of token
 *          to get with attractive reward.
 *          The contract here by is implemented to create opportunities for users to drive project growth
 */
contract StakingV3 is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMathUpgradeable for uint256;

    struct UserHistory {
        uint256 amount;
        uint256 timestamp;
    }

    struct Lazy {
        uint256 unlockedTime;
        bool isRequested;
    }

    struct UserInfo {
        uint256 totalAmount;
        uint256 lastClaim;
        uint256 indexLength;
        uint256 pendingRewards;
        Lazy lazyClaimReward;
        UserHistory[] userHistory;
    }

    /**
     *  @notice _stakedAmount uint256 is amount of staked token.
     */
    uint256 private _stakedAmount;

    /**
     *  @notice _rewardRate uint256 is rate of token.
     */
    uint256 private _rewardRate;

    /**
     *  @notice _timeStarted uint256 is start time of staking pool.
     */
    uint256 private _timeStarted;

    /**
     *  @notice _poolDuration uint256 is duration of staking pool to end-time.
     */
    uint256 private _poolDuration;

    /**
     *  @notice _maxStakedAmount uint256 is max number of token which staked.
     */
    uint256 private _maxStakedAmount;

    /**
     *  @notice pendingClaimReward uint256 is time after request unstake for waiting.
     */
    uint256 public pendingClaimReward;

    /**
     *  @notice _stakeToken IERC20 is interface of staked token.
     */
    IERC20Upgradeable private _stakeToken;

    /**
     *  @notice _rewardToken IERC20 is interfacce of reward token.
     */
    IERC20Upgradeable private _rewardToken;

    /**
     *  @notice Mapping an address to a information of corresponding user address.
     */
    mapping(address => UserInfo) public users;

    event SetPendingClaimReward(uint256 oldValue, uint256 newValue);
    event SetRewardRate(uint256 indexed rate, uint256 indexed time);
    event SetMaxStakedAmount(uint256 indexed maxStakedAmount, uint256 indexed time);
    event SetDuration(uint256 indexed poolDuration, uint256 indexed time);
    event SetStartTime(uint256 indexed timeStart, uint256 indexed time);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawed(address indexed user, uint256 amount);
    event EmergencyWithdrawed(address indexed owner, address indexed token);
    event Claimed(
        address indexed user,
        uint256 indexed amount,
        uint256 indexed time
    );
    event RequestClaim(address indexed sender, uint256 indexed timestamp);

    /**
     *  @notice Initialize new logic contract.
     */
    function initialize(
        address owner_,
        IERC20Upgradeable stakeToken,
        IERC20Upgradeable rewardToken,
        uint256 timeStarted_,
        uint256 rewardRate_,
        uint256 poolDuration_,
        uint256 maxStakedAmount_
    ) public initializer {
        OwnableUpgradeable.__Ownable_init();
        __ReentrancyGuard_init();
        transferOwnership(owner_);
        _stakeToken = stakeToken;
        _rewardToken = rewardToken;
        _timeStarted = timeStarted_;
        _rewardRate = rewardRate_;
        _poolDuration = poolDuration_;
        _maxStakedAmount = maxStakedAmount_;
        pendingClaimReward = 1 days;
    }

    /**
     *  @notice Get start time of staking pool.
     */
    function getTimeStarted() public view returns (uint256) {
        return _timeStarted;
    }

    /**
     *  @notice Get pool duration.
     */
    function getPoolDuration() public view returns (uint256) {
        return _poolDuration;
    }

    /**
     *  @notice Get staked token.
     */
    function getStakeToken() public view returns (address) {
        return address(_stakeToken);
    }

    /**
     *  @notice Get staked amount of staking pool from all user.
     */
    function getStakedAmount() public view returns (uint256) {
        return _stakedAmount;
    }

    /**
     *  @notice Get max staked value.
     */
    function getMaxStakedAmount() public view returns (uint256) {
        return _maxStakedAmount;
    }

    /**
     *  @notice Get amount of deposited token of corresponding user address.
     */
    function getUserAmount(address user) public view returns (uint256) {
        return users[user].totalAmount;
    }

    /**
     *  @notice Get reward rate of staking pool.
     */
    function getRewardRate() public view returns (uint256) {
        return _rewardRate;
    }

    /**
     *  @notice Set reward rate of staking pool.
     *
     *  @dev    Only owner can call this function.
     */
    function setRewardRate(uint256 rewardRate) public onlyOwner {
        _rewardRate = rewardRate;
        emit SetRewardRate(rewardRate, block.timestamp);
    }

    /**
     *  @notice Set start time of staking pool.
     *
     *  @dev    Only owner can call this function.
     */
    function setStartTime(uint256 timeStarted) public onlyOwner {
        _timeStarted = timeStarted;
        emit SetStartTime(timeStarted, block.timestamp);
    }

    /**
     *  @notice Set pool duration.
     *
     *  @dev    Only owner can call this function.
     */
    function setPoolDuration(uint256 poolDuration) public onlyOwner {
        _poolDuration = poolDuration;
        emit SetDuration(poolDuration, block.timestamp);
    }

    /**
     *  @notice Set max staked token in staking pool.
     *
     *  @dev    Only owner can call this function.
     */
    function setMaxStakedAmount(uint256 maxStakedAmount) public onlyOwner {
         _maxStakedAmount = maxStakedAmount;
         emit SetMaxStakedAmount(_maxStakedAmount, block.timestamp);
    }

    /**
     *  @notice Set pending time for unstake from staking pool.
     *
     *  @dev    Only owner can call this function.
     */
    function setPendingClaimReward(uint256 _pendingTime) external onlyOwner {
        uint256 _oldPendingTime = pendingClaimReward;
        pendingClaimReward = _pendingTime;
        emit SetPendingClaimReward(_oldPendingTime, pendingClaimReward);
    }

    /**
     *  @notice Check a mount of pending reward in pool of corresponding user address.
     */
    function pendingRewards(address _user) public view returns (uint256) {
        UserInfo memory user = users[_user];
        if (_timeStarted <= block.timestamp) {
            uint256 amount = _calReward(user);
            amount = amount + user.pendingRewards;
            return amount;
        } else {
            return 0;
        }
    }

    /**
     *  @notice Deposit amount of token to staking pool.
     *
     *  @dev    Only member can call this function.
     */
    function stake(uint256 _amount) public nonReentrant {
        require(_amount > 0, "Invalid amount");
        require(
            _stakedAmount.add(_amount) <= _maxStakedAmount,
            "Staking: Max staking limit has been reached."
        );
        require(
            _timeStarted.add(_poolDuration) >= block.timestamp,
            "Staking: Staking has already ended."
        );

        UserInfo storage user = users[_msgSender()];
        if (user.totalAmount > 0) {
            if (_timeStarted <= block.timestamp) {
                uint256 pending = _calReward(user);
                if (pending > 0) {
                    user.pendingRewards = user.pendingRewards + pending;
                }
            }
        }
        user.lastClaim = block.timestamp;
        
        user.totalAmount = user.totalAmount.add(_amount);
        _stakedAmount = _stakedAmount.add(_amount);
        _stakeToken.safeTransferFrom(_msgSender(), address(this), _amount);
        user.indexLength = user.indexLength.add(1);
        user.userHistory.push(UserHistory(user.totalAmount, block.timestamp));

        emit Deposited(_msgSender(), _amount);
    }

    /**
     *  @notice Request claim before unstake activity
     */
    function requestClaim() external {
        require(_timeStarted > 0 && _timeStarted < block.timestamp, "Pool is not start !");
        UserInfo storage user = users[_msgSender()];
        require(!user.lazyClaimReward.isRequested, "Requested !");
        require(user.lastClaim <= _timeStarted.add(_poolDuration), "Nothing to claim !");

        user.lazyClaimReward.isRequested = true;
        user.lazyClaimReward.unlockedTime = block.timestamp + pendingClaimReward;
        emit RequestClaim(_msgSender(), block.timestamp);
    }

    /**
     *  @notice Claim all reward in pool.
     */
    function claim() external nonReentrant {
        UserInfo storage user = users[_msgSender()];
        require(
            user.lazyClaimReward.isRequested &&
                user.lazyClaimReward.unlockedTime <= block.timestamp,
            "Please request and can claim after 24 hours"
        );
        require(user.totalAmount > 0, "Reward value equal to zero");
        user.lazyClaimReward.isRequested = false;

        if (_timeStarted <= block.timestamp) {
            uint256 pending = pendingRewards(_msgSender());
            if (pending > 0) {
                user.pendingRewards = 0;
                _rewardToken.safeTransfer(_msgSender(), pending);
            }
            emit Claimed(_msgSender(), pending, block.timestamp);
        }

        user.lastClaim = block.timestamp;
        user.indexLength = user.indexLength.add(1);
        user.userHistory.push(
            UserHistory(user.totalAmount, block.timestamp)
        );
    }

    /**
     *  @notice Withdraw amount of rewards caller request.
     */
    function unstake(uint256 _amount) public nonReentrant {
        require(
            _timeStarted.add(_poolDuration) <= block.timestamp,
            "Staking: StakingPool has not expired yet.."
        );

        UserInfo storage user = users[_msgSender()];
        if (user.totalAmount > 0) {
            if (_timeStarted <= block.timestamp) {
                uint256 pending = pendingRewards(_msgSender());
                if (pending > 0) {
                    user.pendingRewards = 0;
                    _rewardToken.safeTransfer(_msgSender(), pending);
                }
            }
        }

        user.lazyClaimReward.isRequested = false;
        user.lastClaim = block.timestamp;
        if (_amount > 0) {
            require(
                user.totalAmount >= _amount,
                "Staking: Cannot unstake more than staked amount."
            );

            user.totalAmount = user.totalAmount.sub(_amount);
            _stakedAmount = _stakedAmount.sub(_amount);
            _stakeToken.safeTransfer(_msgSender(), _amount);
            user.indexLength = user.indexLength.add(1);
            user.userHistory.push(UserHistory(user.totalAmount, block.timestamp));
        }

        emit Withdrawed(_msgSender(), _amount);
    }

    /**
     *  @notice Admin can withdraw excess cash back.
     *
     *  @dev    Only admin can call this function.
     */
    function emergencyWithdraw() public onlyOwner nonReentrant {
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

        emit EmergencyWithdrawed(
            _msgSender(),
            address(_rewardToken)
        );
    }

    /**
     *  @notice Return minimun value betwween two params.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a < b) return a;
        else return b;
    }

    /**
     *  @notice Return a pending amount of reward token.
     */
    function _calReward(UserInfo memory user) private view returns (uint256) {
        uint256 minTime = min(block.timestamp, _timeStarted.add(_poolDuration));
        if (minTime < user.lastClaim) {
            return 0;
        }
        uint256 amount = user
            .totalAmount
            .mul(minTime.sub(user.lastClaim))
            .mul(_rewardRate)
            .div(1e18);
        return amount;
    }
}
