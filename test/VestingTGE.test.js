const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime, setTime } = require("./utils");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { add, subtract, multiply, divide } = require('js-big-decimal');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe("VestingTGE", () => {
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    owner = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];

    const TokenGMI = await ethers.getContractFactory("TokenGMI");
    token = await TokenGMI.deploy();

    const VestingTGE = await ethers.getContractFactory("VestingTGE");
    vestingTGE = await VestingTGE.deploy(owner.address, token.address);

    await token.addController(admin.address);
    await token.mint(owner.address, '100000000000000000000000000'); // mint 1,000,000,000 token

    await token.connect(owner).approve(vestingTGE.address, MAX_UINT256.toString());
  })

  describe("constructor", () => {
    it("Should assign the owner successfully", async function () {
      const _owner = await vestingTGE.owner();
      expect(_owner).to.equal(owner.address, 'owner is not correctly');
    });

    it("Should assign percentTGE successfully", async function () {
      const percentTGE = await vestingTGE.percentTGE();
      expect(percentTGE.toString()).to.equal('100000000000000000', 'linear is not correctly');
    });

    it("Should assign cliff successfully", async function () {
      const cliff = await vestingTGE.cliff();
      expect(cliff.toString()).to.equal('2592000', 'linear is not correctly');
    });

    it("Should assign linear successfully", async function () {
      const linear = await vestingTGE.linear();
      expect(linear.toString()).to.equal('23328000', 'linear is not correctly');
    });
  });

  describe("initiateVest", () => {
    it('Should catch error Ownable: caller is not the owner', async () => {
      await expect(
        vestingTGE.connect(user2).initiateVest(user2.address, '100000000000000000000', Date.now())
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should catch error Vesting: owner_ is the zero address', async () => {
      await expect(
        vestingTGE.connect(owner).initiateVest(ZERO_ADDRESS, '100000000000000000000', Date.now())
      ).to.be.revertedWith('Vesting: owner_ is the zero address');
    });

    it('Should catch error Vesting: amount must be > 0', async () => {
      await expect(
        vestingTGE.connect(owner).initiateVest(user2.address, '0', Date.now())
      ).to.be.revertedWith('Vesting: amount must be > 0');
    });

    it('Should initiateVest successfully', async () => {
      const balanceOwner_before = await token.balanceOf(owner.address);
      const balanceVestingTGE_before = await token.balanceOf(vestingTGE.address);

      const amount = 100000000000000000000;
      const date = divide(Date.now(), 1000, 0);

      await vestingTGE.connect(owner).initiateVest(user2.address, amount.toString(), date);

      const balanceOwner_after = await token.balanceOf(owner.address);
      const balanceVestingTGE_after = await token.balanceOf(vestingTGE.address);

      expect(balanceOwner_after.toString()).to.equal(subtract(balanceOwner_before, amount.toString()), 'Invalid balance owner');
      expect(subtract(balanceOwner_before, balanceOwner_after)).to.equal(subtract(balanceVestingTGE_after, balanceVestingTGE_before), 'Invalid balance vesting');

      const nonce = await vestingTGE.getNonce(user2.address);
      const vestId = await vestingTGE.getVestId(user2.address, nonce - 1);
      const vest = await vestingTGE.getVest(vestId);
      expect(vest.owner).to.equal(user2.address, 'Invalid vest owner');
      expect(vest.amount.toString()).to.equal(amount.toString(), 'Invalid vest amount');

      expect(vest.start.toString()).to.equal(date.toString(), 'Invalid vest start');

      // initial = amount * percentTGE / SCALE = 100000000000000000000 * 100000000000000000 / 1000000000000000000 = 10000000000000000000
      expect(vest.initial).to.equal('10000000000000000000', 'Invalid vest initial');

      const cliff = await vestingTGE.cliff();
      expect(vest.cliff.toString()).to.equal(cliff.toString(), 'Invalid vest cliff');

      const linear = await vestingTGE.linear();
      expect(vest.linear.toString()).to.equal(linear.toString(), 'Invalid vest linear');
    });
  });

  describe("getClaimable", () => {
    beforeEach(async () => {
      const amount = 100000000000000000000;
      date = divide(Date.now(), 1000, 0);
      await vestingTGE.connect(owner).initiateVest(user2.address, amount.toString(), date);
    });

    it('Check getClaimable', async () => {
      // skip 3 months
      await skipTime(7776000);

      const nonce = await vestingTGE.getNonce(user2.address);
      const vestId = await vestingTGE.getVestId(user2.address, nonce - 1);
      const vest = await vestingTGE.getVest(vestId);
      const cliff = await vestingTGE.cliff();
      const linear = await vestingTGE.linear();

      let date_after = (await hre.ethers.provider.getBlock("latest")).timestamp;
      let amountAble = await vestingTGE.connect(user2).getClaimable(0);

      // ((date_after - (start + cliff)) * (amount - initial) / linear) + initial - claimed
      let amountAble_cal = subtract(add(divide(multiply(subtract(date_after, add(vest.start, cliff)),subtract(vest.amount, vest.initial)), linear, 0), vest.initial), vest.claimed)
      expect(amountAble.toString()).to.equal(amountAble_cal, 'Invalid vest amountable');

      // skip 3 months
      await skipTime(7776000);

      date_after = (await hre.ethers.provider.getBlock("latest")).timestamp;
      amountAble = await vestingTGE.connect(user2).getClaimable(0);

      // ((date_after - (start + cliff)) * (amount - initial) / linear) + initial - claimed
      amountAble_cal = subtract(add(divide(multiply(subtract(date_after, add(vest.start, cliff)),subtract(vest.amount, vest.initial)), linear, 0), vest.initial), vest.claimed)
      expect(amountAble.toString()).to.equal(amountAble_cal, 'Invalid vest amountable');

      // skip 4 months
      await skipTime(10368000);

      date_after = (await hre.ethers.provider.getBlock("latest")).timestamp;
      amountAble = await vestingTGE.connect(user2).getClaimable(0);

      // ((date_after - (start + cliff)) * (amount - initial) / linear) + initial - claimed
      amountAble_cal = subtract(vest.amount, vest.claimed);
      expect(amountAble.toString()).to.equal(amountAble_cal, 'Invalid vest amountable');

      expect(amountAble.toString()).to.equal(vest.amount.toString(), 'Invalid vest amountable');
    });
  });

  describe("claim", () => {
    beforeEach(async () => {
      const amount = 100000000000000000000;
      date = divide(Date.now(), 1000, 0);
      await vestingTGE.connect(owner).initiateVest(user2.address, amount.toString(), date);
    });

    it('Should catch error Vesting: No token to claim', async () => {
      await expect(
        vestingTGE.connect(user2).claim(1)
      ).to.be.revertedWith('Vesting: No token to claim');
    });

    it('Should claim successfully', async () => {
      await skipTime(-(10368000 + 7776000 + 7776000));
      // skip 3 months
      await skipTime(7776000);
      // cal claimable

      const balanceUser_before = await token.balanceOf(user2.address);
      const balanceVestingTGE_before = await token.balanceOf(vestingTGE.address);

      await vestingTGE.connect(user2).claim(0);

      const balanceUser_after = await token.balanceOf(user2.address);
      const balanceVestingTGE_after = await token.balanceOf(vestingTGE.address);

      const nonce = await vestingTGE.getNonce(user2.address);
      const vestId = await vestingTGE.getVestId(user2.address, nonce - 1);
      const vest_1 = await vestingTGE.getVest(vestId);

      expect(balanceUser_after.toString()).to.equal(add(balanceUser_before, vest_1.claimed.toString()), 'Invalid balance user2');
      expect(subtract(balanceUser_after, balanceUser_before)).to.equal(subtract(balanceVestingTGE_before, balanceVestingTGE_after), 'Invalid balance vesting');

      // skip 7 months
      await skipTime(181440000);
      await vestingTGE.connect(user2).claim(0);

      const balanceUser_after_2 = await token.balanceOf(user2.address);
      const balanceVestingTGE_after_2 = await token.balanceOf(vestingTGE.address);

      const vest_2 = await vestingTGE.getVest(vestId);
      expect(vest_2.claimed.toString()).to.equal(vest_2.amount.toString(), 'Invalid amount user2');

      expect(balanceUser_after_2.toString()).to.equal(add(balanceUser_after, subtract(vest_2.claimed.toString(), vest_1.claimed.toString())), 'Invalid balance user2');
      expect(subtract(balanceUser_after_2, balanceUser_after)).to.equal(subtract(balanceVestingTGE_after, balanceVestingTGE_after_2), 'Invalid balance vesting');
    });
  });
});
