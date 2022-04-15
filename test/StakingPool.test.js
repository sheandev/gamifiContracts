const { ethers, upgrades } = require("hardhat");
const { expect, use } = require("chai");
const { skipTime, getProfit, getProfitRoot, acceptable } = require("./utils");
const {
  add,
  subtract,
  multiply,
  divide,
  compareTo,
} = require("js-big-decimal");

const MAX_INT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

describe("StakingPool", () => {
  let admin, user1, user2, user3, treasury;
  let newNFT;
  let gmi;
  let stakingPool;
  let CURRENT_TIME;
  let RATE_TYPE_1 = "12683916793";
  let RATE_TYPE_2 = "19025875190";
  let RATE_TYPE_3 = "25367833587";
  let RATE_DEFAULT = "6341958396";
  let TIME_ONE_YEAR = 365 * 24 * 60 * 60;
  let TIME_NINE_MONTHS = 270 * 24 * 60 * 60;
  let TIME_SIX_MONTHS = 180 * 24 * 60 * 60;
  let TIME_THREE_MONTHS = 90 * 24 * 60 * 60;
  let MAX_TOKEN = "40000000000000000000000000";
  beforeEach(async () => {
    const blockNumAfter = await ethers.provider.getBlockNumber();
    const blockAfter = await ethers.provider.getBlock(blockNumAfter);
    const timestampAfter = blockAfter.timestamp;
    CURRENT_TIME = timestampAfter;
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    treasury = accounts[4];

    const Gmi = await ethers.getContractFactory("TokenGMI");
    gmi = await Gmi.deploy();
    await gmi.addController(admin.address);

    const NewNFT = await ethers.getContractFactory("NewNFT");
    newNFT = await upgrades.deployProxy(NewNFT, [
      admin.address,
      "New NFT",
      "NNFT",
      gmi.address,
      treasury.address,
    ]);

    const StakingPool = await ethers.getContractFactory("StakingPool");
    stakingPool = await upgrades.deployProxy(
      StakingPool,
      [admin.address, gmi.address, gmi.address, newNFT.address, CURRENT_TIME],
      {
        unsafeAllow: ["constructor", "delegatecall"],
      }
    );
    await gmi.mint(admin.address, "10000000000000000000000000000000");
    await gmi.mint(user1.address, "1000000000000000000000");
    await gmi.mint(user2.address, "1000000000000000000000");
    await gmi.mint(user3.address, "1000000000000000000000");

    await gmi.connect(admin).approve(admin.address, MAX_INT);
    await gmi.connect(admin).approve(user1.address, MAX_INT);
    await gmi.connect(admin).approve(user2.address, MAX_INT);
    await gmi.connect(admin).approve(user3.address, MAX_INT);

    await gmi.connect(admin).approve(newNFT.address, MAX_INT);
    await gmi.connect(user1).approve(newNFT.address, MAX_INT);
    await gmi.connect(user2).approve(newNFT.address, MAX_INT);

    await gmi.connect(admin).approve(stakingPool.address, MAX_INT);
    await gmi.connect(user1).approve(stakingPool.address, MAX_INT);
    await gmi.connect(user2).approve(stakingPool.address, MAX_INT);

    await newNFT.connect(admin).buy(2);
  });

  describe("Deployment: ", async () => {
    it("should return default value (timestarted,...): ", async () => {
      expect(await stakingPool._timeStarted()).to.equal(CURRENT_TIME);
      expect(await stakingPool.getDuration(3)).to.equal(TIME_ONE_YEAR);
      expect(await stakingPool.getStakeToken()).to.equal(gmi.address);
      expect(await stakingPool._stakedAmount()).to.equal(0);
      expect(await stakingPool.getRewardRate(3)).to.equal(RATE_DEFAULT);
      expect(await stakingPool.getRewardToken()).to.equal(gmi.address);
    });
  });
  describe("Check getter function: ", async () => {
    it("should getRewardToken function return correct: ", async () => {
      expect(await stakingPool.getRewardToken()).to.equal(gmi.address);
    });
    it("should getRewardRate function return correct: ", async () => {
      expect(await stakingPool.getRewardRate(0)).to.equal(RATE_TYPE_1);
      expect(await stakingPool.getRewardRate(1)).to.equal(RATE_TYPE_2);
      expect(await stakingPool.getRewardRate(2)).to.equal(RATE_TYPE_3);
      expect(await stakingPool.getRewardRate(3)).to.equal(RATE_DEFAULT);
    });
    it("should getStakeToken function return correct: ", async () => {
      expect(await stakingPool.getStakeToken()).to.equal(gmi.address);
    });
    it("should getDuration function return correct: ", async () => {
      expect(await stakingPool.getDuration(0)).to.equal(TIME_THREE_MONTHS);
      expect(await stakingPool.getDuration(1)).to.equal(TIME_SIX_MONTHS);
      expect(await stakingPool.getDuration(2)).to.equal(TIME_NINE_MONTHS);
      expect(await stakingPool.getDuration(3)).to.equal(TIME_ONE_YEAR);
    });
    it("should getUserAmount function return correct: ", async () => {
      const duration = 0;
      expect(
        await stakingPool.connect(admin).getUserAmount(admin.address, duration)
      ).to.equal(0);
    });
    it("should getCategoryNFT function return correct: ", async () => {
      // mint
      const category = 2;
      await gmi.connect(user1).approve(newNFT.address, MAX_INT);
      await newNFT.connect(user1).buy(category);
      expect(await stakingPool.getCategoryNFT(user1.address)).to.equal(
        category
      );
    });
    it("should hasNFT function return correct: ", async () => {
      // mint
      const category = 2;
      await gmi.connect(user1).approve(newNFT.address, MAX_INT);
      await newNFT.connect(user1).buy(category);
      expect(await stakingPool.getCategoryNFT(user1.address)).to.equal(
        category
      );
    });
    it("should getUserAvailableReward function return correct: ", async () => {
      // mint
      const category = 2;
      const duration = 0;
      const amount = "1000000";
      await gmi.connect(user1).approve(newNFT.address, MAX_INT);
      await newNFT.connect(user1).buy(category);
      await stakingPool.connect(user1).deposit(amount, duration);
      expect(
        await stakingPool.getUserAvailableReward(user1.address, duration)
      ).to.equal(0);
    });
  });
  describe("Check getRealityRate function: ", async () => {
    it("should getRealityRate function return correct: ", async () => {
      // mint
      const category = 2;
      const duration = 0;
      const amount = "1000000";
      await gmi.connect(user1).approve(newNFT.address, MAX_INT);
      await newNFT.connect(user1).buy(category);
      await stakingPool.connect(user1).deposit(amount, duration);

      const realityValue = await stakingPool.getRealityRate(
        user1.address,
        duration
      );
      const epsilon = 10;
      expect(
        acceptable(
          realityValue,
          divide(multiply(RATE_TYPE_3, 1), 4, 0).toString(),
          epsilon
        )
      ).to.be.true;
    });
  });
  describe("Check _calReward function: ", async () => {
    it("should _calReward function return correct: ", async () => {
      // mint
      const category = 2;
      const duration = 0;
      const amount = "1000000";
      await gmi.connect(user1).approve(newNFT.address, MAX_INT);
      await newNFT.connect(user1).buy(category);
      const tx = await stakingPool.connect(user1).deposit(amount, duration);
      const timestamp = (await ethers.provider.getBlock(tx.blockNumber))
        .timestamp;

      skipTime(TIME_THREE_MONTHS);
      const value = await stakingPool._calReward(user1.address, duration);
      const blockNumAfter = await ethers.provider.getBlockNumber();
      const blockAfter = await ethers.provider.getBlock(blockNumAfter);
      const timestampAfter = blockAfter.timestamp;
      const currentTime = timestampAfter;
      const delta = currentTime - timestamp;
      const realityValue = await stakingPool.getRealityRate(
        user1.address,
        duration
      );

      const epsilon = 10;
      expect(
        acceptable(
          value,
          divide(
            multiply(multiply(amount, delta), realityValue),
            "1000000000000000000"
          ).toString(),
          epsilon
        )
      ).to.be.true;
    });
  });
  describe("Check pendingRewards function: ", async () => {
    it("should pendingRewards function return correct: ", async () => {
      // mint
      const category = 2;
      const duration = 0;

      const amount = "1000000";
      await gmi.connect(user1).approve(newNFT.address, MAX_INT);
      await newNFT.connect(user1).buy(category);

      await stakingPool.connect(user1).deposit(amount, duration);

      skipTime(TIME_THREE_MONTHS);

      const value = await stakingPool._calReward(user1.address, duration);
      const pReward = await stakingPool.getUserAvailableReward(
        user1.address,
        duration
      );
      const pendingRewards = await stakingPool.pendingRewards(
        user1.address,
        duration
      );

      const epsilon = 10;
      expect(
        acceptable(pendingRewards.toString(), add(pReward, value), epsilon)
      ).to.be.true;
    });
  });
  describe("Check deposit function: ", async () => {
    it("should deposit success and log event success: ", async () => {
      const amount = 10000;
      const duration = 1;
      await expect(stakingPool.connect(user1).deposit(amount, duration))
        .to.emit(stakingPool, "Deposited")
        .withArgs(user1.address, amount, 1);
      expect(
        await stakingPool.connect(user1).getUserAmount(user1.address, duration)
      ).to.equal(10000);
    });
    it("should revert when max staking limit has been reached: ", async () => {
      const duration = 1;
      await expect(
        stakingPool.deposit(add(MAX_TOKEN, 1), duration)
      ).to.be.revertedWith("Staking: Max staking limit has been reached.");
    });
    it("should revert when staking has already ended: ", async () => {
      const timming = 900 * 24 * 60 * 60;
      const duration = 1;
      skipTime(timming);
      await expect(stakingPool.deposit(10000, duration)).to.be.revertedWith(
        "Staking: Staking has already ended."
      );
    });
  });

  describe("Check withdraw function: ", async () => {
    it("should revert when staking pool has not expired yet: ", async () => {
      const timming = 1 * 24 * 60 * 60;
      const duration = 2;
      await stakingPool.connect(user1).deposit(10000, duration);
      skipTime(timming);
      await expect(stakingPool.withdraw(10000, duration)).to.be.revertedWith(
        "Staking: StakingPool has not expired yet.."
      );
    });
    it("should revert when can not unstake more than staked amount: ", async () => {
      const timming = 365 * 24 * 60 * 60;
      const duration = 0;
      await gmi
        .connect(admin)
        .transfer(stakingPool.address, "1000000000000000000000000000");
      await stakingPool.connect(user2).deposit("1000000000000000000", duration);

      skipTime(timming);

      await expect(
        stakingPool.connect(user2).withdraw("30000000000000000000", duration)
      ).to.be.revertedWith("Staking: Cannot unstake more than staked amount.");
    });
    it("should return true pending Reward for withdraw correct and log event success: ", async () => {
      const timming = 365 * 24 * 60 * 60;
      const duration = 0;
      await gmi
        .connect(admin)
        .transfer(stakingPool.address, "1000000000000000000000000000");

      await stakingPool.connect(user2).deposit("1000000000000000000", duration);

      skipTime(timming);
      // await expect().to.equal();
      await expect(
        stakingPool.connect(user2).withdraw("1000000000000000000", duration)
      )
        .to.emit(stakingPool, "Withdrawed")
        .withArgs(user2.address, "1000000000000000000", duration);
    });
  });

  describe("Check EmergencyWithdraw function: ", async () => {
    it("should deposit success: ", async () => {
      await gmi.connect(admin).transfer(stakingPool.address, 10000);
      await stakingPool.connect(admin).EmergencyWithdraw();
      expect(await stakingPool._stakedAmount()).to.equal(
        await gmi.balanceOf(stakingPool.address)
      );
    });
    it("should log event success: ", async () => {
      await gmi.connect(admin).transfer(stakingPool.address, 10000);
      const token = await stakingPool.getStakeToken();
      await expect(stakingPool.connect(admin).EmergencyWithdraw())
        .to.emit(stakingPool, "EmergencyWithdrawed")
        .withArgs(admin.address, token);
    });
  });
});
