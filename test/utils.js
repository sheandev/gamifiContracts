const skipTime = async (seconds) => {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
};

const setTime = async (time) => {
  await network.provider.send("evm_setNextBlockTimestamp", [time])
  await network.provider.send("evm_mine")
};

module.exports = {
  skipTime,
  setTime
}
