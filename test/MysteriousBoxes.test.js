const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers, upgrades } = require("hardhat");

describe("Mysterious Boxes", () => {
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

        TOTAL_SUPPLY = await box.TOTAL_SUPPLY();
        pricePerNFTBox = await box.pricePerNFTBox();
        MAX_BURN = pricePerNFTBox.mul(2).mul(TOTAL_SUPPLY);

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

    describe("Deployment", async () => {
        it("Check name, symbol and default state", async () => {
            const name = await box.name();
            const symbol = await box.symbol();
            expect(name).to.equal("Mysterious Box NFT");
            expect(symbol).to.equal("MBN");
        });

        it("Check tokenURI", async () => {
            const baseURI = await box.baseURI();
            expect(baseURI).to.equal("");

            const URI = "this_is_base_uri";
            const tx = await box.setBaseURI(URI);
            await tx.wait();
            const newURI = await box.baseURI();

            expect(newURI).to.equal(URI);
        });

        it("Check Owner", async () => {
            const ownerAddress = await box.owner();
            expect(ownerAddress).to.equal(owner.address);
        });
    });

    describe("isOpenBox", async () => {
        it("return boolean value that instance for box is open or not", async () => {

            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(user1.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();
            const tokenId = 0;
            await box.connect(user1).buy(1);
            expect(await box.isOpenBox(tokenId)).to.equal(false);
        });
    });

    describe("isAdmin", async () => {
        it("return boolean value that instance for account is Admin or not", async () => {
            const isAdminValue = true;
            await box.setAdmin(treasury.address, isAdminValue);
            const isAdmin = await box.isAdmin(treasury.address);
            expect(isAdminValue).to.equal(isAdmin);
        });
    });

    describe("setAdmin", async () => {
        it("only owner can call this func", async () => {
            const isAdminValue = true;
            await expect(box.connect(user1).setAdmin(treasury.address, isAdminValue)).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it("should set a new admin", async () => {
            const isAdminValue = true;
            await box.setAdmin(user1.address, isAdminValue);
            const isAdmin = await box.isAdmin(user1.address);
            expect(isAdminValue).to.equal(isAdmin);
        });
    });

    describe("deposit", async () => {
        it("only admin can call this func", async () => {
            await expect(box.connect(user1).deposit(pricePerNFTBox)).to.be.revertedWith('Ownable: caller is not an admin');
        });

        it("should revert when amount equal to zero", async () => {
            await expect(box.deposit(ZERO)).to.be.revertedWith("At least a mount greater than zero");
        });

        it("should deposit success", async () => {
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(pricePerNFTBox);
            tx.wait();
            expect(await gmi.balanceOf(box.address)).to.equal(pricePerNFTBox);
        });
    });

    describe("open", async () => {
        it("should revert when not owner call open", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();

            await box.connect(user1).buy(num);
            await expect(box.connect(user2).open(0)).to.be.revertedWith("This token is not own !");
        });

        it("should revert when your NFT is opened before", async () => {
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();

            await box.connect(user1).buy(1);
            await combatant.setAdmin(box.address, true);
            await box.connect(user1).open(0);

            await expect(box.connect(user1).open(0)).to.be.revertedWith("Your NFT is opened !");

        });

        it("should open mysterious box and mint new combatant NFT", async () => {
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

    describe("withdraw", async () => {
        beforeEach(async () => {
            await box.connect(owner).setReceiver(owner.address);
        });

        it("only admin can call this func", async () => {
            await expect(box.connect(user1).withdraw(pricePerNFTBox)).to.be.revertedWith('Ownable: caller is not an admin');
        });

        it("should revert when Amount or current balance is invalid", async () => {
            await expect(box.withdraw(ZERO)).to.be.revertedWith("Amount or current balance is invalid");
        });

        it("should withdraw success", async () => {
            await gmi.approve(owner.address, MAX_INT);
            await gmi.approve(box.address, MAX_INT);
            await box.connect(owner).deposit(pricePerNFTBox);

            const balanceUser_before = await gmi.balanceOf(owner.address);

            let balance_contract_before = await gmi.balanceOf(box.address);
            await box.connect(owner).withdraw(pricePerNFTBox);

            let balance_contract_after = await gmi.balanceOf(box.address);
            const balanceUser_after = await gmi.balanceOf(owner.address);

            expect(balance_contract_after).to.equal(ZERO);
            expect(balanceUser_after.sub(balanceUser_before)).to.equal(balance_contract_before.sub(balance_contract_after));
        });
    });

    describe("buy", async () => {
        it("should revert when times plus tokenCounter greater than total supply", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();
            for (let i = 1; i <= 500; i++) {
                await box.connect(user1).buy(1);
            }

            await expect(box.connect(user1).buy(1)).to.be.revertedWith("Sold out");

        });

        it("should revert when Admin not enough token in contract to burn", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(pricePerNFTBox);
            tx.wait();
            await expect(box.buy(num)).to.be.revertedWith("Admin not enough token in contract to burn");
        });

        it("should revert when number times per buying greater than MAX_BATCH", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();
            await expect(box.buy(num + 1)).to.be.revertedWith("Too many mysterious boxes!");
        });

        it("should buy success", async () => {
            const num = 10;
            await gmi.approve(owner.address, MAX_INT);
            const tx = await box.connect(owner).deposit(MAX_BURN);
            tx.wait();

            await box.connect(user1).buy(num);

            expect(await box.balanceOf(user1.address)).to.equal(num);
        });
    });

});
