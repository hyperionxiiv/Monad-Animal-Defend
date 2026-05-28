require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

let privateKey = process.env.PRIVATE_KEY;
if (privateKey && privateKey.startsWith("0x")) {
  privateKey = privateKey.substring(2);
}
const isValidKey = privateKey && privateKey.length === 64 && /^[0-9a-fA-F]+$/.test(privateKey);
const accountsList = isValidKey ? [privateKey] : ["0000000000000000000000000000000000000000000000000000000000000001"];

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    monadTestnet: {
      url: "https://testnet-rpc.monad.xyz",
      accounts: accountsList,
      chainId: 10143,
    },
    monadMainnet: {
      url: "https://rpc.monad.xyz",
      accounts: accountsList,
      chainId: 143,
    },
  },
};

