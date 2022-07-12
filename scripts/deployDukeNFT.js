const hre = require("hardhat");
require("dotenv").config();
const fs = require("fs");
const ethers = hre.ethers;
const upgrades = hre.upgrades;
async function main() {
    //Loading accounts
    const accounts = await ethers.getSigners();
    const addresses = accounts.map((item) => item.address);
    const admin = addresses[0];

    const GMI = "0x93D8d25E3C9A847a5Da79F79ecaC89461FEcA846"; // main: 0x93D8d25E3C9A847a5Da79F79ecaC89461FEcA846 / test: 0x88d8defcda194e08a93689fb6888579f6d45851d

    // Loading contract factory.
    const MysteriousBox = await ethers.getContractFactory("MysteriousBoxes");
    const Duke = await ethers.getContractFactory("Duke");
    const DukeStaking = await ethers.getContractFactory("DukeStaking");
    const Rand = await ethers.getContractFactory("Rand");
    // Deploy contracts
    console.log('==================================================================');
    console.log('DEPLOY CONTRACTS');
    console.log('==================================================================');

    // const duke = await Duke.attach("0x53D2edff285970E383bA767De45A249CAC9E6785");
    // const dukeStaking = await DukeStaking.attach("0x7812cC4f039cf0B2D76c9F1cBa96bb4FCc8704EE");
    // const dukeStakingGeneral = await DukeStaking.attach("0x40A320023A592944ae0aAE5aba3602e0697d30bA");
    // const dukeStakingPilot = await DukeStaking.attach("0x22209c1b8301e05Fd8a41a6D5Fe83f45e2B1e9b0");
    // const mysteriousBox = await MysteriousBox.attach("0x6Cb7CFf54AD5B5d324c91587D2B8c6feE9363c29");
    // const rand = await Rand.attach("0x0c64D87DeFD1E21Feb06FEcc168aaeadEce8309E");

    const rand = await Rand.deploy();
    await rand.deployed();
    console.log("Rand          deployed to:", rand.address);

    const duke = await upgrades.deployProxy(Duke, [
        admin,
        "Duke NFT",
        "DUKE",
        rand.address
    ]
    );
    await duke.deployed();
    let dukeVerify = await upgrades.erc1967.getImplementationAddress(
        duke.address
    );
    console.log("Duke                  deployed to:", duke.address);
    console.log("dukeVerify            deployed to:", dukeVerify);

    const mysteriousBox = await upgrades.deployProxy(MysteriousBox, [
        admin,
        "Mysterious Box NFT",
        "MBN",
        GMI,
        duke.address
    ]
    );
    await mysteriousBox.deployed();

    let mysteriousBoxVerify = await upgrades.erc1967.getImplementationAddress(
        mysteriousBox.address
    );
    console.log("MysteriousBox                  deployed to:", mysteriousBox.address);
    console.log("mysteriousBoxVerify            deployed to:", mysteriousBoxVerify);

    const dukeStaking = await upgrades.deployProxy(DukeStaking, [
        admin,
        GMI,
        GMI,
        duke.address,
        process.env.SOLDIER_RATE,
        process.env.POOL_DURATION,
        process.env.TYPE_ID_SOLDIER,
        process.env.SOLDIER_LIMIT

    ]
    );
    await dukeStaking.deployed();

    let dukeStakingVerify = await upgrades.erc1967.getImplementationAddress(
        dukeStaking.address
    );

    console.log("DukeStaking                       deployed to:", dukeStaking.address);
    console.log("dukeStakingVerify                 deployed to:", dukeStakingVerify);

    const dukeStakingPilot = await upgrades.deployProxy(DukeStaking, [
        admin,
        GMI,
        GMI,
        duke.address,
        process.env.PILOT_RATE,
        process.env.POOL_DURATION,
        process.env.TYPE_ID_PILOT,
        process.env.PILOT_LIMIT

    ]
    );
    await dukeStakingPilot.deployed();

    let dukeStakingPilotVerify = await upgrades.erc1967.getImplementationAddress(
        dukeStakingPilot.address
    );
    console.log("dukeStakingPilot                  deployed to:", dukeStakingPilot.address);
    console.log("dukeStakingPilotVerify            deployed to:", dukeStakingPilotVerify);

    const dukeStakingGeneral = await upgrades.deployProxy(DukeStaking, [
        admin,
        GMI,
        GMI,
        duke.address,
        process.env.GENERAL_RATE,
        process.env.POOL_DURATION,
        process.env.TYPE_ID_GENERAL,
        process.env.GENERAL_LIMIT

    ]
    );
    await dukeStakingGeneral.deployed();

    let dukeStakingGeneralVerify = await upgrades.erc1967.getImplementationAddress(
        dukeStakingGeneral.address
    );
    console.log("dukeStakingGeneral                deployed to:", dukeStakingGeneral.address);
    console.log("dukeStakingGeneralVerify          deployed to:", dukeStakingGeneralVerify);

    console.log('==================================================================');
    console.log('ACTION FUNCTION TO CONTRACTS');
    console.log('==================================================================');

    let tx = await duke.setAdmin(dukeStakingGeneral.address, true);
    await tx.wait();
    tx = await duke.setAdmin(dukeStakingPilot.address, true);
    await tx.wait();
    tx = await duke.setAdmin(dukeStaking.address, true);
    await tx.wait();
    tx = await duke.setAdmin(mysteriousBox.address, true);
    await tx.wait();

    // tx = await mysteriousBox.setPricePerNFTBox(ethers.utils.parseEther("1"));
    // await tx.wait();

    // tx = await dukeStaking.setStakingEndTime("7200");
    // await tx.wait();
    // tx = await dukeStakingPilot.setStakingEndTime("7200");
    // await tx.wait();
    // tx = await dukeStakingGeneral.setStakingEndTime("7200");
    // await tx.wait();

    // tx = await dukeStaking.setPendingUnstake("300");
    // await tx.wait();
    // tx = await dukeStakingPilot.setPendingUnstake("300");
    // await tx.wait();
    // tx = await dukeStakingGeneral.setPendingUnstake("300");
    // await tx.wait();

    const contractAddresses = {
        admin: admin,
        gmi: GMI,
        rand: rand.address,
        duke: duke.address,
        mysteriousBox: mysteriousBox.address,
        dukeStaking: dukeStaking.address,
        dukeStakingPilot: dukeStakingPilot.address,
        dukeStakingGeneral: dukeStakingGeneral.address
    };

    await fs.writeFileSync(
        "contracts.json",
        JSON.stringify(contractAddresses)
    );

    const contractAddresses_verify = {
        admin: admin,
        gmi: GMI,
        duke: dukeVerify,
        mysteriousBox: mysteriousBoxVerify,
        dukeStaking: dukeStakingVerify,
        dukeStakingPilot: dukeStakingPilotVerify,
        dukeStakingGeneral: dukeStakingGeneralVerify
    };

    await fs.writeFileSync(
        "contracts-verify.json",
        JSON.stringify(contractAddresses_verify)
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
