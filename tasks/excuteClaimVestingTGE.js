const { task, types } = require('hardhat/config');
const { readCsvFile } = require('../common/utils');
const { NonceManager } = require('@ethersproject/experimental');
const {
  CONSOLE_LOG_RED_COLOR,
  CONSOLE_LOG_GREEN_COLOR,
  LOCAL_NETWORK_URL
} = require('../common/constants');

Array.prototype.contains = function(v) {
  for (var i = 0; i < this.length; i++) {
    if (this[i] === v) return true;
  }
  return false;
};

Array.prototype.getDuplicates = function() {
  var arr = [];
  var uniqueArr = []
  for (var i = 0; i < this.length; i++) {
    if (!uniqueArr.contains(this[i])) {
      uniqueArr.push(this[i]);
    } else {
      arr.push(this[i]);
    }
  }
  return arr;
}

task('excute:vesting:users', 'Claim token of users')
  .addParam('privateKeyCsv', 'The CSV file that contain a list of private key')
  .addParam('contractAddress', 'Address of VestingTGE contract')
  .addOptionalParam('networkUrl', 'RPC provider URL of target network', LOCAL_NETWORK_URL)
  .setAction(async (taskArgs) => {
    try {
      // Loading private key from CSV file
      const records = await readCsvFile(taskArgs.privateKeyCsv);
      const targetAddrs = records.map(record => record[0]);

      // Check duplicated private key
      const duplicatedAddrs = targetAddrs.getDuplicates();
      if (duplicatedAddrs.length > 0) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below private key are duplicated private key in your private key file, please check again`);
        for (let i = 0; i < duplicatedAddrs.length; i++) {
          console.log(` ${i + 1}. ${duplicatedAddrs[i]}`)
        }
        return;
      }

      // Check invalid vestingTGE contract addresses
      if (!taskArgs.contractAddress || !ethers.utils.isAddress(taskArgs.contractAddress)) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Below VestingTGE address are invalid, please check your contract-address param again`);
        return;
      }

      // Init providers
      const provider = new ethers.providers.JsonRpcProvider(taskArgs.networkUrl);
      const providerGasPrice = await provider.getGasPrice();

      let VestingTGEArtifact;
      try {
        VestingTGEArtifact = require('../artifacts/contracts/VestingTGE.sol/VestingTGE.json');
      } catch (error) {
        console.log(CONSOLE_LOG_RED_COLOR, `\n[ERROR] Please compile contracts by running below command before using this scripts!!!`);
        console.log(CONSOLE_LOG_RED_COLOR, `   ---> npx hardhat compile`);
        return;
      }

      for (let i = 0; i < targetAddrs.length; i++) {
        const signer = new ethers.Wallet(targetAddrs[i], provider);
        const user = new NonceManager(signer);
        const vestingTGEContract = new ethers.Contract(taskArgs.contractAddress, VestingTGEArtifact.abi, user);
        const gasLimit = await vestingTGEContract.estimateGas.claim({ gasPrice: providerGasPrice });
        await vestingTGEContract.claim({ gasPrice: providerGasPrice, gasLimit: gasLimit });
      }

      const currentDate = new Date();
      var formatedDate = "Last checking: " + currentDate.getDate() + "/"
                + (currentDate.getUTCMonth()+1)  + "/"
                + currentDate.getUTCFullYear() + " "
                + currentDate.getUTCHours() + ":"
                + currentDate.getUTCMinutes() + ":"
                + currentDate.getUTCSeconds();
      console.log(`\n${formatedDate} UTC\n`);

      console.log(CONSOLE_LOG_GREEN_COLOR, `\n==> Excute claim done\n`);
    } catch (error) {
      console.log(CONSOLE_LOG_RED_COLOR, 'Excute claim vestingTGE failed!')
      console.log(error);
    }
  });
