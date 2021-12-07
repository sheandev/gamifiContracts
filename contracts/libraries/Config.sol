// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

library Constant {
    uint256 internal constant FIXED_POINT = 10**18;

    /// sqr(365)(1 + APY)
    uint256 internal constant ROOT_30 = 1001900837677200000;
    uint256 internal constant ROOT_45 = 1003014430968400000;
    uint256 internal constant ROOT_60 = 1003805288538300000;
}
