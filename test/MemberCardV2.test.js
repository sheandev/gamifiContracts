const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers, upgrades } = require("hardhat");

describe("MemberCardV2", () => {
    const MaxToken = 100;

    beforeEach(async () => {
        const accounts = await ethers.getSigners();
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[4];

        MemberCardV2 = await ethers.getContractFactory("MemberCardV2");
        memberCardV2 = await MemberCardV2.deploy();
        await memberCardV2.initialize(owner.address,
            "MemberCardV2",
            "MC",
            MaxToken);
    });

    describe("Deployment", async () => {
        it("Check name, symbol and default state", async () => {
            const name = await memberCardV2.name();
            const symbol = await memberCardV2.symbol();
            expect(name).to.equal("MemberCardV2");
            expect(symbol).to.equal("MC");
        });

        it("Check Owner", async () => {
            const ownerAddress = await memberCardV2.owner();
            expect(ownerAddress).to.equal(owner.address);
        });
    });

    describe("setAdmin", async () => {
        it("only owner can call this func", async () => {
            await expect(memberCardV2.connect(user1).setAdmin(user2.address, true)).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it("should set a new admin", async () => {
            await memberCardV2.setAdmin(user1.address, true);
            const isAdmin = await memberCardV2.admins(user1.address);
            expect(isAdmin).to.be.true;
        });
    });

    describe("setCounter", async () => {
        beforeEach(async () => {
            await memberCardV2.setAdmin(owner.address, true);
            await memberCardV2.connect(owner).mintMemberCard(user1.address, 1, "");
        });

        it("Should be revert caller is not an admin", async () => {
            await expect(memberCardV2.connect(user1).setCounter(0, 1)).to.be.revertedWith('Ownable: caller is not an admin');
        });

        it("should setCounter successfully", async () => {
            await memberCardV2.setCounter(0, 1);
            const nft = await memberCardV2.getMemberCard(0);
            expect(nft.counter).to.equals(1);
            expect(nft.typeId).to.equals(1);
        });
    });

    describe("setMaxTokenCounter", async () => {
        it("Should be revert caller is not an admin", async () => {
            await expect(memberCardV2.connect(user1).setMaxTokenCounter(10)).to.be.revertedWith('Ownable: caller is not an admin');
        });

        it("should setMaxTokenCounter successfully", async () => {
            await memberCardV2.setMaxTokenCounter(10);
            const maxTokenCounter = await memberCardV2.getMaxTokenCounter();
            expect(maxTokenCounter).to.equals(10);
        });
    });

    describe("mintMemberCard", async () => {
        it("should revert Ownable: caller is not an admin", async () => {
            await expect(memberCardV2.connect(user1).mintMemberCard(user1.address, 1, "")).to.be.revertedWith("Ownable: caller is not an admin");
        });

        it("should revert Sold out", async () => {
            await memberCardV2.setAdmin(owner.address, true);
            for (let i = 0; i < 100; i++) {
                await memberCardV2.connect(owner).mintMemberCard(user1.address, Math.floor(i / 10 + 1), "");
            }
            await expect(memberCardV2.connect(owner).mintMemberCard(user1.address, 1, "")).to.be.revertedWith("Sold out");
        });

        it("should mintMemberCard successfully", async () => {
            await memberCardV2.setAdmin(owner.address, true);
            for (let i = 0; i < 100; i++) {
                await memberCardV2.connect(owner).mintMemberCard(user1.address, Math.floor(i / 10 + 1), "");
            }
            const isActive = await memberCardV2.getMemberCardActive(0);
            expect(isActive).to.be.true;

            const nft = await memberCardV2.getMemberCard(0);
            expect(nft.counter).to.equals(3);
            expect(nft.typeId).to.equals(1);

            await expect(memberCardV2.connect(user1).transferFrom(user1.address, user2.address, 0)).to.be.revertedWith("NFT cannot be transferred.");
        });
    });

    describe("consumeMembership", async () => {
        it("should revert Ownable: caller is not an vendor", async () => {
            await expect(memberCardV2.connect(user1).consumeMembership(0)).to.be.revertedWith("NFT: caller is not a vendor.");
        });

        it("should revert Member Card has been frozen.", async () => {
            await memberCardV2.setAdmin(owner.address, true);
            for (let i = 0; i < 100; i++) {
                await memberCardV2.connect(owner).mintMemberCard(user1.address, Math.floor(i / 10 + 1), "");
            }
            await memberCardV2.setVendor(owner.address, true);
            await memberCardV2.setFreezeStatus(0, true);
            await expect(memberCardV2.connect(owner).consumeMembership(0)).to.be.revertedWith("Member Card has been frozen.");
        });

        it("should consumeMembership successfully", async () => {
            await memberCardV2.setAdmin(owner.address, true);
            await memberCardV2.setVendor(owner.address, true);
            for (let i = 0; i < 100; i++) {
                await memberCardV2.connect(owner).mintMemberCard(user1.address, Math.floor(i / 10 + 1), "");
            }
            await memberCardV2.setVendor(owner.address, true);
            await memberCardV2.connect(owner).consumeMembership(0);
            let isActive = await memberCardV2.getMemberCardActive(0);
            expect(isActive).to.be.true;

            let nft = await memberCardV2.getMemberCard(0);
            expect(nft.counter).to.equals(2);
            expect(nft.typeId).to.equals(1);

            await expect(memberCardV2.connect(user1).transferFrom(user1.address, user2.address, 0)).to.be.revertedWith("NFT cannot be transferred.");

            await memberCardV2.connect(owner).consumeMembership(0);
            isActive = await memberCardV2.getMemberCardActive(0);
            expect(isActive).to.be.true;

            nft = await memberCardV2.getMemberCard(0);
            expect(nft.counter).to.equals(1);
            expect(nft.typeId).to.equals(1);

            await expect(memberCardV2.connect(user1).transferFrom(user1.address, user2.address, 0)).to.be.revertedWith("NFT cannot be transferred.");

            await memberCardV2.connect(owner).consumeMembership(0);
            isActive = await memberCardV2.getMemberCardActive(0);
            expect(isActive).to.be.false;

            nft = await memberCardV2.getMemberCard(0);
            expect(nft.counter).to.equals(0);
            expect(nft.typeId).to.equals(1);

            await memberCardV2.connect(user1).transferFrom(user1.address, user2.address, 0);
            const ownerOf = await memberCardV2.ownerOf(0);
            expect(ownerOf).to.equals(user2.address);
        });
    });
});
