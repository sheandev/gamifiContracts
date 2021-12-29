const { ethers } = require("hardhat");
const { expect } = require("chai");
const { toBn } = require("evm-bn");
const Big = require("big.js");
const FEE        = "50000000000000000";
const MAX_INT    = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const THREE_MONTHS = 7776000; // seconds

describe("Vendor", () => {
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

    const TokenTest = await ethers.getContractFactory("TokenTest");
    token = await TokenTest.deploy("TokenTest", "TGE");

    const MemberCard = await ethers.getContractFactory("MemberCard");
    memberCard = await MemberCard.deploy("Member Card NFT", "MCN", 3, THREE_MONTHS);

    Vendor = await ethers.getContractFactory("Vendor");
    // vendor = await Vendor.deploy(token.address, memberCard.address);

    await token.connect(admin).approve(user1.address, MAX_INT);
    // await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
    // await memberCard.addVendor(vendor.address);
    // await token.addVendor(vendor.address);
  });

  describe("Buy token", async () => {
    it("Vendor constructor memberCard address not invalid", async () => {
      const vendor = await Vendor.deploy(token.address, user1.address);

      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.addVendor(vendor.address);
      await token.addVendor(vendor.address);

      await memberCard.connect(admin).setTokenExpiry(1);
      await expect(vendor.connect(user1).buyTokens(1, { value: FEE })).to.be.revertedWith("function call to a non-contract account");
    })

    it("Vendor constructor token address not invalid", async () => {
      const vendor = await Vendor.deploy(user1.address, memberCard.address);

      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.addVendor(vendor.address);
      await token.addVendor(vendor.address);

      await memberCard.connect(admin).setTokenExpiry(1);
      await expect(vendor.connect(user1).buyTokens(1, { value: FEE })).to.be.revertedWith("function call to a non-contract account");
    })

    it("Not enough amount", async () => {
      const vendor = await Vendor.deploy(token.address, memberCard.address);
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.addVendor(vendor.address);
      await token.addVendor(vendor.address);

      await memberCard.connect(admin).setTokenExpiry(1);
      await expect(vendor.connect(user1).buyTokens(1, { value: 0 })).to.be.revertedWith("not enough amount");
    });

    it("End of use", async () => {
      const vendor = await Vendor.deploy(token.address, memberCard.address);
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.addVendor(vendor.address);
      await token.addVendor(vendor.address);

      await memberCard.connect(admin).setTokenExpiry(1);
      await vendor.connect(user1).buyTokens(1, { value: FEE });
      await vendor.connect(user1).buyTokens(1, { value: FEE });
      await vendor.connect(user1).buyTokens(1, { value: FEE });

      await expect(vendor.connect(user1).buyTokens(1, { value: FEE })).to.be.revertedWith("End of use");
    })

    it("Expired", async () => {
      const vendor = await Vendor.deploy(token.address, memberCard.address);
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.addVendor(vendor.address);
      await token.addVendor(vendor.address);

      await expect(vendor.connect(user1).buyTokens(1, { value: FEE })).to.be.revertedWith("Expired");
    })

    it("Pass all", async () => {
      const vendor = await Vendor.deploy(token.address, memberCard.address);
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.addVendor(vendor.address);
      await token.addVendor(vendor.address);

      await memberCard.connect(admin).setTokenExpiry(1);
      await vendor.connect(user1).buyTokens(1, { value: FEE });
    })
  });
});
