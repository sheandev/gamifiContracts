const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { skipTime, acceptable, setTime } = require("./utils");
const { BigNumber } = require("ethers");

describe.only("StakingV3", () => {
    beforeEach(async () => {
        ONE_YEAR = 31556926;
        ONE_ETHER = ethers.utils.parseEther("1");
        ETHER_1TR = ethers.utils.parseEther("1000000");
        ETHER_100TR = ethers.utils.parseEther("100000000");
        ETHER_10TR = ethers.utils.parseEther("10000000");
        ETHER_100K = ethers.utils.parseEther("100000");

        APY_75 = BigNumber.from(23782343987); // 75 % APY
        APY_100 = BigNumber.from(31709791984); // 100 % APY
        poolDuration = 12 * 30 * 24 * 60 * 60; // 12 months
        MAX_STAKE = ONE_ETHER.mul(2500000); // 2.5tr token

        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);

        const accounts = await ethers.getSigners();
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];

        const Gmi = await ethers.getContractFactory("TokenGMI");
        gmi = await Gmi.deploy();
        await gmi.addController(owner.address);

        StakingV3 = await ethers.getContractFactory("StakingV3");
        staking = await upgrades.deployProxy(StakingV3, [
            owner.address,
            gmi.address,
            gmi.address,
            block.timestamp,
            APY_100,
            poolDuration,
            MAX_STAKE
        ]);

        await staking.deployed();

        MAX_UINT256 = ethers.constants.MaxUint256;
        DECIMAL = ethers.utils.parseUnits('1', '18');

        await gmi.mint(owner.address, ETHER_100TR);
        await gmi.mint(user1.address, ETHER_100TR);
        await gmi.mint(user2.address, ETHER_100TR);
        await gmi.mint(user3.address, ETHER_100TR);

        await gmi.connect(owner).approve(staking.address, MAX_UINT256);
        await gmi.connect(user1).approve(staking.address, MAX_UINT256);
        await gmi.connect(user2).approve(staking.address, MAX_UINT256);

        timeStart = await staking.getTimeStarted();
        pendingUnstake = await staking.pendingUnstake();
        epsilon = ONE_ETHER;
    });

    describe("Deployment", async () => {
        it("should return owner address", async () => {
            const ownerAddress = await staking.owner();
            expect(ownerAddress).to.equal(owner.address);
        });

        it("should return successfully param", async () => {
            const _poolDuration = await staking.getPoolDuration();
            const _maxStakedAmount = await staking.getMaxStakedAmountPer();
            const _rewardRate = await staking.getRewardRate();

            expect(_poolDuration).to.equal(poolDuration);
            expect(_maxStakedAmount).to.equal(MAX_STAKE);
            expect(_rewardRate).to.equal(APY_100);
        });

    });

    // SET FUNC
    describe("setRewardRate", async () => {
        it("should revert Ownable: caller is not the owner", async () => {
            await expect(staking.connect(user1).setRewardRate(1234567)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should change reward rate", async () => {
            const newRate = 1512300005610;
            await staking.setRewardRate(newRate);
            expect(await staking.getRewardRate()).to.equal(newRate);
        });
    });

    describe("setPoolDuration", async () => {
        it("should revert Ownable: caller is not the owner", async () => {
            await expect(staking.connect(user1).setPoolDuration(1234567)).to.be.revertedWith("caller is not the owner");
        });

        it("should change pool duration", async () => {
            const newPoolDuration = 3 * 30 * 24 * 60 * 60;
            await staking.setPoolDuration(newPoolDuration);
            expect(await staking.getPoolDuration()).to.equal(newPoolDuration);
        });
    });

    describe("setStartTime", async () => {
        it("should revert Ownable: caller is not the owner", async () => {
            await expect(staking.connect(user1).setStartTime(1234567)).to.be.revertedWith("caller is not the owner");
        });

        it("should change start time", async () => {
            await staking.setStartTime(1234567);
            expect(await staking.getTimeStarted()).to.equal(1234567);
        });
    });

    describe("setPendingUnstake", async () => {
        it("should revert Ownable: caller is not the owner", async () => {
            await expect(staking.connect(user1).setPendingUnstake(1234567)).to.be.revertedWith("caller is not the owner");
        });

        it("should change pending unstake time", async () => {
            await staking.setPendingUnstake(1234567);
            expect(await staking.pendingUnstake()).to.equal(1234567);
        });
    });

    describe("setMaxStakedAmountPer", async () => {
        it("should revert Ownable: caller is not the owner", async () => {
            await expect(staking.connect(user1).setMaxStakedAmountPer(1234567)).to.be.revertedWith("caller is not the owner");
        });

        it("should change staking end time", async () => {
            await staking.setMaxStakedAmountPer(1);
            expect(await staking.getMaxStakedAmountPer()).to.equal(1);
        });
    });

    // Others
    describe("deposit", async () => {
        it("should revert Invalid amount", async () => {
            await expect(staking.connect(user1).stake(0)).to.be.revertedWith("Invalid amount");
        });

        it("should revert when max staking limit has been reached", async () => {
            await expect(staking.connect(user1).stake(MAX_STAKE.add(1))).to.be.revertedWith("Staking: Max staking limit has been reached.");
            await staking.connect(user1).stake(MAX_STAKE);
            const availableStakeAmount = await staking.getAvailableStakeAmount(user1.address);
            expect(availableStakeAmount).to.equal(0);
            await expect(staking.connect(user1).stake(availableStakeAmount.add(1))).to.be.revertedWith("Staking: Max staking limit has been reached.");
        });

        it("should revert Staking has already ended", async () => {
            skipTime(Number(timeStart.add(poolDuration + 1)));
            await expect(staking.connect(user1).stake(MAX_STAKE)).to.be.revertedWith("Staking: Staking has already ended.");
        });

        it("should deposit success", async () => {
            await expect(() => staking.connect(user1).stake(MAX_STAKE)).changeTokenBalances(gmi, [user1], [MAX_STAKE.mul(-1)]);
            expect(await staking.getUserAmount(user1.address)).to.equal(MAX_STAKE);
        });
    });

    describe("requestClaim", async () => {
        it("should revert Nothing to claim", async () => {
            await staking.connect(user1).stake(ONE_ETHER);
            skipTime(Number(timeStart.add(poolDuration + 1)));
            await staking.connect(user1).requestClaim();
            skipTime(Number(poolDuration.toString()));
            await staking.connect(user1).claim();
            await expect(staking.connect(user1).requestClaim()).to.be.revertedWith("Nothing to claim !");
        });

        it("should revert when more request", async () => {
            const claimTime = 4 * 30 * 24 * 60 * 60;
            await staking.connect(user1).stake(ONE_ETHER);
            await skipTime(claimTime);
            await staking.connect(user1).requestClaim();
            await expect(staking.connect(user1).requestClaim()).to.be.revertedWith("Requested !");
        });

        it("should request success", async () => {
            const claimTime = 4 * 30 * 24 * 60 * 60;
            await staking.connect(user1).stake(ONE_ETHER);
            await skipTime(claimTime);
            await staking.connect(user1).requestClaim();

            const data = await staking.users(user1.address);
            expect(data.lazyClaim.isRequested).to.equal(true);
        });
    });

    describe("claim", async () => {
        it("should revert when NOT request and can claim after 24 hours ", async () => {
            await expect(staking.connect(user1).claim()).to.be.revertedWith("Please request and can claim after 24 hours");
        });

        it("should revert when amount of reward value equal to zero ", async () => {
            await staking.connect(user1).requestClaim();

            await skipTime(24 * 60 * 60 + 1);
            await expect(staking.connect(user1).claim()).to.be.revertedWith("Reward value equal to zero");
        });

        it("should claim success", async () => {
            await staking.connect(user1).stake(ETHER_100K);
            const time = poolDuration / 2;
            await skipTime(Number(time));
            await staking.connect(user1).requestClaim();
            let data = await staking.users(user1.address);
            expect(data.lazyClaim.isRequested).to.equal(true);

            await skipTime(24 * 60 * 60 + 1);

            const _cal = ETHER_100K.mul(APY_100).mul(time + 24 * 60 * 60 + 1).div(DECIMAL);
            const value = await staking.connect(user1).pendingRewards(user1.address);

            expect(acceptable(value, _cal, epsilon)).to.be.true;
            await staking.connect(user1).claim();
            data = await staking.users(user1.address);

            expect(data.lazyClaim.isRequested).to.equal(false);
        });
    });

    describe("requestUnstake", async () => {
        it("should revert Not allow unstake at this time", async () => {
            const claimTime = 4 * 30 * 24 * 60 * 60;
            await staking.connect(user1).stake(ONE_ETHER);
            await skipTime(claimTime);
            await expect(staking.connect(user1).requestUnstake()).to.be.revertedWith("Not allow unstake at this time");
        });

        it("should revert when more request", async () => {
            await staking.connect(user1).stake(ONE_ETHER);
            skipTime(Number(timeStart.add(poolDuration + 1)));
            await staking.connect(user1).requestUnstake();
            await expect(staking.connect(user1).requestUnstake()).to.be.revertedWith("Requested !");
        });

        it("should request success", async () => {
            await staking.connect(user1).stake(ONE_ETHER);
            skipTime(Number(timeStart.add(poolDuration + 1)));
            await staking.connect(user1).requestUnstake();

            const data = await staking.users(user1.address);
            expect(data.lazyClaim.isRequested).to.equal(false);
            expect(data.lazyUnstake.isRequested).to.equal(true);
        });
    });

    describe("unstake", async () => {
        it("should revert Please request and can withdraw after 24 hours", async () => {
            await expect(staking.connect(user1).unstake(ONE_ETHER)).to.be.revertedWith("Please request and can withdraw after 24 hours");
        });

        it("should revert when connot unstake more than staked amount", async () => {
            const unstakeTime = timeStart.add(poolDuration + 1);
            await skipTime(Number(unstakeTime));
            await staking.connect(user1).requestUnstake();
            await skipTime(Number(pendingUnstake.add(1)));
            await expect(staking.connect(user1).unstake(ETHER_100K)).to.be.revertedWith("Staking: Cannot unstake more than staked amount.");
        });

        it("should unstake success", async () => {
            await  staking.connect(user1).stake(MAX_STAKE);
            await gmi.connect(owner).transfer(staking.address, MAX_STAKE);

            const unstakeTime = timeStart.add(poolDuration + 1);
            await skipTime(Number(unstakeTime));
            await staking.connect(user1).requestUnstake();
            await skipTime(Number(pendingUnstake.add(1)));

            const pendingRewards = await staking.pendingRewards(user1.address);
            await expect(() => staking.connect(user1).unstake(MAX_STAKE)).changeTokenBalance(gmi, user1, pendingRewards.add(MAX_STAKE));
        });
    });

    describe("Check EmergencyWithdraw function", async () => {
        it("should deposit success", async () => {
            await gmi.connect(owner).transfer(staking.address, 10000);
            await staking.connect(owner).emergencyWithdraw();
            expect(await staking.getStakedAmount()).to.equal(
                await gmi.balanceOf(staking.address)
            );
        });
    });
});
