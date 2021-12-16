const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime, getProfit, getProfitRoot } = require("./utils");
const { add, subtract, multiply, divide, compareTo } = require("js-big-decimal");
const Big = require("big.js");

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
      const deposedCash = "56874621512";
      let checkValue1;
      let checkValue2;
      let checkValue3;
      let checkValue4;
      
      beforeEach(async () => {
        await memberCard.connect(user1).mintToken(user1.address, { value: FEE });
        await tokenTest.connect(user1).ownerMint(ONE_ETHER);

        await memberCard.connect(user2).mintToken(user2.address, { value: FEE });
        await tokenTest.connect(user2).ownerMint(ONE_ETHER);

        await memberCard.connect(user3).mintToken(user3.address, { value: FEE });
        await tokenTest.connect(user3).ownerMint(ONE_ETHER);

        await memberCard.connect(user4).mintToken(user4.address, { value: FEE });
        await tokenTest.connect(user4).ownerMint(ONE_ETHER);
      })

      describe("Deposit with 30 days", () => {
        // ((1/365 * (1 + 100%))^30 - 1) * deposedCash
        // 30 days = 586.2511103
        // 15 days = 288.9509233

        beforeEach(async () => {
          await staking.connect(user1).deposit(POOL1, deposedCash);
          checkValue1 = await staking.valueStake(user1.address, POOL1);

          await staking.connect(user2).deposit(POOL1, deposedCash);
          checkValue2 = await staking.valueStake(user2.address, POOL1);

          await staking.connect(user3).deposit(POOL1, deposedCash);
          checkValue3 = await staking.valueStake(user3.address, POOL1);

          await staking.connect(user4).deposit(POOL1, deposedCash);
          checkValue4 = await staking.valueStake(user4.address, POOL1);

        })

        it("Only POOL 30 days", async () => {
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

        it("DeposedCash does not change when deducting the profit after 30 days", async () => {
          await skipTime(THREE_MONTHS);
          const ApyOnlyProfit = getProfit(POOL1, 30, deposedCash);

          let totalAfter30Days = (await staking.calAccumulatedStakeAmount(POOL1, user1.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter30Days = (await staking.calAccumulatedStakeAmount(POOL1, user2.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter30Days = (await staking.calAccumulatedStakeAmount(POOL1, user3.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter30Days = (await staking.calAccumulatedStakeAmount(POOL1, user4.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);
        });

        it("DeposedCash does not change when deducting the profit after 15 days", async () => {
          await skipTime(FIFTEEN_DAYS);
          const ApyOnlyProfit = getProfit(POOL1, 15, deposedCash);

          let totalAfter30Days = (await staking.calAccumulatedStakeAmount(POOL1, user1.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter30Days = (await staking.calAccumulatedStakeAmount(POOL1, user2.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter30Days = (await staking.calAccumulatedStakeAmount(POOL1, user3.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter30Days = (await staking.calAccumulatedStakeAmount(POOL1, user4.address)).toString();
          expect(divide(subtract(totalAfter30Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);
        });
        
        it("ApyOnlyProfit = Profit withdraw after 30 days", async () => {
          await skipTime(THREE_MONTHS)
          const ApyOnlyProfit = getProfit(POOL1, 30, deposedCash);

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

        it("ApyOnlyProfit = Profit withdraw after 15 days", async () => {
          await skipTime(FIFTEEN_DAYS)
          const ApyOnlyProfit = getProfit(POOL1, 15, deposedCash);

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
          await skipTime(THREE_MONTHS);
          const result = multiply(getProfitRoot(POOL1, 30, deposedCash), BIG_NUMBER).slice(0, 10);

          expect((await staking.calAccumulatedStakeAmount(POOL1, user1.address)).toString().slice(0,10)).to.equal(result);
          await staking.connect(user1).withdraw(POOL1);
          expect((await staking.calAccumulatedStakeAmount(POOL1, user1.address)).toString()).to.equal("0");

          expect((await staking.calAccumulatedStakeAmount(POOL1, user2.address)).toString().slice(0,10)).to.equal(result);
          await staking.connect(user2).withdraw(POOL1);
          expect((await staking.calAccumulatedStakeAmount(POOL1, user2.address)).toString()).to.equal("0");

          expect((await staking.calAccumulatedStakeAmount(POOL1, user3.address)).toString().slice(0,10)).to.equal(result);
          await staking.connect(user3).withdraw(POOL1);
          expect((await staking.calAccumulatedStakeAmount(POOL1, user3.address)).toString()).to.equal("0");

          expect((await staking.calAccumulatedStakeAmount(POOL1, user4.address)).toString().slice(0,10)).to.equal(result);
          await staking.connect(user4).withdraw(POOL1);
          expect((await staking.calAccumulatedStakeAmount(POOL1, user4.address)).toString()).to.equal("0");
        })

        it("Continue to deposit after 15 days", async () => {
          await skipTime(FIFTEEN_DAYS);
          const ProfitCurrent1 = (await staking.calAccumulatedStakeAmount(POOL1, user1.address)).toString();
          const ProfitCurrent2 = (await staking.calAccumulatedStakeAmount(POOL1, user2.address)).toString();
          const ProfitCurrent3 = (await staking.calAccumulatedStakeAmount(POOL1, user3.address)).toString();
          const ProfitCurrent4 = (await staking.calAccumulatedStakeAmount(POOL1, user4.address)).toString();

          await staking.connect(user1).deposit(POOL1, deposedCash);
          await staking.connect(user2).deposit(POOL1, deposedCash);
          await staking.connect(user3).deposit(POOL1, deposedCash);
          await staking.connect(user4).deposit(POOL1, deposedCash);
          await skipTime(FIFTEEN_DAYS);

          let result = multiply(
            getProfitRoot(POOL1, 15, add(ProfitCurrent1, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser1 = (await staking.calAccumulatedStakeAmount(POOL1, user1.address)).toString().slice(0, 10);
          expect(ProfitUser1).to.equal(result); 

          result = multiply(
            getProfitRoot(POOL1, 15, add(ProfitCurrent2, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser2 = (await staking.calAccumulatedStakeAmount(POOL1, user2.address)).toString().slice(0, 10);
          expect(ProfitUser2).to.equal(result); 

          result = multiply(
            getProfitRoot(POOL1, 15, add(ProfitCurrent3, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser3 = (await staking.calAccumulatedStakeAmount(POOL1, user3.address)).toString().slice(0, 10);
          expect(ProfitUser3).to.equal(result); 

          result = multiply(
            getProfitRoot(POOL1, 15, add(ProfitCurrent4, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser4 = (await staking.calAccumulatedStakeAmount(POOL1, user4.address)).toString().slice(0, 10);
          expect(ProfitUser4).to.equal(result); 
        })
      });

      describe("deposit with 45 days", () => {
        // ((1/365 * (1 + 200%))^45 - 1) * deposedCash 
        // const ApyOnlyProfit = "1450.466181";
        
        beforeEach(async () => {
          await staking.connect(user1).deposit(POOL2, deposedCash);
          checkValue1 = await staking.valueStake(user1.address, POOL2);

          await staking.connect(user2).deposit(POOL2, deposedCash);
          checkValue2 = await staking.valueStake(user2.address, POOL2);

          await staking.connect(user3).deposit(POOL2, deposedCash);
          checkValue3 = await staking.valueStake(user3.address, POOL2);

          await staking.connect(user4).deposit(POOL2, deposedCash);
          checkValue4 = await staking.valueStake(user4.address, POOL2);

        })

        it("Only POOL 45 days", async () => {
          checkValue1 = await staking.valueStake(user1.address, POOL1);
          expect(checkValue1.value).to.equal("0");
          checkValue1 = await staking.valueStake(user1.address, POOL2);
          expect(checkValue1.value).to.equal(deposedCash);
          checkValue1 = await staking.valueStake(user1.address, POOL3);
          expect(checkValue1.value).to.equal("0");

          checkValue2 = await staking.valueStake(user2.address, POOL1);
          expect(checkValue2.value).to.equal("0");
          checkValue2 = await staking.valueStake(user2.address, POOL2);
          expect(checkValue2.value).to.equal(deposedCash);
          checkValue2 = await staking.valueStake(user2.address, POOL3);
          expect(checkValue2.value).to.equal("0");

          checkValue3 = await staking.valueStake(user3.address, POOL1);
          expect(checkValue3.value).to.equal("0");
          checkValue3 = await staking.valueStake(user3.address, POOL2);
          expect(checkValue3.value).to.equal(deposedCash);
          checkValue3 = await staking.valueStake(user3.address, POOL3);
          expect(checkValue3.value).to.equal("0");

          checkValue4 = await staking.valueStake(user4.address, POOL1);
          expect(checkValue4.value).to.equal("0");
          checkValue4 = await staking.valueStake(user4.address, POOL2);
          expect(checkValue4.value).to.equal(deposedCash);
          checkValue4 = await staking.valueStake(user4.address, POOL3);
          expect(checkValue4.value).to.equal("0");
        })

        it("DeposedCash does not change when deducting the profit after 45 days", async () => {
          await skipTime(THREE_MONTHS);
          const ApyOnlyProfit = getProfit(POOL2, 45, deposedCash);

          let totalAfter45Days = (await staking.calAccumulatedStakeAmount(POOL2, user1.address)).toString();
          expect(divide(subtract(totalAfter45Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter45Days = (await staking.calAccumulatedStakeAmount(POOL2, user2.address)).toString();
          expect(divide(subtract(totalAfter45Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter45Days = (await staking.calAccumulatedStakeAmount(POOL2, user3.address)).toString();
          expect(divide(subtract(totalAfter45Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter45Days = (await staking.calAccumulatedStakeAmount(POOL2, user4.address)).toString();
          expect(divide(subtract(totalAfter45Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);
        });

        it("DeposedCash does not change when deducting the profit after 15 days", async () => {
          await skipTime(FIFTEEN_DAYS);
          const ApyOnlyProfit = getProfit(POOL2, 15, deposedCash);

          let totalAfter45Days = (await staking.calAccumulatedStakeAmount(POOL2, user1.address)).toString();
          expect(divide(subtract(totalAfter45Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter45Days = (await staking.calAccumulatedStakeAmount(POOL2, user2.address)).toString();
          expect(divide(subtract(totalAfter45Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter45Days = (await staking.calAccumulatedStakeAmount(POOL2, user3.address)).toString();
          expect(divide(subtract(totalAfter45Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter45Days = (await staking.calAccumulatedStakeAmount(POOL2, user4.address)).toString();
          expect(divide(subtract(totalAfter45Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);
        });

        it("ApyOnlyProfit = Profit after withdraw 45 days", async () => {
          await skipTime(THREE_MONTHS);
          const ApyOnlyProfit = getProfit(POOL2, 45, deposedCash);

          let withdrawData = await staking.connect(user1).withdraw(POOL2);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          let profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user2).withdraw(POOL2);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user3).withdraw(POOL2);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user4).withdraw(POOL2);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));
        })

        it("ApyOnlyProfit = Profit after withdraw 15 days", async () => {
          await skipTime(FIFTEEN_DAYS);
          const ApyOnlyProfit = getProfit(POOL2, 15, deposedCash);

          let withdrawData = await staking.connect(user1).withdraw(POOL2);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          let profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user2).withdraw(POOL2);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user3).withdraw(POOL2);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user4).withdraw(POOL2);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));
        })

        it("Amount = 0 after withdraw", async () => {
          await skipTime(THREE_MONTHS);
          const result = multiply(getProfitRoot(POOL2, 45, deposedCash), BIG_NUMBER).slice(0, 10);

          expect((await staking.calAccumulatedStakeAmount(POOL2, user1.address)).toString().slice(0, 10)).to.equal(result)
          await staking.connect(user1).withdraw(POOL2);
          expect((await staking.calAccumulatedStakeAmount(POOL2, user1.address)).toString()).to.equal("0")

          expect((await staking.calAccumulatedStakeAmount(POOL2, user2.address)).toString().slice(0, 10)).to.equal(result)
          await staking.connect(user2).withdraw(POOL2);
          expect((await staking.calAccumulatedStakeAmount(POOL2, user2.address)).toString()).to.equal("0")

          expect((await staking.calAccumulatedStakeAmount(POOL2, user3.address)).toString().slice(0, 10)).to.equal(result)
          await staking.connect(user3).withdraw(POOL2);
          expect((await staking.calAccumulatedStakeAmount(POOL2, user3.address)).toString()).to.equal("0")

          expect((await staking.calAccumulatedStakeAmount(POOL2, user4.address)).toString().slice(0, 10)).to.equal(result)
          await staking.connect(user4).withdraw(POOL2);
          expect((await staking.calAccumulatedStakeAmount(POOL2, user4.address)).toString()).to.equal("0")
        })

        it("Continue to deposit after 15 days", async () => {
          await skipTime(FIFTEEN_DAYS);
          const ProfitCurrent1 = (await staking.calAccumulatedStakeAmount(POOL2, user1.address)).toString();
          const ProfitCurrent2 = (await staking.calAccumulatedStakeAmount(POOL2, user2.address)).toString();
          const ProfitCurrent3 = (await staking.calAccumulatedStakeAmount(POOL2, user3.address)).toString();
          const ProfitCurrent4 = (await staking.calAccumulatedStakeAmount(POOL2, user4.address)).toString();

          await staking.connect(user1).deposit(POOL2, deposedCash);
          await staking.connect(user2).deposit(POOL2, deposedCash);
          await staking.connect(user3).deposit(POOL2, deposedCash);
          await staking.connect(user4).deposit(POOL2, deposedCash);
          await skipTime(FIFTEEN_DAYS);

          let result = multiply(
            getProfitRoot(POOL2, 15, add(ProfitCurrent1, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser1 = (await staking.calAccumulatedStakeAmount(POOL2, user1.address)).toString().slice(0, 10);
          expect(ProfitUser1).to.equal(result);

          result = multiply(
            getProfitRoot(POOL2, 15, add(ProfitCurrent2, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser2 = (await staking.calAccumulatedStakeAmount(POOL2, user2.address)).toString().slice(0, 10);
          expect(ProfitUser2).to.equal(result); 

          result = multiply(
            getProfitRoot(POOL2, 15, add(ProfitCurrent3, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser3 = (await staking.calAccumulatedStakeAmount(POOL2, user3.address)).toString().slice(0, 10);
          expect(ProfitUser3).to.equal(result); 

          result = multiply(
            getProfitRoot(POOL2, 15, add(ProfitCurrent4, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser4 = (await staking.calAccumulatedStakeAmount(POOL2, user4.address)).toString().slice(0, 10);
          expect(ProfitUser4).to.equal(result); 
        })
      });

      describe("deposit with 60 days", () => {
        // ((1/365 * (1 + 300%))^60 - 1) * deposedCash
        // const ApyOnlyProfit = "2559.396337";
        // const ApyOnlyProfit = getProfit(4, 60, deposedCash);

        beforeEach(async () => {
          await staking.connect(user1).deposit(POOL3, deposedCash);
          checkValue1 = await staking.valueStake(user1.address, POOL3);

          await staking.connect(user2).deposit(POOL3, deposedCash);
          checkValue2 = await staking.valueStake(user2.address, POOL3);

          await staking.connect(user3).deposit(POOL3, deposedCash);
          checkValue3 = await staking.valueStake(user3.address, POOL3);

          await staking.connect(user4).deposit(POOL3, deposedCash);
          checkValue4 = await staking.valueStake(user4.address, POOL3);

        })

        it("Only POOL 60 days", async () => {
          checkValue1 = await staking.valueStake(user1.address, POOL1);
          expect(checkValue1.value).to.equal("0");
          checkValue1 = await staking.valueStake(user1.address, POOL2);
          expect(checkValue1.value).to.equal("0");
          checkValue1 = await staking.valueStake(user1.address, POOL3);
          expect(checkValue1.value).to.equal(deposedCash);

          checkValue2 = await staking.valueStake(user2.address, POOL1);
          expect(checkValue2.value).to.equal("0");
          checkValue2 = await staking.valueStake(user2.address, POOL2);
          expect(checkValue2.value).to.equal("0");
          checkValue2 = await staking.valueStake(user2.address, POOL3);
          expect(checkValue2.value).to.equal(deposedCash);

          checkValue3 = await staking.valueStake(user3.address, POOL1);
          expect(checkValue3.value).to.equal("0");
          checkValue3 = await staking.valueStake(user3.address, POOL2);
          expect(checkValue3.value).to.equal("0");
          checkValue3 = await staking.valueStake(user3.address, POOL3);
          expect(checkValue3.value).to.equal(deposedCash);

          checkValue4 = await staking.valueStake(user4.address, POOL1);
          expect(checkValue4.value).to.equal("0");
          checkValue4 = await staking.valueStake(user4.address, POOL2);
          expect(checkValue4.value).to.equal("0");
          checkValue4 = await staking.valueStake(user4.address, POOL3);
          expect(checkValue4.value).to.equal(deposedCash);
        })

        it("DeposedCash does not change when deducting the profit after 60 days", async () => {
          await skipTime(THREE_MONTHS);
          const ApyOnlyProfit = getProfit(POOL3, 60, deposedCash);
          
          let totalAfter60Days = (await staking.calAccumulatedStakeAmount(POOL3, user1.address)).toString();
          expect(divide(subtract(totalAfter60Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter60Days = (await staking.calAccumulatedStakeAmount(POOL3, user2.address)).toString();
          expect(divide(subtract(totalAfter60Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter60Days = (await staking.calAccumulatedStakeAmount(POOL3, user3.address)).toString();
          expect(divide(subtract(totalAfter60Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter60Days = (await staking.calAccumulatedStakeAmount(POOL3, user4.address)).toString();
          expect(divide(subtract(totalAfter60Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);
        });

        it("DeposedCash does not change when deducting the profit after 15 days", async () => {
          await skipTime(FIFTEEN_DAYS);
          const ApyOnlyProfit = getProfit(POOL3, 15, deposedCash);
          
          let totalAfter60Days = (await staking.calAccumulatedStakeAmount(POOL3, user1.address)).toString();
          expect(divide(subtract(totalAfter60Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter60Days = (await staking.calAccumulatedStakeAmount(POOL3, user2.address)).toString();
          expect(divide(subtract(totalAfter60Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter60Days = (await staking.calAccumulatedStakeAmount(POOL3, user3.address)).toString();
          expect(divide(subtract(totalAfter60Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);

          totalAfter60Days = (await staking.calAccumulatedStakeAmount(POOL3, user4.address)).toString();
          expect(divide(subtract(totalAfter60Days, multiply(ApyOnlyProfit, BIG_NUMBER)),
              BIG_NUMBER,
              precision
            )
          ).to.equal(deposedCash);
        });

        it("ApyOnlyProfit = Profit after withdraw 60 days", async () => {
          await skipTime(THREE_MONTHS);
          const ApyOnlyProfit = getProfit(POOL3, 60, deposedCash);

          let withdrawData = await staking.connect(user1).withdraw(POOL3);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          let profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user2).withdraw(POOL3);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user3).withdraw(POOL3);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user4).withdraw(POOL3);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));
        })

        it("ApyOnlyProfit = Profit after withdraw 15 days", async () => {
          await skipTime(FIFTEEN_DAYS);
          const ApyOnlyProfit = getProfit(POOL3, 15, deposedCash);

          let withdrawData = await staking.connect(user1).withdraw(POOL3);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          let profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user2).withdraw(POOL3);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user3).withdraw(POOL3);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));

          withdrawData = await staking.connect(user4).withdraw(POOL3);
          withdrawData = (await withdrawData.wait()).events[0];
          withdrawData = await withdrawData.getTransactionReceipt()
          profit = withdrawData.events[withdrawData.events.length - 2].args.toString()
          expect(profit.slice(0,9)).to.equal(multiply(ApyOnlyProfit, BIG_NUMBER).slice(0,9));
        })

        it("Amount = 0 after withdraw", async () => {
          await skipTime(THREE_MONTHS);
          const result = multiply(getProfitRoot(POOL3, 60, deposedCash), BIG_NUMBER).slice(0, 10);

          expect((await staking.calAccumulatedStakeAmount(POOL3, user1.address)).toString().slice(0, 10)).to.equal(result);
          await staking.connect(user1).withdraw(POOL3);
          expect((await staking.calAccumulatedStakeAmount(POOL3, user1.address)).toString()).to.equal("0");

          expect((await staking.calAccumulatedStakeAmount(POOL3, user2.address)).toString().slice(0, 10)).to.equal(result);
          await staking.connect(user2).withdraw(POOL3);
          expect((await staking.calAccumulatedStakeAmount(POOL3, user2.address)).toString()).to.equal("0");

          expect((await staking.calAccumulatedStakeAmount(POOL3, user3.address)).toString().slice(0, 10)).to.equal(result);
          await staking.connect(user3).withdraw(POOL3);
          expect((await staking.calAccumulatedStakeAmount(POOL3, user3.address)).toString()).to.equal("0");

          expect((await staking.calAccumulatedStakeAmount(POOL3, user4.address)).toString().slice(0, 10)).to.equal(result);
          await staking.connect(user4).withdraw(POOL3);
          expect((await staking.calAccumulatedStakeAmount(POOL3, user4.address)).toString()).to.equal("0");
        })

        it("Continue to deposit after 15 days", async () => {
          await skipTime(FIFTEEN_DAYS);
          const ProfitCurrent1 = (await staking.calAccumulatedStakeAmount(POOL3, user1.address)).toString();
          const ProfitCurrent2 = (await staking.calAccumulatedStakeAmount(POOL3, user2.address)).toString();
          const ProfitCurrent3 = (await staking.calAccumulatedStakeAmount(POOL3, user3.address)).toString();
          const ProfitCurrent4 = (await staking.calAccumulatedStakeAmount(POOL3, user4.address)).toString();

          await staking.connect(user1).deposit(POOL3, deposedCash);
          await staking.connect(user2).deposit(POOL3, deposedCash);
          await staking.connect(user3).deposit(POOL3, deposedCash);
          await staking.connect(user4).deposit(POOL3, deposedCash);
          await skipTime(FIFTEEN_DAYS);

          let result = multiply(
            getProfitRoot(POOL3, 15, add(ProfitCurrent1, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser1 = (await staking.calAccumulatedStakeAmount(POOL3, user1.address)).toString().slice(0, 10);
          expect(ProfitUser1).to.equal(result); 

          result = multiply(
            getProfitRoot(POOL3, 15, add(ProfitCurrent2, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser2 = (await staking.calAccumulatedStakeAmount(POOL3, user2.address)).toString().slice(0, 10);
          expect(ProfitUser2).to.equal(result); 

          result = multiply(
            getProfitRoot(POOL3, 15, add(ProfitCurrent3, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser3 = (await staking.calAccumulatedStakeAmount(POOL3, user3.address)).toString().slice(0, 10);
          expect(ProfitUser3).to.equal(result); 

          result = multiply(
            getProfitRoot(POOL3, 15, add(ProfitCurrent4, deposedCash)),
            BIG_NUMBER
          ).slice(0, 10);
          const ProfitUser4 = (await staking.calAccumulatedStakeAmount(POOL3, user4.address)).toString().slice(0, 10);
          expect(ProfitUser4).to.equal(result); 
        })
      });

    });

});
