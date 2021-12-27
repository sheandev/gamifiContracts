const { ethers } = require("hardhat");
const { expect } = require("chai");
const { toBn } = require("evm-bn");
const Big = require("big.js");

describe("IDO", () => {
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];
    user5 = accounts[5];

    addresses = [
      admin.address,
      user1.address,
      user2.address,
      user3.address,
      user4.address,
      user5.address,
    ];

    const IDO = await ethers.getContractFactory("IDO");
    ido = await IDO.deploy();
  });

  describe("Add addresses", () => {
    it("", async () => {
      await ido.addWhiteList(addresses);
      await ido.buyTokens(123);
    });
  });
});
