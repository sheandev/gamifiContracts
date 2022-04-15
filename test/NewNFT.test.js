const chai = require("chai");
const { expect } = require("chai");
const { upgrades } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const { constants } = require("@openzeppelin/test-helpers");
const Big = require("big.js");
const { skipTime } = require("./utils");

chai.use(solidity);
const { add, subtract, multiply, divide } = require("js-big-decimal");
describe("NewNFT", () => {
  beforeEach(async () => {
    MAX_LIMIT =
      "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    treasury = accounts[4];

    CashTestToken = await ethers.getContractFactory("CashTestToken");

    cash = await CashTestToken.deploy([
      owner.address,
      user1.address,
      user2.address,
      user3.address,
    ]);

    NewNFT = await ethers.getContractFactory("NewNFT");
    newNFT = await upgrades.deployProxy(NewNFT, [
      owner.address,
      "New NFT",
      "NNFT",
      cash.address,
      treasury.address,
    ]);

    await newNFT.deployed();

    // let logic = await upgrades.erc1967.getImplementationAddress(
    //     newNFT.address
    // );
  });

  describe("Deployment:", async () => {
    it("Check name, symbol and default state: ", async () => {
      const name = await newNFT.name();
      const symbol = await newNFT.symbol();
      expect(name).to.equal("New NFT");
      expect(symbol).to.equal("NNFT");

      const NOVICE_FIGHTER_PRICE = await newNFT.NOVICE_FIGHTER_PRICE();
      const ACCOMPLISHED_GENERAL_PRICE = await newNFT.ACCOMPLISHED_GENERAL_PRICE();
      const POWERFUL_LEADER_PRICE = await newNFT.POWERFUL_LEADER_PRICE();

      expect(NOVICE_FIGHTER_PRICE.toString()).to.equal("10000000000000000000");
      expect(ACCOMPLISHED_GENERAL_PRICE.toString()).to.equal(
        "15000000000000000000"
      );
      expect(POWERFUL_LEADER_PRICE.toString()).to.equal("20000000000000000000");
    });
    it("Check tokenURI: ", async () => {
      const baseURI = await newNFT.baseURI();
      expect(baseURI).to.equal("");

      const URI = "this_is_base_uri";
      const tx = await newNFT.setBaseURI(URI);
      await tx.wait();
      const newURI = await newNFT.baseURI();

      expect(newURI).to.equal(URI);
    });
    it("Check Owner: ", async () => {
      const ownerAddress = await newNFT.owner();
      expect(ownerAddress).to.equal(owner.address);
    });
    it("Check only have an NFT per account: ", async () => {
      // buy category
      await cash.connect(user1).approve(newNFT.address, MAX_LIMIT);
      await newNFT.connect(user1).buy(0);

      await expect(newNFT.connect(user1).buy(2)).to.be.revertedWith(
        "NFT: caller or receiver had an NFT Card."
      );
    });
  });
  // get function
  describe("isActive Function:", async () => {
    it("should return status isActive: ", async () => {
      await cash.connect(user1).approve(newNFT.address, MAX_LIMIT);
      const tx1 = await newNFT.connect(user1).buy(2);
      await tx1.wait();

      expect(await newNFT.isActive(0)).to.equal(true);
      const _365Days = 365 * 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [_365Days + 1999]);
      await ethers.provider.send("evm_mine");
      expect(await newNFT.isActive(0)).to.equal(false);
    });
  });

  describe("getExpireTime Function:", async () => {
    it("should return expired time: ", async () => {
      await cash.connect(user1).approve(newNFT.address, MAX_LIMIT);
      const tx1 = await newNFT.connect(user1).buy(2);
      await tx1.wait();
      const _365Days = 365 * 24 * 60 * 60;
      const timestamp = (await ethers.provider.getBlock(tx1.blockNumber))
        .timestamp;
      expect(await newNFT.getExpireTime(0)).to.equal(timestamp + _365Days);
    });
  });
  describe("getTreasury Function:", async () => {
    it("should return treasury address: ", async () => {
      expect(await newNFT.connect(user1).getTreasury()).to.equal(
        treasury.address
      );
    });
  });
  describe("getCategory Function:", async () => {
    it("should return NFT category: ", async () => {
      await cash.connect(user1).approve(newNFT.address, MAX_LIMIT);
      const Category = 2;
      const tx1 = await newNFT.connect(user1).buy(Category);
      await tx1.wait();
      expect(await newNFT.getCategory(0)).to.equal(Category);
    });
  });
  describe("getCard Function:", async () => {
    it("should return all information of this card: ", async () => {
      await cash.connect(user1).approve(newNFT.address, MAX_LIMIT);
      const Category = 2;
      const tx1 = await newNFT.connect(user1).buy(Category);
      await tx1.wait();
      const expireTime = await newNFT.getExpireTime(0);
      const card = await newNFT.getCard(0);

      expect(card.category).to.equal(Category);
      expect(card.expireTime).to.equal(expireTime);
    });
  });
  describe("getCurrentIndexes Function:", async () => {
    it("should return token counter: ", async () => {
      expect(await newNFT.getCurrentIndexes(0)).to.equal(0);
      expect(await newNFT.getCurrentIndexes(1)).to.equal(0);
      expect(await newNFT.getCurrentIndexes(2)).to.equal(0);

      await cash.connect(user1).approve(newNFT.address, MAX_LIMIT);
      const Category = 2;
      const tx1 = await newNFT.connect(user1).buy(Category);
      await tx1.wait();

      expect(await newNFT.getCurrentIndexes(2)).to.equal(1);
    });
  });
  describe("getPrice Function:", async () => {
    it("should return expired time: ", async () => {
      expect(await newNFT.getPrice(0)).to.equal("10000000000000000000");
      expect(await newNFT.getPrice(1)).to.equal("15000000000000000000");
      expect(await newNFT.getPrice(2)).to.equal("20000000000000000000");
    });
  });
  // set function
  describe("setAdmin Function:", async () => {
    it("should edit admin for extra new account: ", async () => {
      await expect(
        newNFT.connect(user2).setTreasury(user2.address)
      ).to.be.revertedWith("Ownable: caller is not an admin");
      await newNFT.connect(owner).setAdmin(user2.address, true);
      expect(await newNFT.isAdmin(user2.address)).to.equal(true);
    });
  });
  describe("setTreasury Function:", async () => {
    it("should change to new an treasury account: ", async () => {
      await newNFT.connect(owner).setTreasury(user2.address);
      expect(await newNFT.connect(owner).getTreasury()).to.equal(user2.address);
    });
  });
  describe("setFreezeStatus Function:", async () => {
    it("should return freeze status: ", async () => {
      await cash.connect(user1).approve(newNFT.address, MAX_LIMIT);
      const Category = 2;
      const tx1 = await newNFT.connect(user1).buy(Category);
      await tx1.wait();

      expect(await newNFT.connect(user1).isActive(0)).to.equal(true);

      await newNFT.setFreezeStatus(0, true);

      expect(await newNFT.connect(user1).isActive(0)).to.equal(false);
    });
  });
  describe("activate Function:", async () => {
    it("should revert when not is an Powerful Leader Card: ", async () => {
      await cash.connect(user1).approve(newNFT.address, MAX_LIMIT);
      const Category = 1;
      const tx1 = await newNFT.connect(user1).buy(Category);
      await tx1.wait();

      await expect(newNFT.connect(owner).activate(0)).to.be.revertedWith(
        "This NFT always active !"
      );
    });
    it("should be active success: ", async () => {
      await cash.connect(user1).approve(newNFT.address, MAX_LIMIT);
      const Category = 2;
      const tx1 = await newNFT.connect(user1).buy(Category);
      await tx1.wait();

      await newNFT.connect(owner).setFreezeStatus(0, true);
      expect(await newNFT.connect(owner).isActive(0)).to.equal(false);

      await newNFT.connect(owner).activate(0);
      expect(await newNFT.connect(owner).isActive(0)).to.equal(true);
    });
  });
  // mint function
  describe("buy Function:", async () => {
    it("should revert when function was called with incorrect parameters: ", async () => {
      await cash.connect(user1).approve(newNFT.address, MAX_LIMIT);
      const Category = 3;
      await expect(newNFT.connect(user1).buy(Category)).to.be.revertedWith(
        "Transaction reverted: function was called with incorrect parameters"
      );
    });
    it("should mint success: ", async () => {
      await cash.connect(user2).approve(newNFT.address, MAX_LIMIT);
      const Category = 2;
      await newNFT.connect(user2).buy(Category);
      expect(await newNFT.balanceOf(user2.address)).to.equal(1);
    });
  });
});
