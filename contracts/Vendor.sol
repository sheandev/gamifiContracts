// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./TokenTest.sol";
import "./MemberCard.sol";

import "hardhat/console.sol";

contract Vendor is Ownable {
    MemberCard public memberCard;
    TokenTest public tge;

    constructor(TokenTest _tge, MemberCard _memberCard) {
        tge = _tge;
        memberCard = _memberCard;
    }

    event BuyTokens(address indexed acc, uint256 tokenId, uint256 tokenAmount);

    /// @notice useMemberCard user use their card
    /// @dev    this method can called by anyone
    /// @param  _tokenId of user's card
    function buyTokens(uint256 _tokenId) external payable {
        require(memberCard.getAvailCount(_tokenId) > 0, "End of use");
        require(block.timestamp < memberCard.getExpiryDate(_tokenId), "Expired");
        require(msg.value > 0, "not enough amount");
        MemberCard(memberCard).useToken(_tokenId, _msgSender());

        // transfer token to user;
        payable(owner()).transfer(msg.value);

        uint256 tokenAmount = msg.value * 1000;
        tge.vendorMint(msg.sender, tokenAmount);

        emit BuyTokens(_msgSender(), _tokenId, tokenAmount);
    }
}
