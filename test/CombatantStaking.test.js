const chai = require("chai");
const { expect } = require("chai");
const { upgrades } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const Big = require("big.js");
const { skipTime, getCurrentBlock, acceptable } = require("./utils");

chai.use(solidity);
const { add, subtract, multiply, divide } = require("js-big-decimal");
describe("Combatant Staking", () => {
    const PRICE_PER_NFT_BOX = "250000000000000000000000";
    const SOLDIER_LIMIT = "125000000000000000000000";
    const PILOT_LIMIT = "250000000000000000000000";
    const GENERAL_LIMIT = "500000000000000000000000";
    const GENERAL_RATE = 47564687975; // 150 % APY
    const PILOT_RATE = 23782343987; // 75 % APY
    const SOLDIER_RATE = 15854895992; // 50 % APY
    const poolDuration = 9 * 30 * 24 * 60 * 60; // 9 months
    const typeIdPool = 0; // 0 : Soldier || 1 : Pilot || 2 : General
    const MAX_BURN = "125000000000000000000000000";
    const ZERO = 0;
    const ONE_YEAR = 31104000;
    let TIME_NINE_MONTHS = 270 * 24 * 60 * 60;
    let CURRENT_TIME;
    beforeEach(async () => {
        const blockNumAfter = await ethers.provider.getBlockNumber();
        const blockAfter = await ethers.provider.getBlock(blockNumAfter);
        const timestampAfter = blockAfter.timestamp;
        CURRENT_TIME = timestampAfter;
        MAX_INT =
            "115792089237316195423570985008687907853269984665640564039457584007913129639935";
        const accounts = await ethers.getSigners();
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];
        treasury = accounts[4];

        const Gmi = await ethers.getContractFactory("TokenGMI");
        gmi = await Gmi.deploy();
        await gmi.addController(owner.address);
        const Rand = await ethers.getContractFactory("Rand");
        const rand = await Rand.deploy();
        Combatant = await ethers.getContractFactory("Combatant");
        combatant = await upgrades.deployProxy(Combatant, [
            owner.address,
            "Combatant NFT",
            "CBT",
            rand.address
        ]);


        Staking = await ethers.getContractFactory("CombatantStaking");
        staking = await upgrades.deployProxy(Staking, [
            owner.address,
            gmi.address,
            gmi.address,
            combatant.address,
            SOLDIER_RATE,
            poolDuration,
            typeIdPool,
            SOLDIER_LIMIT
        ]);

        await staking.deployed();

        await gmi.mint(owner.address, MAX_BURN);
        await gmi.mint(user1.address, MAX_BURN);
        await gmi.mint(user2.address, MAX_BURN);
        await gmi.mint(user3.address, MAX_BURN);
        await gmi.mint(treasury.address, MAX_BURN);
        await gmi.mint(staking.address, MAX_BURN);

        await gmi.connect(owner).approve(staking.address, MAX_INT);
        await gmi.connect(user1).approve(staking.address, MAX_INT);
        await gmi.connect(user2).approve(staking.address, MAX_INT);
        await gmi.connect(treasury).approve(staking.address, MAX_INT);

        await combatant.setAdmin(staking.address, true);
    });

    describe("Deployment:", async () => {
        it("should return owner address : ", async () => {
            const ownerAddress = await staking.owner();
            expect(ownerAddress).to.equal(owner.address);
        });
        it("should return type of pool : ", async () => {
            const tyPool = 0; // Soldier
            const typePool = await staking.typeIdPool();
            expect(typePool).to.equal(tyPool);
        });

    });
    // GET FUNC
    describe("getStakeToken:", async () => {
        it("should return staked token: ", async () => {
            expect(await staking.getStakeToken()).to.equal(gmi.address);
        });
    });
    describe("getStakedAmount:", async () => {
        it("should return total staked amount: ", async () => {
            expect(await staking.getStakedAmount()).to.equal(0);
        });
    });
    describe("getPoolDuration:", async () => {
        it("should return pool duration: ", async () => {
            expect(await staking.getPoolDuration()).to.equal(poolDuration);
        });
    });
    describe("getRewardRate:", async () => {
        it("should return reward rate: ", async () => {
            expect(await staking.getRewardRate()).to.equal(SOLDIER_RATE);
        });
    });
    describe("getMaxAmountOf:", async () => {
        it("should return max amount of staking limit: ", async () => {
            expect(await staking.getMaxAmountOf(owner.address)).to.equal(ZERO);
        });
    });

    describe("getUserAmount:", async () => {
        it("should return amount of user: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(user1.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            const amount = "1000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                expect(await staking.getUserAmount(user1.address)).to.equal(amount);
            } else {
                await expect(staking.connect(user1).stake(amount)).to.be.revertedWith("Require to have NFT for staking in pool");
                // await expect(staking.getUserAmount(user1.address)).to.be.revertedWith("Require to have NFT for staking in pool");
            }

        });
    });
    describe("getStartTime:", async () => {
        it("should return start time of staking pool: ", async () => {
            expect(await staking.getStartTime()).to.equal(ZERO);
        });
    });

    // SET FUNC
    describe("setRewardRate:", async () => {
        it("should change reward rate: ", async () => {
            const newRate = 1512300005610;
            await staking.setRewardRate(newRate);
            expect(await staking.getRewardRate()).to.equal(newRate);
        });
    });
    describe("setPoolDuration:", async () => {
        it("should change pool duration: ", async () => {
            const newPoolDuration = 3 * 30 * 24 * 60 * 60;
            await staking.setPoolDuration(newPoolDuration);
            expect(await staking.getPoolDuration()).to.equal(newPoolDuration);
        });
    });

    describe("setStartTime:", async () => {
        it("should change start time: ", async () => {
            const time = 1234567;
            await staking.setStartTime(time);
            expect(await staking.getStartTime()).to.equal(time);
        });
    });

    describe("setPendingUnstake:", async () => {
        it("should change pending unstake time: ", async () => {
            const time = 1234567;
            await staking.setPendingUnstake(time);
            expect(await staking.pendingUnstake()).to.equal(time);
        });
    });

    describe("setStakingEndTime:", async () => {
        it("should change staking end time: ", async () => {
            const time = 1234567;
            await staking.setStakingEndTime(time);
            expect(await staking.stakingEndTime()).to.equal(time);
        });
    });

    // // Others
    describe("stake:", async () => {
        it("should revert when no NFT is staking active: ", async () => {
            const amount = "1000000000000000000"; // 1 ether
            await expect(staking.connect(user1).stake(amount)).to.be.revertedWith("Require to have NFT for staking in pool");
        });
        it("should revert when stake overtime 3 months: ", async () => {
            const tokenId = 0;
            const overtime = 4 * 30 * 24 * 60 * 60;
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(user1.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);

            const amount = "1000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                await skipTime(overtime);
                await expect(staking.connect(user1).stake(amount)).to.be.revertedWith("Only deposit at first 3 months");
            } else {
                await expect(staking.connect(user1).stake(amount)).to.be.revertedWith("Require to have NFT for staking in pool");
            }
        });
        it("should revert when max staking limit has been reached: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(user1.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);

            const amount = "500001000000000000000000"; // 1 ether
            if (typeId.typeId.toString() == '0') {
                await expect(staking.connect(user1).stake(amount)).to.be.revertedWith("Staking: Max staking limit has been reached.");
            } else {
                await expect(staking.connect(user1).stake(amount)).to.be.revertedWith("Require to have NFT for staking in pool");
            }
        });
        it("should stake success: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(user1.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);

            const amount = "125000000000000000000000";
            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                expect(await staking.getUserAmount(user1.address)).to.equal(amount);
            } else {
                console.log("throw ! please try again");
                console.log("typeId.typeId.toString() ", typeId.typeId.toString())
                await expect(staking.connect(user1).stake(amount)).to.be.revertedWith("Require to have NFT for staking in pool");
            }
        });
    });
    describe("pendingRewards:", async () => {
        it("should return pending reward: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            const claimTime = 4 * 30 * 24 * 60 * 60;
            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                await skipTime(claimTime);
                const pendingRewards = await staking.pendingRewards(user1.address);

                console.log("pendingRewards", pendingRewards.toString(), divide(
                    multiply(multiply(amount, 0.5), claimTime),
                    ONE_YEAR
                ));
                const epsilon = 1 / 100 * amount;
                expect(
                    acceptable(pendingRewards.toString(), divide(
                        multiply(multiply(amount, 0.5), claimTime),
                        ONE_YEAR
                    ), epsilon))
                    .to.be.true;
            }
            else {
                console.log("throw ! please try again");
            }
        });
    });
    describe("requestUnstake:", async () => {
        it("should revert when not allow at this time for no NFT or on staking time: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            const claimTime = 4 * 30 * 24 * 60 * 60;
            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                await skipTime(claimTime);
                await expect(staking.connect(user1).requestUnstake()).to.be.revertedWith("Not allow unstake at this time");

            }
            else {
                console.log("throw ! please try again");
            }
        });
        it("should request success: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            const claimTime = 10 * 30 * 24 * 60 * 60; // 1 thangs
            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);

                await skipTime(claimTime);

                await staking.connect(user1).requestUnstake();
                const data = await staking.users(user1.address);
                expect(data.lazyUnstake.isRequested).to.equal(true);
            }
            else {
                console.log("throw ! please try again");
            }
        });
    });

    describe("requestClaim:", async () => {
        it("should revert when pool is not start: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            // const claimTime = 10 * 30 * 24 * 60 * 60;
            // const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                // await staking.connect(user1).stake(amount);
                // await skipTime(claimTime);
                await expect(staking.connect(user1).requestClaim()).to.be.revertedWith("Pool is not start !");

            }
            else {
                console.log("throw ! please try again");
            }
        });
        it("should revert when more request: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            const claimTime = 4 * 30 * 24 * 60 * 60;
            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                await skipTime(claimTime);
                await staking.connect(user1).requestClaim();
                await expect(staking.connect(user1).requestClaim()).to.be.revertedWith("Requested !");

            }
            else {
                console.log("throw ! please try again");
            }
        });
        it("should request success: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            const claimTime = 4 * 30 * 24 * 60 * 60;
            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                await skipTime(claimTime);
                await staking.connect(user1).requestClaim();
                const data = await staking.users(user1.address);
                expect(data.lazyClaim.isRequested).to.equal(true);
            }
            else {
                console.log("throw ! please try again");
            }
        });
    });

    describe("claim:", async () => {
        it("should revert when NOT request and can claim after 24 hours ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(staking.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);

            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);

                await skipTime(10 * 30 * 24 * 60 * 60);
                await staking.connect(user1).requestUnstake();
                await skipTime(24 * 60 * 60 + 1);
                await staking.connect(user1).unstake(amount);

                await expect(staking.connect(user1).claim()).to.be.revertedWith("Please request and can claim after 24 hours");
            }
            else {
                console.log("throw ! please try again");
            }
        });

        it("should revert when amount of reward value equal to zero ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(staking.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);

            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);

                await skipTime(10 * 30 * 24 * 60 * 60);
                await staking.connect(user1).requestUnstake();
                await skipTime(24 * 60 * 60 + 1);
                await staking.connect(user1).unstake(amount);
                await staking.connect(user1).requestClaim();
                await skipTime(24 * 60 * 60 + 1);
                await expect(staking.connect(user1).claim()).to.be.revertedWith("Reward value equal to zero");
            }
            else {
                console.log("throw ! please try again");
            }
        });

        it("should claim success", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(staking.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);

            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                await skipTime(24 * 60 * 60 + 1);

                await staking.connect(user1).requestClaim();
                let data = await staking.users(user1.address);

                expect(data.lazyClaim.isRequested).to.equal(true);
                await skipTime(24 * 60 * 60 + 1);
                await staking.connect(user1).claim();
                data = await staking.users(user1.address);

                expect(data.lazyClaim.isRequested).to.equal(false);
            }
            else {
                console.log("throw ! please try again");
            }
        });
    });
    describe("unstake:", async () => {
        it("should revert when staking pool for NFT not expired: ", async () => {

            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            const unstakeTime = 8 * 30 * 24 * 60 * 60 + 1;
            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                await skipTime(unstakeTime);
                // await staking.connect(user1).requestUnstake();
                // await skipTime(25 * 60 * 60);
                await expect(staking.connect(user1).unstake(amount)).to.be.revertedWith("Staking: StakingPool for NFT has not expired yet..");
            }
            else {
                console.log("throw ! please try again");
            }


        });
        it("should revert when request not finish after 24 hours: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            const unstakeTime = 9 * 30 * 24 * 60 * 60 + 1;
            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                await skipTime(unstakeTime);
                // await staking.connect(user1).requestUnstake();
                // await skipTime(25 * 60 * 60);
                await expect(staking.connect(user1).unstake(amount)).to.be.revertedWith("Please request and can withdraw after 24 hours");
            }
            else {
                console.log("throw ! please try again");
            }
        });
        it("should revert when connot unstake more than staked amount: ", async () => {
            const tokenId = 0;
            await gmi.approve(owner.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            const unstakeTime = 9 * 30 * 24 * 60 * 60 + 1;
            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                await skipTime(unstakeTime);
                await staking.connect(user1).requestUnstake();
                await skipTime(25 * 60 * 60);
                await expect(staking.connect(user1).unstake(MAX_BURN)).to.be.revertedWith("Staking: Cannot unstake more than staked amount.");
            }
            else {
                console.log("throw ! please try again");
            }
        });
        it("should unstake success: ", async () => {
            const tokenId = 0;

            await gmi.approve(owner.address, MAX_INT);
            await gmi.connect(user1).approve(staking.address, MAX_INT);
            await combatant.mint(user1.address);
            const typeId = await combatant.combatantBoxes(tokenId);
            const unstakeTime = 9 * 30 * 24 * 60 * 60 + 1;
            const amount = "100000000000000000000"; // 1 ether

            if (typeId.typeId.toString() == '0') {
                await staking.connect(user1).stake(amount);
                await skipTime(unstakeTime);
                await staking.connect(user1).requestUnstake();
                await skipTime(25 * 60 * 60);
                await staking.connect(user1).unstake(amount);
                const pendingRewards = await staking.pendingRewards(user1.address);
                expect(pendingRewards).to.equal(ZERO);
            }
            else {
                console.log("throw ! please try again");
            }
        });
    });

    describe("Check EmergencyWithdraw function: ", async () => {
        it("should deposit success: ", async () => {
            await gmi.connect(owner).transfer(staking.address, 10000);
            await staking.connect(owner).emergencyWithdraw();
            expect(await staking.getStakedAmount()).to.equal(
                await gmi.balanceOf(staking.address)
            );
        });
    });
});
