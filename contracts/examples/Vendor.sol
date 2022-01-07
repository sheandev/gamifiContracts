// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "contracts/MemberCard.sol";

contract Vendor is Ownable {
    address immutable public memberCard;

    constructor(address _memberCard) {
        memberCard = _memberCard;
    }

    event UseMemberCard(address indexed user, uint256 tokenId);

    /// @notice useMemberCard user use their card
    /// @dev    this method can called by anyone
    /// @param  _tokenId of user's card
    function useMemberCard(uint256 _tokenId) external {
        MemberCard(memberCard).useToken(_tokenId, _msgSender());
        emit UseMemberCard(_msgSender(), _tokenId);
    }
}
