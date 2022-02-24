const { ethers } = require("hardhat");
const { expect } = require("chai");
const { getCurrentBlock, skipBlock } = require("./utils");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const Big = require('big.js');

const allocationSize        = '100000000000000000000000'; // 100,000 USD
const minStakeAmount        = '1000000000000000000000'; // 1000 GMI
const maxStakeAmount        = '10000000000000000000000'; // 10000 GMI
const fundingMinAllocation  = '10000000000000000000'; // 10 USD
const fundingAllocationRate = '500000000000000000'; // rate is 0.5 / mean that stake 1 GMI => can funding 0.5 USD
const estimateTokenAllocationRate = 1000;
const blackHoleAddress = "0x0000000000000000000000000000000000000000";

describe("Project", () => {
    beforeEach(async () => {
        const accounts = await ethers.getSigners();
        admin = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];
        user4 = accounts[4];
        fundingReceiver = accounts[10];

        const TokenGMI = await ethers.getContractFactory("TokenGMI");
        token = await TokenGMI.deploy();

        const CashTestToken = await ethers.getContractFactory("CashTestToken");
        busd = await CashTestToken.deploy([admin.address, user1.address, user2.address, user3.address]);

        const Project = await ethers.getContractFactory("Project");
        project = await Project.deploy(token.address, busd.address);

        await token.addController(admin.address);
        await token.mint(user1.address, '1000000000000000000000000'); // mint 1000,000 token GMI

        await token.connect(user1).approve(project.address, MAX_UINT256.toString());
        await busd.connect(user1).approve(project.address, MAX_UINT256.toString());
        await token.connect(user2).approve(project.address, MAX_UINT256.toString())
        await token.connect(user3).approve(project.address, MAX_UINT256.toString())
        await token.connect(user4).approve(project.address, MAX_UINT256.toString())
    })

    describe("createProject", () => {
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
              minStakeAmount,
              maxStakeAmount,
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
                minStakeAmount,
                maxStakeAmount,
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
                minStakeAmount,
                maxStakeAmount,
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
                minStakeAmount,
                maxStakeAmount,
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
                minStakeAmount,
                maxStakeAmount,
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
                minStakeAmount,
                maxStakeAmount,
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
                minStakeAmount,
                maxStakeAmount,
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
                minStakeAmount,
                maxStakeAmount,
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
                minStakeAmount,
                maxStakeAmount,
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
                minStakeAmount,
                maxStakeAmount,
                fundingEndBlockNumber,
                fundingEndBlockNumber,
                fundingMinAllocation,
                fundingAllocationRate,
                user1.address
              )
          ).to.revertedWith("Invalid block number");
        })

        it("minStakeAmount > maxStakeAmount", async () => {
          let currentBlock = await getCurrentBlock();
          const stakingStartBlockNumber = currentBlock + 100;
          const stakingEndBlockNumber = stakingStartBlockNumber + 100;
          const fundingStartBlockNumber = stakingEndBlockNumber + 100;
          const fundingEndBlockNumber = fundingStartBlockNumber + 100;
          const minStakeAmount = '1000000000000000000000';
          const maxStakeAmount = '100000000000000000000'; 

          await expect(project
            .connect(admin)
            .createProject(
              token.address,
              allocationSize,
              estimateTokenAllocationRate,
              stakingStartBlockNumber,
              stakingEndBlockNumber,
              minStakeAmount,
              maxStakeAmount,
              fundingStartBlockNumber,
              fundingEndBlockNumber,
              fundingMinAllocation,
              fundingAllocationRate,
              user1.address
            )).revertedWith("Invalid stake min amount")
        });
    })

    describe("setStakingBlockNumber", () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );
      });

      it("Success", async () => {
        let projectInfo = await project.getProjectInfo(1);
        const blockStart = projectInfo.stakeInfo.endBlockNumber - 10;
        const blockEnd = projectInfo.fundingInfo.startBlockNumber - 10;
        expect(projectInfo.stakeInfo.startBlockNumber).equal(stakingStartBlockNumber, "Invalid block number");
        expect(projectInfo.stakeInfo.endBlockNumber).equal(stakingEndBlockNumber, "Invalid block number");
        await project.setStakingBlockNumber(1, blockStart, blockEnd);
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.stakeInfo.startBlockNumber).equal(blockStart, "Invalid block number");
        expect(projectInfo.stakeInfo.endBlockNumber).equal(blockEnd, "Invalid block number");
      });

      it("Only owner", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const blockStart = projectInfo.stakeInfo.endBlockNumber - 10;
        const blockEnd = projectInfo.fundingInfo.startBlockNumber - 10;
        await expect(project.connect(user1).setStakingBlockNumber(1, blockStart, blockEnd)).revertedWith("caller is not the owner");
        await project.connect(admin).setStakingBlockNumber(1, blockStart, blockEnd);
      });

      it("blockStart <= blockCurrent", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const currentBlock = await getCurrentBlock();
        const blockEnd = projectInfo.fundingInfo.startBlockNumber - 1;
        await expect(project.connect(admin).setStakingBlockNumber(1, currentBlock - 1, blockEnd)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingBlockNumber(1, currentBlock, blockEnd)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setStakingBlockNumber(1, currentBlock + 20, blockEnd)).ok;
      });

      it("blockStart >= blockEnd", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const currentBlock = await getCurrentBlock();
        const blockStart = currentBlock + 20;
        const blockEnd = projectInfo.fundingInfo.startBlockNumber - 250;
        await expect(project.connect(admin).setStakingBlockNumber(1, blockStart, blockStart - 1)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingBlockNumber(1, blockStart, blockStart)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setStakingBlockNumber(1, blockStart, blockEnd)).ok;
      });

      it("blockEnd >= fundingStartBlockNumber", async () => {
        const projectInfo = await project.getProjectInfo(1);
        const currentBlock = await getCurrentBlock();
        const blockStart = currentBlock + 20;
        const blockEnd = projectInfo.fundingInfo.startBlockNumber * 1 + 10;
        await expect(project.connect(admin).setStakingBlockNumber(1, blockStart, blockEnd)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setStakingBlockNumber(1, blockStart, projectInfo.fundingInfo.startBlockNumber)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setStakingBlockNumber(1, blockStart, blockEnd - 20)).ok;
      });
    });

    describe("setFundingBlockNumber", () => {
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
            minStakeAmount,
            maxStakeAmount,
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
        const blockStart = projectInfo.stakeInfo.endBlockNumber * 1 + currentBlock + 10;
        const blockEnd = blockStart + 10;
        expect(projectInfo.fundingInfo.startBlockNumber).equal(fundingStartBlockNumber, "Invalid block number");
        expect(projectInfo.fundingInfo.endBlockNumber).equal(fundingEndBlockNumber, "Invalid block number");
        await project.setFundingBlockNumber(1, blockStart, blockEnd);
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.fundingInfo.startBlockNumber).equal(blockStart, "Invalid block number");
        expect(projectInfo.fundingInfo.endBlockNumber).equal(blockEnd, "Invalid block number");
      });

      it("Only owner", async () => {
        const projectInfo = await project.getProjectInfo(1);
        let currentBlock = await getCurrentBlock();
        const blockStart = projectInfo.stakeInfo.endBlockNumber * 1 + currentBlock + 10;
        const blockEnd = blockStart + 10;
        await expect(project.connect(user1).setFundingBlockNumber(1, blockStart, blockEnd)).revertedWith("caller is not the owner");
        expect(await project.connect(admin).setFundingBlockNumber(1, blockStart, blockEnd)).ok;
      });

      it("blockStart <= currentBlock", async () => {
        const projectInfo = await project.getProjectInfo(1);
        let currentBlock = await getCurrentBlock();
        const blockStart = projectInfo.stakeInfo.endBlockNumber * 1 + currentBlock + 10;
        const blockEnd = blockStart + 10;
        await expect(project.connect(admin).setFundingBlockNumber(1, currentBlock - 1, blockEnd)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setFundingBlockNumber(1, currentBlock, blockEnd)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setFundingBlockNumber(1, blockStart, blockEnd)).ok;
      });

      it("blockStart <= blockEnd", async () => {
        const projectInfo = await project.getProjectInfo(1);
        let currentBlock = await getCurrentBlock();
        const blockStart = projectInfo.stakeInfo.endBlockNumber * 1 + currentBlock + 10;
        const blockEnd = blockStart + 10;
        await expect(project.connect(admin).setFundingBlockNumber(1, blockStart, blockStart - 1)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setFundingBlockNumber(1, blockStart, blockStart)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setFundingBlockNumber(1, blockStart, blockEnd)).ok;
      });

      it("blockStart <= stakingEndBlockNumber", async () => {
        const projectInfo = await project.getProjectInfo(1);
        let currentBlock = await getCurrentBlock();
        const blockStart = projectInfo.stakeInfo.endBlockNumber * 1 + currentBlock + 10;
        const blockEnd = blockStart + 10;
        await expect(project.connect(admin).setFundingBlockNumber(1, projectInfo.stakeInfo.endBlockNumber - 10, blockEnd)).revertedWith("Invalid block number");
        await expect(project.connect(admin).setFundingBlockNumber(1, projectInfo.stakeInfo.endBlockNumber, projectInfo.stakeInfo.endBlockNumber)).revertedWith("Invalid block number");
        expect(await project.connect(admin).setFundingBlockNumber(1, blockStart, blockEnd)).ok;
      });
    });

    describe("setAllocationSize", () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );
      });

      it("Only owner", async () => {
        await expect(project.connect(user1).setAllocationSize(1, '10')).revertedWith("caller is not the owner");
        expect(await project.connect(admin).setAllocationSize(1, '10')).ok;
      })

      it("Invalid project allocation size", async () => {
         await expect(project.setAllocationSize(1, '0')).revertedWith("Invalid project allocation size");
      })

      it("Success", async () => {
        let projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.allocationSize).equal(allocationSize);
        await project.setAllocationSize(1, "50");
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.allocationSize).equal("50");
     })
    })
    
    describe("setEstimateTokenAllocationRate", () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );
      });

      it("Only owner", async () => {
        await expect(project.connect(user1).setEstimateTokenAllocationRate(1, '10')).revertedWith("caller is not the owner");
        expect(await project.connect(admin).setEstimateTokenAllocationRate(1, '10')).ok;
      })

      it("Invalid project estimate token allocation rate", async () => {
         await expect(project.setEstimateTokenAllocationRate(1, '0')).revertedWith("Invalid project estimate token allocation rate");
      })

      it("Success", async () => {
        let projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.fundingInfo.estimateTokenAllocationRate).equal(estimateTokenAllocationRate);
        await project.setEstimateTokenAllocationRate(1, "50");
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.fundingInfo.estimateTokenAllocationRate).equal("50");
     })
    })

    describe("setMinStakeAmount", () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );
      });

      it("Only owner", async () => {
        await expect(project.connect(user1).setMinStakeAmount(1, '10')).revertedWith("caller is not the owner");
        expect(await project.connect(admin).setMinStakeAmount(1, '10')).ok;
      })

      it("Invalid min of stake amount", async () => {
         await expect(project.setMinStakeAmount(1, '0')).revertedWith("Invalid min of stake amount");
         await expect(project.setMinStakeAmount(1, maxStakeAmount + 100)).revertedWith("Invalid min of stake amount");
      })

      it("Success", async () => {
        let projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.stakeInfo.minStakeAmount).equal(minStakeAmount);
        await project.setMinStakeAmount(1, "50");
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.stakeInfo.minStakeAmount).equal("50");
     })
    })

    describe("setMaxStakeAmount", () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );
      });

      it("Only owner", async () => {
        await expect(project.connect(user1).setMaxStakeAmount(1, '10')).revertedWith("caller is not the owner");
        expect(await project.connect(admin).setMaxStakeAmount(1, '10')).ok;
      })

      it("Invalid limit of stake amount", async () => {
         await expect(project.setMaxStakeAmount(1, '0')).revertedWith("Invalid limit of stake amount");
      })

      it("Success", async () => {
        let projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.stakeInfo.maxStakeAmount).equal(maxStakeAmount);
        await project.setMaxStakeAmount(1, "50");
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.stakeInfo.maxStakeAmount).equal("50");
     })
    })
    
    describe("setFundingAllocationRate", () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );
      });

      it("Only owner", async () => {
        await expect(project.connect(user1).setFundingAllocationRate(1, '10')).revertedWith("caller is not the owner");
        expect(await project.connect(admin).setFundingAllocationRate(1, '10')).ok;
      })

      it("Invalid project funding allocation rate", async () => {
         await expect(project.setFundingAllocationRate(1, '0')).revertedWith("Invalid project funding allocation rate");
      })

      it("Success", async () => {
        let projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.fundingInfo.allocationRate).equal(fundingAllocationRate);
        await project.setFundingAllocationRate(1, "50");
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.fundingInfo.allocationRate).equal("50");
     })
    })

    describe("setFundingReceiver", () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );
      });

      it("Only owner", async () => {
        await expect(project.connect(user1).setFundingReceiver(1, user2.address)).revertedWith("caller is not the owner");
        expect(await project.connect(admin).setFundingReceiver(1, user2.address)).ok;
      })

      it("Invalid funding receiver", async () => {
         await expect(project.setFundingReceiver(1, blackHoleAddress)).revertedWith("Invalid funding receiver");
      })

      it("Success", async () => {
        let projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.fundingInfo.fundingReceiver).equal(user1.address);
        await project.setFundingReceiver(1, user2.address);
        projectInfo = await project.getProjectInfo(1);
        expect(projectInfo.fundingInfo.fundingReceiver).equal(user2.address);
     })
    })

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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );

        projectId = await project.latestProjectId();
      });

      it('Staking has not started yet', async () => {
        await expect(
          project.connect(user1).stake(projectId, maxStakeAmount)
        ).to.revertedWith('Staking has not started yet');
      });

      it('Staking has ended', async () => {
        await skipBlock(200);
        await expect(
          project.connect(user1).stake(projectId, maxStakeAmount)
        ).to.revertedWith('Staking has ended');
      });

      it('Not enough stake amount', async () => {
        await skipBlock(100);
        await expect(
          project.connect(user1).stake(projectId, '0')
        ).to.revertedWith('Not enough stake amount');

        await expect(
          project.connect(user1).stake(projectId, '10000')
        ).to.revertedWith('Not enough stake amount');
      });

      it('Amount exceed limit stake amount', async () => {
        await skipBlock(100);
        await expect(
          project.connect(user1).stake(projectId, maxStakeAmount + 1)
        ).to.revertedWith('Amount exceed limit stake amount');
      });

      it('Stake success', async () => {
        const tokenBalanceOfProject_before = await token.balanceOf(project.address);
        const tokenBalanceOfUser_before = await token.balanceOf(user1.address);

        await skipBlock(100);
        await project.connect(user1).stake(projectId, maxStakeAmount);

        const tokenBalanceOfProject_after = await token.balanceOf(project.address);
        const tokenBalanceOfUser_after = await token.balanceOf(user1.address);

        expect(tokenBalanceOfProject_after.sub(tokenBalanceOfProject_before)).to.be.equal(maxStakeAmount);
        expect(tokenBalanceOfUser_before.sub(tokenBalanceOfUser_after)).to.be.equal(maxStakeAmount);

        const stakeInfo = await project.getStakeInfo(projectId);
        expect(stakeInfo.stakedTotalAmount).to.be.equal(maxStakeAmount);
        expect(stakeInfo.stakedAccounts.length).to.be.equal(1);
        expect(stakeInfo.stakedAccounts[0]).to.be.equal(user1.address);

        const userInfo = await project.getUserInfo(projectId, user1.address);
        expect(userInfo.stakedAmount).to.be.equal(maxStakeAmount);
      });
    });

    describe('funding', () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );

        projectId = await project.latestProjectId();
        await skipBlock(100);
        await project.connect(user1).stake(projectId, maxStakeAmount);
        await project.addWhitelist(projectId, [user1.address]);

        fundingMaxAllocation = await project.getFundingMaxAllocation(projectId, user1.address);
      });

      it('Funding has not started yet', async () => {
        await expect(
          project.connect(user1).funding(projectId, fundingMaxAllocation)
        ).to.revertedWith('Funding has not started yet');
      });

      it('Funding has ended', async () => {
        await skipBlock(400);
        await expect(
          project.connect(user1).funding(projectId, fundingMaxAllocation)
        ).to.revertedWith('Funding has ended');
      });

      it('User is not in whitelist', async () => {
        await skipBlock(200);
        await expect(
          project.connect(user2).funding(projectId, fundingMaxAllocation)
        ).to.revertedWith('User is not in whitelist');
      });

      it('Amount must be greater than min allocation', async () => {
        await skipBlock(200);
        await expect(
          project.connect(user1).funding(projectId, new Big(fundingMinAllocation).sub(1).toString())
        ).to.revertedWith('Amount must be greater than min allocation');
      });

      it('Amount exceed max allocation', async () => {
        await skipBlock(200);
        await expect(
          project.connect(user1).funding(projectId, fundingMaxAllocation.add(1).toString())
        ).to.revertedWith('Amount exceed max allocation');
      });

      it('Funding success', async () => {
        const usdBalanceOfProject_before = await busd.balanceOf(project.address);
        const usdBalanceOfUser_before = await busd.balanceOf(user1.address);

        await skipBlock(200);
        await project.connect(user1).funding(projectId, fundingMaxAllocation);

        const busdBalanceOfProject_after = await busd.balanceOf(project.address);
        const busdBalanceOfUser_after = await busd.balanceOf(user1.address);

        expect(busdBalanceOfProject_after.sub(usdBalanceOfProject_before)).to.be.equal(fundingMaxAllocation);
        expect(usdBalanceOfUser_before.sub(busdBalanceOfUser_after)).to.be.equal(fundingMaxAllocation);

        const fundingInfo = await project.getFundingInfo(projectId);
        expect(fundingInfo.fundedTotalAmount).to.be.equal(fundingMaxAllocation);
        expect(fundingInfo.fundedAccounts.length).to.be.equal(1);
        expect(fundingInfo.fundedAccounts[0]).to.be.equal(user1.address);

        const userInfo = await project.getUserInfo(projectId, user1.address);
        expect(userInfo.fundedAmount).to.be.equal(fundingMaxAllocation);
      });
    });

    describe("addWhitelist", () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );

        projectId = await project.latestProjectId();
        await skipBlock(100);
      });

      it("Only owner", async () => {
        await project.connect(user1).stake(projectId, maxStakeAmount);
        await expect(project.connect(user1).addWhitelist(projectId, [user1.address])).revertedWith("caller is not the owner");
        expect(await project.connect(admin).addWhitelist(projectId, [user1.address])).ok
      })

      it("Invalid account", async () => {
        await expect(project.connect(admin).addWhitelist(projectId, [blackHoleAddress])).revertedWith("Invalid account");
        await project.connect(user1).stake(projectId, maxStakeAmount);
        await expect(project.connect(admin).addWhitelist(projectId, [user1.address])).ok;
      })

      it("Success", async () => {
        expect(await project.connect(user1).isAddedWhitelist(projectId, user1.address)).equal(false);
        await project.connect(user1).stake(projectId, maxStakeAmount);
        expect(await project.connect(admin).addWhitelist(projectId, [user1.address])).ok;
        expect(await project.connect(user1).isAddedWhitelist(projectId, user1.address)).equal(true);
      })
    })

    describe("removeFromWhiteList", () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );

        projectId = await project.latestProjectId();
        await skipBlock(100);
      });

      it("Only owner", async () => {
        await project.connect(user1).stake(projectId, maxStakeAmount);
        expect(await project.connect(admin).addWhitelist(projectId, [user1.address])).ok;
        await expect(project.connect(user1).removeFromWhitelist(projectId, user1.address)).revertedWith("caller is not the owner");
        expect(await project.connect(admin).removeFromWhitelist(projectId, user1.address)).ok
      })

      it("Success", async () => {
        expect(await project.connect(user1).isAddedWhitelist(projectId, user1.address)).equal(false);
        await project.connect(user1).stake(projectId, maxStakeAmount);
        expect(await project.connect(admin).addWhitelist(projectId, [user1.address])).ok;
        expect(await project.connect(user1).isAddedWhitelist(projectId, user1.address)).equal(true);
        expect(await project.connect(admin).removeFromWhitelist(projectId, user1.address)).ok;
        expect(await project.connect(user1).isAddedWhitelist(projectId, user1.address)).equal(false);
      })
    })

    describe('claimBack', () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            user1.address
          );

        projectId = await project.latestProjectId();
        await skipBlock(100);
        await project.connect(user1).stake(projectId, maxStakeAmount);
        await project.addWhitelist(projectId, [user1.address]);

        fundingMaxAllocation = await project.getFundingMaxAllocation(projectId, user1.address);
        await skipBlock(200);
        await project.connect(user1).funding(projectId, fundingMaxAllocation);
      });

      it('Funding has not ended yet', async () => {
        await expect(
          project.connect(user1).claimBack(projectId)
        ).to.revertedWith('Funding has not ended yet');
      });

      it('Lock claim back 24h after Funding', async () => {
        const tokenBalanceOfProject_before = await token.balanceOf(project.address);
        const tokenBalanceOfUser_before = await token.balanceOf(user1.address);

        await skipBlock(100);
        await expect(project.connect(user1).claimBack(projectId)).to.revertedWith("Funding is Processing");

        await skipBlock(30000);
        await project.connect(user1).claimBack(projectId);

        const tokenBalanceOfProject_after = await token.balanceOf(project.address);
        const tokenBalanceOfUser_after = await token.balanceOf(user1.address);

        expect(tokenBalanceOfProject_before.sub(tokenBalanceOfProject_after)).to.be.equal(maxStakeAmount);
        expect(tokenBalanceOfUser_after.sub(tokenBalanceOfUser_before)).to.be.equal(maxStakeAmount);

        const userInfo = await project.getUserInfo(projectId, user1.address);
        expect(userInfo.isClaimedBack).to.be.true;
      })

      it('Nothing to claim back', async () => {
        await skipBlock(30000);
        await expect(
          project.connect(user2).claimBack(projectId)
        ).to.revertedWith('Nothing to claim back');
      });

      it('Claim back success', async () => {
        const tokenBalanceOfProject_before = await token.balanceOf(project.address);
        const tokenBalanceOfUser_before = await token.balanceOf(user1.address);

        await skipBlock(30000);
        await project.connect(user1).claimBack(projectId);

        const tokenBalanceOfProject_after = await token.balanceOf(project.address);
        const tokenBalanceOfUser_after = await token.balanceOf(user1.address);

        expect(tokenBalanceOfProject_before.sub(tokenBalanceOfProject_after)).to.be.equal(maxStakeAmount);
        expect(tokenBalanceOfUser_after.sub(tokenBalanceOfUser_before)).to.be.equal(maxStakeAmount);

        const userInfo = await project.getUserInfo(projectId, user1.address);
        expect(userInfo.isClaimedBack).to.be.true;
      });
    });

    describe('withdrawFunding', () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            fundingReceiver.address
          );

        projectId = await project.latestProjectId();
        await skipBlock(100);
        await project.connect(user1).stake(projectId, maxStakeAmount);
        await project.addWhitelist(projectId, [user1.address]);

        fundingMaxAllocation = await project.getFundingMaxAllocation(projectId, user1.address);
        await skipBlock(200);
        await project.connect(user1).funding(projectId, fundingMaxAllocation);
      });

      it('Funding has not ended yet', async () => {
        await expect(
          project.connect(admin).withdrawFunding(projectId)
        ).to.revertedWith('Funding has not ended yet');
      });

      it('Already withdrawn fund', async () => {
        await skipBlock(100);
        await project.connect(admin).withdrawFunding(projectId);

        await expect(
          project.connect(admin).withdrawFunding(projectId)
        ).to.revertedWith('Already withdrawn fund');
      });

      it('Not enough amount', async () => {
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
            minStakeAmount,
            maxStakeAmount,
            fundingStartBlockNumber,
            fundingEndBlockNumber,
            fundingMinAllocation,
            fundingAllocationRate,
            fundingReceiver.address
          );

        await skipBlock(400);
        projectId = await project.latestProjectId();
        await expect(
          project.connect(admin).withdrawFunding(projectId)
        ).to.revertedWith('Not enough amount');
      });

      it('Withdraw success', async () => {
        const usdBalanceOfProject_before = await busd.balanceOf(project.address);
        const usdBalanceOfFundingReceiver_before = await busd.balanceOf(fundingReceiver.address);

        await skipBlock(300);
        await project.connect(admin).withdrawFunding(projectId);

        const usdBalanceOfProject_after = await busd.balanceOf(project.address);
        const usdBalanceOffundingReceiver_after = await busd.balanceOf(fundingReceiver.address);

        expect(usdBalanceOfProject_before.sub(usdBalanceOfProject_after)).to.be.equal(fundingMaxAllocation);
        expect(usdBalanceOffundingReceiver_after.sub(usdBalanceOfFundingReceiver_before)).to.be.equal(fundingMaxAllocation);

        const fundingInfo = await project.getFundingInfo(projectId);
        expect(fundingInfo.isWithdrawnFund).to.be.true;
      });
    });
});
