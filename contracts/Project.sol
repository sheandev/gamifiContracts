// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./libraries/Formula.sol";
import "./libraries/Config.sol";

contract Project is Ownable {
    struct UserInfo {
        uint256 stakedAmount;
        uint256 fundedAmount;
        uint256 tokenAllocationAmount;
        bool isClaimedBack;
    }

    struct ProjectInfo {
        uint256 id;
        address tokenAddress;
        uint256 allocaltionSize;
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
    }

    IERC20 public gmi;
    IERC20 public busd;

    uint256 public latestProjectId;
    uint256[] public projectIds;

    // projectId => project info
    mapping(uint256 => ProjectInfo) public projects;

    // projectId => account address => user info
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    // projectId => account address => is in whitelist
    mapping(uint256 => mapping(address => bool)) public whiteLists;

    event CreateProject(ProjectInfo project);
    event SetAllocaltionSize(uint256 indexed _projectId, uint256 allocaltionSize);
    event SetEstimateTokenAllocationRate(uint256 indexed _projectId, uint256 estimateTokenAllocationRate);
    event SetStakingStartBlockNumber(uint256 indexed projectId, uint256 blockNumber);
    event SetStakingEndBlockNumber(uint256 indexed projectId, uint256 blockNumber);
    event SetStakingLimitAmount(uint256 indexed projectId, uint256 stakingLimitAmount);
    event SetFundingStartBlockNumber(uint256 indexed projectId, uint256 blockNumber);
    event SetFundingEndBlockNumber(uint256 indexed projectId, uint256 blockNumber);
    event SetFundingMinAllocation(uint256 indexed projectId, uint256 minAllocation);
    event SetFundingAllocationRate(uint256 indexed projectId, uint256 fundingAllocationRate);
    event Stake(address account, uint256 indexed projectId, uint256 indexed amount);
    event ClaimBack(address account, uint256 indexed projectId, uint256 indexed amount);
    event AddedToWhitelist(uint256 indexed projectId, address[] accounts);
    event RemovedFromWhitelist(uint256 indexed projectId, address indexed account);
    event Funding(address account, uint256 indexed projectId, uint256 indexed amount, uint256 tokenAllocationAmount);

    constructor(IERC20 _gmi, IERC20 _busd) {
        gmi = _gmi;
        busd = _busd;
    }

    modifier validProject(uint256 _projectId) {
        require(_projectId <= latestProjectId, "Invalid project id");
        _; 
    }

    function createProject(
        address _tokenAddress,
        uint256 _allocaltionSize,
        uint256 _estimateTokenAllocationRate,
        uint256 _stakingStartBlockNumber,
        uint256 _stakingEndBlockNumber,
        uint256 _stakingLimitAmount,
        uint256 _fundingStartBlockNumber,
        uint256 _fundingEndBlockNumber,
        uint256 _fundingMinAllocation,
        uint256 _fundingAllocationRate
    ) external onlyOwner {
        ProjectInfo memory project;
        project.id = latestProjectId;
        project.tokenAddress = _tokenAddress;
        project.allocaltionSize = _allocaltionSize;
        project.estimateTokenAllocationRate = _estimateTokenAllocationRate;
        project.stakingStartBlockNumber = _stakingStartBlockNumber;
        project.stakingEndBlockNumber = _stakingEndBlockNumber;
        project.stakingLimitAmount = _stakingLimitAmount;
        project.fundingStartBlockNumber = _fundingStartBlockNumber;
        project.fundingEndBlockNumber = _fundingEndBlockNumber;
        project.fundingMinAllocation = _fundingMinAllocation;
        project.fundingAllocationRate = _fundingAllocationRate;

        projects[latestProjectId] = project;
        projectIds.push(latestProjectId);
        latestProjectId++;
        emit CreateProject(project);
    }

    function setAllocaltionSize(uint256 _projectId, uint256 _allocaltionSize) external onlyOwner validProject(_projectId) {
        require(_allocaltionSize > 0, "Invalid project allocaltion size");

        projects[_projectId].allocaltionSize = _allocaltionSize;
        emit SetAllocaltionSize(_projectId, _allocaltionSize);
    }

    function setEstimateTokenAllocationRate(uint256 _projectId, uint256 _estimateTokenAllocationRate) external onlyOwner validProject(_projectId) {
        require(_estimateTokenAllocationRate > 0, "Invalid project estimate token allocaltion rate");

        projects[_projectId].estimateTokenAllocationRate = _estimateTokenAllocationRate;
        emit SetEstimateTokenAllocationRate(_projectId, _estimateTokenAllocationRate);
    }

    function setStakingStartBlockNumber(uint256 _projectId, uint256 _blockNumber) external onlyOwner validProject(_projectId) {
        require(_blockNumber > block.number, "Invalid block number");

        projects[_projectId].stakingStartBlockNumber = _blockNumber;
        emit SetStakingStartBlockNumber(_projectId, _blockNumber);
    }

    function setStakingEndBlockNumber(uint256 _projectId, uint256 _blockNumber) external onlyOwner validProject(_projectId) {
        require(_blockNumber > block.number, "Invalid block number");

        projects[_projectId].stakingEndBlockNumber = _blockNumber;
        emit SetStakingEndBlockNumber(_projectId, _blockNumber);
    }

    function setStakingLimitAmount(uint256 _projectId, uint256 _stakingLimitAmount) external onlyOwner validProject(_projectId) {
        require(_stakingLimitAmount > 0, "Invalid limit of stake amount");

        projects[_projectId].stakingLimitAmount = _stakingLimitAmount;
        emit SetStakingLimitAmount(_projectId, _stakingLimitAmount);
    }

    function setFundingStartBlockNumber(uint256 _projectId, uint256 _blockNumber) external onlyOwner validProject(_projectId) {
        require(_blockNumber > block.number, "Invalid block number");

        projects[_projectId].fundingStartBlockNumber = _blockNumber;
        emit SetFundingStartBlockNumber(_projectId, _blockNumber);
    }

    function setFundingEndBlockNumber(uint256 _projectId, uint256 _blockNumber) external onlyOwner validProject(_projectId) {
        require(_blockNumber > block.number, "Invalid block number");

        projects[_projectId].fundingEndBlockNumber = _blockNumber;
        emit SetFundingEndBlockNumber(_projectId, _blockNumber);
    }

    function setFundingMinAllocation(uint256 _projectId, uint256 _minAllocation) external onlyOwner validProject(_projectId) {
        require(_minAllocation > 0, "Invalid project funding min allocaltion");

        projects[_projectId].fundingMinAllocation = _minAllocation;
        emit SetFundingMinAllocation(_projectId, _minAllocation);
    }

    function setFundingAllocationRate(uint256 _projectId, uint256 _fundingAllocationRate) external onlyOwner validProject(_projectId) {
        require(_fundingAllocationRate > 0, "Invalid project funding allocaltion rate");

        projects[_projectId].fundingAllocationRate = _fundingAllocationRate;
        emit SetFundingAllocationRate(_projectId, _fundingAllocationRate);
    }

    /// @notice stake amount of GMI tokens to Staking Pool
    /// @dev    this method can called by anyone
    /// @param  _projectId  id of the project
    /// @param  _amount  amount of the tokens to be staked
    function stake(uint256 _projectId, uint256 _amount) external validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(block.number >= project.stakingStartBlockNumber, "Staking has not started yet");
        require(block.number <= project.stakingEndBlockNumber, "Staking has ended");
        require(_amount > 0, "Invalid stake amount");
        require(_amount <= project.stakingLimitAmount, "Amount exceed limit stake amount");

        gmi.transferFrom(_msgSender(), address(this), _amount);

        UserInfo memory tmpUserInfo = userInfo[_projectId][_msgSender()];

        if (tmpUserInfo.stakedAmount == 0) {
            project.stakedAccounts.push(_msgSender());
        }
        project.stakedTotalAmount += _amount;
        tmpUserInfo.stakedAmount += _amount;

        emit Stake(_msgSender(), _projectId, _amount);
    }

    /// @notice claimBack amount of GMI tokens from staked GMI before
    /// @dev    This method can called by anyone
    /// @param  _projectId  id of the project
    function claimBack(uint256 _projectId) external validProject(_projectId) {
        ProjectInfo memory project = projects[_projectId];
        require(block.number >= project.fundingEndBlockNumber, "It is not the time to claim back token");

        UserInfo storage tmpUserInfo = userInfo[_projectId][_msgSender()];
        uint256 claimableAmount = tmpUserInfo.stakedAmount;
        require(claimableAmount > 0, "Nothing to claim back");

        tmpUserInfo.isClaimedBack = true;
        gmi.transfer(_msgSender(), claimableAmount);

        emit ClaimBack(_msgSender(), _projectId, claimableAmount);
    }

    function addWhitelist(uint256 _projectId, address[] memory _accounts) external onlyOwner validProject(_projectId) {
        for (uint256 i = 0; i < _accounts.length; i++) { 
            address account = _accounts[i];

            require(account != address(0), "Invalid account");

            UserInfo memory tmpUserInfo = userInfo[_projectId][account];
            require(tmpUserInfo.stakedAmount > 0, "Account did not stake");

            whiteLists[_projectId][account] = true;
        }
        emit AddedToWhitelist(_projectId, _accounts);
    }

    function removeFromWhitelist(uint256 _projectId, address _account) public onlyOwner validProject(_projectId) {
        whiteLists[_projectId][_account] = false;
        emit RemovedFromWhitelist(_projectId, _account);
    }

    /// @notice fund amount of USD to funding
    /// @dev    this method can called by anyone
    /// @param  _projectId  id of the project
    /// @param  _amount  amount of the tokens to be staked
    function funding(uint256 _projectId, uint256 _amount) external validProject(_projectId) {
        ProjectInfo memory project = projects[_projectId];
        require(block.number >= project.fundingStartBlockNumber, "Funding has not started yet");
        require(block.number <= project.fundingEndBlockNumber, "Funding has ended");

        require(whiteLists[_projectId][_msgSender()], "User is not in whitelist");
        require(_amount >= project.fundingMinAllocation, "Amount must be greater than min allocation");

        uint256 fundingMaxAllocation = getFundingMaxAllocation(_projectId, _msgSender());
        require(_amount > fundingMaxAllocation, "Amount exceed max allocation");

        busd.transferFrom(_msgSender(), address(this), _amount);

        uint256 tokenAllocationAmount = estimateTokenAllocation(_projectId, _amount);
        UserInfo storage tmpUserInfo = userInfo[_projectId][_msgSender()];
        tmpUserInfo.fundedAmount += _amount;
        tmpUserInfo.tokenAllocationAmount += tokenAllocationAmount;

        emit Funding(_msgSender(), _projectId, _amount, tokenAllocationAmount);
    }

    function getProjectInfo(uint256 _projectId) public view returns (ProjectInfo memory result) {
        result = projects[_projectId];
    }

    function getUserInfo(uint256 _projectId, address _account) public view returns (UserInfo memory result) {
        result = userInfo[_projectId][_account];
    }

    function getFundingMaxAllocation(uint256 _projectId, address _account) public view returns(uint256) {
        UserInfo memory tmpUserInfo = userInfo[_projectId][_account];
        uint256 stakedAmount = tmpUserInfo.stakedAmount;
        if (stakedAmount == 0) return 0;

        ProjectInfo memory project = projects[_projectId];
        uint256 allocaltionSize = project.allocaltionSize;

        uint256 maxAllocationAmount = Formula.mulDiv(stakedAmount, Formula.SCALE, project.fundingAllocationRate);
        if (maxAllocationAmount > allocaltionSize) {
            return allocaltionSize;
        }

        return maxAllocationAmount;
    }

    function estimateTokenAllocation(uint256 _projectId, uint256 _fundingAmount) public view returns (uint256) {
        ProjectInfo memory project = projects[_projectId];
        return Formula.mulDiv(_fundingAmount, Formula.SCALE, project.estimateTokenAllocationRate);
    }
}
