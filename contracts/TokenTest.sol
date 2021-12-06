// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenTest is ERC20 {

    address private stakeContract;

    modifier onlyStakeContract() {
        require(msg.sender == stakeContract, "Invalid address");
        _;
    }

    constructor (string memory name_, string memory symbol_) ERC20(name_, symbol_){
        _mint(_msgSender(), 1000 ether);
    }

    function setStakeContract(address stake) public {
        stakeContract = stake;
    }

    function ownerMint(uint256 amount) public {
        _mint(_msgSender(), amount);
    }

    function stakeMint(address receiver, uint256 amount) public onlyStakeContract{
        _mint(receiver, amount);
    }
}