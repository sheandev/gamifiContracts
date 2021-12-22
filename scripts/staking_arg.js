const fs = require("fs");
const text = fs.readFileSync("scripts/contracts.json", "utf8");
const contractAddress = JSON.parse(text);

module.exports = [contractAddress.tokenTest, contractAddress.memberCard];
