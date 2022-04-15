const hre = require("hardhat");
require("dotenv").config();
const fs = require("fs");
const ethers = hre.ethers;
const upgrades = hre.upgrades;
const contract = require("../contracts.json");
const contractVerify = require("../contracts-verify.json");
async function main() {
    //Loading accounts
    const accounts = await ethers.getSigners();
    const addresses = accounts.map((item) => item.address);
    const admin = addresses[0];

    // Loading contract factory.
    const MysteriousBox = await ethers.getContractFactory("MysteriousBoxes");
    const Combatant = await ethers.getContractFactory("Combatant");
    const CombatantStaking = await ethers.getContractFactory("CombatantStaking");
    // Deploy contracts
    console.log('==================================================================');
    console.log('DEPLOY CONTRACTS');
    console.log('==================================================================');

    const Rand = await ethers.getContractFactory("Rand");
    const rand = await Rand.deploy();
    console.log("Rand          deployed to:", rand.address);

    const combatant = await upgrades.deployProxy(Combatant, [
        admin,
        "Combatant NFT",
        "CBT",
        rand.address
    ]
    );
    await combatant.deployed();
    let combatantVerify = await upgrades.erc1967.getImplementationAddress(
        combatant.address
    );
    console.log("Combatant                  deployed to:", combatant.address);
    console.log("combatantVerify            deployed to:", combatantVerify);

    const mysteriousBox = await upgrades.deployProxy(MysteriousBox, [
        admin,
        "Mysterious Box NFT",
        "MBN",
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        combatant.address
    ]
    );
    await mysteriousBox.deployed();

    let mysteriousBoxVerify = await upgrades.erc1967.getImplementationAddress(
        mysteriousBox.address
    );
    console.log("MysteriousBox                  deployed to:", mysteriousBox.address);
    console.log("mysteriousBoxVerify            deployed to:", mysteriousBoxVerify);

    const combatantStaking = await upgrades.deployProxy(CombatantStaking, [
        admin,
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        combatant.address,
        process.env.SOLDIER_RATE,
        process.env.POOL_DURATION,
        process.env.TYPE_ID_SOLDIER,
        process.env.SOLDIER_LIMIT

    ]
    );
    await combatantStaking.deployed();

    let combatantStakingVerify = await upgrades.erc1967.getImplementationAddress(
        combatantStaking.address
    );

    console.log("CombatantStaking                       deployed to:", combatantStaking.address);
    console.log("combatantStakingVerify                 deployed to:", combatantStakingVerify);

    const combatantStakingPilot = await upgrades.deployProxy(CombatantStaking, [
        admin,
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        combatant.address,
        process.env.PILOT_RATE,
        process.env.POOL_DURATION,
        process.env.TYPE_ID_PILOT,
        process.env.PILOT_LIMIT

    ]
    );
    await combatantStakingPilot.deployed();

    let combatantStakingPilotVerify = await upgrades.erc1967.getImplementationAddress(
        combatantStakingPilot.address
    );
    console.log("combatantStakingPilot                  deployed to:", combatantStakingPilot.address);
    console.log("combatantStakingPilotVerify            deployed to:", combatantStakingPilotVerify);

    const combatantStakingGeneral = await upgrades.deployProxy(CombatantStaking, [
        admin,
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        "0x88d8defcda194e08a93689fb6888579f6d45851d",
        combatant.address,
        process.env.GENERAL_RATE,
        process.env.POOL_DURATION,
        process.env.TYPE_ID_GENERAL,
        process.env.GENERAL_LIMIT

    ]
    );
    await combatantStakingGeneral.deployed();

    let combatantStakingGeneralVerify = await upgrades.erc1967.getImplementationAddress(
        combatantStakingGeneral.address
    );
    console.log("combatantStakingGeneral                deployed to:", combatantStakingGeneral.address);
    console.log("combatantStakingGeneralVerify          deployed to:", combatantStakingGeneralVerify);

    const contractAddresses = {
        ...contract,
        admin: admin,
        gmi: '0x88d8defcda194e08a93689fb6888579f6d45851d',
        rand: rand.address,
        combatant: combatant.address,
        mysteriousBox: mysteriousBox.address,
        combatantStaking: combatantStaking.address,
        combatantStakingPilot: combatantStakingPilot.address,
        combatantStakingGeneral: combatantStakingGeneral.address
    };

    await fs.writeFileSync(
        "contracts.json",
        JSON.stringify(contractAddresses)
    );

    const contractAddresses_verify = {
        ...contractVerify,
        admin: admin,
        gmi: "0x88d8defcda194e08a93689fb6888579f6d45851d",
        combatant: combatantVerify,
        mysteriousBox: mysteriousBoxVerify,
        combatantStaking: combatantStakingVerify,
        combatantStakingPilot: combatantStakingPilotVerify,
        combatantStakingGeneral: combatantStakingGeneralVerify
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
