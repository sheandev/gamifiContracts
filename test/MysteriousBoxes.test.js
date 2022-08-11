const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers, upgrades } = require("hardhat");

describe("Mysterious Boxes", () => {
    const ZERO = 0;
    beforeEach(async () => {
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
        const Duke = await ethers.getContractFactory("Duke");
        duke = await upgrades.deployProxy(Duke, [
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
            duke.address
        ]);

        await box.deployed();

        MAX_UINT256 = ethers.constants.MaxUint256;

        TOTAL_SUPPLY = await box.TOTAL_SUPPLY();
        pricePerNFTBox = await box.pricePerNFTBox();
        MAX_BURN = pricePerNFTBox.mul(TOTAL_SUPPLY);

        await gmi.mint(owner.address, MAX_BURN);
        await gmi.mint(user1.address, MAX_BURN);
        await gmi.mint(user2.address, MAX_BURN);
        await gmi.mint(user3.address, MAX_BURN);
        await gmi.mint(treasury.address, MAX_BURN);

        await gmi.connect(owner).approve(box.address, MAX_UINT256);
        await gmi.connect(user1).approve(box.address, MAX_UINT256);
        await gmi.connect(user2).approve(box.address, MAX_UINT256);
        await gmi.connect(treasury).approve(box.address, MAX_UINT256);

        await gmi.transfer(box.address, MAX_BURN);

        MAX_BATCH = await box.MAX_BATCH();
    });

    describe("Deployment", async () => {
        it("Check name, symbol and default state", async () => {
            const name = await box.name();
            const symbol = await box.symbol();
            expect(name).to.equal("Mysterious Box NFT");
            expect(symbol).to.equal("MBN");
        });

        it("Check Owner", async () => {
            const ownerAddress = await box.owner();
            expect(ownerAddress).to.equal(owner.address);
        });
    });

    describe("isOpenBox", async () => {
        it("return boolean value that instance for box is open or not", async () => {
            const tokenId = 0;
            await box.connect(user1).buy(1);
            expect(await box.isOpened(tokenId)).to.equal(false);
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
            const isAdmin = await box.admins(user1.address);
            expect(isAdminValue).to.equal(isAdmin);
        });
    });

    describe("open", async () => {
        it("should revert when not owner call open", async () => {
            await box.connect(user1).buy(MAX_BATCH);
            await expect(box.connect(user2).open(0)).to.be.revertedWith("This token is not own !");
        });

        it("should revert when your NFT is opened before", async () => {
            await box.connect(user1).buy(1);
            await duke.setAdmin(box.address, true);
            await box.connect(user1).open(0);

            await expect(box.connect(user1).open(0)).to.be.revertedWith("Your NFT is opened !");

        });

        it("should open mysterious box and mint new duke NFT", async () => {
            await box.connect(user1).buy(MAX_BATCH);
            await duke.setAdmin(box.address, true);
            await box.connect(user1).open(0);

            expect(await box.isOpened(0)).to.equal(true);
        });
    });

    describe("withdraw", async () => {
        it("only admin can call this func", async () => {
            await expect(box.connect(user1).withdraw(owner.address, pricePerNFTBox)).to.be.revertedWith('Ownable: caller is not an admin');
        });

        it("should revert when Amount or current balance is invalid", async () => {
            await expect(box.withdraw(owner.address, ZERO)).to.be.revertedWith("Amount or current balance is invalid");
        });

        it("should withdraw success", async () => {
            const balanceUser_before = await gmi.balanceOf(owner.address);

            let balance_contract_before = await gmi.balanceOf(box.address);
            await box.connect(owner).withdraw(owner.address, pricePerNFTBox);

            let balance_contract_after = await gmi.balanceOf(box.address);
            const balanceUser_after = await gmi.balanceOf(owner.address);

            expect(balanceUser_after.sub(balanceUser_before)).to.equal(balance_contract_before.sub(balance_contract_after));
        });
    });

    describe("buy", async () => {
        it("should revert when times plus tokenCounter greater than total supply", async () => {
            for (let i = 1; i <= 500; i++) {
                await box.connect(user1).buy(1);
            }
            await expect(box.connect(user1).buy(1)).to.be.revertedWith("Sold out");
        });

        it("should revert when Admin not enough token in contract to burn", async () => {
            await box.connect(owner).withdraw(owner.address, MAX_BURN);
            await expect(box.buy(MAX_BATCH)).to.be.revertedWith("Admin not enough token in contract to burn");
        });

        it("should revert when number times per buying greater than MAX_BATCH", async () => {
            await expect(box.buy(MAX_BATCH + 1)).to.be.revertedWith("Too many mysterious boxes!");
        });

        it("should buy success", async () => {
            await box.connect(user1).buy(MAX_BATCH);
            expect(await box.balanceOf(user1.address)).to.equal(MAX_BATCH);
        });
    });

    describe("mintBacth", async () => {
        it("should revert with caller is not the owner", async () => {
            await expect(box.connect(user1).mintBacth(1)).to.be.revertedWith("caller is not the owner");
        });

        it("should revert with Sold out", async () => {
            for (let i = 1; i <= 500; i++) {
                const balanceUser_before = await gmi.balanceOf(owner.address);
                const balance_contract_before = await gmi.balanceOf(box.address);
                await box.mintBacth(1);
                const balance_contract_after = await gmi.balanceOf(box.address);
                const balanceUser_after = await gmi.balanceOf(owner.address);

                expect(balanceUser_after.sub(balanceUser_before)).to.equal(0);
                expect(balance_contract_before.sub(balance_contract_after)).to.equal(pricePerNFTBox);
            }
            await expect(box.mintBacth(1)).to.be.revertedWith("Sold out");
        });

        it("should revert with Admin not enough token in contract to burn", async () => {
            await box.connect(owner).withdraw(owner.address, MAX_BURN);
            await expect(box.mintBacth(MAX_BATCH)).to.be.revertedWith("Admin not enough token in contract to burn");
        });

        it("should revert with Too many mysterious boxes!", async () => {
            await expect(box.mintBacth(MAX_BATCH + 1)).to.be.revertedWith("Too many mysterious boxes!");
        });

        it("should mintBacth success", async () => {
            const balanceUser_before = await gmi.balanceOf(owner.address);
            const balance_contract_before = await gmi.balanceOf(box.address);

            await box.mintBacth(MAX_BATCH);

            const balance_contract_after = await gmi.balanceOf(box.address);
            const balanceUser_after = await gmi.balanceOf(owner.address);

            expect(balanceUser_after.sub(balanceUser_before)).to.equal(0);
            expect(balance_contract_before.sub(balance_contract_after)).to.equal(pricePerNFTBox.mul(MAX_BATCH));
            expect(await box.balanceOf(owner.address)).to.equal(MAX_BATCH);
        });
    });
});
