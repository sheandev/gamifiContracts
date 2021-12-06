const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime } = require("./utils");

const THREE_MONTHS = 7776000; // seconds
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

    const ERC20 = await ethers.getContractFactory("TokenTest");
    token = await ERC20.deploy("MiToken", "MIT");

    const Staking = await ethers.getContractFactory("Staking");
    staking = await Staking.deploy(token.address, memberCard.address);

    await token.setStakeContract(staking.address);
    await token.connect(user1).approve(staking.address, MAX_INT);
    await token.connect(user2).approve(staking.address, MAX_INT);

  });

  describe("deposit", () => {
    it("", async () => {
      await token.connect(user1).ownerMint(ONE_ETHER);
      await memberCard.connect(user1).mintToken(user1.address, { value: FEE });

      const balance = (await memberCard.balanceOf(user1.address)).toString();
      expect(balance).to.equal("1");

      await staking.connect(user1).deposit(0, 100);

      let checkvalue = await staking.valueStake(user1.address, 0);
      expect(checkvalue.value).to.equal("100");

      checkvalue = await staking.valueStake(user1.address, 1);
      expect(checkvalue.value).to.equal("0");

      checkvalue = await staking.valueStake(user1.address, 2);
      expect(checkvalue.value).to.equal("0");

      await token.connect(user2).ownerMint(TEN_ETHER);
      await memberCard.connect(user2).mintToken(user2.address, { value: FEE });

      await staking.connect(user2).deposit(1, ONE_ETHER);
      await skipTime(THREE_MONTHS);

      let dataProfit = await staking.calProfit(0, user1.address);
      console.log("Profit user 1 : ", dataProfit.toString());
      
      dataProfit = await staking.calProfit(1, user2.address);
      console.log("Profit user 2 : ", dataProfit.toString());

      await staking.connect(user2).withdraw(1);

      // dataProfit = await staking.calProfit(1, user2.address);
      // console.log("Profit user 2 : ",dataProfit.toString());

      // expect(name).to.equal("TGE");
    });
  });
});
