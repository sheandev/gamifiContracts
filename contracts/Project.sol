// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./libraries/Formula.sol";
import "./libraries/Config.sol";
import "hardhat/console.sol";

contract Project is Ownable {
    struct UserInfo {
        bool isCompletedCampaign;
        bool isAddedWhitelist;
        bool isClaimedBack;
        uint256 stakedAmount;
        uint256 fundedAmount;
        uint256 tokenAllocationAmount;
    }

    struct ProjectInfo {
        uint256 id;
        address tokenAddress;
        uint256 allocationSize;
        uint256 estimateTokenAllocationRate;

        // Staking
        uint256 stakingStartBlockNumber;
        uint256 stakingEndBlockNumber;
        uint256 stakingLimitAmount;
        uint256 stakedTotalAmount;
        address[] stakedAccounts;

        // Funding
        uint256 fundingStartBlockNumber;
        uint256 fundingEndBlockNumber;
        uint256 fundingMinAllocation;
        uint256 fundingAllocationRate;
        uint256 fundingTotalAmount;
        address fundingReceiver;
        address[] fundingAccounts;
    }

    struct ObjectInfo {
        address objectAccount;
        uint256 objectAmount;
    }

    IERC20 public immutable gmi;
    IERC20 public immutable busd;

    uint256 public latestProjectId;
    uint256[] public projectIds;

    // projectId => project info
    mapping(uint256 => ProjectInfo) public projects;

    // projectId => account address => user info
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    event CreateProject(ProjectInfo project);
    event SetAllocationSize(uint256 indexed _projectId, uint256 allocationSize);
    event SetEstimateTokenAllocationRate(uint256 indexed _projectId, uint256 estimateTokenAllocationRate);
    event SetStakingBlockNumber(uint256 indexed projectId, uint256 blockStart, uint256 blockEnd);
    event SetStakingLimitAmount(uint256 indexed projectId, uint256 stakingLimitAmount);
    event SetFundingBlockNumber(uint256 indexed projectId, uint256 blockStart, uint256 blockEnd);
    event SetFundingMinAllocation(uint256 indexed projectId, uint256 minAllocation);
    event SetFundingAllocationRate(uint256 indexed projectId, uint256 fundingAllocationRate);
    event SetFundingReceiver(uint256 indexed projectId, address fundingReceiver);
    event Stake(address account, uint256 indexed projectId, uint256 indexed amount);
    event ClaimBack(address account, uint256 indexed projectId, uint256 indexed amount);
    event AddToCompletedCampaignList(uint256 indexed projectId, address[] accounts);
    event RemovedFromCompletedCampaignList(uint256 indexed projectId, address indexed account);
    event AddedToWhitelist(uint256 indexed projectId, address[] accounts);
    event RemovedFromWhitelist(uint256 indexed projectId, address indexed account);
    event Funding(address account, uint256 indexed projectId, uint256 indexed amount, uint256 tokenAllocationAmount);
    event WithdrawFunding(address account, uint256 indexed projectId, uint256 indexed amount);

    constructor(IERC20 _gmi, IERC20 _busd) {
        gmi = _gmi;
        busd = _busd;
    }

    modifier validProject(uint256 _projectId) {
        require(projects[_projectId].id != 0 && projects[_projectId].id <= latestProjectId, "Invalid project id");
        _; 
    }

    function createProject(
        address _tokenAddress,
        uint256 _allocationSize,
        uint256 _estimateTokenAllocationRate,
        uint256 _stakingStartBlockNumber,
        uint256 _stakingEndBlockNumber,
        uint256 _stakingLimitAmount,
        uint256 _fundingStartBlockNumber,
        uint256 _fundingEndBlockNumber,
        uint256 _fundingMinAllocation,
        uint256 _fundingAllocationRate,
        address _fundingReceiver
    ) external onlyOwner {
        require(_stakingStartBlockNumber > block.number
             && _stakingStartBlockNumber < _stakingEndBlockNumber
             && _fundingStartBlockNumber > _stakingEndBlockNumber
             && _fundingStartBlockNumber < _fundingEndBlockNumber, "Invalid block number");

        latestProjectId++;
        ProjectInfo memory project;
        project.id = latestProjectId;
        project.tokenAddress = _tokenAddress;
        project.allocationSize = _allocationSize;
        project.estimateTokenAllocationRate = _estimateTokenAllocationRate;
        project.stakingStartBlockNumber = _stakingStartBlockNumber;
        project.stakingEndBlockNumber = _stakingEndBlockNumber;
        project.stakingLimitAmount = _stakingLimitAmount;
        project.fundingStartBlockNumber = _fundingStartBlockNumber;
        project.fundingEndBlockNumber = _fundingEndBlockNumber;
        project.fundingMinAllocation = _fundingMinAllocation;
        project.fundingAllocationRate = _fundingAllocationRate;
        project.fundingReceiver = _fundingReceiver;

        projects[latestProjectId] = project;
        projectIds.push(latestProjectId);
        emit CreateProject(project);
    }

    function setAllocationSize(uint256 _projectId, uint256 _allocationSize) external onlyOwner validProject(_projectId) {
        require(_allocationSize > 0, "Invalid project allocation size");

        projects[_projectId].allocationSize = _allocationSize;
        emit SetAllocationSize(_projectId, _allocationSize);
    }

    function setEstimateTokenAllocationRate(uint256 _projectId, uint256 _estimateTokenAllocationRate) external onlyOwner validProject(_projectId) {
        require(_estimateTokenAllocationRate > 0, "Invalid project estimate token allocation rate");

        projects[_projectId].estimateTokenAllocationRate = _estimateTokenAllocationRate;
        emit SetEstimateTokenAllocationRate(_projectId, _estimateTokenAllocationRate);
    }

    function setStakingBlockNumber(uint256 _projectId, uint256 _blockStart, uint256 _blockEnd) external onlyOwner validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(_blockStart > block.number 
             && _blockStart < _blockEnd
             && _blockEnd   < project.fundingStartBlockNumber, "Invalid block number");

        project.stakingStartBlockNumber = _blockStart;
        project.stakingEndBlockNumber = _blockEnd;
        emit SetStakingBlockNumber(_projectId, _blockStart, _blockEnd);
    }

    function setStakingLimitAmount(uint256 _projectId, uint256 _stakingLimitAmount) external onlyOwner validProject(_projectId) {
        require(_stakingLimitAmount > 0, "Invalid limit of stake amount");

        projects[_projectId].stakingLimitAmount = _stakingLimitAmount;
        emit SetStakingLimitAmount(_projectId, _stakingLimitAmount);
    }

    function setFundingBlockNumber(uint256 _projectId, uint256 _blockStart, uint256 _blockEnd) external onlyOwner validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(_blockStart > block.number
             && _blockStart < _blockEnd
             && _blockStart > project.stakingEndBlockNumber, "Invalid block number");

        project.fundingStartBlockNumber = _blockStart;
        project.fundingEndBlockNumber = _blockEnd;
        emit SetFundingBlockNumber(_projectId, _blockStart, _blockEnd);
    }

    function setFundingMinAllocation(uint256 _projectId, uint256 _minAllocation) external onlyOwner validProject(_projectId) {
        require(_minAllocation > 0, "Invalid project funding min allocation");

        projects[_projectId].fundingMinAllocation = _minAllocation;
        emit SetFundingMinAllocation(_projectId, _minAllocation);
    }

    function setFundingAllocationRate(uint256 _projectId, uint256 _fundingAllocationRate) external onlyOwner validProject(_projectId) {
        require(_fundingAllocationRate > 0, "Invalid project funding allocation rate");

        projects[_projectId].fundingAllocationRate = _fundingAllocationRate;
        emit SetFundingAllocationRate(_projectId, _fundingAllocationRate);
    }

    function setFundingReceiver(uint256 _projectId, address _fundingReceiver) external onlyOwner validProject(_projectId) {
        require(_fundingReceiver != address(0), "Invalid funding receiver");

        projects[_projectId].fundingReceiver = _fundingReceiver;
        emit SetFundingReceiver(_projectId, _fundingReceiver);
    }

    /// @notice stake amount of GMI tokens to Staking Pool
    /// @dev    this method can called by anyone
    /// @param  _projectId  id of the project
    /// @param  _amount  amount of the tokens to be staked
    function stake(uint256 _projectId, uint256 _amount) external validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(block.number >= project.stakingStartBlockNumber, "Staking has not started yet");
        require(block.number <= project.stakingEndBlockNumber, "Staking has ended");

        require(isCompletedCampaign(_projectId, _msgSender()), "User is not complete gleam campaign");
        require(_amount > 0, "Invalid stake amount");
        require(_amount <= project.stakingLimitAmount, "Amount exceed limit stake amount");

        gmi.transferFrom(_msgSender(), address(this), _amount);

        UserInfo storage user = userInfo[_projectId][_msgSender()];

        if (user.stakedAmount == 0) {
            project.stakedAccounts.push(_msgSender());
        }
        project.stakedTotalAmount += _amount;
        user.stakedAmount += _amount;

        emit Stake(_msgSender(), _projectId, _amount);
    }

    /// @notice claimBack amount of GMI tokens from staked GMI before
    /// @dev    This method can called by anyone
    /// @param  _projectId  id of the project
    function claimBack(uint256 _projectId) external validProject(_projectId) {
        ProjectInfo memory project = projects[_projectId];
        require(block.number >= project.fundingEndBlockNumber, "It is not the time to claim back token");

        UserInfo storage user = userInfo[_projectId][_msgSender()];
        uint256 claimableAmount = user.stakedAmount;
        require(claimableAmount > 0, "Nothing to claim back");

        user.isClaimedBack = true;
        gmi.transfer(_msgSender(), claimableAmount);

        emit ClaimBack(_msgSender(), _projectId, claimableAmount);
    }

    function addCompletedCampaignList(uint256 _projectId, address[] memory _accounts) external onlyOwner validProject(_projectId) {
        for (uint256 i = 0; i < _accounts.length; i++) { 
            address account = _accounts[i];
            require(account != address(0), "Invalid account");

            UserInfo storage user = userInfo[_projectId][account];
            user.isCompletedCampaign = true;
        }
        emit AddToCompletedCampaignList(_projectId, _accounts);
    }

    function removedFromCompletedCampaignList(uint256 _projectId, address _account) public onlyOwner validProject(_projectId) {
        userInfo[_projectId][_account].isCompletedCampaign = false;
        emit RemovedFromCompletedCampaignList(_projectId, _account);
    }

    function addWhitelist(uint256 _projectId, address[] memory _accounts) external onlyOwner validProject(_projectId) {
        for (uint256 i = 0; i < _accounts.length; i++) {
            address account = _accounts[i];
            require(account != address(0), "Invalid account");

            UserInfo storage user = userInfo[_projectId][account];
            require(user.stakedAmount > 0, "Account did not stake");

            user.isAddedWhitelist = true;
        }
        emit AddedToWhitelist(_projectId, _accounts);
    }

    function removeFromWhitelist(uint256 _projectId, address _account) public onlyOwner validProject(_projectId) {
        userInfo[_projectId][_account].isAddedWhitelist = false;
        emit RemovedFromWhitelist(_projectId, _account);
    }

    /// @notice fund amount of USD to funding
    /// @dev    this method can called by anyone
    /// @param  _projectId  id of the project
    /// @param  _amount  amount of the tokens to be staked
    function funding(uint256 _projectId, uint256 _amount) external validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(block.number >= project.fundingStartBlockNumber, "Funding has not started yet");
        require(block.number <= project.fundingEndBlockNumber, "Funding has ended");

        require(isAddedWhitelist(_projectId, _msgSender()), "User is not in whitelist");
        require(_amount >= project.fundingMinAllocation, "Amount must be greater than min allocation");

        uint256 fundingMaxAllocation = getFundingMaxAllocation(_projectId, _msgSender());
        require(_amount > fundingMaxAllocation, "Amount exceed max allocation");

        busd.transferFrom(_msgSender(), address(this), _amount);

        uint256 tokenAllocationAmount = estimateTokenAllocation(_projectId, _amount);
        UserInfo storage user = userInfo[_projectId][_msgSender()];
        user.fundedAmount += _amount;
        user.tokenAllocationAmount += tokenAllocationAmount;

        emit Funding(_msgSender(), _projectId, _amount, tokenAllocationAmount);
    }

    /// @notice receive amount USD from contract
    /// @dev    this method can called by owner
    /// @param  _projectId  id of the project
    function withdrawFunding(uint256 _projectId) external onlyOwner validProject(_projectId) {
        ProjectInfo memory project = projects[_projectId];
        require(block.number > project.fundingEndBlockNumber, "Funding has not ended yet");
        require(project.fundingReceiver != address(0), "Funding receive address is not set");

        uint256 _amount = project.fundingTotalAmount;
        require(_amount > 0, "Not enought amount");
        busd.transferFrom(address(this), project.fundingReceiver, _amount);

        project.fundingTotalAmount = 0;

        emit WithdrawFunding(project.fundingReceiver, _projectId, _amount);
    }

    function getProjectInfo(uint256 _projectId) public validProject(_projectId) view returns (ProjectInfo memory result) {
        result = projects[_projectId];
    }

    function getUserInfo(uint256 _projectId, address _account) public view returns (UserInfo memory result) {
        result = userInfo[_projectId][_account];
    }

    function isCompletedCampaign(uint256 _projectId, address _account) public view returns (bool) {
        return userInfo[_projectId][_account].isCompletedCampaign;
    }

    function isAddedWhitelist(uint256 _projectId, address _account) public view returns (bool) {
        return userInfo[_projectId][_account].isAddedWhitelist;
    }

    function getFundingMaxAllocation(uint256 _projectId, address _account) public view returns(uint256) {
        UserInfo memory user = userInfo[_projectId][_account];
        uint256 stakedAmount = user.stakedAmount;
        if (stakedAmount == 0) return 0;

        ProjectInfo memory project = projects[_projectId];
        uint256 allocationSize = project.allocationSize;

        uint256 maxAllocationAmount = Formula.mulDiv(stakedAmount, Formula.SCALE, project.fundingAllocationRate);
        if (maxAllocationAmount > allocationSize) {
            return allocationSize;
        }

        return maxAllocationAmount;
    }

    function estimateTokenAllocation(uint256 _projectId, uint256 _fundingAmount) public view returns (uint256) {
        ProjectInfo memory project = projects[_projectId];
        return Formula.mulDiv(_fundingAmount, Formula.SCALE, project.estimateTokenAllocationRate);
    }
}
