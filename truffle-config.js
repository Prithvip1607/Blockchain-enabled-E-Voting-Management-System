require("dotenv").config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

module.exports = {
  contracts_directory: "./contracts",
  contracts_build_directory: "./build/contracts",
  migrations_directory: "./migrations",
  test_directory: "./test",

  networks: {
    // Ethereum Sepolia testnet (chain id 11155111).
    // The private key is read from .env on YOUR machine only. It is never sent to the
    // frontend and must never be committed. Use a throw-away test wallet, not a real one.
    sepolia: {
      provider: () => {
        if (!SEPOLIA_RPC_URL || !DEPLOYER_PRIVATE_KEY) {
          throw new Error("Set SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY in .env (see .env.example).");
        }
        return new HDWalletProvider({
          privateKeys: [DEPLOYER_PRIVATE_KEY.replace(/^0x/, "")],
          providerOrUrl: SEPOLIA_RPC_URL,
        });
      },
      network_id: 11155111,
      confirmations: 0,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    // No "development" network is defined on purpose: `truffle test` uses Truffle's
    // built-in in-process test chain. It is used for automated tests only.
  },

  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "paris", // widest compatibility (no PUSH0)
      },
    },
  },
};
