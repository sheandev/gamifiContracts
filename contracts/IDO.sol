//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract IDO is Ownable {
    IERC20 public tge;
    IERC20 public usd;

    mapping(address => bool) public whiteList;

    constructor(IERC20 _tge, IERC20 _usd) {
        tge = _tge;
        usd = _usd;
    }

    function addWhiteList(address[] memory _list) public {
        for (uint256 i = 0; i < _list.length; i++) {
            whiteList[_list[i]] = true;
        }
    }

    event TranferTokenToUser(uint256 _tokenAmount);
    function buyTokens(uint256 _amount) external payable {
        uint256 tokenAmount;
        require(whiteList[msg.sender], "Address not in the list allow buy");

        // transfer usd to address(this)
        usd.transferFrom(msg.sender, address(this), _amount);

        // tinh toan so token se ban cho user
        tokenAmount = _amount * 1000;

        // transfer token to user;
        payable(owner()).transfer(msg.value);
        emit TranferTokenToUser(tokenAmount);
    }
}
