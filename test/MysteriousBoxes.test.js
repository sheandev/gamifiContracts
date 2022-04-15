const chai = require("chai");
const { expect } = require("chai");
const { upgrades } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const Big = require("big.js");
const { skipTime } = require("./utils");

chai.use(solidity);
const { add, subtract, multiply, divide } = require("js-big-decimal");
describe("Mysterious Boxes", () => {
    const PRICE_PER_NFT_BOX = "250000000000000000000000";

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
        const Combatant = await ethers.getContractFactory("Combatant");
        combatant = await upgrades.deployProxy(Combatant, [
            owner.address,
            "Mysterious Box NFT",
            "MBN",
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
            const name = await box.name();
            const symbol = await box.symbol();
            expect(name).to.equal("Mysterious Box NFT");
            expect(symbol).to.equal("MBN");
        });
        it("Check tokenURI: ", async () => {
            const baseURI = await box.baseURI();
            expect(baseURI).to.equal("");

            const URI = "this_is_base_uri";
            const tx = await box.setBaseURI(URI);
            await tx.wait();
            const newURI = await box.baseURI();

            expect(newURI).to.equal(URI);
        });
        it("Check Owner: ", async () => {
            const ownerAddress = await box.owner();
            expect(ownerAddress).to.equal(owner.address);
        });
    });

    describe("isOpenBox:", async () => {
        it("return boolean value that instance for box is open or not: ", async () => {

            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(user1.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();
            const tokenId = 0;
            await box.connect(user1).buy(1);
            expect(await box.isOpenBox(tokenId)).to.equal(false);
        });
    });

    describe("isAdmin:", async () => {
        it("return boolean value that instance for account is Admin or not: ", async () => {
            const isAdminValue = true;
            await box.setAdmin(treasury.address, isAdminValue);
            const isAdmin = await box.isAdmin(treasury.address);
            expect(isAdminValue).to.equal(isAdmin);
        });
    });

    describe("setAdmin:", async () => {
        it("only owner can call this func: ", async () => {
            const isAdminValue = true;
            await expect(box.connect(user1).setAdmin(treasury.address, isAdminValue)).to.be.revertedWith('Ownable: caller is not the owner');
        });
        it("should set a new admin: ", async () => {
            const isAdminValue = true;
            await box.setAdmin(user1.address, isAdminValue);
            const isAdmin = await box.isAdmin(user1.address);
            expect(isAdminValue).to.equal(isAdmin);
        });
    });

    describe("deposit:", async () => {
        it("only admin can call this func: ", async () => {
            const amount = PRICE_PER_NFT_BOX;
            await expect(box.connect(user1).deposit(amount)).to.be.revertedWith('Ownable: caller is not an admin');
        });
        it("should revert when amount equal to zero: ", async () => {
            await expect(box.deposit(ZERO)).to.be.revertedWith("At least a mount greater than zero");
        });
        it("should deposit success: ", async () => {
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(PRICE_PER_NFT_BOX);
            tx.wait();
            expect(await gmi.balanceOf(box.address)).to.equal(PRICE_PER_NFT_BOX);
        });
    });

    describe("open:", async () => {
        it("should revert when not owner call open: ", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();

            await box.connect(user1).buy(num);
            await expect(box.connect(user2).open(0)).to.be.revertedWith("This token is not own !");
        });
        it("should revert when your NFT is opened before: ", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();

            await box.connect(user1).buy(1);
            await combatant.setAdmin(box.address, true);
            await box.connect(user1).open(0);

            await expect(box.connect(user1).open(0)).to.be.revertedWith("Your NFT is opened !");

        });
        it("should open mysterious box and mint new combatant NFT: ", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();

            await box.connect(user1).buy(num);
            await combatant.setAdmin(box.address, true);
            await box.connect(user1).open(0);

            expect(await box.isOpenBox(0)).to.equal(true);
        });
    });

    describe("withdraw:", async () => {
        it("only admin can call this func: ", async () => {
            const amount = PRICE_PER_NFT_BOX;
            await expect(box.connect(user1).withdraw(amount)).to.be.revertedWith('Ownable: caller is not an admin');
        });
        it("should revert when Amount or current balance is invalid: ", async () => {
            await expect(box.withdraw(ZERO)).to.be.revertedWith("Amount or current balance is invalid");
        });
        it("should withdraw success: ", async () => {
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(box.address, MAX_INT);
            const txdeposit = await box.connect(owner).deposit(PRICE_PER_NFT_BOX);
            txdeposit.wait();
            let balance = await gmi.balanceOf(box.address);
            const txwithdraw = await box.connect(owner).withdraw(PRICE_PER_NFT_BOX);
            txwithdraw.wait();
            balance = await gmi.balanceOf(box.address);
            expect(balance).to.equal(ZERO);
        });
    });

    describe("buy:", async () => {
        it("should revert when times plus tokenCounter greater than total supply: ", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();
            for (let i = 1; i <= 500; i++) {
                await box.connect(user1).buy(1);
            }

            await expect(box.connect(user1).buy(1)).to.be.revertedWith("Sold out");

        });

        it("should revert when Admin not enough token in contract to burn: ", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(PRICE_PER_NFT_BOX);
            tx.wait();
            await expect(box.buy(num)).to.be.revertedWith("Admin not enough token in contract to burn");
        });

        it("should revert when number times per buying greater than MAX_BATCH: ", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();
            await expect(box.buy(num + 1)).to.be.revertedWith("Too many mysterious boxes!");
        });
        it("should buy success: ", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();

            await box.connect(user1).buy(num);

            expect(await box.balanceOf(user1.address)).to.equal(num);
        });
    });

});
