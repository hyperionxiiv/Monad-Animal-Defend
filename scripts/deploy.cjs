const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment of EternalPetz contract...");

  const EternalPetz = await ethers.getContractFactory("EternalPetz");
  const contract = await EternalPetz.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`EternalPetz deployed successfully to address: ${contractAddress}`);

  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  
  const addressesFilePath = path.join(__dirname, "../src/utils/contractAddresses.json");
  
  let addresses = {};
  if (fs.existsSync(addressesFilePath)) {
    try {
      addresses = JSON.parse(fs.readFileSync(addressesFilePath, "utf8"));
    } catch (e) {
      console.warn("Failed to parse existing contractAddresses.json, recreating...");
    }
  }

  if (chainId === 143) {
    addresses.monadMainnet = contractAddress;
    console.log("Updated contractAddresses.json with Monad Mainnet address.");
  } else {
    addresses.monadTestnet = contractAddress;
    console.log("Updated contractAddresses.json with Monad Testnet address.");
  }

  const dir = path.dirname(addressesFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2), "utf8");
  console.log("Contract addresses configuration file updated.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
