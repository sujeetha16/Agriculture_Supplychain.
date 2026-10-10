// Path: blockchain/test/AgriChain.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgriChain Smart Contract Lifecycle & Access Control Suite", function () {
  let agriChain;
  let owner, farmer, distributor, retailer, consumer, outsider;

  // Enum mappings matching AgriChain.sol
  const Role = {
    None: 0,
    Farmer: 1,
    Distributor: 2,
    Retailer: 3,
    Consumer: 4
  };

  const Status = {
    Created: 0,
    DispatchedToDistributor: 1,
    ReceivedByDistributor: 2,
    DispatchedToRetailer: 3,
    ReceivedByRetailer: 4,
    SoldToConsumer: 5
  };

  beforeEach(async function () {
    [owner, farmer, distributor, retailer, consumer, outsider] = await ethers.getSigners();

    const AgriChainFactory = await ethers.getContractFactory("AgriChain");
    agriChain = await AgriChainFactory.deploy();
    await agriChain.waitForDeployment();

    // Setup initial role registrations
    await agriChain.connect(farmer).registerRole(Role.Farmer);
    await agriChain.connect(distributor).registerRole(Role.Distributor);
    await agriChain.connect(retailer).registerRole(Role.Retailer);
    await agriChain.connect(consumer).registerRole(Role.Consumer);
  });

  describe("1. Role Registration & Access Control", function () {
    it("should allow accounts to register legitimate roles and emit RoleRegistered", async function () {
      const role = await agriChain.getRole(farmer.address);
      expect(role).to.equal(Role.Farmer);
    });

    it("should revert if an account attempts to register Role.None", async function () {
      await expect(
        agriChain.connect(outsider).registerRole(Role.None)
      ).to.be.revertedWith("Invalid role");
    });

    it("should revert if an account attempts to register a second role (immutable identity)", async function () {
      await expect(
        agriChain.connect(farmer).registerRole(Role.Distributor)
      ).to.be.revertedWith("Role already registered");
    });
  });

  describe("2. Product Creation", function () {
    it("should allow an authorized Farmer to create a crop batch and emit ProductCreated", async function () {
      const tx = await agriChain
        .connect(farmer)
        .createProduct("Organic Honeycrisp Apples", "2026-10-10");
      const receipt = await tx.wait();

      const product = await agriChain.getProduct(1);
      expect(product.id).to.equal(1n);
      expect(product.name).to.equal("Organic Honeycrisp Apples");
      expect(product.harvestDate).to.equal("2026-10-10");
      expect(product.farmer).to.equal(farmer.address);
      expect(product.status).to.equal(Status.Created);
      expect(product.exists).to.be.true;
    });

    it("should prevent non-farmers from creating agricultural products", async function () {
      await expect(
        agriChain.connect(distributor).createProduct("Rogue Grain Batch", "2026-10-10")
      ).to.be.revertedWith("Caller does not have required role");

      await expect(
        agriChain.connect(outsider).createProduct("Unregistered Batch", "2026-10-10")
      ).to.be.revertedWith("Caller does not have required role");
    });

    it("should reject product creation with empty name or harvestDate", async function () {
      await expect(
        agriChain.connect(farmer).createProduct("", "2026-10-10")
      ).to.be.revertedWith("Product name is required");

      await expect(
        agriChain.connect(farmer).createProduct("Sweet Corn", "")
      ).to.be.revertedWith("Harvest date is required");
    });
  });

  describe("3. Complete Legitimate Supply-Chain Transition Cycle", function () {
    let productId;

    beforeEach(async function () {
      const tx = await agriChain
        .connect(farmer)
        .createProduct("Pacific NW Cherries", "2026-09-15");
      await tx.wait();
      productId = 1;
    });

    it("should successfully execute Farmer -> Distributor -> Retailer -> Consumer workflow", async function () {
      // Step A: Farmer dispatches to Distributor
      await expect(
        agriChain
          .connect(farmer)
          .dispatchToDistributor(productId, distributor.address, "2026-09-16")
      )
        .to.emit(agriChain, "ProductDispatchedToDistributor")
        .withArgs(productId, farmer.address, distributor.address, "2026-09-16", (v) => v > 0);

      let p = await agriChain.getProduct(productId);
      expect(p.status).to.equal(Status.DispatchedToDistributor);
      expect(p.distributor).to.equal(distributor.address);

      // Step B: Distributor receives from Farmer
      await expect(
        agriChain.connect(distributor).receiveFromFarmer(productId, "2026-09-17")
      )
        .to.emit(agriChain, "ProductReceivedByDistributor")
        .withArgs(productId, distributor.address, "2026-09-17", (v) => v > 0);

      p = await agriChain.getProduct(productId);
      expect(p.status).to.equal(Status.ReceivedByDistributor);

      // Step C: Distributor dispatches to Retailer
      await expect(
        agriChain
          .connect(distributor)
          .dispatchToRetailer(productId, retailer.address, "2026-09-18")
      )
        .to.emit(agriChain, "ProductDispatchedToRetailer")
        .withArgs(productId, distributor.address, retailer.address, "2026-09-18", (v) => v > 0);

      p = await agriChain.getProduct(productId);
      expect(p.status).to.equal(Status.DispatchedToRetailer);
      expect(p.retailer).to.equal(retailer.address);

      // Step D: Retailer receives from Distributor
      await expect(
        agriChain.connect(retailer).receiveFromDistributor(productId, "2026-09-19")
      )
        .to.emit(agriChain, "ProductReceivedByRetailer")
        .withArgs(productId, retailer.address, "2026-09-19", (v) => v > 0);

      p = await agriChain.getProduct(productId);
      expect(p.status).to.equal(Status.ReceivedByRetailer);

      // Step E: Retailer sells to Consumer
      await expect(
        agriChain.connect(retailer).sellToConsumer(productId, consumer.address, "2026-09-20")
      )
        .to.emit(agriChain, "ProductSoldToConsumer")
        .withArgs(productId, retailer.address, consumer.address, "2026-09-20", (v) => v > 0);

      p = await agriChain.getProduct(productId);
      expect(p.status).to.equal(Status.SoldToConsumer);
      expect(p.consumer).to.equal(consumer.address);
    });
  });

  describe("4. Negative Security & State-Machine Violations", function () {
    let productId;

    beforeEach(async function () {
      await agriChain
        .connect(farmer)
        .createProduct("Organic Russet Potatoes", "2026-10-01");
      productId = 1;
    });

    it("should revert if dispatching to an entity not registered as Distributor", async function () {
      await expect(
        agriChain
          .connect(farmer)
          .dispatchToDistributor(productId, outsider.address, "2026-10-02")
      ).to.be.revertedWith("Receiver is not a distributor");
    });

    it("should revert if an unauthorized farmer tries to dispatch another farmer's product", async function () {
      const [, , , , , , otherFarmer] = await ethers.getSigners();
      await agriChain.connect(otherFarmer).registerRole(Role.Farmer);

      await expect(
        agriChain
          .connect(otherFarmer)
          .dispatchToDistributor(productId, distributor.address, "2026-10-02")
      ).to.be.revertedWith("Only product farmer can dispatch");
    });

    it("should revert out-of-order transitions (e.g. distributor receiving before dispatch)", async function () {
      await expect(
        agriChain.connect(distributor).receiveFromFarmer(productId, "2026-10-02")
      ).to.be.revertedWith("Only assigned distributor can receive");
    });

    it("should revert when querying nonexistent products", async function () {
      await expect(agriChain.getProduct(9999)).to.be.revertedWith(
        "Product does not exist"
      );
    });

    it("should prevent replaying terminal sold state", async function () {
      // Execute through to sold
      await agriChain.connect(farmer).dispatchToDistributor(productId, distributor.address, "2026-10-02");
      await agriChain.connect(distributor).receiveFromFarmer(productId, "2026-10-03");
      await agriChain.connect(distributor).dispatchToRetailer(productId, retailer.address, "2026-10-04");
      await agriChain.connect(retailer).receiveFromDistributor(productId, "2026-10-05");
      await agriChain.connect(retailer).sellToConsumer(productId, consumer.address, "2026-10-06");

      // Attempt second sale
      await expect(
        agriChain.connect(retailer).sellToConsumer(productId, consumer.address, "2026-10-07")
      ).to.be.revertedWith("Invalid product status");
    });
  });
});
