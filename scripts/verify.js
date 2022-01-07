const hre = require("hardhat");
const fs = require("fs");
const text = fs.readFileSync("scripts/contracts.json", "utf8");
const contractAddress = JSON.parse(text);
const THREE_MONTHS = 7776000;

async function main() {
  try {
    await hre.run("verify:verify", {
      address: contractAddress.cashTestToken,
      constructorArguments: [contractAddress.adminAddress],
      contract: "contracts/CashTestToken.sol:CashTestToken",
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  try {
    await hre.run("verify:verify", {
      address: contractAddress.memberCard,
      constructorArguments: [
        "Member Card NFT",
        "MCN",
        contractAddress.cashTestToken,
        3,
        THREE_MONTHS,
      ],
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  try {
    await hre.run("verify:verify", {
      address: contractAddress.vendor,
      constructorArguments: [contractAddress.memberCard],
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  try {
    await hre.run("verify:verify", {
      address: contractAddress.tokenTest,
      constructorArguments: ["TGE Token", "TGE"],
    });
  } catch (err) {
    console.log("err :>> ", err);
  }

  try {
    await hre.run("verify:verify", {
      address: contractAddress.staking,
      constructorArguments: [
        contractAddress.tokenTest,
        contractAddress.memberCard,
      ],
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
