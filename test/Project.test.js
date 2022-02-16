const { ethers } = require("hardhat");
const { expect } = require("chai");
const { getCurrentBlock, skipBlock } = require("./utils");

const allocationSize = 5000;
const estimateTokenAllocationRate = 1000;
const stakingLimitAmount = 1000;
const fundingMinAllocation = 500;
const fundingAllocationRate = 500;

describe("Project", () => {
    beforeEach(async () => {
        const accounts = await ethers.getSigners();
        admin = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];
        user4 = accounts[4];
        liquidity = accounts[10];

        // const maxBuyLimit = 500;
        // const maxSellLimit = 500;
        // const snipeTimeout = 20;
        // const blacklistTimeout = 30;
        // const listingTime = 30;

        // const AntiBot = await ethers.getContractFactory("AntiBotMaster");
        // antiBot = await AntiBot.deploy(liquidity.address, maxBuyLimit, maxSellLimit, snipeTimeout, blacklistTimeout, listingTime);

        // gmi = await Gmi.deploy("GMI", "Gamifi Token", antiBot.address);
        // gmi = await Gmi.deploy("GMI", "Gamifi Token");
        // await gmi.connect(admin).mint(user2.address, 100);
        // await gmi.connect(admin).mint(user3.address, 100);
        // await gmi.connect(admin).mint(user4.address, 100);

        const TokenTest = await ethers.getContractFactory("TokenTest");
        tokenTest = await TokenTest.deploy("TKT", "Token Test");

        const Busd = await ethers.getContractFactory("CashTestToken");
        busd = await Busd.deploy([admin.address, user1.address, user2.address, user3.address]);

        const Project = await ethers.getContractFactory("Project");
        project = await Project.deploy(tokenTest.address, busd.address);

        await tokenTest.connect(user2).approve(project.address, 60)
        await tokenTest.connect(user3).approve(project.address, 60)
        await tokenTest.connect(user4).approve(project.address, 60)
    })

    describe("Create Project", () => {
        it("Success", async () => {
          expect(await project.latestProjectId()).equal(0, "Invalid project id");
          let currentBlock = await getCurrentBlock();
          const stakingStartBlockNumber = currentBlock + 100;
          const stakingEndBlockNumber = stakingStartBlockNumber + 100;
          const fundingStartBlockNumber = stakingEndBlockNumber + 100;
          const fundingEndBlockNumber = fundingStartBlockNumber + 100;

          await project
            .connect(admin)
            .createProject(
              tokenTest.address,
              allocationSize,
              estimateTokenAllocationRate,
              stakingStartBlockNumber,
              stakingEndBlockNumber,
              stakingLimitAmount,
              fundingStartBlockNumber,
              fundingEndBlockNumber,
              fundingMinAllocation,
              fundingAllocationRate,
              user1.address
            );

          expect(await project.latestProjectId()).equal(1, "Invalid project id");
        });

        it("Only owner", async () => {
          let currentBlock = await getCurrentBlock();
          const stakingStartBlockNumber = currentBlock + 100;
          const stakingEndBlockNumber = stakingStartBlockNumber + 100;
          const fundingStartBlockNumber = stakingEndBlockNumber + 100;
          const fundingEndBlockNumber = fundingStartBlockNumber + 100;

          await expect(
            project
              .connect(user1)
              .createProject(
                tokenTest.address,
                allocationSize,
                estimateTokenAllocationRate,
                stakingStartBlockNumber,
                stakingEndBlockNumber,
                stakingLimitAmount,
                fundingStartBlockNumber,
                fundingEndBlockNumber,
                fundingMinAllocation,
                fundingAllocationRate,
                user1.address
              )
          ).to.revertedWith("caller is not the owner");
        });

        it("stakingStartBlockNumber <= current block number", async() => {
          let currentBlock = await getCurrentBlock();
          const stakingStartBlockNumber = currentBlock + 100;
          const stakingEndBlockNumber = stakingStartBlockNumber + 100;
          const fundingStartBlockNumber = stakingEndBlockNumber + 100;
          const fundingEndBlockNumber = fundingStartBlockNumber + 100;

          await expect(
            project
              .connect(admin)
              .createProject(
                tokenTest.address,
                allocationSize,
                estimateTokenAllocationRate,
                currentBlock - 1,
                stakingEndBlockNumber,
                stakingLimitAmount,
                fundingStartBlockNumber,
                fundingEndBlockNumber,
                fundingMinAllocation,
                fundingAllocationRate,
                user1.address
              )
          ).to.revertedWith("Invalid block number");

          currentBlock = await getCurrentBlock()
          await expect(
            project
              .connect(admin)
              .createProject(
                tokenTest.address,
                allocationSize,
                estimateTokenAllocationRate,
                currentBlock,
                stakingEndBlockNumber,
                stakingLimitAmount,
                fundingStartBlockNumber,
                fundingEndBlockNumber,
                fundingMinAllocation,
                fundingAllocationRate,
                user1.address
              )
          ).to.revertedWith("Invalid block number");
        })

        it("stakingStartBlockNumber >= stakingEndBlockNumber", async() => {
          let currentBlock = await getCurrentBlock();
          const stakingStartBlockNumber = currentBlock + 100;
          const stakingEndBlockNumber = stakingStartBlockNumber + 100;
          const fundingStartBlockNumber = stakingEndBlockNumber + 100;
          const fundingEndBlockNumber = fundingStartBlockNumber + 100;

          await expect(
            project
              .connect(admin)
              .createProject(
                tokenTest.address,
                allocationSize,
                estimateTokenAllocationRate,
                stakingEndBlockNumber + 1,
                stakingEndBlockNumber,
                stakingLimitAmount,
                fundingStartBlockNumber,
                fundingEndBlockNumber,
                fundingMinAllocation,
                fundingAllocationRate,
                user1.address
              )
          ).to.revertedWith("Invalid block number");

          await expect(
            project
              .connect(admin)
              .createProject(
                tokenTest.address,
                allocationSize,
                estimateTokenAllocationRate,
                stakingEndBlockNumber,
                stakingEndBlockNumber,
                stakingLimitAmount,
                fundingStartBlockNumber,
                fundingEndBlockNumber,
                fundingMinAllocation,
                fundingAllocationRate,
                user1.address
              )
          ).to.revertedWith("Invalid block number");
        })

        it("fundingStartBlockNumber <= stakingEndBlockNumber", async() => {
          let currentBlock = await getCurrentBlock();
          const stakingStartBlockNumber = currentBlock + 100;
          const stakingEndBlockNumber = stakingStartBlockNumber + 100;
          const fundingStartBlockNumber = stakingEndBlockNumber + 100;
          const fundingEndBlockNumber = fundingStartBlockNumber + 100;

          await expect(
            project
              .connect(admin)
              .createProject(
                tokenTest.address,
                allocationSize,
                estimateTokenAllocationRate,
                stakingStartBlockNumber,
                stakingEndBlockNumber,
                stakingLimitAmount,
                stakingEndBlockNumber - 1,
                fundingEndBlockNumber,
                fundingMinAllocation,
                fundingAllocationRate,
                user1.address
              )
          ).to.revertedWith("Invalid block number");

          await expect(
            project
              .connect(admin)
              .createProject(
                tokenTest.address,
                allocationSize,
                estimateTokenAllocationRate,
                stakingStartBlockNumber,
                stakingEndBlockNumber,
                stakingLimitAmount,
                stakingEndBlockNumber,
                fundingEndBlockNumber,
                fundingMinAllocation,
                fundingAllocationRate,
                user1.address
              )
          ).to.revertedWith("Invalid block number");
        })

        it("fundingStartBlockNumber >= fundingEndBlockNumber", async() => {
          let currentBlock = await getCurrentBlock();
          const stakingStartBlockNumber = currentBlock + 100;
          const stakingEndBlockNumber = stakingStartBlockNumber + 100;
          const fundingStartBlockNumber = stakingEndBlockNumber + 100;
          const fundingEndBlockNumber = fundingStartBlockNumber + 100;

          await expect(
            project
              .connect(admin)
              .createProject(
                tokenTest.address,
                allocationSize,
                estimateTokenAllocationRate,
                stakingStartBlockNumber,
                stakingEndBlockNumber,
                stakingLimitAmount,
                fundingEndBlockNumber + 1,
                fundingEndBlockNumber,
                fundingMinAllocation,
                fundingAllocationRate,
                user1.address
              )
          ).to.revertedWith("Invalid block number");

          await expect(
            project
              .connect(admin)
              .createProject(
                tokenTest.address,
                allocationSize,
                estimateTokenAllocationRate,
                stakingStartBlockNumber,
                stakingEndBlockNumber,
                stakingLimitAmount,
                fundingEndBlockNumber,
                fundingEndBlockNumber,
                fundingMinAllocation,
                fundingAllocationRate,
                user1.address
              )
          ).to.revertedWith("Invalid block number");
        })
    })

    describe("Set staking block number", () => {
      beforeEach(async () => {
        currentBlock = await getCurrentBlock();
        stakingStartBlockNumber = currentBlock + 100;
        stakingEndBlockNumber = stakingStartBlockNumber + 100;
        fundingStartBlockNumber = stakingEndBlockNumber + 100;
        fundingEndBlockNumber = fundingStartBlockNumber + 100;

        await project
          .connect(admin)
          .createProject(
            tokenTest.address,
            allocationSize,
            estimateTokenAllocationRate,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            stakingLimitAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );
      });

      it("Success", async () => {
        let projectInfo = await project.getProjectInfo(1);
        const blockStart = projectInfo.stakingEndBlockNumber - 10;
        const blockEnd = projectInfo.fundingStartBlockNumber - 10;
        expect(projectInfo.stakingStartBlockNumber).equal(stakingStartBlockNumber, "Invalid block number");
        expect(projectInfo.stakingEndBlockNumber).equal(stakingEndBlockNumber, "Invalid block number");
        await project.setStakingBlockNumber(1, blockStart, blockEnd);
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.stakingStartBlockNumber).equal(blockStart, "Invalid block number");
        expect(projectInfo.stakingEndBlockNumber).equal(blockEnd, "Invalid block number");
      });

      it("Only owner", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const blockStart = projectInfo.stakingEndBlockNumber - 10;
        const blockEnd = projectInfo.fundingStartBlockNumber - 10;
        await expect(project.connect(user1).setStakingBlockNumber(1, blockStart, blockEnd)).revertedWith("caller is not the owner");
        await project.connect(admin).setStakingBlockNumber(1, blockStart, blockEnd);
      });

      it("blockStart <= blockCurrent", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const currentBlock = await getCurrentBlock();
        const blockEnd = projectInfo.fundingStartBlockNumber - 1;
        await expect(project.connect(admin).setStakingBlockNumber(1, currentBlock - 1, blockEnd)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingBlockNumber(1, currentBlock, blockEnd)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setStakingBlockNumber(1, currentBlock + 20, blockEnd)).ok;
      });

      it("blockStart >= blockEnd", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const currentBlock = await getCurrentBlock();
        const blockStart = currentBlock + 20;
        const blockEnd = projectInfo.fundingStartBlockNumber - 250;
        await expect(project.connect(admin).setStakingBlockNumber(1, blockStart, blockStart - 1)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingBlockNumber(1, blockStart, blockStart)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setStakingBlockNumber(1, blockStart, blockEnd)).ok;
      });

      it("blockEnd >= fundingStartBlockNumber", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const currentBlock = await getCurrentBlock();
        const blockStart = currentBlock + 20;
        const blockEnd = projectInfo.fundingStartBlockNumber * 1 + 10;
        await expect(project.connect(admin).setStakingBlockNumber(1, blockStart, blockEnd)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingBlockNumber(1, blockStart, projectInfo.fundingStartBlockNumber)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setStakingBlockNumber(1, blockStart, blockEnd - 20)).ok;
      });
    });

    describe("Set funding block number", () => {
      beforeEach(async () => {
        currentBlock = await getCurrentBlock();
        stakingStartBlockNumber = currentBlock + 100;
        stakingEndBlockNumber = stakingStartBlockNumber + 100;
        fundingStartBlockNumber = stakingEndBlockNumber + 100;
        fundingEndBlockNumber = fundingStartBlockNumber + 100;

        await project
          .connect(admin)
          .createProject(
            tokenTest.address,
            allocationSize,
            estimateTokenAllocationRate,
            stakingStartBlockNumber,
            stakingEndBlockNumber,
            stakingLimitAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );
      });

      it("Success", async () => {
        let projectInfo = await project.getProjectInfo(1);
        let currentBlock = await getCurrentBlock();
        const blockStart = projectInfo.stakingEndBlockNumber * 1 + currentBlock + 10;
        const blockEnd = blockStart + 10;
        expect(projectInfo.fundingStartBlockNumber).equal(fundingStartBlockNumber, "Invalid block number");
        expect(projectInfo.fundingEndBlockNumber).equal(fundingEndBlockNumber, "Invalid block number");
        await project.setFundingBlockNumber(1, blockStart, blockEnd);
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.fundingStartBlockNumber).equal(blockStart, "Invalid block number");
        expect(projectInfo.fundingEndBlockNumber).equal(blockEnd, "Invalid block number");
      });

      it("Only owner", async () => {
        const projectInfo = await project.getProjectInfo(1);
        let currentBlock = await getCurrentBlock();
        const blockStart = projectInfo.stakingEndBlockNumber * 1 + currentBlock + 10;
        const blockEnd = blockStart + 10;
        await expect(project.connect(user1).setFundingBlockNumber(1, blockStart, blockEnd)).revertedWith("caller is not the owner");
        expect(await project.connect(admin).setFundingBlockNumber(1, blockStart, blockEnd)).ok;
      });

      it("blockStart <= currentBlock", async () => {
        const projectInfo = await project.getProjectInfo(1);
        let currentBlock = await getCurrentBlock();
        const blockStart = projectInfo.stakingEndBlockNumber * 1 + currentBlock + 10;
        const blockEnd = blockStart + 10;
        await expect(project.connect(admin).setFundingBlockNumber(1, currentBlock - 1, blockEnd)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setFundingBlockNumber(1, currentBlock, blockEnd)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setFundingBlockNumber(1, blockStart, blockEnd)).ok;
      });

      it("blockStart <= blockEnd", async () => {
        const projectInfo = await project.getProjectInfo(1);
        let currentBlock = await getCurrentBlock();
        const blockStart = projectInfo.stakingEndBlockNumber * 1 + currentBlock + 10;
        const blockEnd = blockStart + 10;
        await expect(project.connect(admin).setFundingBlockNumber(1, blockStart, blockStart - 1)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setFundingBlockNumber(1, blockStart, blockStart)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setFundingBlockNumber(1, blockStart, blockEnd)).ok;
      });

      it("blockStart <= stakingEndBlockNumber", async () => {
        const projectInfo = await project.getProjectInfo(1);
        let currentBlock = await getCurrentBlock();
        const blockStart = projectInfo.stakingEndBlockNumber * 1 + currentBlock + 10;
        const blockEnd = blockStart + 10;
        await expect(project.connect(admin).setFundingBlockNumber(1, projectInfo.stakingEndBlockNumber - 10, blockEnd)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setFundingBlockNumber(1, projectInfo.stakingEndBlockNumber, projectInfo.stakingEndBlockNumber)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setFundingBlockNumber(1, blockStart, blockEnd)).ok;
      });
    });
})