const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  const THREE_MONTHS = 7776000;

  //Loading accounts
  const accounts = await ethers.getSigners();
  const addresses = accounts.map((item) => item.address);

  // Loading contract factory.
  // const Token      = await ethers.getContractFactory("ERC20");
  // const AntiBot    = await ethers.getContractFactory("AntiBotMaster");
  // const Vesting    = await ethers.getContractFactory("Vesting");
  const MemberCard = await ethers.getContractFactory("MemberCard");
  const TokenTest  = await ethers.getContractFactory("TokenTest");
  const Staking    = await ethers.getContractFactory("Staking");
  const Vendor     = await ethers.getContractFactory("Vendor");

  // Deploy contracts
  // const token = await Token.deploy("GAMI20", "GAMI", {
  //   from: addresses[0],
  //   to: addresses[1],
  //   amount: 1000,
  // });
  // await token.deployed();
  // console.log("Token      deployed to:", token.address);

  // TODO: Add deploy params later
  // const antiBot = await AntiBot.deploy();
  // await antiBot.deployed();
  // console.log("AntiBot    deployed to:", antiBot.address);

  // const vesting = await Vesting.deploy();
  // await vesting.deployed();
  // console.log("Vesting    deployed to:", vesting.address);

  const memberCard = await MemberCard.deploy("Member Card NFT", "MCN", 3, THREE_MONTHS);
  await memberCard.deployed();
  console.log("MemberCard deployed to:", memberCard.address);

  const vendor = await Vendor.deploy(memberCard.address);
  await vendor.deployed();
  console.log("Vendor deployed to:", vendor.address);

  const tokenTest = await TokenTest.deploy("TGEToken", "TGE");
  await tokenTest.deployed();
  console.log("TokenTest deployed to:", tokenTest.address);

  const staking = await Staking.deploy(tokenTest.address, memberCard.address);
  await staking.deployed();
  console.log("Staking deployed to:", staking.address);

  await tokenTest.setStakeContract(staking.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});
