// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./libraries/Formula.sol";
import "./libraries/Config.sol";

interface ITToken {
    function stakeMint(address receiver, uint256 amount) external;
}

contract Project is Ownable {
    struct UserInfo {
        uint256 lastAction;
        uint256 originValue;
        uint256 value;
        bool isWhiteList;
    }

    struct ProjectInfo {
        uint256 id;
        address token;
        uint256 startStakingTime;
        uint256 endStakingTime;
        uint256 startFundingTime;
        uint256 endFundingTime;
        uint256 totalAmountStake;
        uint256 minAllocation;
        uint256 maxAllocation;
    } 

    ProjectInfo[] public projects;

    IERC20 public gmi;
    IERC20 public busd;

    // estimate
    uint256 public ref;

    mapping(address => mapping(uint256 => UserInfo)) public userInfo;
    mapping(uint256 => ProjectInfo) public projectInfo;
    mapping(address => mapping(uint256 => bool)) public whiteList;

    constructor(
        IERC20 _gmi,
        IERC20 _busd
    ) {
        gmi = _gmi;
        busd = _busd;
    }

    modifier onlyWhitelisted(uint256 projectId) { 
        require(isWhitelisted(projectId, msg.sender)); 
        _; 
    }

    event Deposit(
        uint256 indexed amount,
        uint256 lastAction
    );

    /// @notice deposit amount of GMI tokens to Staking Pool
    /// @dev    this method can called by anyone
    /// @param  _projectId  id of the project
    /// @param  _amount  amount of the tokens to be staked
    function deposit(uint256 _projectId, uint256 _amount) external {
        require(_projectId > 0, "Invalid project id");
        require(_amount > 0, "Not enough amount");
        gmi.transferFrom(_msgSender(), address(this), _amount);

        UserInfo storage tmpInfo = userInfo[_msgSender()][_projectId];
        ProjectInfo storage pjInfo = projectInfo[_projectId];

        if (tmpInfo.originValue == 0) {
            tmpInfo.value = _amount;
        } else {
            tmpInfo.value += _amount;
        }

        pjInfo.totalAmountStake += _amount;
        tmpInfo.originValue += _amount;
        tmpInfo.lastAction = block.timestamp; // solhint-disable-line not-rely-on-time
       
        emit Deposit(
            _amount,
            tmpInfo.lastAction
        );
    }

    event Withdraw(uint256 indexed projectId, uint256 indexed amount, uint256 lastAction);

    /// @notice withdraw amount of GMI tokens from Staking Pool
    /// @dev    This method can called by anyone
    /// @param  _projectId  id of the project
    function withdraw(uint256 _projectId) external {
        UserInfo storage tmpInfo = userInfo[_msgSender()][_projectId];
        ProjectInfo storage pjInfo = projectInfo[_projectId];
        require(pjInfo.endStakingTime < block.timestamp, "Not finished");

        uint256 _amount = tmpInfo.originValue;

        require(_amount > 0, "Nothing to withdraw");

        gmi.transfer(_msgSender(), _amount);

        tmpInfo.value = 0;
        tmpInfo.originValue = 0;
        tmpInfo.lastAction = block.timestamp; // solhint-disable-line not-rely-on-time

        emit Withdraw(_projectId, _amount, tmpInfo.lastAction);
    }

    event Funding(
        uint256 indexed projectId,
        uint256 indexed amount,
        uint256 lastAction
    );

    /// @notice deposit amount of GMI tokens to Staking Pool
    /// @dev    this method can called by anyone
    /// @param  _projectId  id of the project
    /// @param  _amount  amount of the tokens to be staked
    function funding(uint256 _projectId, uint256 _amount) external onlyWhitelisted(_projectId) {
        require(_amount > 0, "Not enough amount");
        busd.transferFrom(_msgSender(), address(this), _amount);

        uint256 tokenAmount = getEstimateTokenAllocation(_amount);

        UserInfo storage tmpInfo = userInfo[_msgSender()][_projectId];

        if (tmpInfo.originValue == 0) {
            tmpInfo.value = _amount;
        } else {
            tmpInfo.value += _amount;
        }

        tmpInfo.originValue += _amount;
        tmpInfo.lastAction = block.timestamp; // solhint-disable-line not-rely-on-time
        
        emit Funding(
            _projectId,
            _amount,
            tmpInfo.lastAction
        );
    }

    function getStakeUser(uint256 _projectId) public view returns (uint256) {
        UserInfo storage tmpInfo = userInfo[_msgSender()][_projectId];
        return tmpInfo.originValue;
    }

    function isWhitelisted(uint256 _projectId, address _address) public view returns(bool) { 
        return whiteList[_address][_projectId]; 
    }

    event AddedToWhitelist(uint256 indexed projectId, address[] _accounts); 
    function add(uint256 _projectId, address[] memory _accounts) public onlyOwner { 
        require(_projectId > 0, "Invalid project id");
        for (uint256 i = 0; i < _accounts.length; i++) { 
            address account = _accounts[i]; 
            require(account != address(0), "Invalid account provided"); 
            whiteList[account][_projectId] = true; 
        }
        emit AddedToWhitelist(_projectId, _accounts); 
    } 

    event RemovedFromWhitelist(uint256 indexed projectId, address indexed account);
    function remove(uint256 _projectId, address _address) public onlyOwner { 
        whiteList[_address][_projectId] = false; 
        emit RemovedFromWhitelist(_projectId, _address); 
    }

    function getEstimateTokenAllocation(uint256 _amount)
        public
        view
        returns (uint256)
    {
        require(_amount > 0, "");
        return SafeMath.mul(_amount, ref);
    }
}
