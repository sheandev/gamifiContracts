const { ethers } = require('hardhat');
const { expect } = require('chai');
const { skipTime } = require('../utils');
const { MaxUint256, AddressZero } = ethers.constants;

const TGE_PERCENT = 3000; // TGE 30%
const CLIFF = 30 * 86400; // 30 days
const CLAIM_TIMES = 2;

describe('ShibaVesting', () => {
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    admin = accounts[0];
    owner = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];

    const TokenGMI     = await ethers.getContractFactory('TokenGMI');
    const ShibaVesting = await ethers.getContractFactory('ShibaVesting');

    token   = await TokenGMI.deploy();
    vesting = await upgrades.deployProxy(ShibaVesting, [owner.address, token.address]);

    await token.addController(admin.address);
    await token.mint(owner.address, ethers.utils.parseEther('1000000')); // mint 1M token
    await token.connect(owner).approve(vesting.address, MaxUint256.toString());

    TOKEN_1000 = ethers.utils.parseEther('1000');
    TOKEN_30   = ethers.utils.parseEther('30');
    TOKEN_45   = ethers.utils.parseEther('45');
    TOKEN_100  = ethers.utils.parseEther('100');
    TOKEN_135  = ethers.utils.parseEther('135');
    TOKEN_450  = ethers.utils.parseEther('450');
    TOKEN_700  = ethers.utils.parseEther('700');

    TGE_DOMINATOR = await vesting.TGE_DOMINATOR();
  })

  describe('constructor', () => {
    it('Should assign the owner successfully', async () => {
      expect(await vesting.owner()).to.equal(owner.address, 'owner is not correctly');
      expect(await vesting.token()).to.equal(token.address);
    });
  });

  describe('initiateVests', () => {
    it('Should catch error Inconsistent length', async () => {
      await expect(
        vesting.connect(owner).initiateVests(
          [],
          [TOKEN_100, TOKEN_450, TOKEN_450],
          TOKEN_1000,
          TGE_PERCENT,
          CLIFF,
          CLAIM_TIMES
        )
      ).to.be.revertedWith('Inconsistent length');

      await expect(
        vesting.connect(owner).initiateVests(
          [user2.address, user3.address],
          [TOKEN_100, TOKEN_450, TOKEN_450],
          TOKEN_1000,
          TGE_PERCENT,
          CLIFF,
          CLAIM_TIMES
        )
      ).to.be.revertedWith('Inconsistent length');
    });

    it('Should catch error Invalid TGE percent', async () => {
      await expect(
        vesting.connect(owner).initiateVests(
          [user2.address, user3.address, user4.address],
          [TOKEN_100, TOKEN_450, TOKEN_450],
          TOKEN_1000,
          TGE_DOMINATOR,
          CLIFF,
          CLAIM_TIMES
        )
      ).to.be.revertedWith('Invalid TGE percent');
    });

    it('Should catch error Total must be greater than 0', async () => {
      await expect(
        vesting.connect(owner).initiateVests(
          [user2.address, user3.address, user4.address],
          [TOKEN_100, TOKEN_450, TOKEN_450],
          0,
          TGE_PERCENT,
          CLIFF,
          CLAIM_TIMES
        )
      ).to.be.revertedWith('Total must be greater than 0');
    });

    it('Should catch error Invalid vesting item', async () => {
      await expect(
        vesting.connect(owner).initiateVests(
          [user2.address, user3.address, AddressZero],
          [TOKEN_100, TOKEN_450, TOKEN_450],
          TOKEN_1000,
          TGE_PERCENT,
          CLIFF,
          CLAIM_TIMES
        )
      ).to.be.revertedWith('Invalid vesting item');

      await expect(
        vesting.connect(owner).initiateVests(
          [user2.address, user3.address, user4.address],
          [TOKEN_100, TOKEN_450, 0],
          TOKEN_1000,
          TGE_PERCENT,
          CLIFF,
          CLAIM_TIMES
        )
      ).to.be.revertedWith('Invalid vesting item');
    });

    it('Should catch error Bad total', async () => {
      await expect(
        vesting.connect(owner).initiateVests(
          [user2.address, user3.address, user4.address],
          [TOKEN_100, TOKEN_450, TOKEN_450],
          TOKEN_1000.add(1),
          TGE_PERCENT,
          CLIFF,
          CLAIM_TIMES
        )
      ).to.be.revertedWith('Bad total');
    });

    it('Should init successfully', async () => {
      await expect(() => {
        return vesting.connect(owner).initiateVests(
          [user2.address, user3.address, user4.address],
          [TOKEN_100, TOKEN_450, TOKEN_450],
          TOKEN_1000,
          TGE_PERCENT,
          CLIFF,
          CLAIM_TIMES
        );
      }).to.changeTokenBalances(
        token,
        [vesting, owner, user2, user3, user4],
        [TOKEN_700, TOKEN_1000.mul(-1), TOKEN_30, TOKEN_135, TOKEN_135]
      );

      const lockData_user2 = await vesting.getLockData(user2.address);
      expect(lockData_user2.cliff.toNumber()).to.equal(CLIFF);
      expect(lockData_user2.count).to.equal(CLAIM_TIMES);
      expect(lockData_user2.amountEach).to.equal(TOKEN_100.sub(TOKEN_30).div(CLAIM_TIMES));
      expect(lockData_user2.createdAt.toNumber()).to.greaterThan(0);
      expect(await vesting.getClaimable(user2.address)).to.equal(0);

      const lockData_user3 = await vesting.getLockData(user3.address);
      expect(lockData_user3.cliff.toNumber()).to.equal(CLIFF);
      expect(lockData_user3.count).to.equal(CLAIM_TIMES);
      expect(lockData_user3.amountEach).to.equal(TOKEN_450.sub(TOKEN_135).div(CLAIM_TIMES));
      expect(lockData_user3.createdAt.toNumber()).to.greaterThan(0);

      const lockData_user4 = await vesting.getLockData(user4.address);
      expect(lockData_user4.cliff.toNumber()).to.equal(CLIFF);
      expect(lockData_user4.count).to.equal(CLAIM_TIMES);
      expect(lockData_user4.amountEach).to.equal(TOKEN_450.sub(TOKEN_135).div(CLAIM_TIMES));
      expect(lockData_user4.createdAt.toNumber()).to.greaterThan(0);

      expect(await vesting.getClaimable(user2.address)).to.equal(0);
      expect(await vesting.getClaimable(user3.address)).to.equal(0);
      expect(await vesting.getClaimable(user4.address)).to.equal(0);
    });
  });

  describe('getClaimable', () => {
    beforeEach(async () => {
      await vesting.connect(owner).initiateVests(
        [user2.address, user3.address, user4.address],
        [TOKEN_100, TOKEN_450, TOKEN_450],
        TOKEN_1000,
        TGE_PERCENT,
        CLIFF,
        CLAIM_TIMES
      );
    });

    it('Check getClaimable', async () => {
      expect(await vesting.getClaimable(user2.address)).to.equal(0);
      expect(await vesting.getClaimable(user3.address)).to.equal(0);
      expect(await vesting.getClaimable(user4.address)).to.equal(0);

      // skip 1 months
      await skipTime(30 * 86400);

      expect(await vesting.getClaimable(user2.address)).to.equal(TOKEN_100.mul(3500).div(TGE_DOMINATOR));
      expect(await vesting.getClaimable(user3.address)).to.equal(TOKEN_450.mul(3500).div(TGE_DOMINATOR));
      expect(await vesting.getClaimable(user4.address)).to.equal(TOKEN_450.mul(3500).div(TGE_DOMINATOR));

      // skip 1 months
      await skipTime(30 * 86400);

      expect(await vesting.getClaimable(user2.address)).to.equal(TOKEN_100.mul(7000).div(TGE_DOMINATOR));
      expect(await vesting.getClaimable(user3.address)).to.equal(TOKEN_450.mul(7000).div(TGE_DOMINATOR));
      expect(await vesting.getClaimable(user4.address)).to.equal(TOKEN_450.mul(7000).div(TGE_DOMINATOR));
    });
  });

  describe('claim', () => {
    beforeEach(async () => {
      await vesting.connect(owner).initiateVests(
        [user2.address, user3.address, user4.address],
        [TOKEN_100, TOKEN_450, TOKEN_450],
        TOKEN_1000,
        TGE_PERCENT,
        CLIFF,
        CLAIM_TIMES
      );
    });

    it('Should catch error Nothing to claim', async () => {
      await expect(vesting.connect(user2).claim()).to.be.revertedWith('Nothing to claim');
      await expect(vesting.connect(user3).claim()).to.be.revertedWith('Nothing to claim');
      await expect(vesting.connect(user4).claim()).to.be.revertedWith('Nothing to claim');
      await expect(vesting.connect(owner).claim()).to.be.revertedWith('Nothing to claim');
    });

    it('Should claim successfully', async () => {
      // skip 1 months
      await skipTime(30 * 86400);

      let tokenBalance_Vesting = TOKEN_700;
      let tokenBalance_user2 = TOKEN_30;
      let tokenBalance_user3 = TOKEN_135;
      let tokenBalance_user4 = TOKEN_135;
      expect(await token.balanceOf(vesting.address)).to.equal(tokenBalance_Vesting);
      expect(await token.balanceOf(user2.address)).to.equal(tokenBalance_user2);
      expect(await token.balanceOf(user3.address)).to.equal(tokenBalance_user3);
      expect(await token.balanceOf(user4.address)).to.equal(tokenBalance_user4);

      // user 2 claim remain tokens
      let claimable_user2 = TOKEN_100.mul(3500).div(TGE_DOMINATOR);
      await expect(() => vesting.connect(user2).claim()).to.changeTokenBalances(
        token,
        [vesting, owner, user2, user3, user4],
        [claimable_user2.mul(-1), 0, claimable_user2, 0, 0]
      );

      tokenBalance_Vesting = tokenBalance_Vesting.sub(claimable_user2);
      tokenBalance_user2 = tokenBalance_user2.add(claimable_user2);
      expect(await token.balanceOf(vesting.address)).to.equal(tokenBalance_Vesting);
      expect(await token.balanceOf(user2.address)).to.equal(tokenBalance_user2);

      // user 3 claim tokens
      let claimable_user3 = TOKEN_450.mul(3500).div(TGE_DOMINATOR);
      await expect(() => vesting.connect(user3).claim()).to.changeTokenBalances(
        token,
        [vesting, owner, user2, user3, user4],
        [claimable_user3.mul(-1), 0, 0, claimable_user3, 0]
      );

      tokenBalance_Vesting = tokenBalance_Vesting.sub(claimable_user3);
      tokenBalance_user3 = tokenBalance_user3.add(claimable_user3);
      expect(await token.balanceOf(vesting.address)).to.equal(tokenBalance_Vesting);
      expect(await token.balanceOf(user3.address)).to.equal(tokenBalance_user3);


      // skip 1 months
      await skipTime(30 * 86400);

      // user 2 claim remain tokens
      claimable_user2 = TOKEN_100.mul(3500).div(TGE_DOMINATOR);
      await expect(() => vesting.connect(user2).claim()).to.changeTokenBalances(
        token,
        [vesting, owner, user2, user3, user4],
        [claimable_user2.mul(-1), 0, claimable_user2, 0, 0]
      );

      tokenBalance_Vesting = tokenBalance_Vesting.sub(claimable_user2);
      tokenBalance_user2 = tokenBalance_user2.add(claimable_user2);
      expect(await token.balanceOf(vesting.address)).to.equal(tokenBalance_Vesting);
      expect(await token.balanceOf(user2.address)).to.equal(tokenBalance_user2);

      // user 3 claim remain tokens
      claimable_user3 = TOKEN_450.mul(3500).div(TGE_DOMINATOR);
      await expect(() => vesting.connect(user3).claim()).to.changeTokenBalances(
        token,
        [vesting, owner, user2, user3, user4],
        [claimable_user3.mul(-1), 0, 0, claimable_user3, 0]
      );

      tokenBalance_Vesting = tokenBalance_Vesting.sub(claimable_user3);
      tokenBalance_user3 = tokenBalance_user3.add(claimable_user3);
      expect(await token.balanceOf(vesting.address)).to.equal(tokenBalance_Vesting);
      expect(await token.balanceOf(user3.address)).to.equal(tokenBalance_user3);


      // skip 1 months
      await skipTime(30 * 86400);

      // user 4 claim tokens
      claimable_user4 = TOKEN_450.mul(7000).div(TGE_DOMINATOR);
      await expect(() => vesting.connect(user4).claim()).to.changeTokenBalances(
        token,
        [vesting, owner, user2, user3, user4],
        [claimable_user4.mul(-1), 0, 0, 0, claimable_user4]
      );

      tokenBalance_Vesting = tokenBalance_Vesting.sub(claimable_user4);
      tokenBalance_user4 = tokenBalance_user4.add(claimable_user4);
      expect(await token.balanceOf(vesting.address)).to.equal(0);
      expect(await token.balanceOf(user4.address)).to.equal(tokenBalance_user4);

      await expect(vesting.connect(user2).claim()).to.be.revertedWith('Nothing to claim');
      await expect(vesting.connect(user3).claim()).to.be.revertedWith('Nothing to claim');
      await expect(vesting.connect(user4).claim()).to.be.revertedWith('Nothing to claim');
    });
  });

  describe('edge case', () => {
    it('Should claim successfully', async () => {
      const vestAmount_user2 = ethers.BigNumber.from(333);
      const vestAmount_user3 = ethers.BigNumber.from(667);

      await vesting.connect(owner).initiateVests(
        [user2.address, user3.address],
        [vestAmount_user2, vestAmount_user3],
        vestAmount_user2.add(vestAmount_user3),
        TGE_PERCENT,
        CLIFF,
        CLAIM_TIMES
      );

      await expect(vesting.connect(user2).claim()).to.be.revertedWith('Nothing to claim');
      await expect(vesting.connect(user3).claim()).to.be.revertedWith('Nothing to claim');

      // skip 45 days
      await skipTime(45 * 86400);

      let tokenBalance_user2   = vestAmount_user2.mul(TGE_PERCENT).div(TGE_DOMINATOR);
      let tokenBalance_user3   = vestAmount_user3.mul(TGE_PERCENT).div(TGE_DOMINATOR);;
      let tokenBalance_Vesting = vestAmount_user2.add(vestAmount_user3).sub(tokenBalance_user2.add(tokenBalance_user3));
      expect(await token.balanceOf(vesting.address)).to.equal(tokenBalance_Vesting);
      expect(await token.balanceOf(user2.address)).to.equal(tokenBalance_user2);
      expect(await token.balanceOf(user3.address)).to.equal(tokenBalance_user3);

      // user 2 claim tokens
      const lockData_user2 = await vesting.getLockData(user2.address);
      expect(lockData_user2.amountEach).to.equal(vestAmount_user2.sub(tokenBalance_user2).div(CLAIM_TIMES));
      let claimable_user2 = lockData_user2.amountEach;
      expect(await vesting.getClaimable(user2.address)).to.equal(claimable_user2);
      await expect(() => vesting.connect(user2).claim()).to.changeTokenBalances(
        token,
        [vesting, user2, user3],
        [claimable_user2.mul(-1), claimable_user2, 0]
      );

      tokenBalance_Vesting = tokenBalance_Vesting.sub(claimable_user2);
      tokenBalance_user2 = tokenBalance_user2.add(claimable_user2);
      expect(await token.balanceOf(vesting.address)).to.equal(tokenBalance_Vesting);
      expect(await token.balanceOf(user2.address)).to.equal(tokenBalance_user2);


      // skip 15 days
      await skipTime(15 * 86400);

      // user 2 claim remain tokens
      expect(await vesting.getClaimable(user2.address)).to.equal(claimable_user2);
      await expect(() => vesting.connect(user2).claim()).to.changeTokenBalances(
        token,
        [vesting, owner, user2, user3, user4],
        [claimable_user2.mul(-1), 0, claimable_user2, 0, 0]
      );

      tokenBalance_Vesting = tokenBalance_Vesting.sub(claimable_user2);
      tokenBalance_user2 = tokenBalance_user2.add(claimable_user2);
      expect(await token.balanceOf(vesting.address)).to.equal(tokenBalance_Vesting);
      expect(await token.balanceOf(user2.address)).to.equal(tokenBalance_user2);

      // user 3 claim tokens
      const lockData_user3 = await vesting.getLockData(user3.address);
      expect(lockData_user3.amountEach).to.equal(vestAmount_user3.sub(tokenBalance_user3).div(CLAIM_TIMES));
      let claimable_user3 = vestAmount_user3.sub(tokenBalance_user3)
      expect(await vesting.getClaimable(user3.address)).to.equal(claimable_user3);

      await expect(() => vesting.connect(user3).claim()).to.changeTokenBalances(
        token,
        [vesting, user2, user3],
        [claimable_user3.mul(-1), 0, claimable_user3]
      );

      tokenBalance_Vesting = tokenBalance_Vesting.sub(claimable_user3);
      tokenBalance_user3 = tokenBalance_user3.add(claimable_user3);
      expect(await token.balanceOf(vesting.address)).to.equal(0);
      expect(await token.balanceOf(user3.address)).to.equal(tokenBalance_user3);

      await expect(vesting.connect(user2).claim()).to.be.revertedWith('Nothing to claim');
      await expect(vesting.connect(user3).claim()).to.be.revertedWith('Nothing to claim');

      // Check token balance finally
      expect(await token.balanceOf(vesting.address)).to.equal('0');
      expect(await token.balanceOf(user2.address)).to.equal(vestAmount_user2);
      expect(await token.balanceOf(user3.address)).to.equal(vestAmount_user3);
    });
  });
});
