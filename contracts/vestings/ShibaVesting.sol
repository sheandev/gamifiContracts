// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title  Vesting contract
 * @author GamiFi team
 * @notice This is kind of linear vesting, but users aren't able
 *         to claim in the lock time.
*/
contract ShibaVesting is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @dev Lock data of each vesting user
     */
    struct Lock {
        uint256 cliff;          // lock period time, user can claim after that time.
        uint256 count;          // maximum number of times that user can claim.
        uint256 total;          // total of lock tokens that user is distributed (exclude TGE tokens).
        uint256 amountEach;     // minimum number of tokens that user can claim.
        uint256 claimedAmount;  // amount of tokens that user claimed.
        uint256 createdAt;      // timestamp of creating vesting time.
    }

    /**
     * @dev The denominator with which to calculate the initial TGE token amount.
     *      1000 is 100% at percent unit.
     */
    uint256 public constant TGE_DOMINATOR = 10000;

    /**
     * @dev The distribute ERC-20 token address.
     */
    IERC20Upgradeable public token;

    /**
     * @dev The mapping data that save vesting data with key is user wallet address.
     */
    mapping(address => Lock) private lockData;

    event InitiatedVests(
        address[] accounts,
        uint256[] amounts,
        uint256 indexed totalAmount,
        uint256 indexed tgePercent,
        uint256 indexed cliff,
        uint256 count
    );
    event Claimed(address indexed account, uint256 indexed amount);

    /**
     * @notice  initialize
     * @dev     Called by proxy when deploying contract.
     *
     * @param   owner_      The ownership of vesting contract.
     * @param   _token      The distribute token address.
     */
    function initialize(address owner_, IERC20Upgradeable _token)
        public
        initializer
    {
        __Ownable_init();
        __ReentrancyGuard_init();

        token = _token;
        _transferOwnership(owner_);
    }

    /**
     * @notice  initiate vestings
     * @dev     This function can be called by anyone.
     *
     * @param   _accounts     The list of wallet addresses that need to distribute.
     * @param   _amounts      The list of number tokens that need to distribute, it's length must be equal _accounts.
     * @param   _totalAmount  The total of lock tokens that user is distributed.
     * @param   _tgePercent   Percent of tokens that user will receive at TGE time.
     * @param   _cliff        Lock period time, user can claim after that time.
     * @param   _count        Mmaximum number of times that user can claim.
     */
    function initiateVests(
        address[] memory _accounts,
        uint256[] memory _amounts,
        uint256 _totalAmount,
        uint256 _tgePercent,
        uint256 _cliff,
        uint256 _count
    ) external {
        require(
            _accounts.length > 0 && _accounts.length == _amounts.length,
            "Inconsistent length"
        );
        require(_tgePercent < TGE_DOMINATOR, "Invalid TGE percent");
        require(_totalAmount > 0, "Total must be greater than 0");

        uint256 exptectedTotal;
        uint256 currentTime = block.timestamp;

        token.safeTransferFrom(_msgSender(), address(this), _totalAmount);

        for (uint256 i = 0; i < _accounts.length; i++) {
            require(_accounts[i] != address(0) && _amounts[i] > 0, "Invalid vesting item");

            exptectedTotal += _amounts[i];
            uint256 initial = (_amounts[i] * _tgePercent) / TGE_DOMINATOR;
            token.safeTransfer(_accounts[i], initial);

            uint256 remainAmount = _amounts[i] - initial;
            lockData[_accounts[i]] = Lock(
                _cliff,
                _count,
                remainAmount,
                remainAmount / _count,
                0,
                currentTime
            );
        }
        require(exptectedTotal == _totalAmount, "Bad total");

        emit InitiatedVests(
            _accounts,
            _amounts,
            _totalAmount,
            _tgePercent,
            _cliff,
            _count
        );
    }

    /**
     * @notice  claim
     * @dev     This function can be called by anyone.
     */
    function claim() external nonReentrant {
        uint256 claimStep = _getClaimStep(_msgSender());
        uint256 claimable = _calClaimable(_msgSender(), claimStep);
        require(claimable > 0, "Nothing to claim");

        lockData[_msgSender()].count -= claimStep;
        lockData[_msgSender()].claimedAmount += claimable;
        token.safeTransfer(_msgSender(), claimable);

        emit Claimed(_msgSender(), claimable);
    }

    /**
     * @notice  getClaimable
     * @dev     Return the number of token that user can claim now.
     *
     * @param   _account    The address of user
     */
    function getClaimable(address _account) public view returns (uint256) {
        uint256 claimStep = _getClaimStep(_account);
        return _calClaimable(_account, claimStep);
    }

    /**
     * @notice  _getClaimStep
     * @dev     Return the number of lock count that user can claim.
     *
     * @param   _account    The address of user
     */
    function _getClaimStep(address _account) private view returns (uint256) {
        Lock memory vestData = lockData[_account];
        if (vestData.count == 0) return 0;

        uint256 currentTime = block.timestamp;
        if (currentTime - vestData.createdAt < vestData.cliff) return 0;

        uint256 claimStep = (currentTime - vestData.createdAt) / vestData.cliff;
        if (claimStep >= vestData.count) {
            claimStep = vestData.count;
        }

        return claimStep;
    }

    /**
     * @notice  _calClaimable
     * @dev     Calculate the number of token that user is able to claim.
     *
     * @param   _account        The address of user.
     * @param   _claimStep      The number of lock count that user can claim.
     */
    function _calClaimable(address _account, uint256 _claimStep)
        private
        view
        returns (uint256)
    {
        if (_claimStep == 0) return 0;

        Lock memory vestData = lockData[_account];
        if (_claimStep == vestData.count)
            return vestData.total - vestData.claimedAmount;
        return vestData.amountEach * _claimStep;
    }

    /**
     * @notice  getLockData
     * @dev     Return lock data of an user
     *
     * @param   _account        The address of user.
     */
    function getLockData(address _account) public view returns (Lock memory) {
        return lockData[_account];
    }
}
