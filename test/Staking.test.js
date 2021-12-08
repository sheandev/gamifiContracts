const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime } = require("./utils");
const { add, subtract, multiply, divide } = require("js-big-decimal");

const THREE_MONTHS = 7776000; // seconds
const ONE_MONTH = 2592000;

const FEE = "50000000000000000";

const ONE_ETHER = "1000000000000000000";
const TEN_ETHER = "10000000000000000000";
const MAX_INT = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

describe("Staking", () => {
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];

    const MemberCard = await ethers.getContractFactory("MemberCard");
    memberCard = await MemberCard.deploy("Member Card NFT", "MCN", 3, THREE_MONTHS);

    const TokenTest = await ethers.getContractFactory("TokenTest");
    tokenTest = await TokenTest.deploy("MiToken", "MIT");

    const Staking = await ethers.getContractFactory("Staking");
    staking = await Staking.deploy(tokenTest.address, memberCard.address);

    await tokenTest.setStakeContract(staking.address);
    await tokenTest.connect(user1).approve(staking.address, MAX_INT);
    await tokenTest.connect(user2).approve(staking.address, MAX_INT);

  });

  describe("deposit", () => {

    it("Not allow when not have MemberCard", async () => {
      await tokenTest.connect(user1).ownerMint(ONE_ETHER);
      await expect(staking.connect(user1).deposit(0, 100)).to.be.revertedWith("Must have MemberCard");
    })

    it("Allow when have MemberCard", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      const balance = (await memberCard.balanceOf(user1.address)).toString();
      expect(balance).to.equal("1");

      await tokenTest.connect(user1).ownerMint(ONE_ETHER);
      await staking.connect(user1).deposit(0, 100);
    })

    it("Not allow when transfer deposit > balance", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      const balance = (await memberCard.balanceOf(user1.address)).toString();
      expect(balance).to.equal("1");

      await tokenTest.connect(user1).ownerMint(100);
      await expect(staking.connect(user1).deposit(0, ONE_ETHER)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    })

    it("Allow when transfer deposit < balance", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      const balance = (await memberCard.balanceOf(user1.address)).toString();
      expect(balance).to.equal("1");

      await tokenTest.connect(user1).ownerMint(ONE_ETHER);
      await staking.connect(user1).deposit(0, 100);
    })

    it("Allow when transfer deposit = balance", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      const balance = (await memberCard.balanceOf(user1.address)).toString();
      expect(balance).to.equal("1");

      await tokenTest.connect(user1).ownerMint(ONE_ETHER);
      await staking.connect(user1).deposit(0, ONE_ETHER);
    })

    it("deposit with 30 day", async () => {
      const depositAmount = "100";

      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      const balance = (await memberCard.balanceOf(user1.address)).toString();
      expect(balance).to.equal("1");

      await tokenTest.connect(user1).ownerMint(ONE_ETHER);
      await staking.connect(user1).deposit(0, depositAmount);

      // user1 check value staked with 30 day
      let checkValue = await staking.valueStake(user1.address, 0);
      expect(checkValue.value).to.equal(depositAmount);

      await skipTime(THREE_MONTHS);

      // user1 check value staked with 45 day
      checkValue = await staking.valueStake(user1.address, 1);
      expect(checkValue.value).to.equal("0");

      // user1 check value staked with 60 day
      checkValue = await staking.valueStake(user1.address, 2);
      expect(checkValue.value).to.equal("0");

      let profit = (await staking.calProfit(0, user1.address)).toString();
      expect(
        divide(
          subtract(profit, multiply("5.862511103", ONE_ETHER)),
          ONE_ETHER, 0
        )
      ).to.equal(depositAmount);

    });
  });
});
