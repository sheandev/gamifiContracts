// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (token/ERC721/ERC721.sol)

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IMemberCard {
    function getMemberCardActive(uint256 tokenId) external view returns(bool);
    function consumeMembership(uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract Vendor is Context, Ownable {
    address public memberCard;

    constructor(address _memberCard) {
        memberCard = _memberCard;
    }

    function useMemberCard(uint256 _tokenId) external {
        require(IMemberCard(memberCard).ownerOf(_tokenId) == _msgSender(), "Unauthorised use of Member Card");
        bool active = IMemberCard(memberCard).getMemberCardActive(_tokenId);
        if (active) {
            IMemberCard(memberCard).consumeMembership(_tokenId);
        }
    }
}
