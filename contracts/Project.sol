// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./libraries/Formula.sol";
import "./libraries/Config.sol";

contract Project is Ownable {
    struct UserInfo {
        bool isCompletedCampaign;
        bool isAddedWhitelist;
        bool isClaimedBack;
        uint256 stakedAmount;
        uint256 fundedAmount;
        uint256 tokenAllocationAmount;
    }

    struct StakeInfo {
        uint256 startBlockNumber;
        uint256 endBlockNumber;
        uint256 minStakeAmount;
        uint256 maxStakeAmount;
        uint256 stakedTotalAmount;
        address[] stakedAccounts;
    }

    struct FundingInfo {
        address fundingReceiver;
        uint256 startBlockNumber;
        uint256 endBlockNumber;
        uint256 minAllocation;
        uint256 estimateTokenAllocationRate;
        uint256 allocationRate;
        uint256 fundedTotalAmount;
        address[] fundedAccounts;
        bool isWithdrawnFund;
    }

    struct ProjectInfo {
        uint256 id;
        address owner;
        address tokenAddress;
        uint256 allocationSize;
        StakeInfo stakeInfo;
        FundingInfo fundingInfo;
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
    event SetMinStakeAmount(uint256 indexed projectId, uint256 minStakeAmount);
    event SetMaxStakeAmount(uint256 indexed projectId, uint256 maxStakeAmount);
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
        uint256 _minStakeAmount,
        uint256 _maxStakeAmount,
        uint256 _fundingStartBlockNumber,
        uint256 _fundingEndBlockNumber,
        uint256 _fundingMinAllocation,
        uint256 _fundingAllocationRate,
        address _fundingReceiver
    ) external onlyOwner {
        require(_stakingStartBlockNumber > block.number &&
                _stakingStartBlockNumber < _stakingEndBlockNumber &&
                _fundingStartBlockNumber > _stakingEndBlockNumber &&
                _fundingStartBlockNumber < _fundingEndBlockNumber, "Invalid block number");
        require(_minStakeAmount <= _maxStakeAmount, "Invalid stake min amount");
        require(_fundingReceiver != address(0), "Invalid funding receiver address");

        latestProjectId++;
        ProjectInfo memory project;
        project.id = latestProjectId;
        project.tokenAddress = _tokenAddress;
        project.allocationSize = _allocationSize;
        project.stakeInfo.startBlockNumber = _stakingStartBlockNumber;
        project.stakeInfo.endBlockNumber = _stakingEndBlockNumber;
        project.stakeInfo.minStakeAmount = _minStakeAmount;
        project.stakeInfo.maxStakeAmount = _maxStakeAmount;
        project.fundingInfo.startBlockNumber = _fundingStartBlockNumber;
        project.fundingInfo.endBlockNumber = _fundingEndBlockNumber;
        project.fundingInfo.minAllocation = _fundingMinAllocation;
        project.fundingInfo.allocationRate = _fundingAllocationRate;
        project.fundingInfo.estimateTokenAllocationRate = _estimateTokenAllocationRate;
        project.fundingInfo.fundingReceiver = _fundingReceiver;

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

        projects[_projectId].fundingInfo.estimateTokenAllocationRate = _estimateTokenAllocationRate;
        emit SetEstimateTokenAllocationRate(_projectId, _estimateTokenAllocationRate);
    }

    function setStakingBlockNumber(uint256 _projectId, uint256 _blockStart, uint256 _blockEnd) external onlyOwner validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(_blockStart > block.number &&
                _blockStart < _blockEnd &&
                _blockEnd < project.fundingInfo.startBlockNumber, "Invalid block number");

        project.stakeInfo.startBlockNumber = _blockStart;
        project.stakeInfo.endBlockNumber = _blockEnd;
        emit SetStakingBlockNumber(_projectId, _blockStart, _blockEnd);
    }

    function setMinStakeAmount(uint256 _projectId, uint256 _minStakeAmount) external onlyOwner validProject(_projectId) {
        require(_minStakeAmount > 0 && _minStakeAmount <= projects[_projectId].stakeInfo.maxStakeAmount, "Invalid min of stake amount");

        projects[_projectId].stakeInfo.minStakeAmount = _minStakeAmount;
        emit SetMinStakeAmount(_projectId, _minStakeAmount);
    }

    function setMaxStakeAmount(uint256 _projectId, uint256 _maxStakeAmount) external onlyOwner validProject(_projectId) {
        require(_maxStakeAmount > 0, "Invalid limit of stake amount");

        projects[_projectId].stakeInfo.maxStakeAmount = _maxStakeAmount;
        emit SetMaxStakeAmount(_projectId, _maxStakeAmount);
    }

    function setFundingBlockNumber(uint256 _projectId, uint256 _blockStart, uint256 _blockEnd) external onlyOwner validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(_blockStart > block.number &&
                _blockStart < _blockEnd &&
                _blockStart > project.stakeInfo.endBlockNumber, "Invalid block number");

        project.fundingInfo.startBlockNumber = _blockStart;
        project.fundingInfo.endBlockNumber = _blockEnd;
        emit SetFundingBlockNumber(_projectId, _blockStart, _blockEnd);
    }

    function setFundingMinAllocation(uint256 _projectId, uint256 _minAllocation) external onlyOwner validProject(_projectId) {
        require(_minAllocation > 0, "Invalid project funding min allocation");

        projects[_projectId].fundingInfo.minAllocation = _minAllocation;
        emit SetFundingMinAllocation(_projectId, _minAllocation);
    }

    function setFundingAllocationRate(uint256 _projectId, uint256 _fundingAllocationRate) external onlyOwner validProject(_projectId) {
        require(_fundingAllocationRate > 0, "Invalid project funding allocation rate");

        projects[_projectId].fundingInfo.allocationRate = _fundingAllocationRate;
        emit SetFundingAllocationRate(_projectId, _fundingAllocationRate);
    }

    function setFundingReceiver(uint256 _projectId, address _fundingReceiver) external onlyOwner validProject(_projectId) {
        require(_fundingReceiver != address(0), "Invalid funding receiver");
        projects[_projectId].fundingInfo.fundingReceiver = _fundingReceiver;
        emit SetFundingReceiver(_projectId, _fundingReceiver);
    }

    /// @notice stake amount of GMI tokens to Staking Pool
    /// @dev    this method can called by anyone
    /// @param  _projectId  id of the project
    /// @param  _amount  amount of the tokens to be staked
    function stake(uint256 _projectId, uint256 _amount) external validProject(_projectId) {
        StakeInfo storage stakeInfo = projects[_projectId].stakeInfo;
        require(block.number >= stakeInfo.startBlockNumber, "Staking has not started yet");
        require(block.number <= stakeInfo.endBlockNumber, "Staking has ended");

        require(isCompletedCampaign(_projectId, _msgSender()), "User is not complete gleam campaign");
        require(_amount != 0 && _amount >= stakeInfo.minStakeAmount, "Not enough stake amount");
        require(_amount <= stakeInfo.maxStakeAmount, "Amount exceed limit stake amount");

        gmi.transferFrom(_msgSender(), address(this), _amount);

        UserInfo storage user = userInfo[_projectId][_msgSender()];

        if (user.stakedAmount == 0) {
            stakeInfo.stakedAccounts.push(_msgSender());
        }
        stakeInfo.stakedTotalAmount += _amount;
        user.stakedAmount += _amount;

        emit Stake(_msgSender(), _projectId, _amount);
    }

    /// @notice claimBack amount of GMI tokens from staked GMI before
    /// @dev    This method can called by anyone
    /// @param  _projectId  id of the project
    function claimBack(uint256 _projectId) external validProject(_projectId) {
        require(block.number >= projects[_projectId].fundingInfo.endBlockNumber, "Funding has not ended yet");

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
        FundingInfo storage fundingInfo = projects[_projectId].fundingInfo;
        require(block.number >= fundingInfo.startBlockNumber, "Funding has not started yet");
        require(block.number <= fundingInfo.endBlockNumber, "Funding has ended");

        require(isAddedWhitelist(_projectId, _msgSender()), "User is not in whitelist");
        require(_amount >= fundingInfo.minAllocation, "Amount must be greater than min allocation");

        uint256 fundingMaxAllocation = getFundingMaxAllocation(_projectId, _msgSender());
        require(_amount <= fundingMaxAllocation, "Amount exceed max allocation");

        busd.transferFrom(_msgSender(), address(this), _amount);

        UserInfo storage user = userInfo[_projectId][_msgSender()];
        if (user.fundedAmount == 0) {
            fundingInfo.fundedAccounts.push(_msgSender());
        }
        fundingInfo.fundedTotalAmount += _amount;
        user.fundedAmount += _amount;

        uint256 tokenAllocationAmount = estimateTokenAllocation(_projectId, _amount);
        user.tokenAllocationAmount += tokenAllocationAmount;

        emit Funding(_msgSender(), _projectId, _amount, tokenAllocationAmount);
    }

    /// @notice receive amount USD from contract
    /// @dev    this method can called by owner
    /// @param  _projectId  id of the project
    function withdrawFunding(uint256 _projectId) external onlyOwner validProject(_projectId) {
        FundingInfo storage fundingInfo = projects[_projectId].fundingInfo;
        require(block.number > fundingInfo.endBlockNumber, "Funding has not ended yet");
        require(!fundingInfo.isWithdrawnFund, "Already withdrawn fund");

        uint256 _amount = fundingInfo.fundedTotalAmount;
        require(_amount > 0, "Not enough amount");

        busd.transfer(fundingInfo.fundingReceiver, _amount);
        fundingInfo.isWithdrawnFund = true;

        emit WithdrawFunding(fundingInfo.fundingReceiver, _projectId, _amount);
    }

    function getProjectInfo(uint256 _projectId) public validProject(_projectId) view returns (ProjectInfo memory result) {
        result = projects[_projectId];
    }

    function getStakeInfo(uint256 _projectId) public validProject(_projectId) view returns (StakeInfo memory result) {
        result = projects[_projectId].stakeInfo;
    }

    function getFundingInfo(uint256 _projectId) public validProject(_projectId) view returns (FundingInfo memory result) {
        result = projects[_projectId].fundingInfo;
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

        uint256 maxAllocationAmount = Formula.mulDivFixedPoint(stakedAmount, project.fundingInfo.allocationRate);
        if (maxAllocationAmount > allocationSize) {
            return allocationSize;
        }

        return maxAllocationAmount;
    }

    function estimateTokenAllocation(uint256 _projectId, uint256 _fundingAmount) public view returns (uint256) {
        ProjectInfo memory project = projects[_projectId];
        return Formula.mulDiv(_fundingAmount, Formula.SCALE, project.fundingInfo.estimateTokenAllocationRate);
    }
}
