/* Writes src/deployment.json (contract address + ABI) from the Truffle artifact of the
   Sepolia deployment. Run after `npm run deploy:sepolia`.

   The file contains only public information (contract address, ABI, deployment tx).
   It never contains keys or RPC credentials. */
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const SEPOLIA = 11155111;
const artifactPath = path.join(__dirname, "..", "build", "contracts", "Voting.json");

async function main() {
  if (!fs.existsSync(artifactPath)) {
    throw new Error("build/contracts/Voting.json not found. Run: npm run compile && npm run deploy:sepolia");
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const net = artifact.networks && artifact.networks[String(SEPOLIA)];
  if (!net || !net.address) {
    throw new Error("Voting is not deployed on Sepolia (network 11155111). Run: npm run deploy:sepolia");
  }

  // Deployment block lets the frontend search vote events efficiently.
  let deploymentBlock = null;
  if (process.env.SEPOLIA_RPC_URL && net.transactionHash) {
    try {
      const { ethers } = require("ethers");
      const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL, SEPOLIA, { staticNetwork: true });
      const receipt = await provider.getTransactionReceipt(net.transactionHash);
      if (receipt) deploymentBlock = receipt.blockNumber;
    } catch (e) {
      console.warn("[export] could not read deployment block:", e.message);
    }
  }

  const out = {
    network: "Ethereum Sepolia",
    chainId: SEPOLIA,
    address: net.address,
    deploymentTx: net.transactionHash || null,
    deploymentBlock,
    abi: artifact.abi,
  };
  const dest = path.join(__dirname, "..", "src", "deployment.json");
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`[export] wrote src/deployment.json`);
  console.log(`[export] contract: ${out.address}`);
  console.log(`[export] https://sepolia.etherscan.io/address/${out.address}`);
}

main().catch((e) => {
  console.error("[export] " + e.message);
  process.exit(1);
});
