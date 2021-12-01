const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  //Loading accounts
  const accounts = await ethers.getSigners();
  const addresses = accounts.map((item) => item.address);

  // Loading contract factory.
  const Token      = await ethers.getContractFactory("ERC20");
  const AntiBot    = await ethers.getContractFactory("AntiBotMaster");
  const Vesting    = await ethers.getContractFactory("Vesting");
  const MemberCard = await ethers.getContractFactory("MemberCard");

  // Deploy contracts
  const token = await Token.deploy();
  await token.deployed();
  console.log("Token      deployed to:", token.address);

  // TODO: Add deploy params later
  // const antiBot = await AntiBot.deploy();
  // await antiBot.deployed();
  // console.log("AntiBot    deployed to:", antiBot.address);

  // const vesting = await Vesting.deploy();
  // await vesting.deployed();
  // console.log("Vesting    deployed to:", vesting.address);

  // const memberCard = await MemberCard.deploy();
  // await memberCard.deployed();
  // console.log("MemberCard deployed to:", memberCard.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});
