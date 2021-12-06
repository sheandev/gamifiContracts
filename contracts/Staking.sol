// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "hardhat/console.sol";

import "./libraries/Formula.sol";
import "./libraries/Config.sol";

interface ITToken {
    function stakeMint(address receiver, uint256 amount) external;
}

contract Staking is Ownable {
    enum PoolStake {
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

    mapping(address => mapping(PoolStake => UserInfo)) public valueStake;
    mapping(PoolStake => StakeInfo) public stakeInfo;

    event Deposit(PoolStake poolInfo, uint256 indexed amount);
    event Withdraw(PoolStake poolInfo);

    constructor(IERC20 _tge, IERC721 _memberCard) {
        tge = _tge;
        memberCard = _memberCard;
        stakeInfo[PoolStake.POOL1] = StakeInfo(30, 100, Constant.ROOT_30);
        stakeInfo[PoolStake.POOL2] = StakeInfo(45, 200, Constant.ROOT_45);
        stakeInfo[PoolStake.POOL3] = StakeInfo(60, 300, Constant.ROOT_60);
    }

    function deposit(PoolStake poolInfo, uint256 amount) external {
        require(memberCard.balanceOf(_msgSender()) > 0, "Must have MemberCard");
        tge.transferFrom(_msgSender(), address(this), amount);
        
        UserInfo storage tmpInfo = valueStake[_msgSender()][poolInfo];

        uint256 profit = calProfit(poolInfo, _msgSender());
        tmpInfo.value = profit + amount;
        tmpInfo.originValue += amount;
        tmpInfo.lastAction = block.timestamp;
        emit Deposit(poolInfo, amount);
    }

    function withdraw(PoolStake poolInfo) external {
        UserInfo storage tmpInfo = valueStake[_msgSender()][poolInfo];
        require(tmpInfo.originValue > 0, "Nothing to withdraw");

        uint256 profit = calProfit(poolInfo, _msgSender());
        tge.transfer(_msgSender(), tmpInfo.originValue);
        uint256 reward = profit - tmpInfo.originValue * 10**19;
        ITToken(address(tge)).stakeMint(_msgSender(), reward / (10**19));
        console.log("Mint value ", reward / (10**19));
        tmpInfo.value = 0;
        tmpInfo.originValue = 0;
        tmpInfo.lastAction = block.timestamp;
        emit Withdraw(poolInfo);
    }

    function calProfit(PoolStake poolInfo, address user)
        public
        view
        returns (uint256 profit)
    {
        UserInfo storage tmpInfo = valueStake[user][poolInfo];
        uint256 tmpDay = (block.timestamp - tmpInfo.lastAction) / 1 days;
        tmpDay = tmpDay > stakeInfo[poolInfo].duration
            ? stakeInfo[poolInfo].duration
            : tmpDay;
        profit =
            Formula.powBySquare18(stakeInfo[poolInfo].rootData, tmpDay) *
            tmpInfo.value;
        console.log(profit);
    }
}
