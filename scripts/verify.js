const hre = require("hardhat");
const contractAddress = require("./contracts.json");

async function main() {
  try {
    await hre.run("verify:verify", {
      address: contractAddress.gmi,
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  try {
    await hre.run("verify:verify", {
      address: contractAddress.busd,
      constructorArguments: [[contractAddress.admin]],
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  try {
    await hre.run("verify:verify", {
      address: contractAddress.project,
      constructorArguments: [contractAddress.gmi, contractAddress.busd],
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
