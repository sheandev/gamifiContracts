// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 *  @notice ICombatant is interface of combatant token
 */
interface ICombatant {
    enum TypeId {
        SOLDIER,
        PILOT,
        GENERAL
    }

    struct CombatantInfo {
        TypeId typeId;
        uint256 lockedExpireTime;
        uint256 useCounter;
        bool isLocked;
    }

    function getCombatantInfoOf(uint256 tokenId)
        external
        view
        returns (CombatantInfo calldata);

    function mint(address owner) external;

    function tokensOfOwnerByType(address sender, uint256 typeID)
        external
        view
        returns (uint256[] memory);

    function lockToken(uint256 tokenId, uint256 duration) external;

    function unlockToken(uint256 tokenId) external;
}
