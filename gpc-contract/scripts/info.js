const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("deployment.json not found.");
    process.exitCode = 1;
    return;
  }

  const { contractAddress } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const GPC = await ethers.getContractFactory("GenPosFitCoin");
  const gpc = GPC.attach(contractAddress);

  const owner = await gpc.owner();
  const name = await gpc.name();
  const symbol = await gpc.symbol();
  const maxSupply = await gpc.MAX_SUPPLY();
  const totalSupply = await gpc["totalSupply(uint256)"](0);

  console.log("Contract:", contractAddress);
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Owner:", owner);
  console.log("Max supply:", ethers.formatEther(maxSupply), "GPC");
  console.log("Total supply:", ethers.formatEther(totalSupply), "GPC");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});