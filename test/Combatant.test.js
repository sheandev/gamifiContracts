const chai = require("chai");
const { expect } = require("chai");
const { upgrades } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const Big = require("big.js");
const { skipTime, getCurrentBlock } = require("./utils");

chai.use(solidity);
const { add, subtract, multiply, divide } = require("js-big-decimal");
describe("Combatant NFT", () => {
    const PRICE_PER_NFT_BOX = "250000000000000000000000";
    const SOLDIER_LIMIT = "125000000000000000000000";
    const PILOT_LIMIT = "250000000000000000000000";
    const GENERAL_LIMIT = "500000000000000000000000";
    const SOLDIER_SUPPLY = 375;
    const PILOT_SUPPLY = 100;
    const GENERAL_SUPPLY = 25;
    const MAX_BURN = "125000000000000000000000000";
    const ZERO = 0;
    beforeEach(async () => {
        MAX_INT =
            "115792089237316195423570985008687907853269984665640564039457584007913129639935";
        const accounts = await ethers.getSigners();
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];
        user3 = accounts[3];
        treasury = accounts[4];

        const Gmi = await ethers.getContractFactory("TokenGMI");
        gmi = await Gmi.deploy();
        await gmi.addController(owner.address);
        const Rand = await ethers.getContractFactory("Rand");
        const rand = await Rand.deploy();

        Combatant = await ethers.getContractFactory("Combatant");
        combatant = await upgrades.deployProxy(Combatant, [
            owner.address,
            "Combatant NFT",
            "CBT",
            rand.address
        ]);

        Box = await ethers.getContractFactory("MysteriousBoxes");
        box = await upgrades.deployProxy(Box, [
            owner.address,
            "Mysterious Box NFT",
            "MBN",
            gmi.address,
            combatant.address
        ]);

        await box.deployed();

        await gmi.mint(owner.address, MAX_BURN);
        await gmi.mint(user1.address, MAX_BURN);
        await gmi.mint(user2.address, MAX_BURN);
        await gmi.mint(user3.address, MAX_BURN);
        await gmi.mint(treasury.address, MAX_BURN);

        await gmi.connect(owner).approve(box.address, MAX_INT);
        await gmi.connect(user1).approve(box.address, MAX_INT);
        await gmi.connect(user2).approve(box.address, MAX_INT);
        await gmi.connect(treasury).approve(box.address, MAX_INT);


    });

    describe("Deployment:", async () => {
        it("Check name, symbol and default state: ", async () => {
            const name = await combatant.name();
            const symbol = await combatant.symbol();
            expect(name).to.equal("Combatant NFT");
            expect(symbol).to.equal("CBT");
        });
        it("Check tokenURI: ", async () => {
            const baseURI = await combatant.baseURI();
            expect(baseURI).to.equal("");

            const URI = "this_is_base_uri";
            const tx = await combatant.setBaseURI(URI);
            await tx.wait();
            const newURI = await combatant.baseURI();

            expect(newURI).to.equal(URI);
        });
        it("Check Owner: ", async () => {
            const ownerAddress = await combatant.owner();
            expect(ownerAddress).to.equal(owner.address);
        });
    });
    // GET FUNC
    describe("getCombatantBoxOf:", async () => {
        it("should return information of mysterious box: ", async () => {
            await combatant.setAdmin(box.address, true);
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(user1.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();
            await box.connect(user1).buy(1);

            const tokenId = 0;
            const txopen = await box.connect(user1).open(0);
            txopen.wait();

            const balance = await combatant.balanceOf(user1.address);
            expect(balance).to.equal(1);
            const boxInfo = await combatant.getCombatantBoxOf(tokenId);
            expect(boxInfo).to.have.property('activeTime');
            expect(boxInfo).to.have.property('typeId');
        });
    });

    describe("getSupplyOf:", async () => {
        it("should return supply of type ID: ", async () => {
            let typeId = 0;
            let SUPPLY = await combatant.getSupplyOf(typeId);
            expect(SUPPLY).to.equal(SOLDIER_SUPPLY);
            typeId = 1;
            SUPPLY = await combatant.getSupplyOf(typeId);
            expect(SUPPLY).to.equal(PILOT_SUPPLY);
            typeId = 2;
            SUPPLY = await combatant.getSupplyOf(typeId);
            expect(SUPPLY).to.equal(GENERAL_SUPPLY);
        });
    });

    describe("isAdmin:", async () => {
        it("return boolean value that instance for account is Admin or not: ", async () => {
            const isAdminValue = true;
            await combatant.setAdmin(treasury.address, isAdminValue);
            const isAdmin = await combatant.isAdmin(treasury.address);
            expect(isAdminValue).to.equal(isAdmin);
        });
    });


    // SET FUNC
    describe("setAdmin:", async () => {
        it("only owner can call this func: ", async () => {
            const isAdminValue = true;
            await expect(combatant.connect(user1).setAdmin(treasury.address, isAdminValue)).to.be.revertedWith('Ownable: caller is not the owner');
        });
        it("should set a new admin: ", async () => {
            const isAdminValue = true;
            await combatant.setAdmin(user1.address, isAdminValue);
            const isAdmin = await combatant.isAdmin(user1.address);
            expect(isAdminValue).to.equal(isAdmin);
        });
    });

    describe("tokensOfOwner:", async () => {
        it("return list token ID of owner address: ", async () => {
            await combatant.setAdmin(box.address, true);
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(user1.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();
            await box.connect(user1).buy(10);

            let tokenId = 0;
            await box.connect(user1).open(tokenId);
            tokenId = 1;
            await box.connect(user1).open(tokenId);
            const list = await combatant.tokensOfOwner(user1.address);
            expect(list.length).to.equal(tokenId + 1);
        });
    });

    describe("mint:", async () => {
        it("should mint with random rate: ", async () => {
            await combatant.setAdmin(box.address, true);
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();
            // await box.connect(user1).buy(1);
            // await box.connect(user1).open(0);
            let type1 = 0;
            let type2 = 0;
            let type3 = 0;
            let total = 500;
            for (let i = 0; i < total; i++) {
                await combatant.mint(user1.address);
                let ty = await combatant.combatantBoxes(i);
                if (ty.typeId.toString() == '0') {
                    type1++;
                } else if (ty.typeId.toString() == '1') {
                    type2++;
                } else if (ty.typeId.toString() == '2') {
                    type3++;
                }
            }
            console.log(`%: type1: ${type1 / total * 100}, type2: ${type2 / total * 100}, type3: ${type3 / total * 100}`)
            expect(await combatant.balanceOf(user1.address)).to.equal(total);
        });
    });
});
