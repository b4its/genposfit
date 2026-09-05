const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GenPosFitCoin (GPC)", function () {
  let gpc, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const GPC = await ethers.getContractFactory("GenPosFitCoin");
    gpc = await GPC.deploy(owner.address);
    await gpc.waitForDeployment();
  });

  it("should set correct name and symbol", async function () {
    expect(await gpc.name()).to.equal("GenPosFit Coin");
    expect(await gpc.symbol()).to.equal("GPC");
  });

  it("should set owner to deployer", async function () {
    expect(await gpc.owner()).to.equal(owner.address);
  });

  it("should mint tokens only by owner", async function () {
    await gpc.mint(owner.address, ethers.parseEther("1000"));
    const bal = await gpc.balanceOf(owner.address, 0);
    expect(bal).to.equal(ethers.parseEther("1000"));
  });

  it("should reject mint by non-owner", async function () {
    await expect(
      gpc.connect(user1).mint(user1.address, ethers.parseEther("100"))
    ).to.be.revertedWithCustomError(gpc, "OwnableUnauthorizedAccount");
  });

  it("should transfer tokens via safeTransferFrom", async function () {
    await gpc.mint(owner.address, ethers.parseEther("500"));
    await gpc.safeTransferFrom(owner.address, user1.address, 0, ethers.parseEther("200"), "0x");
    expect(await gpc.balanceOf(owner.address, 0)).to.equal(ethers.parseEther("300"));
    expect(await gpc.balanceOf(user1.address, 0)).to.equal(ethers.parseEther("200"));
  });

  it("should burn tokens", async function () {
    await gpc.mint(owner.address, ethers.parseEther("500"));
    await gpc.burn(ethers.parseEther("200"));
    expect(await gpc.balanceOf(owner.address, 0)).to.equal(ethers.parseEther("300"));
  });

  it("should burn from another address (admin correction)", async function () {
    await gpc.mint(user1.address, ethers.parseEther("500"));
    await gpc.burnFrom(user1.address, ethers.parseEther("100"));
    expect(await gpc.balanceOf(user1.address, 0)).to.equal(ethers.parseEther("400"));
  });

  it("should respect max supply", async function () {
    const MAX = await gpc.MAX_SUPPLY();
    await expect(
      gpc.mint(owner.address, MAX + 1n)
    ).to.be.revertedWith("GPC: exceeds max supply");
  });
});