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

  const target = process.env.TARGET;
  if (!target) {
    console.error("Usage: TARGET=0x... npx hardhat run scripts/send.js --network sepolia");
    process.exitCode = 1;
    return;
  }

  if (!ethers.isAddress(target)) {
    console.error(`Invalid target address: ${target}`);
    process.exitCode = 1;
    return;
  }

  const amount = ethers.parseEther(process.env.AMOUNT || "100");

  try {
    const tx = await gpc.safeTransferFrom(signer.address, target, 0, amount, "0x");
    await tx.wait();

    console.log(`Sent ${ethers.formatEther(amount)} GPC to ${target}`);
    console.log("Tx hash:", tx.hash);
  } catch (err) {
    console.error("Transfer failed:", err.reason || err.message || err);
    if (typeof err.code === "string") console.error("Code:", err.code);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});