// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./libraries/Formula.sol";
import "./libraries/Config.sol";

interface ITToken {
    function stakeMint(address receiver, uint256 amount) external;
}

contract Staking is Ownable, ReentrancyGuard  {
    using SafeERC20 for IERC20;

    enum PoolType {
        POOL1,
        POOL2,
        POOL3
    }

    struct UserInfo {
        uint256 lastAction;
        uint256 originValue;
        uint256 value;
    }

    struct StakeInfo {
        uint256 duration;
        uint256 apy;
        uint256 rootData;
    }

    IERC20 public tge;
    IERC721 public memberCard;

    mapping(address => mapping(PoolType => UserInfo)) public valueStake;
    mapping(PoolType => StakeInfo) public stakeInfo;

    constructor(IERC20 _tge, IERC721 _memberCard) {
        tge = _tge;
        memberCard = _memberCard;
        stakeInfo[PoolType.POOL1] = StakeInfo(30, 100, Constant.ROOT_30);
        stakeInfo[PoolType.POOL2] = StakeInfo(45, 200, Constant.ROOT_45);
        stakeInfo[PoolType.POOL3] = StakeInfo(60, 300, Constant.ROOT_60);
    }

    event Deposit(PoolType poolType, uint256 indexed amount);

    /// @notice deposit amount of TGE tokens to Staking Pool
    /// @dev    this method can called by anyone
    /// @param  _poolType pool type of staking
    /// @param  _amount  amount of the tokens to be staked
    function deposit(PoolType _poolType, uint256 _amount) external {
        require(memberCard.balanceOf(_msgSender()) > 0, "Must have MemberCard");
        tge.safeTransferFrom(_msgSender(), address(this), _amount);

        UserInfo storage tmpInfo = valueStake[_msgSender()][_poolType];

        if (tmpInfo.originValue == 0) {
            tmpInfo.value = _amount;
        } else {
            uint256 accAmount = calAccumulatedStakeAmount(_poolType, _msgSender());
            tmpInfo.value = accAmount + _amount;
        }

        tmpInfo.originValue += _amount;
        tmpInfo.lastAction = block.timestamp; // solhint-disable-line not-rely-on-time
        emit Deposit(_poolType, _amount);
    }

    event Withdraw(PoolType poolType);
    event Reward(uint256 reward);

    /// @notice withdraw amount of TGE tokens from Staking Pool
    /// @dev    This method can called by anyone
    /// @param  _poolType pool type of staking
    function withdraw(PoolType _poolType) external nonReentrant {
        UserInfo storage tmpInfo = valueStake[_msgSender()][_poolType];
        require(tmpInfo.originValue > 0, "Nothing to withdraw");

        uint256 accAmount = calAccumulatedStakeAmount(_poolType, _msgSender());
        tge.safeTransfer(_msgSender(), tmpInfo.originValue);

        uint256 reward = accAmount - tmpInfo.originValue * Constant.FIXED_POINT;
        ITToken(address(tge)).stakeMint(
            _msgSender(),
            reward / Constant.FIXED_POINT
        );

        tmpInfo.value = 0;
        tmpInfo.originValue = 0;
        tmpInfo.lastAction = block.timestamp; // solhint-disable-line not-rely-on-time
        emit Reward(reward);
        emit Withdraw(_poolType);
    }

    function calAccumulatedStakeAmount(PoolType _poolType, address _account)
        public
        view
        returns (uint256 accAmount)
    {
        UserInfo storage tmpInfo = valueStake[_account][_poolType];
        uint256 tmpDay = (block.timestamp - tmpInfo.lastAction) / 1 days; // solhint-disable-line not-rely-on-time
        tmpDay = tmpDay > stakeInfo[_poolType].duration
            ? stakeInfo[_poolType].duration
            : tmpDay;
        accAmount =
            Formula.pow(stakeInfo[_poolType].rootData, tmpDay) *
            tmpInfo.value;
    }
}
