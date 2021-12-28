// Loading env configs for deploying and public contract source
require('dotenv').config();

// Using hardhat-ethers plugin for deploying
// See here: https://hardhat.org/plugins/nomiclabs-hardhat-ethers.html
//           https://hardhat.org/guides/deploying.html
require('@nomiclabs/hardhat-ethers');

// Testing plugins with Waffle
// See here: https://hardhat.org/guides/waffle-testing.html
require("@nomiclabs/hardhat-waffle");

// This plugin runs solhint on the project's sources and prints the report
// See here: https://hardhat.org/plugins/nomiclabs-hardhat-solhint.html
require("@nomiclabs/hardhat-solhint");

// Verify and public source code on etherscan
require('@nomiclabs/hardhat-etherscan');

const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: { count: 100 },
    },
    // Rinkeby test network config for deploying
    rinkeby: {
      url: process.env.RINKEBY_URL,
      accounts: [`${process.env.PRIVATE_KEY_RINKEBY}`],
      gas: 8100000,
      gasPrice: 8000000000,
    },
    // Polygon test network config for deploying
    matic: {
      url: process.env.MATIC_URL,
      accounts: [process.env.PRIVATE_KEY_MATIC],
    },
  },
  // Verify and public source code on etherscan
  etherscan: {
    // polygonscan
    // apiKey: `${process.env.ETHERSCAN_API_KEY}`
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "deploy",
    deployments: "deployments",
  },
  mocha: {
    timeout: 200000,
    useColors: true,
    reporter: "mocha-multi-reporters",
    reporterOptions: {
      configFile: "./mocha-report.json",
    },
  },
};

module.exports = config;
