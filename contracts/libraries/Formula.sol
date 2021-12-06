// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Config.sol";

library Formula {
    // 18 Decimal places
    function decMul18(uint256 x, uint256 y) private pure returns (uint256) {
        return (x * y + 10e18 / 2) / 10e18;
    }

    // b^x - fixed-point 18 DP base, integer exponent
    function powBySquare18(uint256 base, uint256 n)
        internal
        pure
        returns (uint256)
    {
        if (n == 0) return 10e18;

        uint256 y = 10e18;

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
