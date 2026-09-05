require("@nomicfoundation/hardhat-toolbox");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Robust .env loader: loads both local and root .env, overriding empty string variables
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      const parsed = dotenv.parse(fs.readFileSync(filePath));
      for (const [key, val] of Object.entries(parsed)) {
        if (!process.env[key] || process.env[key].trim() === "") {
          process.env[key] = val;
        }
      }
    } catch (_) {}
  }
}

// 1. Load local .env (inside gpc-contract)
loadEnvFile(path.resolve(__dirname, ".env"));
// 2. Load root .env (from project root)
loadEnvFile(path.resolve(__dirname, "..", ".env"));

const SEPOLIA_RPC_URL = (process.env.SEPOLIA_RPC_URL || "").trim();
const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").trim();
const ETHERSCAN_API_KEY = (process.env.ETHERSCAN_API_KEY || "").trim();

const isSepoliaTarget = process.argv.some(arg => arg.includes("sepolia"));

if (isSepoliaTarget && !SEPOLIA_RPC_URL) {
  throw new Error("SEPOLIA_RPC_URL is required in .env or environment when targeting Sepolia network");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY || "",
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
};