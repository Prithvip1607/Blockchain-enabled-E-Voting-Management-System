/* Copies browser bundles from node_modules into src/vendor so the frontend has no CDN dependency.
   Runs automatically after `npm install`. */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "src", "vendor");
const files = [
  ["ethers/dist/ethers.umd.min.js", "ethers.umd.min.js"],
  ["chart.js/dist/chart.umd.js", "chart.umd.js"],
];

fs.mkdirSync(out, { recursive: true });
let missing = 0;
for (const [from, to] of files) {
  const src = path.join(root, "node_modules", from);
  if (!fs.existsSync(src)) {
    console.warn(`[vendor] missing ${from}. Run "npm install" first.`);
    missing++;
    continue;
  }
  fs.copyFileSync(src, path.join(out, to));
  console.log(`[vendor] ${to}`);
}
if (missing) process.exitCode = 0; // do not fail npm install; the UI reports missing libraries at runtime
