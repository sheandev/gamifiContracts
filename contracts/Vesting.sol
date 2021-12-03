// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";


contract Vesting is Context, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 private _token;

    struct Vest {
        address owner;
        uint256 amount;
        uint256 stakeType;
        uint256 start;
        uint256 initial;
        uint256 cliff;
        uint256 linear;
        uint256 claimed;
    }

    mapping(bytes32 => Vest) private _vests;
    mapping(address => uint256) private _nonce;
    address private _owner;


    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    constructor() {
    }

    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }


    function initialize(address owner_, IERC20 token) public initializer {
        _setOwner(owner_);
        _token = token;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function renounceOwnership() public virtual onlyOwner {
        _setOwner(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(
            newOwner != address(0),
            "Ownable: new owner is the zero address"
        );
        _setOwner(newOwner);
    }

    function _setOwner(address newOwner) private {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function getClaimable(address owner_, uint256 nonce)
        public
        view
        virtual
        returns (uint256)
    {
        bytes32 index = getVestId(owner_, nonce);
        uint256 tokenClaimable;
        if (
            block.timestamp >= _vests[index].start.add(_vests[index].cliff) &&
            block.timestamp <=
            _vests[index].start.add(_vests[index].cliff).add(
                _vests[index].linear
            )
        ) {
            uint256 timePassed =
                block.timestamp.sub(
                    (_vests[index].start).add(_vests[index].cliff)
                );
            tokenClaimable = (
                (_vests[index].amount - _vests[index].initial)
                    .mul(timePassed)
                    .div(_vests[index].linear)
            )
                .add(_vests[index].initial)
                .sub(_vests[index].claimed);
        } else if (
            block.timestamp >
            _vests[index].start.add(_vests[index].cliff).add(
                _vests[index].linear
            )
        ) {
            tokenClaimable = _vests[index].amount.sub(_vests[index].claimed);
        }
        return tokenClaimable;
    }

    function claim(address owner_, uint256 nonce) public virtual {
        uint256 tokenClaimable = getClaimable(owner_, nonce);
        bytes32 index = getVestId(owner_, nonce);
        _vests[index].claimed = _vests[index].claimed.add(tokenClaimable);
        _token.safeTransfer(owner_, tokenClaimable);
    }

    function initiateVest(
        uint256 amount,
        uint256 stakeType,
        uint256 initial,
        uint256 cliff,
        uint256 linear
    ) public virtual returns (bytes32) {
        return initiateVest(_msgSender(), amount, stakeType, initial, cliff, linear);
    }

    function initiateVest(
        address owner_,
        uint256 amount,
        uint256 stakeType,
        uint256 initial,
        uint256 cliff,
        uint256 linear
    ) public virtual returns (bytes32) {
        require(
            initial < amount,
            "Vesting: initial amount should be less than total amount."
        );
        _token.safeTransferFrom(_msgSender(), address(this), amount);
        bytes32 index = getVestId(owner_, _nonce[owner_]);
        _vests[index] = Vest(
            owner_,
            amount,
            stakeType,
            block.timestamp,
            initial,
            cliff,
            linear,
            0
        );
        _vests[index].claimed = _vests[index].claimed.add(
            _vests[index].initial
        );
        _token.safeTransfer(_vests[index].owner, _vests[index].initial);
        _nonce[owner_]++;
        return index;
    }

    function getVestId(address user, uint256 nonce)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(user, nonce));
    }

    function getNonce(address user) public view returns (uint256) {
        return _nonce[user];
    }

    function getVest(bytes32 index) public view virtual returns (Vest memory) {
        return _vests[index];
    }

    function getVestType(bytes32 index) public view virtual returns (uint256) {
        return _vests[index].stakeType;
    }
}
