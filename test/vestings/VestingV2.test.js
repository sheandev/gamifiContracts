const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime, setTime } = require("../utils");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { add, subtract, multiply, divide } = require("js-big-decimal");

const CLIFF = "2596000";
const LINEAR = "23328000";

describe("VestingV2", () => {
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    owner = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];

    const TokenGMI = await ethers.getContractFactory("TokenGMI");
    token = await TokenGMI.deploy();

    const VestingShiba = await ethers.getContractFactory("VestingV2");
    vestingShiba = await upgrades.deployProxy(VestingShiba, [
      owner.address,
      token.address,
    ]);

    await token.addController(admin.address);
    await token.mint(owner.address, "100000000000000000000000000"); // mint 1,000,000,000 token

    await token
      .connect(owner)
      .approve(vestingShiba.address, MAX_UINT256.toString());

    ETHER_1_0_0 = ethers.utils.parseEther("100");
  });

  describe("constructor", () => {
    it("Should assign the owner successfully", async function() {
      const _owner = await vestingShiba.owner();
      expect(_owner).to.equal(owner.address, "owner is not correctly");
    });
  });

  describe("initiateVests", () => {
    it("Should catch error Vesting: Inconsistent length", async () => {
      await expect(
        vestingShiba
          .connect(owner)
          .initiateVests([], ["100"], "10", "100", CLIFF, LINEAR)
      ).to.be.revertedWith("Vesting: Inconsistent length");

      await expect(
        vestingShiba
          .connect(owner)
          .initiateVests([user2.address], [], "10", "100", CLIFF, LINEAR)
      ).to.be.revertedWith("Vesting: Inconsistent length");
    });

    it("Should catch error Vesting: Bad totalAmount", async () => {
      await expect(
        vestingShiba
          .connect(owner)
          .initiateVests(
            [user2.address, user3.address],
            ["100", "100"],
            "10",
            "100",
            CLIFF,
            LINEAR
          )
      ).to.be.revertedWith("Vesting: Bad totalAmount");

      await expect(
        vestingShiba
          .connect(owner)
          .initiateVests([user2.address], ["90"], "10", "100", CLIFF, LINEAR)
      ).to.be.revertedWith("Vesting: Bad totalAmount");
    });

    it("Should catch error Vesting: Invalid account", async () => {
      await expect(
        vestingShiba
          .connect(owner)
          .initiateVests(
            [ethers.constants.AddressZero],
            ["100"],
            "10",
            "100",
            CLIFF,
            LINEAR
          )
      ).to.be.revertedWith("Vesting: Invalid account");
    });

    it("Should catch error Vesting: Bad Percent", async () => {
      await expect(
        vestingShiba
          .connect(owner)
          .initiateVests(
            [user2.address],
            ["100"],
            "200",
            "100",
            CLIFF,
            LINEAR
          )
      ).to.be.revertedWith(
        "Vesting: Bad Percent"
      );
    });

    it("Should initiateVests successfully", async () => {
      const balanceOwner_before = await token.balanceOf(owner.address);
      const balanceVestingTGE_before = await token.balanceOf(
        vestingShiba.address
      );
      const balanceUser_before = await token.balanceOf(user2.address);

      const amount = ETHER_1_0_0;

      let transaction = await vestingShiba
        .connect(owner)
        .initiateVests(
          [user2.address],
          [amount],
          "10",
          amount,
          CLIFF,
          LINEAR
        );
      let blockNumber = (await ethers.provider.getTransaction(transaction.hash))
        .blockNumber;

      const date = (await hre.ethers.provider.getBlock(blockNumber)).timestamp;

      const balanceOwner_after = await token.balanceOf(owner.address);
      const balanceVestingTGE_after = await token.balanceOf(
        vestingShiba.address
      );
      const balanceUser_after = await token.balanceOf(user2.address);

      expect(balanceOwner_after).to.equal(
        balanceOwner_before.sub(amount),
        "Invalid balance owner"
      );
      expect(balanceOwner_before.sub(balanceOwner_after)).to.equal(
        balanceVestingTGE_after
          .sub(balanceVestingTGE_before)
          .add(balanceUser_after.sub(balanceUser_before)),
        "Invalid balance vesting"
      );

      const nonce1 = await vestingShiba.getNonce(user2.address);
      const nonce = nonce1.sub(1);
      const vestId = await vestingShiba.getVestId(user2.address, nonce);
      const vest = await vestingShiba.getVest(vestId);
      expect(vest.owner).to.equal(user2.address, "Invalid vest owner");
      expect(vest.amount.toString()).to.equal(
        amount.toString(),
        "Invalid vest amount"
      );

      expect(vest.start.toString()).to.equal(
        date.toString(),
        "Invalid vest start"
      );

      // initial = amount * percentTGE / SCALE = 100000000000000000000 * 100000000000000000 / 1000000000000000000 = 10000000000000000000
      expect(vest.initial).to.equal(
        amount.div(10),
        "Invalid vest initial"
      );

      expect(vest.cliff.toString()).to.equal(CLIFF, "Invalid vest cliff");

      expect(vest.linear.toString()).to.equal(LINEAR, "Invalid vest linear");
    });
  });

  describe("getClaimable", () => {
    beforeEach(async () => {
      const amount = ETHER_1_0_0;
      await vestingShiba
        .connect(owner)
        .initiateVests(
          [user2.address],
          [amount],
          "10",
          amount,
          CLIFF,
          LINEAR
        );
    });

    it("Check getClaimable", async () => {
      // skip 3 months
      await skipTime(7776000);

      const nonce1 = await vestingShiba.getNonce(user2.address);
      const nonce = nonce1.sub(1);
      const vestId = await vestingShiba.getVestId(user2.address, nonce);

      const vest = await vestingShiba.getVest(vestId);
      const subAmount = vest.amount.sub(vest.initial);
      const addCliff = vest.start.add(vest.cliff);

      let date_after = (await hre.ethers.provider.getBlock("latest")).timestamp;
      let amountAble = await vestingShiba.getClaimable(user2.address);
      let amountAbleForNonce = await vestingShiba.getClaimableForNonce(
        user2.address,
        nonce
      );
      expect(amountAble).to.equals(amountAbleForNonce);

      let timePassed = subtract(date_after, addCliff);
      let tokenCliff = divide(
        multiply(timePassed, subAmount),
        vest.linear.toString(),
        0
      );

      // ((date_after - (start + cliff)) * (amount - initial) / linear) + initial - claimed
      let amountAble_cal = subtract(
        add(tokenCliff, vest.initial.toString()),
        vest.claimed.toString()
      );
      expect(amountAble).to.equal(amountAble_cal, "Invalid vest amountable 1");

      // skip 3 months
      await skipTime(7776000);

      date_after = (await hre.ethers.provider.getBlock("latest")).timestamp;
      amountAble = await vestingShiba.getClaimable(user2.address);
      amountAbleForNonce = await vestingShiba.getClaimableForNonce(
        user2.address,
        nonce
      );
      expect(amountAble).to.equals(amountAbleForNonce);

      timePassed = subtract(date_after, addCliff);
      tokenCliff = divide(
        multiply(timePassed, subAmount),
        vest.linear.toString(),
        0
      );

      // ((date_after - (start + cliff)) * (amount - initial) / linear) + initial - claimed
      amountAble_cal = subtract(
        add(tokenCliff, vest.initial.toString()),
        vest.claimed.toString()
      );
      expect(amountAble.toString()).to.equal(
        amountAble_cal,
        "Invalid vest amountable 2"
      );

      // skip 4 months
      await skipTime(10372001);

      amountAble = await vestingShiba.getClaimable(user2.address);
      amountAbleForNonce = await vestingShiba.getClaimableForNonce(
        user2.address,
        nonce
      );
      expect(amountAble).to.equals(amountAbleForNonce);

      amountAble_cal = subtract(vest.amount, vest.claimed);
      expect(amountAble.toString()).to.equal(
        amountAble_cal,
        "Invalid vest amountable 3"
      );

      expect(amountAble.toString()).to.equal(
        vest.amount,
        "Invalid vest amountable 3"
      );
    });

    it("Check getClaimable many nonces", async () => {
      // skip 3 months
      await skipTime(7776000);

      await vestingShiba
        .connect(owner)
        .initiateVests(
          [user2.address],
          [ETHER_1_0_0],
          "10",
          ETHER_1_0_0,
          CLIFF,
          LINEAR
        );

      // skip 3 months
      await skipTime(7776000);

      const nonce1 = await vestingShiba.getNonce(user2.address);
      let totalClaim = 0;
      for (let i = 0; i < nonce1; i++) {
        let totalClaimForNonce = await vestingShiba.getClaimableForNonce(
          user2.address,
          i
        );
        totalClaim = totalClaimForNonce.add(totalClaim);
      }
      let amountAble = await vestingShiba.getClaimable(user2.address);
      expect(amountAble).to.equals(totalClaim);

      // skip 3 months
      await skipTime(7776000);

      totalClaim = 0;
      for (let i = 0; i < nonce1; i++) {
        let totalClaimForNonce = await vestingShiba.getClaimableForNonce(
          user2.address,
          i
        );
        totalClaim = totalClaimForNonce.add(totalClaim);
      }
      amountAble = await vestingShiba.getClaimable(user2.address);
      expect(amountAble).to.equals(totalClaim);
    });
  });

  describe("claim", () => {
    beforeEach(async () => {
      const amount = ETHER_1_0_0;
      await vestingShiba
        .connect(owner)
        .initiateVests(
          [user2.address],
          [amount],
          "10",
          amount,
          CLIFF,
          LINEAR
        );
    });

    it("Should claim successfully", async () => {
      // skip 3 months
      await skipTime(7776000);
      // cal claimable

      const balanceUser_before = await token.balanceOf(user2.address);
      const balanceVestingTGE_before = await token.balanceOf(
        vestingShiba.address
      );

      await vestingShiba.connect(user2).claim();

      const balanceUser_after = await token.balanceOf(user2.address);
      const balanceVestingTGE_after = await token.balanceOf(
        vestingShiba.address
      );

      const nonce1 = await vestingShiba.getNonce(user2.address);
      const nonce = nonce1.sub(1);
      const vestId = await vestingShiba.getVestId(user2.address, nonce);

      const vest_1 = await vestingShiba.getVest(vestId);

      expect(balanceUser_after).to.equal(
        balanceUser_before.add(vest_1.claimed),
        "Invalid balance user2 round 1"
      );
      expect(balanceUser_after.sub(balanceUser_before)).to.equal(
        balanceVestingTGE_before.sub(balanceVestingTGE_after),
        "Invalid balance vesting round 1"
      );

      // skip 7 months
      await skipTime(181440000);
      await vestingShiba.connect(user2).claim();

      const balanceUser_after_2 = await token.balanceOf(user2.address);
      const balanceVestingTGE_after_2 = await token.balanceOf(
        vestingShiba.address
      );
      const vest_2 = await vestingShiba.getVest(vestId);
      expect(vest_2.claimed).to.equal(
        vest_2.amount,
        "Invalid amount user2 round 2"
      );

      expect(balanceUser_after_2.toString()).to.equal(
        add(balanceUser_after, vest_2.claimed.sub(vest_1.claimed)),
        "Invalid balance user2 round 3"
      );
      expect(subtract(balanceUser_after_2, balanceUser_after)).to.equal(
        subtract(balanceVestingTGE_after, balanceVestingTGE_after_2),
        "Invalid balance vesting round 2"
      );
    });
  });
});
