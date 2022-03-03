// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/Formula.sol";

contract VestingTGE is Context, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 private immutable _token;

    struct Vest {
        address owner;
        uint256 amount;
        uint256 start;
        uint256 initial;
        uint256 cliff;
        uint256 linear;
        uint256 claimed;
    }

    mapping(bytes32 => Vest) private _vests;
    mapping(address => uint256) private _nonce;
    uint256 public percentTGE;
    uint256 public cliff;
    uint256 public linear;

    constructor(address owner_, IERC20 token) {
        _transferOwnership(owner_);
        _token = token;
        percentTGE = 100000000000000000; // 10% at TGE
        cliff = 30 days;
        linear = 270 days;
    }

    function getClaimable(uint256 nonce) public view returns (uint256) {
        bytes32 index = getVestId(_msgSender(), nonce);
        uint256 tokenClaimable;
        uint256 timestamp = block.timestamp; // solhint-disable-line not-rely-on-time
        if (timestamp < _vests[index].start) {
            tokenClaimable = 0;
        } else if (
            timestamp > _vests[index].start.add(_vests[index].cliff) &&
            timestamp <=
            _vests[index].start.add(_vests[index].cliff).add(
                _vests[index].linear
            )
        ) {
            uint256 timePassed = timestamp.sub(
                (_vests[index].start).add(_vests[index].cliff)
            );
            tokenClaimable = (
                (_vests[index].amount - _vests[index].initial)
                    .mul(timePassed)
                    .div(_vests[index].linear)
            ).add(_vests[index].initial).sub(_vests[index].claimed);
        } else if (
            timestamp >
            _vests[index].start.add(_vests[index].cliff).add(
                _vests[index].linear
            )
        ) {
            tokenClaimable = _vests[index].amount.sub(_vests[index].claimed);
        }
        return tokenClaimable;
    }

    function claim(uint256 nonce) external {
        uint256 tokenClaimable = getClaimable(nonce);
        require(tokenClaimable > 0, "Vesting: No token to claim");
        bytes32 index = getVestId(_msgSender(), nonce);
        _vests[index].claimed = _vests[index].claimed.add(tokenClaimable);
        _token.safeTransfer(_msgSender(), tokenClaimable);
    }

    function initiateVest(address owner_, uint256 amount, uint256 startTimestamp) external onlyOwner returns (bytes32) {
        require(owner_ != address(0), "Vesting: owner_ is the zero address"); // solhint-disable-line reason-string
        require(amount > 0, "Vesting: amount must be > 0"); // solhint-disable-line reason-string

        _token.safeTransferFrom(_msgSender(), address(this), amount);
        bytes32 index = getVestId(owner_, _nonce[owner_]);

        _vests[index] = Vest(
            owner_,
            amount,
            startTimestamp,
            _calAmountTGE(amount),
            cliff,
            linear,
            0
        );

        _nonce[owner_]++;
        return index;
    }

    function getVestId(address user, uint256 nonce) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(user, nonce));
    }

    function _calAmountTGE(uint256 amount) private view returns (uint256) {
        return Formula.mulDiv(amount, percentTGE, Formula.SCALE);
    }

    function getNonce(address user) public view returns (uint256) {
        return _nonce[user];
    }

    function getVest(bytes32 index) public view returns (Vest memory) {
        return _vests[index];
    }
}
