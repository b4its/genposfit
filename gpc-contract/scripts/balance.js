const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [signer] = await ethers.getSigners();

  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error("deployment.json not found. Run `make gpc-publish` first.");
    process.exitCode = 1;
    return;
  }

  const { contractAddress } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const GPC = await ethers.getContractFactory("GenPosFitCoin");
  const gpc = GPC.attach(contractAddress);

  const target = process.env.TARGET || signer.address;
  const bal = await gpc.balanceOf(target, 0);

  console.log(`GPC balance of ${target}: ${ethers.formatEther(bal)} GPC`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});