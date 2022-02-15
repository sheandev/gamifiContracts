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

    describe("Set staking start block number", () => {
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
        expect(projectInfo.stakingStartBlockNumber).equal(stakingStartBlockNumber, "Invalid block number");
        await project.setStakingStartBlockNumber(1, projectInfo.stakingEndBlockNumber - 10);
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.stakingStartBlockNumber).equal(projectInfo.stakingEndBlockNumber - 10, "Invalid block number");
      });

      it("Only owner", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const stakingEndBlockNumber = projectInfo.stakingEndBlockNumber;
        await expect(project.connect(user1).setStakingStartBlockNumber(1, stakingEndBlockNumber - 1)).revertedWith("caller is not the owner");
        await project.connect(admin).setStakingStartBlockNumber(1, stakingEndBlockNumber - 1);
      });

      it("Set stakingStartBlockNumber >= stakingEndBlockNumber", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const stakingEndBlockNumber = projectInfo.stakingEndBlockNumber;
        await expect(project.connect(admin).setStakingStartBlockNumber(1, stakingEndBlockNumber + 10)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingStartBlockNumber(1, stakingEndBlockNumber)).revertedWith("Invalid block number");
      });
    });

    describe("Set staking end block number", () => {
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
        expect(projectInfo.stakingEndBlockNumber).equal(stakingEndBlockNumber, "Invalid block number");
        await project.setStakingEndBlockNumber(1, projectInfo.fundingStartBlockNumber - 10);
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.stakingEndBlockNumber).equal(projectInfo.fundingStartBlockNumber - 10, "Invalid block number");
      });

      it("Only owner", async () => {
        const projectInfo = await project.getProjectInfo(1);
        await expect(project.connect(user1).setStakingEndBlockNumber(1, projectInfo.fundingStartBlockNumber - 10)).revertedWith("caller is not the owner");

        await project.connect(admin).setStakingEndBlockNumber(1, projectInfo.fundingStartBlockNumber - 10);
      });

      it("Set stakingEndBlockNumber <= stakingStartBlockNumber", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const stakingEndBlockNumber = projectInfo.stakingEndBlockNumber;
        await expect(project.connect(admin).setStakingStartBlockNumber(1, stakingEndBlockNumber + 10)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingStartBlockNumber(1, stakingEndBlockNumber)).revertedWith("Invalid block number");
      });

      it("Set stakingEndBlockNumber >= fundingStartBlockNumber", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const fundingStartBlockNumber = projectInfo.fundingStartBlockNumber;
        await expect(project.connect(admin).setStakingEndBlockNumber(1, fundingStartBlockNumber + 10)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingEndBlockNumber(1, fundingStartBlockNumber)).revertedWith("Invalid block number");
      });
    });

    describe("Set funding start block number", () => {
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
        expect(projectInfo.fundingStartBlockNumber).equal(fundingStartBlockNumber, "Invalid block number");
        await project.setFundingStartBlockNumber(1, projectInfo.stakingEndBlockNumber + 10);
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.fundingStartBlockNumber).equal(projectInfo.stakingEndBlockNumber + 10, "Invalid block number");
      });

      it("Only owner", async () => {
        const projectInfo = await project.getProjectInfo(1);
        await expect(project.connect(user1).setFundingStartBlockNumber(1, projectInfo.stakingEndBlockNumber + 10)).revertedWith("caller is not the owner");

        await project.connect(admin).setFundingStartBlockNumber(1, projectInfo.stakingEndBlockNumber + 10);
      });

      it("Set stakingEndBlockNumber <= stakingStartBlockNumber", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const stakingEndBlockNumber = projectInfo.stakingEndBlockNumber;
        await expect(project.connect(admin).setStakingStartBlockNumber(1, stakingEndBlockNumber + 10)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingStartBlockNumber(1, stakingEndBlockNumber)).revertedWith("Invalid block number");
      });

      it("Set stakingEndBlockNumber >= fundingStartBlockNumber", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const fundingStartBlockNumber = projectInfo.fundingStartBlockNumber;
        await expect(project.connect(admin).setStakingEndBlockNumber(1, fundingStartBlockNumber + 10)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingEndBlockNumber(1, fundingStartBlockNumber)).revertedWith("Invalid block number");
      });
    });
})