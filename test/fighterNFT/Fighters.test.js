const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Fighters", () => {
  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    admin = accounts[1];
    user  = accounts[2];

    const Rand = await ethers.getContractFactory("Rand");
    const Fighters = await ethers.getContractFactory("Fighters");

    randomizer = await Rand.deploy();
    fighters = await upgrades.deployProxy(Fighters, [
      owner.address,
      "Fighters NFT",
      "Fighters",
      randomizer.address
    ]);

    await fighters.setAdmin(admin.address, true);

    TYPE_AMOUNT      = await fighters.TYPE_AMOUNT();
    TYPED_SUPPLY     = await fighters.TYPED_SUPPLY();
    MAX_TOTAL_SUPPLY = await fighters.MAX_TOTAL_SUPPLY();
  });

  describe("deployment", async () => {
    it("Check name, symbol and default state", async () => {
      const name = await fighters.name();
      const symbol = await fighters.symbol();
      expect(name).to.equal("Fighters NFT");
      expect(symbol).to.equal("Fighters");
    });

    it("Check tokenURI", async () => {
      const baseURI = await fighters.baseURI();
      expect(baseURI).to.equal("");

      const URI = "this_is_base_uri";
      await fighters.setBaseURI(URI);
      const newURI = await fighters.baseURI();

      expect(newURI).to.equal(URI);
    });

    it("Check Owner", async () => {
      const ownerAddress = await fighters.owner();
      expect(ownerAddress).to.equal(owner.address);
    });

    it("Check Randomizer contract address", async () => {
      expect(await fighters.randomizer()).to.equal(randomizer.address);
    });
  });

  describe("mint", async () => {
    it("should mint with random rate", async () => {
      for (let i = 0; i < MAX_TOTAL_SUPPLY; i++) {
        await fighters.mint(user.address);
        const fighter = await fighters.fighters(i);

        console.log(`\tType: ${fighter.typeId}, IDO use counter: ${fighter.useCounter.toString()}`);
      }

      for (let type = 0; type < TYPE_AMOUNT; type++) {
        const currentSupply = await fighters.currentSupplies(type);
        expect(currentSupply).to.equal(TYPED_SUPPLY);
      }

      expect(await fighters.balanceOf(user.address)).to.equal(MAX_TOTAL_SUPPLY);
    });
  });
});
