const hre = require("hardhat");
const contracts = require("../contracts-verify.json");

async function main() {
  try {
    await hre.run("verify:verify", {
      address: contracts.memberCard,
    });
  } catch (err) {
    console.log("err :>> ", err);
  }
  
  try {
    await hre.run("verify:verify", {
      address: contracts.gmi,
    });
  } catch (err) {
    console.log("err :>> ", err);
  }
  
  try {
    await hre.run("verify:verify", {
      address: contracts.busd,
      constructorArguments: [[contracts.admin]],
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  try {
    await hre.run("verify:verify", {
      address: contracts.project,
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  try {
    await hre.run("verify:verify", {
      address: contracts.vestingTGE,
    });
  } catch (err) {
    console.log("err :>> ", err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
