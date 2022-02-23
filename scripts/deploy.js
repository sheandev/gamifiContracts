const hre = require("hardhat");
const fs = require("fs");
const ethers = hre.ethers;

async function main() {
  //Loading accounts
  const accounts = await ethers.getSigners();
  const addresses = accounts.map((item) => item.address);
  const admin = addresses[0];

  // Loading contract factory.
  const Gmi        = await ethers.getContractFactory("TokenGMI");
  const Busd       = await ethers.getContractFactory("CashTestToken");
  const Project    = await ethers.getContractFactory("Project");
  const MemberCard = await ethers.getContractFactory("MemberCard");
  const Staking    = await ethers.getContractFactory("Staking");
  const Vendor     = await ethers.getContractFactory("Vendor");
  const Vesting    = await ethers.getContractFactory("Vesting");

  // Deploy contracts
  console.log('==================================================================');
  console.log('DEPLOY CONTRACTS');
  console.log('==================================================================');

  const memberCard = await MemberCard.deploy();
  await memberCard.deployed();
  console.log("MemberCard deployed to:", memberCard.address);

  const vendor = await Vendor.deploy(memberCard.address);
  await vendor.deployed();
  console.log("Vendor     deployed to:", vendor.address);

  const gmi = await Gmi.deploy();
  await gmi.deployed();
  console.log("GMI Token  deployed to:", gmi.address);

  const busd = await Busd.deploy([admin]);
  await busd.deployed();
  console.log("Busd       deployed to:", busd.address);

  const project = await Project.deploy(gmi.address, busd.address);
  await project.deployed();
  console.log("Project    deployed to:", project.address);

  const staking = await Staking.deploy(gmi.address, memberCard.address);
  await staking.deployed();
  console.log("Staking    deployed to:", staking.address);

  const vesting = await Vesting.deploy();
  await vesting.deployed();
  console.log("Vesting    deployed to:", vesting.address);

  const contractAddresses = {
    admin: admin,
    memberCard: memberCard.address,
    vendor: vendor.address,
    gmi: gmi.address,
    busd: busd.address,
    project: project.address,
    staking: staking.address,
    vesting: vesting.address
  };

  await fs.writeFileSync(
    "contracts.json",
    JSON.stringify(contractAddresses)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});
