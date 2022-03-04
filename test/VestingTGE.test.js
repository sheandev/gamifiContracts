const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime, setTime } = require("./utils");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { add, subtract, multiply, divide } = require('js-big-decimal');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const CLIFF = '2596000';
const LINEAR = '23328000';

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
    vestingTGE = await upgrades.deployProxy(VestingTGE, [owner.address, token.address]);

    await token.addController(admin.address);
    await token.mint(owner.address, '100000000000000000000000000'); // mint 1,000,000,000 token

    await token.connect(owner).approve(vestingTGE.address, MAX_UINT256.toString());
  })

  describe("constructor", () => {
    it("Should assign the owner successfully", async function () {
      const _owner = await vestingTGE.owner();
      expect(_owner).to.equal(owner.address, 'owner is not correctly');
    });
  });

  describe("initiateVests", () => {
    it('Should catch error Vesting: Bad length', async () => {
      await expect(
        vestingTGE.connect(owner).initiateVests([], ['100'], ['10'], '100', CLIFF, LINEAR)
      ).to.be.revertedWith('Vesting: Bad length');

      await expect(
        vestingTGE.connect(owner).initiateVests([user2.address], [], ['10'], '100', CLIFF, LINEAR)
      ).to.be.revertedWith('Vesting: Bad length');

      await expect(
        vestingTGE.connect(owner).initiateVests([user2.address], ['100'], [], '100', CLIFF, LINEAR)
      ).to.be.revertedWith('Vesting: Bad length');
    });

    it('Should catch error Vesting: Mismatched inputs', async () => {
      await expect(
        vestingTGE.connect(owner).initiateVests([user2.address, user3.address], ['100'], ['10'], '10', CLIFF, LINEAR)
      ).to.be.revertedWith('Vesting: Mismatched inputs');

      await expect(
        vestingTGE.connect(owner).initiateVests([user2.address], ['100', '100'], ['10'], '100', CLIFF, LINEAR)
      ).to.be.revertedWith('Vesting: Mismatched inputs');

      await expect(
        vestingTGE.connect(owner).initiateVests([user2.address], ['100'], ['10', '10'], '100', CLIFF, LINEAR)
      ).to.be.revertedWith('Vesting: Mismatched inputs');
    });

    it('Should catch error Vesting: Bad totalAmount', async () => {
      await expect(
        vestingTGE.connect(owner).initiateVests([user2.address, user3.address], ['100', '100'], ['10', '10'], '100', CLIFF, LINEAR)
      ).to.be.revertedWith('Vesting: Bad totalAmount');

      await expect(
        vestingTGE.connect(owner).initiateVests([user2.address], ['90'], ['9'], '100', CLIFF, LINEAR)
      ).to.be.revertedWith('Vesting: Bad totalAmount');
    });

    it('Should catch error Vesting: owner_ is the zero address', async () => {
      await expect(
        vestingTGE.connect(owner).initiateVests([ZERO_ADDRESS], ['100'], ['10'], '100', CLIFF, LINEAR)
      ).to.be.revertedWith('Vesting: owner_ is the zero address');
    });

    it('Should catch error Vesting: initial amount should be less than total amount.', async () => {
      await expect(
        vestingTGE.connect(owner).initiateVests([user2.address], ['100'], ['200'], '100', CLIFF, LINEAR)
      ).to.be.revertedWith('Vesting: initial amount should be less than total amount.');
    });

    it('Should initiateVests successfully', async () => {
      const balanceOwner_before = await token.balanceOf(owner.address);
      const balanceVestingTGE_before = await token.balanceOf(vestingTGE.address);
      const balanceUser_before = await token.balanceOf(user2.address);

      const amount = 100000000000000000000;

      let transaction = await vestingTGE.connect(owner).initiateVests([user2.address], [amount.toString()], [divide(amount.toString(), '10', 0)], amount.toString(), CLIFF, LINEAR);
      let blockNumber = (await ethers.provider.getTransaction(transaction.hash)).blockNumber;

      const date = (await hre.ethers.provider.getBlock(blockNumber)).timestamp;

      const balanceOwner_after = await token.balanceOf(owner.address);
      const balanceVestingTGE_after = await token.balanceOf(vestingTGE.address);
      const balanceUser_after = await token.balanceOf(user2.address);

      expect(balanceOwner_after.toString()).to.equal(subtract(balanceOwner_before, amount.toString()), 'Invalid balance owner');
      expect(subtract(balanceOwner_before, balanceOwner_after)).to.equal(add(subtract(balanceVestingTGE_after, balanceVestingTGE_before),subtract(balanceUser_after, balanceUser_before)), 'Invalid balance vesting');

      const vest = await vestingTGE.connect(user2).getVest();
      expect(vest.owner).to.equal(user2.address, 'Invalid vest owner');
      expect(vest.amount.toString()).to.equal(amount.toString(), 'Invalid vest amount');

      expect(vest.start.toString()).to.equal(date.toString(), 'Invalid vest start');

      // initial = amount * percentTGE / SCALE = 100000000000000000000 * 100000000000000000 / 1000000000000000000 = 10000000000000000000
      expect(vest.initial).to.equal('10000000000000000000', 'Invalid vest initial');

      expect(vest.cliff.toString()).to.equal(CLIFF, 'Invalid vest cliff');

      expect(vest.linear.toString()).to.equal(LINEAR, 'Invalid vest linear');
    });
  });

  describe("getClaimable", () => {
    beforeEach(async () => {
      const amount = 100000000000000000000;
      await vestingTGE.connect(owner).initiateVests([user2.address], [amount.toString()], [divide(amount.toString(), '10', 0)], amount.toString(), CLIFF, LINEAR);
    });

    it('Check getClaimable', async () => {
      // skip 3 months
      await skipTime(7776000);

      const vest = await vestingTGE.connect(user2).getVest();
      const subAmount = subtract(vest.amount, vest.initial);
      const addCliff = add(vest.start, vest.cliff);

      let date_after = (await hre.ethers.provider.getBlock("latest")).timestamp;
      let amountAble = await vestingTGE.connect(user2).getClaimable();

      let timePassed = subtract(date_after, addCliff);
      let tokenCliff = divide(multiply(timePassed, subAmount), vest.linear.toString(), 0);

      // ((date_after - (start + cliff)) * (amount - initial) / linear) + initial - claimed      
      let amountAble_cal = subtract(add(tokenCliff, vest.initial.toString()), vest.claimed.toString());
      expect(amountAble.toString()).to.equal(amountAble_cal, 'Invalid vest amountable 1');

      // skip 3 months
      await skipTime(7776000);

      date_after = (await hre.ethers.provider.getBlock("latest")).timestamp;
      amountAble = await vestingTGE.connect(user2).getClaimable();

      timePassed = subtract(date_after, addCliff);
      tokenCliff = divide(multiply(timePassed, subAmount), vest.linear.toString(), 0);

      // ((date_after - (start + cliff)) * (amount - initial) / linear) + initial - claimed
      amountAble_cal = subtract(add(tokenCliff, vest.initial.toString()), vest.claimed.toString());
      expect(amountAble.toString()).to.equal(amountAble_cal, 'Invalid vest amountable 2');

      // skip 4 months
      await skipTime(10372001);

      amountAble = await vestingTGE.connect(user2).getClaimable();

      amountAble_cal = subtract(vest.amount, vest.claimed);
      expect(amountAble.toString()).to.equal(amountAble_cal, 'Invalid vest amountable 3');

      expect(amountAble.toString()).to.equal(subtract(vest.amount, vest.initial), 'Invalid vest amountable 3');
    });
  });

  describe("claim", () => {
    beforeEach(async () => {
      const amount = 100000000000000000000;
      await vestingTGE.connect(owner).initiateVests([user2.address], [amount.toString()], [divide(amount.toString(), '10', 0)], amount.toString(), CLIFF, LINEAR);
    });

    it('Should catch error Vesting: No token to claim', async () => {
      await expect(
        vestingTGE.connect(user2).claim()
      ).to.be.revertedWith('Vesting: No token to claim');
    });

    it('Should claim successfully', async () => {
      // skip 3 months
      await skipTime(7776000);
      // cal claimable

      const balanceUser_before = await token.balanceOf(user2.address);
      const balanceVestingTGE_before = await token.balanceOf(vestingTGE.address);

      await vestingTGE.connect(user2).claim();

      const balanceUser_after = await token.balanceOf(user2.address);
      const balanceVestingTGE_after = await token.balanceOf(vestingTGE.address);

      const vest_1 = await vestingTGE.connect(user2).getVest();

      expect(balanceUser_after.toString()).to.equal(add(balanceUser_before, subtract(vest_1.claimed, vest_1.initial)), 'Invalid balance user2 round 1');
      expect(subtract(balanceUser_after, balanceUser_before)).to.equal(subtract(balanceVestingTGE_before, balanceVestingTGE_after), 'Invalid balance vesting round 1');

      // skip 7 months
      await skipTime(181440000);
      await vestingTGE.connect(user2).claim();

      const balanceUser_after_2 = await token.balanceOf(user2.address);
      const balanceVestingTGE_after_2 = await token.balanceOf(vestingTGE.address);

      const vest_2 = await vestingTGE.connect(user2).getVest();
      expect(vest_2.claimed.toString()).to.equal(vest_2.amount.toString(), 'Invalid amount user2 round 2');

      expect(balanceUser_after_2.toString()).to.equal(add(balanceUser_after, subtract(vest_2.claimed.toString(), vest_1.claimed.toString())), 'Invalid balance user2 round 3');
      expect(subtract(balanceUser_after_2, balanceUser_after)).to.equal(subtract(balanceVestingTGE_after, balanceVestingTGE_after_2), 'Invalid balance vesting round 2');
    });
  });
});
