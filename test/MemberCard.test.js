const { ethers } = require("hardhat");
const { expect } = require("chai");
const { constants } = require('@openzeppelin/test-helpers');
const Big = require('big.js');
const { skipTime } = require("./utils");

const ONE_MONTH = 2592000;          // seconds
const THREE_MONTHS = 7776000;       // seconds
const FEE = "30000000000000000000"; // $30 USDC

describe("MemberCard", () => {
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];

    CashTestToken = await ethers.getContractFactory("CashTestToken");
    MemberCard    = await ethers.getContractFactory("MemberCard");
    Vendor        = await ethers.getContractFactory("Vendor");

    cash       = await CashTestToken.deploy([user1.address, user2.address, user3.address]);
    memberCard = await MemberCard.deploy("Member Card NFT", "MCN", cash.address, 3, THREE_MONTHS);
    vendor1    = await Vendor.deploy(memberCard.address);
    vendor2    = await Vendor.deploy(memberCard.address);

    await memberCard.addVendor(vendor1.address);

    await cash.connect(user1).increaseAllowance(memberCard.address, constants.MAX_UINT256.toString());
    await cash.connect(user2).increaseAllowance(memberCard.address, constants.MAX_UINT256.toString());
    await cash.connect(user3).increaseAllowance(memberCard.address, constants.MAX_UINT256.toString());
    await cash.connect(user4).increaseAllowance(memberCard.address, constants.MAX_UINT256.toString());
  });

  describe("Deployment 1 : Check basic info", () => {
    it("Check name", async () => {
      let name = await memberCard.name();
      expect(name).to.equal("Member Card NFT");
    });

    it("Check Token URI", async () => {
      await memberCard.connect(admin).setTokenExpiry(1);
      await memberCard.connect(admin).setTokenExpiry(2);
      await memberCard.connect(user1).mintToken(user1.address);
      await memberCard.connect(user2).mintToken(user2.address);

      let uri1 = await memberCard.tokenURI(1);
      let uri2 = await memberCard.tokenURI(2);
      expect(uri1).to.equal("");
      expect(uri2).to.equal("");
    });

    it("Set duration", async () => {
      await memberCard.setExpiryDate(THREE_MONTHS + 100);
      expect(await memberCard.cardDuration()).to.equal("7776100");
      await expect(
        memberCard.setExpiryDate(THREE_MONTHS + 100)
      ).to.be.revertedWith("Must different");
    });

    it("Set count for a card", async () => {
      await memberCard.connect(user1).mintToken(user1.address);
      await memberCard.connect(admin).setTokenExpiry(1);
      await vendor1.connect(user1).useMemberCard(1);
      expect(await memberCard.getAvailCount(1)).to.equal(2);

      await memberCard.setAvailCountFor(1, 10);
      expect(await memberCard.getAvailCount(1)).to.equal("10");
    });

    it("Set count", async () => {
      await memberCard.setAvailCount(10);
      expect(await memberCard.countOfUse()).to.equal("10");
      await expect(memberCard.setAvailCount(10)).to.be.revertedWith("Must different");
    });

    it("Check data mint", async () => {
      const balanceCashUser1_before = await cash.balanceOf(user1.address);
      const balanceCashOwner_before = await cash.balanceOf(admin.address);
      await memberCard.connect(user1).mintToken(user1.address);

      const balanceCashUser1_after = await cash.balanceOf(user1.address);
      const balanceCashOwner_after = await cash.balanceOf(admin.address);
      expect(balanceCashUser1_before.sub(balanceCashUser1_after)).to.equal(FEE);
      expect(balanceCashOwner_after.sub(balanceCashOwner_before)).to.equal(FEE);

      const uri1 = await memberCard.tokenURI(1);
      expect(uri1).to.equal("");
    });

    it("Check only have 1 NFT per wallet", async () => {
      // If user1 already has 1 NFT, can not mint the second one
      await memberCard.connect(user1).mintToken(user1.address);
      let data = await memberCard.tokensOfOwner(user1.address);
      expect(data.length).to.equal(1);
      expect(data[0]).to.equal(1);

      await expect(
        memberCard.connect(user1).mintToken(user1.address)
      ).to.be.revertedWith("Only have 1 NFT per wallet");

      // If user2 already has 1 NFT, user2 can not receive NFTs more
      await memberCard.connect(user2).mintToken(user2.address);
      data = await memberCard.tokensOfOwner(user2.address);
      expect(data.length).to.equal(1);
      expect(data[0]).to.equal(2);
      await expect(
        memberCard.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Only have 1 NFT per wallet");
    });

    it("Check Owner", async () => {
      await memberCard.connect(user1).mintToken(user1.address);
      let ownerOf1 = await memberCard.ownerOf(1);
      expect(ownerOf1).to.equal(user1.address);
    });

    it("add and remove Vendor", async () => {
      await expect(
        memberCard.connect(user1).addVendor(vendor2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      expect(await memberCard.vendors(vendor2.address)).to.be.false;
      await memberCard.addVendor(vendor2.address);
      expect(await memberCard.vendors(vendor2.address)).to.be.true;
      await memberCard.removeVendor(vendor2.address);
      expect(await memberCard.vendors(vendor2.address)).to.be.false;
    });
  });

  describe("Deployment 2: Mint token", () => {

    it("Check expiry empty after minted when admin not set yet", async () => {
      await memberCard.connect(user1).mintToken(user1.address);
      await expect(memberCard.connect(user2).getExpiryDate(1)).to.be.empty;
    });

    it("Check not owner use", async () => {
      await memberCard.connect(user1).mintToken(user1.address);
      await memberCard.connect(admin).setTokenExpiry(1);
      await expect(vendor1.connect(user2).useMemberCard(1)).to.be.revertedWith("Not owner");
    });

    it("Check owner use 4 times ", async () => {
      await memberCard.connect(user1).mintToken(user1.address);
      await memberCard.connect(admin).setTokenExpiry(1);

      await vendor1.connect(user1).useMemberCard(1);
      let useInfo = await memberCard.getuseTokenInfo(1);
      expect(useInfo.length).to.be.equal(1);
      expect(useInfo[0].vendor).to.be.equal(vendor1.address);
      expect(useInfo[0].owner).to.be.equal(user1.address);
      expect(useInfo[0].usedAt > 0).to.be.true;

      await vendor1.connect(user1).useMemberCard(1);
      useInfo = await memberCard.getuseTokenInfo(1);
      expect(useInfo.length).to.be.equal(2);
      expect(useInfo[1].vendor).to.be.equal(vendor1.address);
      expect(useInfo[1].owner).to.be.equal(user1.address);
      expect(useInfo[1].usedAt > 0).to.be.true;

      await memberCard.addVendor(vendor2.address);
      await vendor2.connect(user1).useMemberCard(1);
      useInfo = await memberCard.getuseTokenInfo(1);
      expect(useInfo.length).to.be.equal(3);
      expect(useInfo[2].vendor).to.be.equal(vendor2.address);
      expect(useInfo[2].owner).to.be.equal(user1.address);
      expect(useInfo[2].usedAt > 0).to.be.true;

      expect(await memberCard.getAvailCount(1)).to.equal(0);
      await expect(vendor1.connect(user1).useMemberCard(1)).to.be.revertedWith("Out of use");
    });

    it("Check owner use when expried", async () => {
      await memberCard.connect(user1).mintToken(user1.address);
      await memberCard.connect(admin).setTokenExpiry(1);
      await vendor1.connect(user1).useMemberCard(1);
      await skipTime(THREE_MONTHS);
      await expect(vendor1.connect(user1).useMemberCard(1)).to.be.revertedWith("Expired");
    });

    it("Not enough cash", async () => {
      await expect(memberCard.connect(user4).mintToken(user4.address)).to.be.revertedWith("transfer amount exceeds balance");
    })

  });

  describe("Deployment 3 : Use token", () => {

    it("Check use when admin not set expiry yet", async () => {
      await memberCard.connect(user1).mintToken(user1.address);
      await expect(vendor1.connect(user1).useMemberCard(1)).to.be.revertedWith("Expired");
    });

    it("Check invalid vendor", async () => {
      await memberCard.connect(user1).mintToken(user1.address);
      await memberCard.connect(admin).setTokenExpiry(1);
      await expect(vendor2.connect(user1).useMemberCard(1)).to.be.revertedWith("Invalid vendor");
    });

    it("Check Balance User", async () => {
      const balanceCashUser1_before = await cash.balanceOf(user1.address);
      const balanceCashUser2_before = await cash.balanceOf(user2.address);
      const balanceCashOwner_before = await cash.balanceOf(admin.address);

      await memberCard.connect(user1).mintToken(user1.address);
      await memberCard.connect(user2).mintToken(user2.address);

      await memberCard.connect(admin).setTokenExpiry(1);
      await memberCard.connect(admin).setTokenExpiry(2);
      await memberCard.connect(admin).setTokenExpiry(3);

      const balanceCashUser1_after = await cash.balanceOf(user1.address);
      const balanceCashUser2_after = await cash.balanceOf(user2.address);
      expect(balanceCashUser1_before.sub(balanceCashUser1_after)).to.equal(FEE);
      expect(balanceCashUser2_before.sub(balanceCashUser2_after)).to.equal(FEE);

      await vendor1.connect(user1).useMemberCard(1);
      await vendor1.connect(user2).useMemberCard(2);
      expect(await memberCard.getAvailCount(1)).to.equal(2);
      expect(await memberCard.getAvailCount(2)).to.equal(2);

      const balanceCashUser3_before = await cash.balanceOf(user3.address);
      await memberCard.connect(user3).mintToken(user3.address);

      expect(await memberCard.getAvailCount(3)).to.equal(3);
      const balanceCashUser3_after = await cash.balanceOf(user3.address);
      expect(balanceCashUser3_before.sub(balanceCashUser3_after)).to.equal(FEE);

      await vendor1.connect(user3).useMemberCard(3);
      expect(await memberCard.getAvailCount(1)).to.equal(2);
      expect(await memberCard.getAvailCount(2)).to.equal(2);
      expect(await memberCard.getAvailCount(3)).to.equal(2);

      const balanceCashOwner_after = await cash.balanceOf(admin.address);
      expect(balanceCashOwner_after.sub(balanceCashOwner_before)).to.equal(new Big(FEE).mul(3).toString());
    });
  });

  describe("setPause", () => {
    it("Allows transfer success", async () => {
      await memberCard.connect(user1).mintToken(user1.address);
      
      const balanceCurrentUser1 = await memberCard.connect(user1).balanceOf(user1.address);
      expect(balanceCurrentUser1).to.equal(1)

      const balanceCurrentUser2 = await memberCard.connect(user1).balanceOf(user2.address);
      expect(balanceCurrentUser2).to.equal(0)

      await memberCard.connect(user1).transferFrom(user1.address, user2.address, 1)

      const balanceAfterTransferUser1 = await memberCard.connect(user1).balanceOf(user1.address);
      expect(balanceAfterTransferUser1).to.equal(0)

      const balanceAfterTransferUser2 = await memberCard.connect(user1).balanceOf(user2.address);
      expect(balanceAfterTransferUser2).to.equal(1)
    });

    it("Transfer is NOT allowed", async () => {
      await memberCard.connect(admin).setPaused(true);
      await memberCard.connect(user1).mintToken(user1.address);
      const token = await memberCard.connect(user1).tokenByIndex(0);
      await memberCard.connect(user1).approve(admin.address, token)
      await expect(
        memberCard.transferFrom(user1.address, user2.address, token)
      ).to.be.revertedWith("Pausable: paused")
    });
  });

  describe("burnExpiredTokens", () => {
    it("Caller is not NFT contract owner", async () => {
      await expect(
        memberCard.connect(user1).burnExpiredTokens()
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it("Total supply is empty", async () => {
      await expect(
        memberCard.burnExpiredTokens()
      ).to.be.revertedWith('Total supply is empty');
    });

    it("burn token after expired automatically", async () => {
      await memberCard.connect(user1).mintToken(user1.address);
      await memberCard.connect(user2).mintToken(user2.address);
      await memberCard.connect(user3).mintToken(user3.address);

      expect(await memberCard.totalSupply()).to.be.equal('3');

      await memberCard.connect(admin).setTokenExpiry(1);

      await skipTime(ONE_MONTH);
      await memberCard.connect(admin).setTokenExpiry(2);
      await memberCard.connect(admin).setTokenExpiry(3);

      await memberCard.burnExpiredTokens();
      expect(await memberCard.totalSupply()).to.be.equal('3');

      await skipTime(2 * ONE_MONTH); // Skip 2 months, token 1 will be expired
      await memberCard.burnExpiredTokens();
      expect(await memberCard.totalSupply()).to.be.equal('2');
      expect(await memberCard.balanceOf(user1.address)).to.be.equal('0');
      expect(await memberCard.balanceOf(user2.address)).to.be.equal('1');
      expect(await memberCard.balanceOf(user3.address)).to.be.equal('1');

      await skipTime(ONE_MONTH); // Skip 1 months, token 2, 3 will be expired
      await memberCard.burnExpiredTokens();
      expect(await memberCard.totalSupply()).to.be.equal('0');
      expect(await memberCard.balanceOf(user1.address)).to.be.equal('0');
      expect(await memberCard.balanceOf(user2.address)).to.be.equal('0');
      expect(await memberCard.balanceOf(user3.address)).to.be.equal('0');

      await expect(
        memberCard.burnExpiredTokens()
      ).to.be.revertedWith('Total supply is empty');
    });
  });
});
