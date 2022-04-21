// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
*  @notice IMemberCard is interface of membercard token
*/
interface IMemberCard {
    function getMemberCardActive(uint256 tokenId) external view returns (bool);

    function consumeMembership(uint256 tokenId) external;

    function ownerOf(uint256 tokenId) external view returns (address);

    function isMember(address user) external view returns (bool);

    function balanceOf(address account) external view returns (uint256);
}

/**
 *  @title  Dev Staking Pool
 *
 *  @author Gamifi Team
 *
 *  @notice This smart contract is created for staking pool for user owning membercard can stake amount of token 
 *          to get with attractive reward. 
 *            - 225% APY only staking in 30 days from start day.
 *          The contract here by is implemented to create opportunities for users to drive project growth
 */
contract StakingNFT is Context, Initializable, ReentrancyGuard {
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

    /**
     *  @notice _owner address is address of owner.
     */
    address private _owner;

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
     *  @notice memberCard address is address of membercard token.
     */
    address private memberCard;
    
     /**
     *  @notice _stakeToken IERC20 is interface of staked token.
     */
    IERC20 private _stakeToken;

    /**
     *  @notice _rewardToken IERC20 is interfacce of reward token.
     */
    IERC20 private _rewardToken;

    /**
     *  @notice Mapping an address to a information of corresponding user address.
     */
    mapping(address => UserInfo) public userInfo;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event Deposited(address user, uint256 amount, uint256 timestamp);
    event Withdrawed(address user, uint256 amount, uint256 timestamp);
    event EmergencyWithdrawed(address owner, address token, uint256 timestamp);

    constructor() {}

    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    modifier onlyMember() {
        require(IMemberCard(memberCard).balanceOf(_msgSender()) > 0, "Ownable: caller is not the owner");
        _;
    }

    /**
     *  @notice Initialize new logic contract.
     */
    function initialize(
        address owner_,
        IERC20 stakeToken,
        IERC20 rewardToken,
        address _memberCard,
        uint256 timeStarted,
        uint256 rewardRate_,
        uint256 poolDuration_,
        uint256 maxStakedAmount_
    ) public initializer {
        _setOwner(owner_);
        memberCard = _memberCard;
        _stakeToken = stakeToken;
        _rewardToken = rewardToken;
        _timeStarted = timeStarted;
        _rewardRate = rewardRate_;
        _poolDuration = poolDuration_;
        _maxStakedAmount = maxStakedAmount_;
    }

    /**
     *  @notice Return current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     *  @notice Renounce ownership.
     *
     *  @dev    Only owner can call this function.
     */
    function renounceOwnership() public virtual onlyOwner {
        _setOwner(address(0));
    }

    /**
     *  @notice Transfer ownership for new owner.
     *
     *  @dev    Only owner can call this function.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(
            newOwner != address(0),
            "Ownable: new owner is the zero address"
        );
        _setOwner(newOwner);
    }

    /**
     *  @notice Replace old owner by new owner.
     */
    function _setOwner(address newOwner) private {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
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
        return userInfo[user].amount;
    }

    /**
     *  @notice Set reward rate of staking pool.
     *
     *  @dev    Only owner can call this function.
     */
    function setRewardRate(uint256 rewardRate) public onlyOwner {
        _rewardRate = rewardRate;
    }

    /**
     *  @notice Set start time of staking pool.
     *
     *  @dev    Only owner can call this function.
     */
    function setStartTime(uint256 timeStarted) public onlyOwner {
        _timeStarted = timeStarted;
    }

    /**
     *  @notice Set pool duration.
     *
     *  @dev    Only owner can call this function.
     */
    function setPoolDuration(uint256 poolDuration) public onlyOwner {
        _poolDuration = poolDuration;
    }

    /**
     *  @notice Check a mount of pending reward in pool of corresponding user address.
     */
    function pendingRewards(address _user) public view returns (uint256) {
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
    function deposit(uint256 _amount) public nonReentrant onlyMember {

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

        emit Deposited(_msgSender(), _amount, block.timestamp);
    }

    /**
     *  @notice Return minimun value betwween two params.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a < b) return a;
        else return b;
    }

    /**
     *  @notice Withdraw amount of rewards caller request.
     */
    function withdraw(uint256 _amount) public nonReentrant {
        require(
            _timeStarted.add(_poolDuration) <= block.timestamp,
            "Staking: StakingPool has not expired yet.."
        );
  
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

        emit Withdrawed(_msgSender(), _amount, block.timestamp);
    }

    /**
     *  @notice Admin can withdraw excess cash back.
     *
     *  @dev    Only admin can call this function.
     */
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

        emit EmergencyWithdrawed(_msgSender(), address(_rewardToken), block.timestamp);
    }
}
