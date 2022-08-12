const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;
const upgrades = hre.upgrades;

async function main() {
  //Loading accounts
  const accounts = await ethers.getSigners();
  const addresses = accounts.map((item) => item.address);
  const admin = addresses[0];

  const GMI = "0x88d8defcda194e08a93689fb6888579f6d45851d"; // main: 0x93D8d25E3C9A847a5Da79F79ecaC89461FEcA846 / test: 0x88d8defcda194e08a93689fb6888579f6d45851d

  // Loading contract factory.
  const StakingV3 = await ethers.getContractFactory("StakingV3");

  const blockNumAfter = await ethers.provider.getBlockNumber();
  const blockAfter = await ethers.provider.getBlock(blockNumAfter);
  const timestampAfter = blockAfter.timestamp;

  const CURRENT_TIME = timestampAfter;

  // Deploy contracts
  console.log(
    "=================================================================="
  );
  console.log("DEPLOY CONTRACTS");
  console.log(
    "=================================================================="
  );

  const stakingAPY75 = await upgrades.deployProxy(
    StakingV3,
    [
      admin,
      GMI, //staked token
      GMI, //reward token
      CURRENT_TIME,
      process.env.APY75,
      // process.env.TIMESTAMP_9_MONTHS,
      28800,
      process.env.MAX_TOKEN_9_MONTHS,
    ]
  );
  await stakingAPY75.deployed();
  console.log("stakingAPY75             deployed to:", stakingAPY75.address);
  const stakingAPY75Verify = await upgrades.erc1967.getImplementationAddress(
    stakingAPY75.address
  );
  console.log("stakingAPY75Verify       deployed to:", stakingAPY75Verify);

  const stakingAPY100 = await upgrades.deployProxy(
    StakingV3,
    [
      admin,
      GMI, //staked token
      GMI, //reward token
      CURRENT_TIME,
      process.env.APY100,
      // process.env.TIMESTAMP_12_MONTHS,
      28800,
      process.env.MAX_TOKEN_12_MONTHS,
    ]
  );
  await stakingAPY100.deployed();
  console.log("stakingAPY100            deployed to:", stakingAPY100.address);
  const stakingAPY100Verify = await upgrades.erc1967.getImplementationAddress(
    stakingAPY100.address
  );
  console.log("stakingAPY100Verify      deployed to:", stakingAPY100Verify);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
