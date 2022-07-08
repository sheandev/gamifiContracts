// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/**
 *  @notice IDuke is interface of duke token
 */
interface IDuke {
    struct DukeInfo {
        TypeId typeId;
        uint256 lockedExpireTime;
        uint256 useCounter;
        bool isLocked;
    }

    function getDukeInfoOf(uint256 tokenId)
        external
        view
        returns (DukeInfo calldata);

    function mint(address owner) external;

    function tokensOfOwnerByType(address sender, TypeId typeID)
        external
        view
        returns (uint256[] memory);

    function lockToken(uint256 tokenId, uint256 duration) external;

    function unlockToken(uint256 tokenId) external;
}

enum TypeId {
        SOLDIER,
        PILOT,
        GENERAL
}
