// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./libraries/Formula.sol";
import "./libraries/Config.sol";

interface IMemberCard {
    function getMemberCardActive(uint256 tokenId) external view returns(bool);
    function consumeMembership(uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract Project is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct UserInfo {
        bool isAddedWhitelist;
        bool isClaimedBack;
        uint256 stakedAmount;
        uint256 fundedAmount;
        uint256 tokenAllocationAmount;
        uint256 allocatedPortion;
        uint256 usedMemberCard;
    }

    struct StakeInfo {
        uint256 startBlockNumber;
        uint256 endBlockNumber;
        uint256 minStakeAmount;
        uint256 maxStakeAmount;
        uint256 stakedTotalAmount;
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
        uint256 totalTokenAllocated;
        uint256 whitelistedTotalPortion;
        StakeInfo stakeInfo;
        FundingInfo fundingInfo;
        ClaimBackInfo claimBackInfo;
    }

    IERC20Upgradeable public gmi;
    IERC20Upgradeable public busd;
    IMemberCard public memberCard;

    uint256 public latestProjectId;

    // projectId => project info
    mapping(uint256 => ProjectInfo) public projects;

    // projectId => account address => user info
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    mapping(address => bool) public admins;

    event CreateProject(ProjectInfo project);
    event SetAllocationSize(uint256 indexed _projectId, uint256 indexed allocationSize);
    event SetEstimateTokenAllocationRate(uint256 indexed _projectId, uint256 indexed estimateTokenAllocationRate);
    event SetStakingBlockNumber(uint256 indexed projectId, uint256 indexed blockStart, uint256 indexed blockEnd);
    event SetMinStakeAmount(uint256 indexed projectId, uint256 indexed minStakeAmount);
    event SetMaxStakeAmount(uint256 indexed projectId, uint256 indexed maxStakeAmount);
    event SetClaimBackStartBlockNumber(uint256 indexed projectId, uint256 indexed blockStart);
    event SetFundingBlockNumber(uint256 indexed projectId, uint256 indexed blockStart, uint256 indexed blockEnd);
    event SetFundingMinAllocation(uint256 indexed projectId, uint256 indexed minAllocation);
    event SetFundingReceiver(uint256 indexed projectId, address indexed fundingReceiver);
    event Stake(address indexed account, uint256 indexed projectId, uint256 indexed amount);
    event StakeWithMemberCard(address indexed account, uint256 indexed projectId, uint256 indexed tokenId, uint256 portion);
    event ClaimBack(address indexed account, uint256 indexed projectId, uint256 indexed amount);
    event AddedToWhitelist(uint256 indexed projectId, address[] indexed accounts);
    event RemovedFromWhitelist(uint256 indexed projectId, address[] indexed accounts);
    event Funding(address indexed account, uint256 indexed projectId, uint256 indexed amount, uint256 tokenAllocationAmount);
    event WithdrawFunding(address indexed account, uint256 indexed projectId, uint256 indexed amount);
    event SetAdmin(address indexed user, bool indexed allow);

    function initialize(address owner_, IERC20Upgradeable _gmi, IERC20Upgradeable _busd, IMemberCard _memberCard) public initializer {
        OwnableUpgradeable.__Ownable_init();
        _transferOwnership(owner_);
        gmi = _gmi;
        busd = _busd;
        memberCard = IMemberCard(_memberCard);
    }

    modifier validProject(uint256 _projectId) {
        require(projects[_projectId].id > 0 && projects[_projectId].id <= latestProjectId, "Invalid project id");
        _; 
    }

    modifier onlyAdminOrOwner() {
        require(admins[_msgSender()] || owner() == _msgSender(), "Not admin or owner");
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
    ) external onlyAdminOrOwner {
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

    function setAllocationSize(uint256 _projectId, uint256 _allocationSize) external onlyAdminOrOwner validProject(_projectId) {
        require(_allocationSize > 0, "Invalid project allocation size");

        projects[_projectId].allocationSize = _allocationSize;
        emit SetAllocationSize(_projectId, _allocationSize);
    }

    function setEstimateTokenAllocationRate(uint256 _projectId, uint256 _rate) external onlyAdminOrOwner validProject(_projectId) {
        require(_rate > 0, "Invalid project estimate token allocation rate");

        projects[_projectId].fundingInfo.estimateTokenAllocationRate = _rate;
        emit SetEstimateTokenAllocationRate(_projectId, _rate);
    }

    function setStakingBlockNumber(uint256 _projectId, uint256 _blockStart, uint256 _blockEnd) external onlyAdminOrOwner validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(_blockStart > block.number &&
                _blockStart < _blockEnd &&
                _blockEnd < project.fundingInfo.startBlockNumber, "Invalid block number");

        project.stakeInfo.startBlockNumber = _blockStart;
        project.stakeInfo.endBlockNumber = _blockEnd;
        emit SetStakingBlockNumber(_projectId, _blockStart, _blockEnd);
    }

    function setMinStakeAmount(uint256 _projectId, uint256 _amount) external onlyAdminOrOwner validProject(_projectId) {
        StakeInfo storage stakeInfo = projects[_projectId].stakeInfo;
        require(_amount > 0 && _amount <= stakeInfo.maxStakeAmount, "Invalid min of stake amount");

        stakeInfo.minStakeAmount = _amount;
        emit SetMinStakeAmount(_projectId, _amount);
    }

    function setMaxStakeAmount(uint256 _projectId, uint256 _amount) external onlyAdminOrOwner validProject(_projectId) {
        require(_amount > 0, "Invalid limit of stake amount");

        projects[_projectId].stakeInfo.maxStakeAmount = _amount;
        emit SetMaxStakeAmount(_projectId, _amount);
    }

    function setFundingBlockNumber(uint256 _projectId, uint256 _blockStart, uint256 _blockEnd) external onlyAdminOrOwner validProject(_projectId) {
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

    function setClaimBackStartBlockNumber(uint256 _projectId, uint256 _blockStart) external onlyAdminOrOwner validProject(_projectId) {
        ProjectInfo storage project = projects[_projectId];
        require(_blockStart > block.number &&
                _blockStart > project.fundingInfo.endBlockNumber, "Invalid block number");

        project.claimBackInfo.startBlockNumber = _blockStart;
        emit SetClaimBackStartBlockNumber(_projectId, _blockStart);
    }

    function setFundingMinAllocation(uint256 _projectId, uint256 _amount) external onlyAdminOrOwner validProject(_projectId) {
        require(_amount > 0, "Invalid project funding min allocation");

        projects[_projectId].fundingInfo.minAllocation = _amount;
        emit SetFundingMinAllocation(_projectId, _amount);
    }

    function setFundingReceiver(uint256 _projectId, address _fundingReceiver) external onlyAdminOrOwner validProject(_projectId) {
        require(_fundingReceiver != address(0), "Invalid funding receiver");
        projects[_projectId].fundingInfo.fundingReceiver = _fundingReceiver;
        emit SetFundingReceiver(_projectId, _fundingReceiver);
    }

    function setContracts(address _gmi, address _busd, address _memberCard) external onlyAdminOrOwner {
        require(_gmi != address(0) && _busd != address(0) && _memberCard != address(0), "Invalid contract address");
        gmi = IERC20Upgradeable(_gmi);
        busd = IERC20Upgradeable(_busd);
        memberCard = IMemberCard(_memberCard);
    }

    function setAdmin(address user, bool allow) public onlyOwner {
        admins[user] = allow;
        emit SetAdmin(user, allow);
    }

    /// @notice stake amount of GMI tokens to Staking Pool
    /// @dev    this method can called by anyone
    /// @param  _projectId  id of the project
    /// @param  _amount  amount of the tokens to be staked
    function stake(uint256 _projectId, uint256 _amount) external validProject(_projectId) {
        StakeInfo storage stakeInfo = projects[_projectId].stakeInfo;
        require(!isAlreadyStaked(_projectId, _msgSender()), "You already staking");
        require(block.number >= stakeInfo.startBlockNumber, "Staking has not started yet");
        require(block.number <= stakeInfo.endBlockNumber, "Staking has ended");

        require(_amount >= stakeInfo.minStakeAmount, "Not enough stake amount");
        require(_amount <= stakeInfo.maxStakeAmount, "Amount exceed limit stake amount");

        gmi.safeTransferFrom(_msgSender(), address(this), _amount);

        userInfo[_projectId][_msgSender()].stakedAmount += _amount;
        userInfo[_projectId][_msgSender()].allocatedPortion += _amount;
        stakeInfo.stakedTotalAmount += _amount;

        emit Stake(_msgSender(), _projectId, _amount);
    }

    /// @notice stake member card NFT to Staking Pool
    /// @dev    this method can called by anyone
    /// @param  _projectId  id of the project
    /// @param  _tokenId  id of the member card to be staked
    function stakeWithMemberCard(uint256 _projectId, uint256 _tokenId) external validProject(_projectId) {
        StakeInfo storage stakeInfo = projects[_projectId].stakeInfo;

        require(!isAlreadyStaked(_projectId, _msgSender()), "You already staking");
        require(block.number >= stakeInfo.startBlockNumber, "Staking has not started yet");
        require(block.number <= stakeInfo.endBlockNumber, "Staking has ended");

        require(memberCard.ownerOf(_tokenId) == _msgSender(), "Unauthorised use of Member Card");
        bool active = memberCard.getMemberCardActive(_tokenId);
        require(active, "Invalid member card");

        require(gmi.balanceOf(_msgSender()) >= stakeInfo.minStakeAmount, "Token balance is not enough");

        memberCard.consumeMembership(_tokenId);

        userInfo[_projectId][_msgSender()].allocatedPortion += stakeInfo.maxStakeAmount;
        userInfo[_projectId][_msgSender()].usedMemberCard++;

        addUserToWhitelist(_projectId, _msgSender(), true);

        emit StakeWithMemberCard(_msgSender(), _projectId, _tokenId, stakeInfo.maxStakeAmount);
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
        gmi.safeTransfer(_msgSender(), claimableAmount);

        emit ClaimBack(_msgSender(), _projectId, claimableAmount);
    }

    function addUsersToWhitelist(uint256 _projectId, address[] memory _accounts) external onlyAdminOrOwner validProject(_projectId) {
        require(_accounts.length > 0, "Account list is empty");

        for (uint256 i = 0; i < _accounts.length; i++) {
            addUserToWhitelist(_projectId, _accounts[i], false);
        }

        emit AddedToWhitelist(_projectId, _accounts);
    }

    function addUserToWhitelist(uint256 _projectId, address _account, bool _isStakeMemberCard) private validProject(_projectId) {
        require(_account != address(0), "Invalid account");

        UserInfo storage user = userInfo[_projectId][_account];
        require(user.allocatedPortion > 0, "Account did not stake yet");

        user.isAddedWhitelist = true;
        projects[_projectId].whitelistedTotalPortion += _isStakeMemberCard ? projects[_projectId].stakeInfo.maxStakeAmount : user.stakedAmount;
    }

    function removeUsersFromWhitelist(uint256 _projectId, address[] memory _accounts) external onlyAdminOrOwner validProject(_projectId) {
        require(_accounts.length > 0, "Account list is empty");

        for (uint256 i = 0; i < _accounts.length; i++) {
            address account = _accounts[i];
            require(account != address(0), "Invalid account");

            UserInfo storage user = userInfo[_projectId][account];
            if (!user.isAddedWhitelist) continue;

            user.isAddedWhitelist = false;
            if (projects[_projectId].whitelistedTotalPortion >= user.allocatedPortion) {
                projects[_projectId].whitelistedTotalPortion -= user.allocatedPortion;
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

        busd.safeTransferFrom(_msgSender(), address(this), _amount);

        UserInfo storage user = userInfo[_projectId][_msgSender()];
        user.fundedAmount += _amount;
        fundingInfo.fundedTotalAmount += _amount;

        uint256 tokenAllocationAmount = estimateTokenAllocation(_projectId, _amount);
        user.tokenAllocationAmount += tokenAllocationAmount;
        projects[_projectId].totalTokenAllocated += tokenAllocationAmount;

        emit Funding(_msgSender(), _projectId, _amount, tokenAllocationAmount);
    }

    /// @notice Send funded USD to project funding receiver
    /// @dev    this method only called by owner
    /// @param  _projectId  id of the project
    function withdrawFunding(uint256 _projectId) external onlyAdminOrOwner validProject(_projectId) {
        FundingInfo storage fundingInfo = projects[_projectId].fundingInfo;
        require(block.number > fundingInfo.endBlockNumber, "Funding has not ended yet");
        require(!fundingInfo.isWithdrawnFund, "Already withdrawn fund");

        uint256 _amount = fundingInfo.fundedTotalAmount;
        require(_amount > 0, "Nothing to withdraw");

        busd.safeTransfer(fundingInfo.fundingReceiver, _amount);
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

     function isAlreadyStaked(uint256 _projectId, address _account) public view returns (bool) {
        return userInfo[_projectId][_account].allocatedPortion > 0;
    }

    function getFundingMaxAllocation(uint256 _projectId, address _account) public view returns(uint256) {
        UserInfo memory user = userInfo[_projectId][_account];
        ProjectInfo memory project = projects[_projectId];

        uint256 allocatedPortion = user.allocatedPortion;
        if (!user.isAddedWhitelist || allocatedPortion == 0 || project.whitelistedTotalPortion == 0) return 0;

        uint256 maxAllocableAmount = Formula.mulDiv(
            allocatedPortion,
            project.allocationSize,
            project.whitelistedTotalPortion
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
