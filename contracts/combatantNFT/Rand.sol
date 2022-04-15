// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 *  @title  Dev Non-fungible token
 *
 *  @author Gamifi Team
 *
 *  @notice This smart contract create a RANDOM for generate the token ERC721 for Operation. These tokens initially are minted
 *          by the all user and using at all staking pool of system operation. It includes 3 category:
 *            - Soldier       : is the lower-level  NFT for upgrade to 50% APY
 *            - Pilot         : is the middle-level NFT for upgrade to 75% APY
 *            - General       : is the top-level    NFT for upgrade to 150% APY
 *          The contract here by is implemented to initial some NFT for logic divided APY.
 */
contract Rand {
    /**
     *  @notice Random a lucky number for choose type of combatant box.
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
