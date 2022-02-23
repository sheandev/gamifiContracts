const Big = require("big.js");
const ethers = require("hardhat");

const skipTime = async (seconds) => {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
};

const setTime = async (time) => {
  await network.provider.send("evm_setNextBlockTimestamp", [time])
  await network.provider.send("evm_mine")
};

const getProfit = (pool, days, deposedCash, round) => {
  return Big((pool + 2) ** (1 / 365))
    .pow(days)
    .minus(1)
    .times(deposedCash)
    .round(round ? round : 18)
    .toString();
};

const getProfitRoot = (pool, days, deposedCash, round) => {
  return Big((pool + 2) ** (1 / 365))
    .pow(days)
    .times(deposedCash)
    .round(round ? round : 18)
    .toString();
};

const skipBlock = async (blockNumber) => {
  for (let index = 0; index < blockNumber; index++) {
    await hre.ethers.provider.send('evm_mine');
  }
};

const getCurrentBlock = async () => {
  const latestBlock = await hre.ethers.provider.getBlock("latest");
  return latestBlock.number;
};

module.exports = {
  skipTime,
  setTime,
  getProfit,
  getProfitRoot,
  skipBlock,
  getCurrentBlock
}
