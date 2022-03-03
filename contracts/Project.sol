// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./libraries/Formula.sol";
import "./libraries/Config.sol";

contract Project is Ownable {
    struct UserInfo {
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
        uint256 whitelistedStakedTotalAmount;
    }

    struct FundingInfo {
        uint256 startBlockNumber;
        uint256 endBlockNumber;
        uint256 minAllocation;
        uint256 estimateTokenAllocationRate;
        uint256 fundedTotalAmount;
        address fundingReceiver;
        bool isWithdrawnFund;
    }

    struct ClaimBackInfo {
        uint256 startBlockNumber;
    }

    struct ProjectInfo {
        uint256 id;
        uint256 allocationSize;
        StakeInfo stakeInfo;
        FundingInfo fundingInfo;
        ClaimBackInfo claimBackInfo;
    }

    IERC20 public immutable gmi;
    IERC20 public immutable busd;

    uint256 public latestProjectId;

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
    event SetClaimBackStartBlockNumber(uint256 indexed projectId, uint256 blockStart);
    event SetFundingBlockNumber(uint256 indexed projectId, uint256 blockStart, uint256 blockEnd);
    event SetFundingMinAllocation(uint256 indexed projectId, uint256 minAllocation);
    event SetFundingReceiver(uint256 indexed projectId, address fundingReceiver);
    event Stake(address account, uint256 indexed projectId, uint256 indexed amount);
    event ClaimBack(address account, uint256 indexed projectId, uint256 indexed amount);
    event AddedToWhitelist(uint256 indexed projectId, address[] accounts);
    event RemovedFromWhitelist(uint256 indexed projectId, address[] accounts);
    event Funding(address account, uint256 indexed projectId, uint256 indexed amount, uint256 tokenAllocationAmount);
    event WithdrawFunding(address account, uint256 indexed projectId, uint256 indexed amount);

    constructor(IERC20 _gmi, IERC20 _busd) {
        gmi = _gmi;
        busd = _busd;
    }

    modifier validProject(uint256 _projectId) {
        require(projects[_projectId].id > 0 && projects[_projectId].id <= latestProjectId, "Invalid project id");
        _; 
    }

    function createProject(
        uint256 _allocationSize,
        uint256 _stakingStartBlockNumber,
        uint256 _stakingEndBlockNumber,
        uint256 _minStakeAmount,
        uint256 _maxStakeAmount,
        uint256 _fundingStartBlockNumber,
        uint256 _fundingEndBlockNumber,
        uint256 _fundingMinAllocation,
        uint256 _estimateTokenAllocationRate,
        address _fundingReceiver,
        uint256 _claimBackStartBlockNumber
    ) external onlyOwner {
        require(_stakingStartBlockNumber > block.number &&
                _stakingStartBlockNumber < _stakingEndBlockNumber &&
                _fundingStartBlockNumber > _stakingEndBlockNumber &&
                _fundingStartBlockNumber < _fundingEndBlockNumber &&
                _fundingEndBlockNumber < _claimBackStartBlockNumber, "Invalid block number");
        require(_minStakeAmount <= _maxStakeAmount, "Invalid stake min amount");
        require(_fundingReceiver != address(0), "Invalid funding receiver address");

        latestProjectId++;
        ProjectInfo memory project;
        project.id = latestProjectId;
        project.allocationSize = _allocationSize;
        project.stakeInfo.startBlockNumber = _stakingStartBlockNumber;
        project.stakeInfo.endBlockNumber = _stakingEndBlockNumber;
        project.stakeInfo.minStakeAmount = _minStakeAmount;
        project.stakeInfo.maxStakeAmount = _maxStakeAmount;
        project.fundingInfo.startBlockNumber = _fundingStartBlockNumber;
        project.fundingInfo.endBlockNumber = _fundingEndBlockNumber;
        project.fundingInfo.minAllocation = _fundingMinAllocation;
        project.fundingInfo.estimateTokenAllocationRate = _estimateTokenAllocationRate;
        project.fundingInfo.fundingReceiver = _fundingReceiver;
        project.claimBackInfo.startBlockNumber = _claimBackStartBlockNumber;

        projects[latestProjectId] = project;
        emit CreateProject(project);
    }

    function setAllocationSize(uint256 _projectId, uint256 _allocationSize) external onlyOwner validProject(_projectId) {
        require(_allocationSize > 0, "Invalid project allocation size");

        projects[_projectId].allocationSize = _allocationSize;
        emit SetAllocationSize(_projectId, _allocationSize);
    }

    function setEstimateTokenAllocationRate(uint256 _projectId, uint256 _rate) external onlyOwner validProject(_projectId) {
        require(_rate > 0, "Invalid project estimate token allocation rate");

        projects[_projectId].fundingInfo.estimateTokenAllocationRate = _rate;
        emit SetEstimateTokenAllocationRate(_projectId, _rate);
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

    function setMinStakeAmount(uint256 _projectId, uint256 _amount) external onlyOwner validProject(_projectId) {
        StakeInfo storage stakeInfo = projects[_projectId].stakeInfo;
        require(_amount > 0 && _amount <= stakeInfo.maxStakeAmount, "Invalid min of stake amount");

        stakeInfo.minStakeAmount = _amount;
        emit SetMinStakeAmount(_projectId, _amount);
    }

    function setMaxStakeAmount(uint256 _projectId, uint256 _amount) external onlyOwner validProject(_projectId) {
        require(_amount > 0, "Invalid limit of stake amount");

        projects[_projectId].stakeInfo.maxStakeAmount = _amount;
        emit SetMaxStakeAmount(_projectId, _amount);
    }

    function setFundingBlockNumber(uint256 _projectId, uint256 _blockStart, uint256 _blockEnd) external onlyOwner validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(_blockStart > block.number &&
                _blockStart > project.stakeInfo.endBlockNumber &&
                _blockStart < _blockEnd &&
                _blockEnd < project.claimBackInfo.startBlockNumber,
                "Invalid block number");

        project.fundingInfo.startBlockNumber = _blockStart;
        project.fundingInfo.endBlockNumber = _blockEnd;
        emit SetFundingBlockNumber(_projectId, _blockStart, _blockEnd);
    }

    function setClaimBackStartBlockNumber(uint256 _projectId, uint256 _blockStart) external onlyOwner validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(_blockStart > block.number &&
                _blockStart > project.fundingInfo.endBlockNumber, "Invalid block number");

        project.claimBackInfo.startBlockNumber = _blockStart;
        emit SetClaimBackStartBlockNumber(_projectId, _blockStart);
    }

    function setFundingMinAllocation(uint256 _projectId, uint256 _amount) external onlyOwner validProject(_projectId) {
        require(_amount > 0, "Invalid project funding min allocation");

        projects[_projectId].fundingInfo.minAllocation = _amount;
        emit SetFundingMinAllocation(_projectId, _amount);
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

        require(_amount >= stakeInfo.minStakeAmount, "Not enough stake amount");
        require(_amount <= stakeInfo.maxStakeAmount, "Amount exceed limit stake amount");

        gmi.transferFrom(_msgSender(), address(this), _amount);

        userInfo[_projectId][_msgSender()].stakedAmount += _amount;
        stakeInfo.stakedTotalAmount += _amount;

        emit Stake(_msgSender(), _projectId, _amount);
    }

    /// @notice claimBack amount of GMI tokens from staked GMI before
    /// @dev    This method can called by anyone
    /// @param  _projectId  id of the project
    function claimBack(uint256 _projectId) external validProject(_projectId) {
        require(block.number >= projects[_projectId].claimBackInfo.startBlockNumber, "Claiming back has not started yet");

        UserInfo storage user = userInfo[_projectId][_msgSender()];
        uint256 claimableAmount = user.stakedAmount;
        require(claimableAmount > 0, "Nothing to claim back");

        user.isClaimedBack = true;
        gmi.transfer(_msgSender(), claimableAmount);

        emit ClaimBack(_msgSender(), _projectId, claimableAmount);
    }

    function addWhitelist(uint256 _projectId, address[] memory _accounts) external onlyOwner validProject(_projectId) {
        require(block.number > projects[_projectId].stakeInfo.endBlockNumber, "Staking has not ended yet");
        require(_accounts.length > 0, "Account list is empty");

        for (uint256 i = 0; i < _accounts.length; i++) {
            address account = _accounts[i];
            require(account != address(0), "Invalid account");

            UserInfo storage user = userInfo[_projectId][account];
            if (user.isAddedWhitelist) continue;
            require(user.stakedAmount > 0, "Account did not stake yet");

            user.isAddedWhitelist = true;
            projects[_projectId].stakeInfo.whitelistedStakedTotalAmount += user.stakedAmount;
        }
        emit AddedToWhitelist(_projectId, _accounts);
    }

    function removeFromWhitelist(uint256 _projectId, address[] memory _accounts) public onlyOwner validProject(_projectId) {
        require(block.number > projects[_projectId].stakeInfo.endBlockNumber, "Staking has not ended yet");
        require(_accounts.length > 0, "Account list is empty");

        for (uint256 i = 0; i < _accounts.length; i++) {
            address account = _accounts[i];
            require(account != address(0), "Invalid account");

            UserInfo storage user = userInfo[_projectId][account];
            if (!user.isAddedWhitelist) continue;

            user.isAddedWhitelist = false;
            if (projects[_projectId].stakeInfo.whitelistedStakedTotalAmount >= user.stakedAmount) {
                projects[_projectId].stakeInfo.whitelistedStakedTotalAmount -= user.stakedAmount;
            }
        }
        emit RemovedFromWhitelist(_projectId, _accounts);
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
        user.fundedAmount += _amount;
        fundingInfo.fundedTotalAmount += _amount;

        uint256 tokenAllocationAmount = estimateTokenAllocation(_projectId, _amount);
        user.tokenAllocationAmount += tokenAllocationAmount;

        emit Funding(_msgSender(), _projectId, _amount, tokenAllocationAmount);
    }

    /// @notice Send funded USD to project funding receiver
    /// @dev    this method only called by owner
    /// @param  _projectId  id of the project
    function withdrawFunding(uint256 _projectId) external onlyOwner validProject(_projectId) {
        FundingInfo storage fundingInfo = projects[_projectId].fundingInfo;
        require(block.number > fundingInfo.endBlockNumber, "Funding has not ended yet");
        require(!fundingInfo.isWithdrawnFund, "Already withdrawn fund");

        uint256 _amount = fundingInfo.fundedTotalAmount;
        require(_amount > 0, "Nothing to withdraw");

        busd.transfer(fundingInfo.fundingReceiver, _amount);
        fundingInfo.isWithdrawnFund = true;

        emit WithdrawFunding(fundingInfo.fundingReceiver, _projectId, _amount);
    }

    function getProjectInfo(uint256 _projectId) public view returns (ProjectInfo memory result) {
        result = projects[_projectId];
    }

    function getStakeInfo(uint256 _projectId) public view returns (StakeInfo memory result) {
        result = projects[_projectId].stakeInfo;
    }

    function getFundingInfo(uint256 _projectId) public view returns (FundingInfo memory result) {
        result = projects[_projectId].fundingInfo;
    }

    function getUserInfo(uint256 _projectId, address _account) public view returns (UserInfo memory result) {
        result = userInfo[_projectId][_account];
    }

    function isAddedWhitelist(uint256 _projectId, address _account) public view returns (bool) {
        return userInfo[_projectId][_account].isAddedWhitelist;
    }

    function getFundingMaxAllocation(uint256 _projectId, address _account) public view returns(uint256) {
        UserInfo memory user = userInfo[_projectId][_account];
        ProjectInfo memory project = projects[_projectId];

        uint256 stakedAmount = user.stakedAmount;
        if (!user.isAddedWhitelist || stakedAmount == 0 || project.stakeInfo.whitelistedStakedTotalAmount == 0) return 0;

        uint256 maxAllocableAmount = Formula.mulDiv(
            stakedAmount,
            project.allocationSize,
            project.stakeInfo.whitelistedStakedTotalAmount
        );
        uint256 allocableAmount = maxAllocableAmount - user.fundedAmount;
        uint256 remainingAllocationSize = project.allocationSize - project.fundingInfo.fundedTotalAmount;

        if (allocableAmount > remainingAllocationSize) {
            return remainingAllocationSize;
        }

        return allocableAmount;
    }

    function estimateTokenAllocation(uint256 _projectId, uint256 _fundingAmount) public view returns (uint256) {
        uint256 rate = projects[_projectId].fundingInfo.estimateTokenAllocationRate;
        require(rate > 0, "Did not set estimate token allocation rate yet");
        return Formula.mulDiv(_fundingAmount, Formula.SCALE, rate);
    }
}
