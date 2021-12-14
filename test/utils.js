const Big = require("big.js");

const skipTime = async (seconds) => {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
};

const setTime = async (time) => {
  await network.provider.send("evm_setNextBlockTimestamp", [time])
  await network.provider.send("evm_mine")
};

const getProfit = (r, days, deposedCash, round) => {
  return Big(r ** (1 / 365))
    .pow(days)
    .minus(1)
    .times(deposedCash)
    .round(round ? round : 18)
    .toString();
};

const getProfitRoot = (r, days, deposedCash, round) => {
  return Big(r ** (1 / 365))
    .pow(days)
    .times(deposedCash)
    .round(round ? round : 18)
    .toString();
};

module.exports = {
  skipTime,
  setTime,
  getProfit,
  getProfitRoot
}
