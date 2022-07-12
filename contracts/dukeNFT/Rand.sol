// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/**
 *  @title  Dev Non-fungible token
 *
 *  @author Gamifi Team
 *
 *  @notice This smart contract create a RANDOM for generate the token ERC721 for Operation.
 */
contract Rand {
    /**
     *  @notice Random a lucky number for choose type of duke box.
     */
    function random(uint256 tokenId) external view returns (uint256) {
        uint256 result = uint256(
            keccak256(
                abi.encodePacked(
                    tx.origin,
                    blockhash(block.number - 1),
                    block.timestamp,
                    block.difficulty,
                    tokenId
                )
            )
        );

        return result;
    }
}
