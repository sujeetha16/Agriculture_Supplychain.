// Path: blockchain/scripts/deploy.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const AgriChain = await hre.ethers.getContractFactory("AgriChain");
  const contract = await AgriChain.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("AgriChain deployed to:", address);
  console.log("Sepolia explorer:", `https://sepolia.etherscan.io/address/${address}`);

  const artifact = await hre.artifacts.readArtifact("AgriChain");
  const output = {
    address,
    abi: artifact.abi,
    network: "sepolia",
    chainId: 11155111
  };

  const outputPath = path.join(__dirname, "../../frontend/src/contracts/AgriChain.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log("Frontend contract file written to:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
