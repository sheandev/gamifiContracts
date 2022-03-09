const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime, setTime } = require("../utils");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { add, subtract, multiply, divide } = require('js-big-decimal');

const CLIFF = '2596000';
const LINEAR = '23328000';

describe("VestingTGE - Integration", () => {
  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    owner = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];
    user5 = accounts[5];

    const TokenGMI = await ethers.getContractFactory("TokenGMI");
    token = await TokenGMI.deploy();

    const VestingTGE = await ethers.getContractFactory("VestingTGE");
    vestingTGE = await upgrades.deployProxy(VestingTGE, [owner.address, token.address]);

    await token.addController(admin.address);
    await token.mint(owner.address, '100000000000000000000000000'); // mint 1,000,000,000 token

    await token.connect(owner).approve(vestingTGE.address, MAX_UINT256.toString());
  });

  it('initiateVests user 2, 3, 4, 5', async () => {
    const balanceOwner_before = await token.balanceOf(owner.address);
    const balanceVestingTGE_before = await token.balanceOf(vestingTGE.address);
    const balanceUser_2_before = await token.balanceOf(user2.address);
    const balanceUser_3_before = await token.balanceOf(user3.address);
    const balanceUser_4_before = await token.balanceOf(user4.address);
    const balanceUser_5_before = await token.balanceOf(user5.address);

    const amount = 100000000000000000000;
    const amount_initial = divide(amount.toString(), '10', 0);
    const total_amount = multiply('4', amount.toString());

    expect(await vestingTGE.isVestingStarted()).to.be.false;

    let transaction = await vestingTGE.connect(owner).initiateVests([user2.address, user3.address, user4.address, user5.address],
      [amount.toString(), amount.toString(), amount.toString(), amount.toString()],
      [amount_initial, amount_initial, amount_initial, amount_initial],
      total_amount, CLIFF, LINEAR);

    expect(await vestingTGE.isVestingStarted()).to.be.true;

    let blockNumber = (await ethers.provider.getTransaction(transaction.hash)).blockNumber;
    const date = (await hre.ethers.provider.getBlock(blockNumber)).timestamp;

    const balanceOwner_after = await token.balanceOf(owner.address);
    const balanceVestingTGE_after = await token.balanceOf(vestingTGE.address);
    expect(balanceOwner_after.toString()).to.equal(subtract(balanceOwner_before, total_amount), 'Invalid balance owner');

    // user 2
    const balanceUser_2_after = await token.balanceOf(user2.address);
    expect(subtract(balanceUser_2_after, balanceUser_2_before)).to.equal(amount_initial, 'Invalid balance user 2 vesting');

    // user 3
    const balanceUser_3_after = await token.balanceOf(user3.address);
    expect(subtract(balanceUser_3_after, balanceUser_3_before)).to.equal(amount_initial, 'Invalid balance user 3 vesting');

    // user 4
    const balanceUser_4_after = await token.balanceOf(user4.address);
    expect(subtract(balanceUser_4_after, balanceUser_4_before)).to.equal(amount_initial, 'Invalid balance user 4 vesting');

    // user 5
    const balanceUser_5_after = await token.balanceOf(user5.address);
    expect(subtract(balanceUser_5_after, balanceUser_5_before)).to.equal(amount_initial, 'Invalid balance user 5 vesting');

    expect(subtract(balanceOwner_before, balanceOwner_after)).to.equal(add(subtract(balanceVestingTGE_after, balanceVestingTGE_before), multiply('4', amount_initial)), 'Invalid balance vesting');
  });

  it('User 2 claim token after 3 month', async () => {
    // skip 3 months
    await skipTime(7776000);
    // cal claimable

    const balanceUser_before = await token.balanceOf(user2.address);
    const balanceVestingTGE_before = await token.balanceOf(vestingTGE.address);

    await vestingTGE.connect(user2).claim();

    const balanceUser_after = await token.balanceOf(user2.address);
    const balanceVestingTGE_after = await token.balanceOf(vestingTGE.address);

    const vest_user_2 = await vestingTGE.vests(user2.address);

    expect(balanceUser_after.toString()).to.equal(add(balanceUser_before, subtract(vest_user_2.claimed, vest_user_2.initial)), 'Invalid balance user2');
    expect(subtract(balanceUser_after, balanceUser_before)).to.equal(subtract(balanceVestingTGE_before, balanceVestingTGE_after), 'Invalid balance vesting');

    // user 3
    const vest_user_3 = await vestingTGE.vests(user3.address);
    expect(vest_user_3.claimed).to.equal(vest_user_3.initial, 'Invalid balance user 3');

    // user 4
    const vest_user_4 = await vestingTGE.vests(user4.address);
    expect(vest_user_4.claimed).to.equal(vest_user_4.initial, 'Invalid balance user 4');

    // user 5
    const vest_user_5 = await vestingTGE.vests(user5.address);
    expect(vest_user_5.claimed).to.equal(vest_user_5.initial, 'Invalid balance user 5');
  });

  it('User 3 claim token after 4 month', async () => {
    // skip 1 months
    await skipTime(2592000);
    // cal claimable

    const balanceUser_2_before = await token.balanceOf(user2.address);
    const balanceUser_3_before = await token.balanceOf(user3.address);
    const balanceUser_4_before = await token.balanceOf(user4.address);
    const balanceUser_5_before = await token.balanceOf(user5.address);
    const balanceVestingTGE_before = await token.balanceOf(vestingTGE.address);

    await vestingTGE.connect(user3).claim();

    const balanceUser_2_after = await token.balanceOf(user2.address);
    const balanceUser_3_after = await token.balanceOf(user3.address);
    const balanceUser_4_after = await token.balanceOf(user4.address);
    const balanceUser_5_after = await token.balanceOf(user5.address);
    const balanceVestingTGE_after = await token.balanceOf(vestingTGE.address);

    // user 2
    expect(balanceUser_2_after.toString()).to.equal(balanceUser_2_before, 'Invalid balance user 2');

    // user 3
    const vest_user_3 = await vestingTGE.vests(user3.address);
    expect(balanceUser_3_after.toString()).to.equal(add(balanceUser_3_before, subtract(vest_user_3.claimed, vest_user_3.initial)), 'Invalid balance user 3');
    expect(subtract(balanceUser_3_after, balanceUser_3_before)).to.equal(subtract(balanceVestingTGE_before, balanceVestingTGE_after), 'Invalid balance vesting');

    // user 4
    const vest_user_4 = await vestingTGE.vests(user4.address);
    expect(balanceUser_4_after.toString()).to.equal(balanceUser_4_before, 'Invalid balance user 4');
    expect(vest_user_4.claimed).to.equal(vest_user_4.initial, 'Invalid balance user 4');

    // user 5
    const vest_user_5 = await vestingTGE.vests(user5.address);
    expect(balanceUser_5_after.toString()).to.equal(balanceUser_5_before, 'Invalid balance user 5');
    expect(vest_user_5.claimed).to.equal(vest_user_5.initial, 'Invalid balance user 5');
  });

  it('User 4 claim token after 10 month', async () => {
    // skip 6 months
    await skipTime(15556000);
    // cal claimable

    const balanceUser_2_before = await token.balanceOf(user2.address);
    const balanceUser_3_before = await token.balanceOf(user3.address);
    const balanceUser_4_before = await token.balanceOf(user4.address);
    const balanceUser_5_before = await token.balanceOf(user5.address);
    const balanceVestingTGE_before = await token.balanceOf(vestingTGE.address);

    await vestingTGE.connect(user4).claim();

    const balanceUser_2_after = await token.balanceOf(user2.address);
    const balanceUser_3_after = await token.balanceOf(user3.address);
    const balanceUser_4_after = await token.balanceOf(user4.address);
    const balanceUser_5_after = await token.balanceOf(user5.address);
    const balanceVestingTGE_after = await token.balanceOf(vestingTGE.address);

    // user 2
    expect(balanceUser_2_after.toString()).to.equal(balanceUser_2_before, 'Invalid balance user 2');

    // user 3
    expect(balanceUser_3_after.toString()).to.equal(balanceUser_3_before, 'Invalid balance user 3');

    // user 4
    const vest_user_4 = await vestingTGE.vests(user4.address);
    expect(balanceUser_4_after.toString()).to.equal(add(balanceUser_4_before, subtract(vest_user_4.claimed, vest_user_4.initial)), 'Invalid balance user 4');
    expect(vest_user_4.claimed).to.equal(vest_user_4.amount, 'Invalid balance user 4');
    expect(subtract(balanceUser_4_after, balanceUser_4_before)).to.equal(subtract(balanceVestingTGE_before, balanceVestingTGE_after), 'Invalid balance vesting');

    // user 5
    const vest_user_5 = await vestingTGE.vests(user5.address);
    expect(balanceUser_5_after.toString()).to.equal(balanceUser_5_before, 'Invalid balance user 5');
    expect(vest_user_5.claimed).to.equal(vest_user_5.initial, 'Invalid balance user 5');
  });

  it('User 5 not claim token after 11 month', async () => {
    // skip 1 months
    await skipTime(2592000);
    // cal claimable

    const balanceUser_2_before = await token.balanceOf(user2.address);
    const balanceUser_3_before = await token.balanceOf(user3.address);
    const balanceUser_4_before = await token.balanceOf(user4.address);
    const balanceUser_5_before = await token.balanceOf(user5.address);
    const balanceVestingTGE_before = await token.balanceOf(vestingTGE.address);

    const balanceUser_2_after = await token.balanceOf(user2.address);
    const balanceUser_3_after = await token.balanceOf(user3.address);
    const balanceUser_4_after = await token.balanceOf(user4.address);
    const balanceUser_5_after = await token.balanceOf(user5.address);
    const balanceVestingTGE_after = await token.balanceOf(vestingTGE.address);

    // user 2
    expect(balanceUser_2_after).to.equal(balanceUser_2_before, 'Invalid balance user 2');

    // user 3
    expect(balanceUser_3_after).to.equal(balanceUser_3_before, 'Invalid balance user 3');

    // user 4
    const vest_user_4 = await vestingTGE.vests(user4.address);
    expect(balanceUser_4_after).to.equal(balanceUser_4_before, 'Invalid balance user 4');
    expect(vest_user_4.claimed).to.equal(vest_user_4.amount, 'Invalid balance user 4');

    // user 5
    const vest_user_5 = await vestingTGE.vests(user5.address)
    const amountClaimable = await vestingTGE.getClaimable(user5.address);
    expect(balanceUser_5_after).to.equal(balanceUser_5_before, 'Invalid balance user 5');
    expect(vest_user_5.claimed).to.equal(vest_user_5.initial, 'Invalid balance user 5');
    expect(amountClaimable.toString()).to.equal(subtract(vest_user_5.amount, vest_user_5.initial), 'Invalid balance user 5');

    expect(balanceVestingTGE_after).to.equal(balanceVestingTGE_before, 'Invalid balance vesting');
  });
});
