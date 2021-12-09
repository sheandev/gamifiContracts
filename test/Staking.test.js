const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime } = require("./utils");
const { add, subtract, multiply, divide, compareTo } = require("js-big-decimal");

const THREE_MONTHS = 7776000; // seconds
const ONE_MONTH    = 2592000; // seconds
const FIFTEEN_DAYS = 1296000; // seconds

const precision  = 0;
const FEE        = "50000000000000000";
const BIG_NUMBER = "1000000000000000000";

const ONE_ETHER  = "1000000000000000000";
const TEN_ETHER  = "10000000000000000000";
const MAX_INT    = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

describe("Staking", () => {
  let admin, user1, user2, user3, user4;
  let memberCard;
  let tokenTest;
  let staking;

  const POOL1 = 0; // 30 days
  const POOL2 = 1; // 45 days
  const POOL3 = 2; // 60 days

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];

    const MemberCard = await ethers.getContractFactory("MemberCard");
    memberCard = await MemberCard.deploy("Member Card NFT", "MCN", 3, THREE_MONTHS);

    const TokenTest = await ethers.getContractFactory("TokenTest");
    tokenTest = await TokenTest.deploy("MiToken", "MIT");

    const Staking = await ethers.getContractFactory("Staking");
    staking = await Staking.deploy(tokenTest.address, memberCard.address);

    await tokenTest.setStakeContract(staking.address);
    await tokenTest.connect(user1).approve(staking.address, MAX_INT);
    await tokenTest.connect(user2).approve(staking.address, MAX_INT);
    await tokenTest.connect(user3).approve(staking.address, MAX_INT);
    await tokenTest.connect(user4).approve(staking.address, MAX_INT);

  });


    it("Not allow when not have MemberCard", async () => {
      await tokenTest.connect(user1).ownerMint(ONE_ETHER);
      await expect(staking.connect(user1).deposit(0, 100)).to.be.revertedWith("Must have MemberCard");
    })

    it("Allow when have MemberCard", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      const balance = (await memberCard.balanceOf(user1.address)).toString();
      expect(balance).to.equal("1");

      await tokenTest.connect(user1).ownerMint(ONE_ETHER);
      await staking.connect(user1).deposit(POOL1, 100);
    })

    it("Not allow when transfer deposit > balance", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      const balance = (await memberCard.balanceOf(user1.address)).toString();
      expect(balance).to.equal("1");

      await tokenTest.connect(user1).ownerMint(100);
      await expect(staking.connect(user1).deposit(POOL1, ONE_ETHER)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    })

    it("Allow when transfer deposit < balance", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      const balance = (await memberCard.balanceOf(user1.address)).toString();
      expect(balance).to.equal("1");

      await tokenTest.connect(user1).ownerMint(ONE_ETHER);
      await staking.connect(user1).deposit(POOL1, 100);
    })

    it("Allow when transfer deposit = balance", async () => {
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
      const balance = (await memberCard.balanceOf(user1.address)).toString();
      expect(balance).to.equal("1");

      await tokenTest.connect(user1).ownerMint(ONE_ETHER);
      await staking.connect(user1).deposit(POOL1, ONE_ETHER);
    })

    describe("Deposit", () => {
      const deposedCash = "100";
      let balanceUser1;
      let balanceUser2;
      let balanceUser3;
      let balanceUser4;

      let checkValue1;
      let checkValue2;
      let checkValue3;
      let checkValue4;
      
      beforeEach(async () => {
        await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
        balanceUser1 = (await memberCard.balanceOf(user1.address)).toString();
        await tokenTest.connect(user1).ownerMint(ONE_ETHER);

        await memberCard.connect(user2).mintToken(user2.address, { value: FEE });
        balanceUser2 = (await memberCard.balanceOf(user2.address)).toString();
        await tokenTest.connect(user2).ownerMint(ONE_ETHER);

        await memberCard.connect(user3).mintToken(user3.address, { value: FEE });
        balanceUser3 = (await memberCard.balanceOf(user3.address)).toString();
        await tokenTest.connect(user3).ownerMint(ONE_ETHER);

        await memberCard.connect(user4).mintToken(user4.address, { value: FEE });
        balanceUser4 = (await memberCard.balanceOf(user4.address)).toString();
        await tokenTest.connect(user4).ownerMint(ONE_ETHER);
      })

      describe("Deposit with 30 days", () => {
        // (1/365 * (1 + 100%))^30 * deposedCash
        const ApyOnlyProfit = "5.862511103";
        
        beforeEach(async () => {
          await staking.connect(user1).deposit(POOL1, deposedCash);
          checkValue1 = await staking.valueStake(user1.address, POOL1);

          await staking.connect(user2).deposit(POOL1, deposedCash);
          checkValue2 = await staking.valueStake(user2.address, POOL1);

          await staking.connect(user3).deposit(POOL1, deposedCash);
          checkValue3 = await staking.valueStake(user2.address, POOL1);

          await staking.connect(user4).deposit(POOL1, deposedCash);
          checkValue4 = await staking.valueStake(user2.address, POOL1);

          await skipTime(THREE_MONTHS);
        })

        it("Only 30 days", async () => {
          expect(checkValue1.value).to.equal(deposedCash);
          checkValue1 = await staking.valueStake(user1.address, POOL2);
          expect(checkValue1.value).to.equal("0");
          checkValue1 = await staking.valueStake(user1.address, POOL3);
          expect(checkValue1.value).to.equal("0");

          expect(checkValue2.value).to.equal(deposedCash);
          checkValue2 = await staking.valueStake(user2.address, POOL2);
          expect(checkValue2.value).to.equal("0");
          checkValue2 = await staking.valueStake(user2.address, POOL3);
          expect(checkValue2.value).to.equal("0");

          expect(checkValue3.value).to.equal(deposedCash);
          checkValue3 = await staking.valueStake(user3.address, POOL2);
          expect(checkValue3.value).to.equal("0");
          checkValue3 = await staking.valueStake(user3.address, POOL3);
          expect(checkValue3.value).to.equal("0");

          expect(checkValue4.value).to.equal(deposedCash);
          checkValue4 = await staking.valueStake(user4.address, POOL2);
          expect(checkValue4.value).to.equal("0");
          checkValue4 = await staking.valueStake(user4.address, POOL3);
          expect(checkValue4.value).to.equal("0");
        })

        it("DeposedCash does not change after deducting the profit", async () => {
          let totalAfter30Days = (await staking.calProfit(0, user1.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter30Days = (await staking.calProfit(0, user2.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter30Days = (await staking.calProfit(0, user3.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter30Days = (await staking.calProfit(0, user4.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);
        });
        
        it("ApyOnlyProfit = Profit after withdraw", async () => {
          let withdrawData = await staking.connect(user1).withdraw(POOL1);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          let profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user2).withdraw(POOL1);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user3).withdraw(POOL1);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user4).withdraw(POOL1);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));
        })
        
        it("Amount = 0 after withdraw", async () => {
          expect((await staking.calProfit(0, user1.address)).toString()).to.equal("105862511102991263200")
          await staking.connect(user1).withdraw(POOL1);
          expect((await staking.calProfit(0, user1.address)).toString()).to.equal("0")

          expect((await staking.calProfit(0, user2.address)).toString()).to.equal("105862511102991263200")
          await staking.connect(user2).withdraw(POOL1);
          expect((await staking.calProfit(0, user2.address)).toString()).to.equal("0")

          expect((await staking.calProfit(0, user3.address)).toString()).to.equal("105862511102991263200")
          await staking.connect(user3).withdraw(POOL1);
          expect((await staking.calProfit(0, user3.address)).toString()).to.equal("0")

          expect((await staking.calProfit(0, user4.address)).toString()).to.equal("105862511102991263200")
          await staking.connect(user4).withdraw(POOL1);
          expect((await staking.calProfit(0, user4.address)).toString()).to.equal("0")
        })
      });

      describe("deposit with 45 days", () => {
        // (1/365 * (1 + 100%))^45 * deposedCash
        const ApyOnlyProfit = "108.9214181";
      });

      describe("deposit with 60 days", () => {
        // (1/365 * (1 + 100%))^60 * deposedCash
        const ApyOnlyProfit = "112.0687126";
      });

    });

});
