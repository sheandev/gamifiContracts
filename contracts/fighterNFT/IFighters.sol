// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/**
 *  @notice IFighters is interface of fighter tokens
 */
interface IFighters {
    enum TypeId {
        TODD,
        MANDY,
        ARTHUR,
        KAEM,
        ROBIN,
        FREYDIS,
        LEIF,
        MINA,
        LYCA,
        BASER
    }

    struct FighterInfo {
        TypeId typeId;
        uint256 useCounter;
    }

    function mint(address _to) external;

    function consumeMembership(uint256 _tokenId) external;

    function getFighterInfoOf(uint256 _tokenId)
        external
        view
        returns (FighterInfo calldata);

    function tokensOfOwnerByType(address _owner, TypeId _typeId)
        external
        view
        returns (uint256[] memory);
}
