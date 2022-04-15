// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

interface INewNFT {
    enum Category { NOVICE_FIGHTER, ACCOMPLISHED_GENERAL, POWERFUL_LEADER }
    struct Card {
        Category category;
        uint256 expireTime;
    }
    function getExpireTime(uint256 tokenId) external view returns(uint256);
    function getCategory(uint256 tokenId) external view returns(Category);
    function getCard(uint256 tokenId) external view returns(Card memory);
    function isActive(uint256 tokenId) external view returns(bool);
    function getPrice(Category category) external pure returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
}

contract StakingPool is Initializable, ReentrancyGuardUpgradeable, PausableUpgradeable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMathUpgradeable for uint256;
    using AddressUpgradeable for address;

    enum Category { NOVICE_FIGHTER, ACCOMPLISHED_GENERAL, POWERFUL_LEADER }
    enum Duration { THREE_MONTHS, SIX_MONTHS, NINE_MONTHS, TWELVES_MONTHS }

    struct UserHistory {
        uint256 amount;
        uint256 timestamp;
    }
    struct Pool {
        Duration duration;
        uint256 amount;
        uint256 availableRewards;
        uint256 lastClaim;
    }
    struct UserInfo {
        uint256 totalAmount;
        Pool[4] pools;
        UserHistory[] userHistories;
    }

    uint256 public constant POWERFUL_LEADER_RATE = 25367833587;
    uint256 public constant ACCOMPLISHED_GENERAL_RATE = 19025875190;
    uint256 public constant NOVICE_FIGHTER_RATE = 12683916793;
    uint256 public constant DEFAULT_RATE = 6341958396;

    mapping(address => UserInfo) public userInfos;

    IERC20Upgradeable private _stakeToken;
    IERC20Upgradeable private _rewardToken; 

    uint256 public _timeStarted;
    uint256 public _maxStakedAmount;
    uint256 public _stakedAmount;
    address public NFTCard;

    event Deposited(address user, uint256 amount, Duration duration);
    event Withdrawed(address user, uint256 amount, Duration duration);
    event EmergencyWithdrawed(address owner, address token);

    function initialize(
        address owner_,
        IERC20Upgradeable stakeToken,
        IERC20Upgradeable rewardToken,
        address _NFTCard,
        uint256 timeStarted
    ) public initializer {
        OwnableUpgradeable.__Ownable_init();
        transferOwnership(owner_);

        NFTCard = _NFTCard;

        _stakeToken = stakeToken;
        _rewardToken = rewardToken;

        _timeStarted = timeStarted;
        _maxStakedAmount = 40000000 * 1e18;
    }
  
    function getStakeToken() public view returns (address) {
        return address(_stakeToken);
    }

    function getRewardToken() public view returns (address) {
        return address(_rewardToken);
    }

    function getUserAmount(address user, Duration duration ) public view returns (uint256) {
        return userInfos[user].pools[uint256(duration)].amount;
    }

    function getUserAvailableReward(address _user, Duration _duration ) public view returns (uint256) {
        return userInfos[_user].pools[uint256(_duration)].availableRewards;
    }

    function getRewardRate(uint256 category) public pure returns (uint256) {
        if (category == uint256(Category.NOVICE_FIGHTER)) {
            return NOVICE_FIGHTER_RATE;
        }

        if (category == uint256(Category.ACCOMPLISHED_GENERAL)) {
            return ACCOMPLISHED_GENERAL_RATE;
        }

        if (category == uint256(Category.POWERFUL_LEADER)) {
            return POWERFUL_LEADER_RATE;  
        } 
        
        return DEFAULT_RATE;
    }

    function getDuration(Duration duration) public pure returns (uint256) {
        if (duration == Duration.THREE_MONTHS) {
            return 90 days;
        }

        if (duration == Duration.SIX_MONTHS) {
            return 180 days;
        }

        if (duration == Duration.NINE_MONTHS) {
            return 270 days;  
        } 
        
        return 365 days;
    }

    function getRealityRate(address _user, Duration duration) public view returns(uint256) {
       
        return getRewardRate(getCategoryNFT(_user)).mul((uint256(duration).add(1))).div(4);   
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a < b) return a;
        else return b;
    }

    function hasNFT(address _user) public view returns (uint256) {
        bool isActive;
        uint256 tokenId;
        uint256 isOwnedNFT = INewNFT(NFTCard).balanceOf(_user);
        
        if(isOwnedNFT > 0) {
            tokenId = INewNFT(NFTCard).tokenOfOwnerByIndex(_user, 0);
            isActive = INewNFT(NFTCard).isActive(tokenId);
        }
       
        return (isActive && isOwnedNFT > 0) ? tokenId: 0;
    }

    function getCategoryNFT(address _user) public view returns (uint256) {
        if (hasNFT(_user) > 0) {  
            INewNFT.Category category = INewNFT(NFTCard).getCategory(hasNFT(_user));
            return uint256(category);
        }
       return 3;  
    }

    function _calReward(address _user, Duration _duration) public view returns (uint256) {
        UserInfo memory user = userInfos[_user];
        uint256 minTime = min(block.timestamp, _timeStarted.add(getDuration(_duration)));
        if (minTime < user.pools[uint256(_duration)].lastClaim) {
            return 0;
        }
        uint256 amount = user.pools[uint256(_duration)]
            .amount
            .mul(minTime.sub(user.pools[uint256(_duration)].lastClaim))
            .mul(getRealityRate(_user, _duration))
            .div(1e18);
        return amount;
    }

    function pendingRewards(address _user, Duration _duration) public view returns (uint256) {
        UserInfo memory user = userInfos[_user];
        if (_timeStarted <= block.timestamp) {
            uint256 amount = _calReward(_user, _duration);
            amount = amount + user.pools[uint256(_duration)].availableRewards;
            return amount;
        } else {
            return 0;
        }
    }

    function deposit(uint256 _amount, Duration _duration) public nonReentrant {
        UserInfo storage user = userInfos[_msgSender()];
        user.pools[uint256(_duration)].duration = _duration;

        if (user.pools[uint256(_duration)].amount > 0) {
            if (_timeStarted <= block.timestamp) {
                uint256 pending = _calReward(_msgSender(), _duration);
                if (pending > 0) {
                    user.pools[uint256(_duration)].availableRewards = user.pools[uint256(_duration)].availableRewards.add(pending);
                }
            }
        }
        user.pools[uint256(_duration)].lastClaim = block.timestamp;
        if (_amount > 0) {
            require(
                _stakedAmount.add(_amount) <= _maxStakedAmount,
                "Staking: Max staking limit has been reached."
            );
            require(
                _timeStarted.add(getDuration(user.pools[uint256(_duration)].duration)) >= block.timestamp,
                "Staking: Staking has already ended."
            );
            user.pools[uint256(_duration)].amount = (user.pools[uint256(_duration)].amount).add(_amount);
            _stakedAmount = _stakedAmount.add(_amount);
             user.totalAmount = user.totalAmount.add(_amount);
            _stakeToken.safeTransferFrom(_msgSender(), address(this), _amount);

            user.userHistories.push(UserHistory(user.pools[uint256(_duration)].amount, block.timestamp));
        }

        emit Deposited(_msgSender(), _amount, _duration);
    }

    function withdraw(uint256 _amount, Duration _duration) public nonReentrant {
        UserInfo storage user = userInfos[_msgSender()];
        require(
            _timeStarted.add(getDuration(user.pools[uint256(_duration)].duration)) <= block.timestamp,
            "Staking: StakingPool has not expired yet.."
        );

        if (user.pools[uint256(_duration)].amount > 0) {
            if (_timeStarted <= block.timestamp) {
                uint256 pending = pendingRewards(_msgSender(), _duration);
               
                pending = pending + user.pools[uint256(_duration)].availableRewards;
                if (pending > 0) {
                    user.pools[uint256(_duration)].availableRewards = 0;
                    _rewardToken.safeTransfer(_msgSender(), pending);
                }
            }
        }

        user.pools[uint256(_duration)].lastClaim = block.timestamp;
        if (_amount > 0) {
            require(
                user.pools[uint256(_duration)].amount >= _amount,
                "Staking: Cannot unstake more than staked amount."
            );

            user.pools[uint256(_duration)].amount = user.pools[uint256(_duration)].amount.sub(_amount);
            _stakedAmount = _stakedAmount.sub(_amount);
            user.totalAmount = user.totalAmount.sub(_amount);
            _stakeToken.safeTransfer(_msgSender(), _amount);
      
            user.userHistories.push(UserHistory(user.pools[uint256(_duration)].amount, block.timestamp));
        }

        emit Withdrawed(_msgSender(), _amount, _duration);
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

        emit EmergencyWithdrawed(_msgSender(), address(_rewardToken));
    }

    
}
