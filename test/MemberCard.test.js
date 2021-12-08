const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime } = require("./utils");

const THREE_MONTHS = 7776000; // seconds
const FEE = "50000000000000000";

describe("MemberCard", () => {
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];

    MemberCard = await ethers.getContractFactory("MemberCard");
    memberCard = await MemberCard.deploy("Member Card NFT", "MCN", 3, THREE_MONTHS);
  });

  describe("Deployment 1 : Check basic info", () => {
    it("Check name", async () => {
      let name = await memberCard.name();
      expect(name).to.equal("Member Card NFT");
    });

    it("Set duration", async () => {
      await memberCard.setExpiryDate(THREE_MONTHS + 100);
      expect(await memberCard.cardDuration()).to.equal("7776100");
      await expect(
        memberCard.setExpiryDate(THREE_MONTHS + 100)
      ).to.be.revertedWith("Must different");
    });

    it("Set count for a card", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.connect(admin).setTokenExpiry(1);
      await memberCard.connect(user1).useToken(1);
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
      let balanceB = await ethers.provider.getBalance(user1.address);
      let txData = await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      let txNormal = await ethers.provider.getTransaction(txData.hash);

      //check balance
      let gasUse = (await txData.wait()).gasUsed;
      let txFee = gasUse.mul(txNormal.gasPrice);
      let balanceA = await ethers.provider.getBalance(user1.address);

      expect(balanceB.sub(txFee.add(balanceA))).to.equal("50000000000000000");

      let uri1 = await memberCard.tokenURI(1);
      expect(uri1).to.equal("");
    });

    it("Check Owner", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      let ownerOf1 = await memberCard.ownerOf(1);
      expect(ownerOf1).to.equal(user1.address);
    });
  });

  describe("Deployment 2: Mint token", () => {

    it("Check expiry empty after minted when admin not set yet", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await expect(memberCard.connect(user2).getExpiryDate(1)).to.be.empty;
    });

    it("Check not owner use", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.connect(admin).setTokenExpiry(1);
      await expect(memberCard.connect(user2).useToken(1)).to.be.revertedWith("Not owner");
    });

    it("Check owner use", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.connect(admin).setTokenExpiry(1);
      await memberCard.connect(user1).useToken(1);
      expect(await memberCard.getAvailCount(1)).to.equal(2);

      await memberCard.connect(user2).mintToken(user2.address, { value: FEE });
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      let data = await memberCard.tokensOfOwner(user1.address);
      expect(data[0]).to.equal(1);
      expect(data[1]).to.equal(3);
    });

    it("Check owner use 4 times ", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.connect(admin).setTokenExpiry(1);
      await memberCard.connect(user1).useToken(1);
      await memberCard.connect(user1).useToken(1);
      await memberCard.connect(user1).useToken(1);
      expect(await memberCard.getAvailCount(1)).to.equal(0);

      await expect(memberCard.connect(user1).useToken(1)).to.be.revertedWith("Out of use");
    });

    it("Check owner use when expried", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.connect(admin).setTokenExpiry(1);
      await memberCard.connect(user1).useToken(1);
      await skipTime(THREE_MONTHS);
      await expect(memberCard.connect(user1).useToken(1)).to.be.revertedWith("Expired");
    });

  });

  describe("Deployment 3 : Use token", () => {

    it("Check use when admin not set expiry yet", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await expect(memberCard.connect(user1).useToken(1)).to.be.revertedWith("Expired");
    });

    it("Check Token URI", async () => {

      await memberCard.connect(admin).setTokenExpiry(1);
      await memberCard.connect(admin).setTokenExpiry(2);
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      await memberCard.connect(user2).mintToken(user2.address, { value: FEE });

      let uri1 = await memberCard.tokenURI(1);
      let uri2 = await memberCard.tokenURI(2);
      expect(uri1).to.equal("");
      expect(uri2).to.equal("");
    });

    
    it("Check Balance User", async () => {
      let balanceB1 = await ethers.provider.getBalance(user1.address);
      let balanceB2 = await ethers.provider.getBalance(user2.address);

      let txData1 = await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      let txData2 = await memberCard.connect(user2).mintToken(user2.address, { value: FEE });

      await memberCard.connect(admin).setTokenExpiry(1);
      await memberCard.connect(admin).setTokenExpiry(2);
      await memberCard.connect(admin).setTokenExpiry(3);

      let txNormal1 = await ethers.provider.getTransaction(txData1.hash);
      let txNormal2 = await ethers.provider.getTransaction(txData2.hash);

      //check balance user 1
      let gasUse = (await txData1.wait()).gasUsed;
      let txFee = gasUse.mul(txNormal1.gasPrice);

      let balanceA1 = await ethers.provider.getBalance(user1.address);
      expect(balanceB1.sub(txFee.add(balanceA1))).to.equal("50000000000000000");

      //check balance user 2
      gasUse = (await txData2.wait()).gasUsed;
      txFee = gasUse.mul(txNormal2.gasPrice);

      let balanceA2 = await ethers.provider.getBalance(user2.address);
      expect(balanceB2.sub(txFee.add(balanceA2))).to.equal("50000000000000000");

      await memberCard.connect(user1).useToken(1);
      await memberCard.connect(user2).useToken(2);
      expect(await memberCard.getAvailCount(1)).to.equal(2);
      expect(await memberCard.getAvailCount(2)).to.equal(2);

      let balanceB3 = await ethers.provider.getBalance(user3.address);

      let txData3 = await memberCard.connect(user3).mintToken(user3.address, { value: FEE });
      expect(await memberCard.getAvailCount(3)).to.equal(3);

      let txNormal3 = await ethers.provider.getTransaction(txData3.hash);

      // check balance user 1
      gasUse = (await txData3.wait()).gasUsed;
      txFee = gasUse.mul(txNormal3.gasPrice);

      let balanceA3 = await ethers.provider.getBalance(user3.address);
      expect(balanceB3.sub(txFee.add(balanceA3))).to.equal("50000000000000000");

      await memberCard.connect(user3).useToken(3);
      expect(await memberCard.getAvailCount(1)).to.equal(2);
      expect(await memberCard.getAvailCount(2)).to.equal(2);
      expect(await memberCard.getAvailCount(3)).to.equal(2);
    });


  });

  describe("setPause", () => {
    it("Allows transfer success", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      
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

    it("Transfer not allows", async () => {
      await memberCard.connect(admin).setPaused(true);
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      const token = await memberCard.connect(user1).tokenByIndex(0);
      await memberCard.connect(user1).approve(admin.address, token)
      await expect(memberCard.transferFrom(user1.address, user2.address, token)).to.be.revertedWith("Pausable: paused")
    });
  })
});
