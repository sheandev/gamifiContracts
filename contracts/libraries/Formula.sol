// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./Config.sol";

library Formula {
    function decMul18(uint256 x, uint256 y) private pure returns (uint256) {
        uint256 prod_xy = x * y;
        return (prod_xy + Constant.FIXED_POINT / 2) / Constant.FIXED_POINT;
    }

    // b^x - fixed-point 18 DP base, integer exponent
    function powBySquare18(uint256 base, uint256 n)
        internal
        pure
        returns (uint256)
    {
        if (n == 0) return Constant.FIXED_POINT;

        uint256 y = Constant.FIXED_POINT;

        while (n > 1) {
            if (n % 2 == 0) {
                base = decMul18(base, base);
                n = n / 2;
            } else if (n % 2 != 0) {
                y = decMul18(base, y);
                base = decMul18(base, base);
                n = (n - 1) / 2;
            }
        }
        return decMul18(base, y);
    }
}
