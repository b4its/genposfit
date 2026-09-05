const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying GPC with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const GenPosFitCoin = await ethers.getContractFactory("GenPosFitCoin");
  const gpc = await GenPosFitCoin.deploy(deployer.address);
  await gpc.waitForDeployment();

  const addr = await gpc.getAddress();
  const chainId = hre.network.config.chainId;
  console.log("\nGenPosFitCoin (GPC) deployed to:", addr);
  console.log("Network chain ID:", chainId);

  fs.writeFileSync(
    path.join(__dirname, "..", "deployment.json"),
    JSON.stringify({ network: hre.network.name, contractAddress: addr, chainId }, null, 2)
  );
  console.log("Contract address saved to deployment.json");

  const initialMint = ethers.parseEther("1000000");
  const mintTx = await gpc.mint(deployer.address, initialMint);
  await mintTx.wait();
  console.log("Minted 1,000,000 GPC to deployer (tx:", mintTx.hash, ")");

  const totalSupply = await gpc["totalSupply(uint256)"](0);
  console.log("Total supply:", ethers.formatEther(totalSupply), "GPC");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});