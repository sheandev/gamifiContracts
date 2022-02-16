const { ethers } = require("hardhat");
const { expect } = require("chai");
const { getCurrentBlock, skipBlock } = require("./utils");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");

const allocationSize = 5000;
const estimateTokenAllocationRate = 1000;
const stakingLimitAmount = '1000000000000000000000';
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

        const TokenGMI = await ethers.getContractFactory("TokenGMI");
        token = await TokenGMI.deploy();

        const CashTestToken = await ethers.getContractFactory("CashTestToken");
        busd = await CashTestToken.deploy([admin.address, user1.address, user2.address, user3.address]);

        const Project = await ethers.getContractFactory("Project");
        project = await Project.deploy(token.address, busd.address);

        await token.addController(admin.address);
        await token.mint(user1.address, '1000000000000000000000000'); // mint 1000,000 token GMI

        await token.connect(user1).approve(project.address, MAX_UINT256.toString())
        await token.connect(user2).approve(project.address, MAX_UINT256.toString())
        await token.connect(user3).approve(project.address, MAX_UINT256.toString())
        await token.connect(user4).approve(project.address, MAX_UINT256.toString())
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
              token.address,
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
                token.address,
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
                token.address,
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
                token.address,
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
                token.address,
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
                token.address,
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
                token.address,
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
                token.address,
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
                token.address,
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
                token.address,
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
            token.address,
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
            token.address,
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

    describe('stake', () => {
      beforeEach(async () => {
        currentBlock = await getCurrentBlock();
        stakingStartBlockNumber = currentBlock + 100;
        stakingEndBlockNumber = stakingStartBlockNumber + 100;
        fundingStartBlockNumber = stakingEndBlockNumber + 100;
        fundingEndBlockNumber = fundingStartBlockNumber + 100;

        await project
          .connect(admin)
          .createProject(
            token.address,
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

        projectId = await project.latestProjectId();
        await project.addCompletedCampaignList(projectId, [user1.address])
      });

      it('Staking has not started yet', async () => {
        await expect(
          project.connect(user1).stake(projectId, '1000000000000000000')
        ).to.revertedWith('Staking has not started yet');
      });

      it('Staking has ended', async () => {
        await skipBlock(400);
        await expect(
          project.connect(user1).stake(projectId, '1000000000000000000')
        ).to.revertedWith('Staking has ended');
      });

      it('User is not complete gleam campaign', async () => {
        await skipBlock(100);
        await expect(
          project.connect(user2).stake(projectId, '1000000000000000000')
        ).to.revertedWith('User is not complete gleam campaign');
      });

      it('Invalid stake amount', async () => {
        await skipBlock(100);
        await expect(
          project.connect(user1).stake(projectId, '0')
        ).to.revertedWith('Invalid stake amount');
      });

      it('Amount exceed limit stake amount', async () => {
        await skipBlock(100);
        await expect(
          project.connect(user1).stake(projectId, stakingLimitAmount + 1)
        ).to.revertedWith('Amount exceed limit stake amount');
      });

      it('Stake success', async () => {
        const tokenBalanceOfProject_before = await token.balanceOf(project.address);
        const tokenBalanceOfUser_before = await token.balanceOf(user1.address);

        await skipBlock(100);
        await project.connect(user1).stake(projectId, stakingLimitAmount);

        const tokenBalanceOfProject_after = await token.balanceOf(project.address);
        const tokenBalanceOfUser_after = await token.balanceOf(user1.address);

        expect(tokenBalanceOfProject_after.sub(tokenBalanceOfProject_before)).to.be.equal(stakingLimitAmount);
        expect(tokenBalanceOfUser_before.sub(tokenBalanceOfUser_after)).to.be.equal(stakingLimitAmount);

        const projectInfo = await project.getProjectInfo(projectId);
        expect(projectInfo.stakedTotalAmount).to.be.equal(stakingLimitAmount);
        expect(projectInfo.stakedAccounts.length).to.be.equal(1);
        expect(projectInfo.stakedAccounts[0]).to.be.equal(user1.address);

        const userInfo = await project.getUserInfo(projectId, user1.address);
        expect(userInfo.stakedAmount).to.be.equal(stakingLimitAmount);
      });
    });
});
