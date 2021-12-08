// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./libraries/Formula.sol";

contract FormulaTest {
    function testPowBySquare18 (uint256 x, uint256 y)  public
        pure
        returns(uint256 ) {
           return Formula.powBySquare18(x,y);
    }
    function testErr () public pure returns(uint256) {
            return Formula.powBySquare18(7300038383900000123, 7);
    }
}
