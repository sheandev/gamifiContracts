// 0x5FbDB2315678afecb367f032d93F642f64180aa3

const { ethers } = require("hardhat");
const { expect } = require("chai");
const Big = require('big.js');
const FIXED_POINT = new Big(10**18)
describe("Formula Test", () => {
  beforeEach(async () => {
    const FormulaTest = await ethers.getContractFactory("FormulaTest");
    formulaTest = await FormulaTest.deploy();
  });

  describe("test formula", () => {
    it("raised to 0", async () => {
      const res1 = await formulaTest.testPowBySquare18('0','0')
      expect(res1.toString()).to.equal("1000000000000000000");

      const resBN1 = new Big('0').pow(0).times(FIXED_POINT)
      expect(resBN1.toString()).to.equal("1000000000000000000");

      const res2 = await formulaTest.testPowBySquare18('1000000000000000000','0')
      expect(res2.toString()).to.equal("1000000000000000000");

      const resBN2 = new Big('1').pow(0).times(FIXED_POINT)
      expect(resBN2.toString()).to.equal("1000000000000000000");

      const res3 = await formulaTest.testPowBySquare18('3000000000000000000','0')
      expect(res3.toString()).to.equal("1000000000000000000");

      const resBN3 = new Big('3').pow(0).times(FIXED_POINT)
      expect(resBN3.toString()).to.equal("1000000000000000000");

      const res4 = await formulaTest.testPowBySquare18('123456789123456789','0')
      expect(res4.toString()).to.equal("1000000000000000000");

      const resBN4 = new Big('0.123456789123456789').pow(0).times(FIXED_POINT)
      expect(resBN4.toString()).to.equal("1000000000000000000");
    })

    it("1 raised to N", async () => {
      const res1 = await formulaTest.testPowBySquare18('1000000000000000000','2')
      expect(res1.toString()).to.equal("1000000000000000000");
      
      const resBN1 = new Big('1').pow(2).times(FIXED_POINT)
      expect(resBN1.toString()).to.equal("1000000000000000000");

      const res2 = await formulaTest.testPowBySquare18('1000000000000000000','456')
      expect(res2.toString()).to.equal("1000000000000000000");

      const resBN2 = new Big('1').pow(456).times(FIXED_POINT)
      expect(resBN2.toString()).to.equal("1000000000000000000");
    })

    it("X raised to 1", async () => {
      const res1 = await formulaTest.testPowBySquare18('1000000000000000000','1')
      expect(res1.toString()).to.equal("1000000000000000000");

      const resBN1 = new Big('1').pow(1).times(FIXED_POINT)
      expect(resBN1.toString()).to.equal("1000000000000000000");

      const res2 = await formulaTest.testPowBySquare18('3000000000000000000','1')
      expect(res2.toString()).to.equal("3000000000000000000");
    
      const resBN2 = new Big('3').pow(1).times(FIXED_POINT)
      expect(resBN2.toString()).to.equal("3000000000000000000");

      const res3 = await formulaTest.testPowBySquare18('123456789123456789','1')
      expect(res3.toString()).to.equal("123456789123456789");
      
      const resBN3 = new Big('0.123456789123456789').pow(1).times(FIXED_POINT)
      expect(resBN3.toString()).to.equal("123456789123456789");
    })

    it("X raised to N, Integer base", async () => {
      const res1 = await formulaTest.testPowBySquare18('2000000000000000000','2')
      expect(res1.toString()).to.equal("4000000000000000000");

      const resBN1 = new Big('2').pow(2).times(FIXED_POINT)
      expect(resBN1.toString()).to.equal("4000000000000000000");

      const res2 = await formulaTest.testPowBySquare18('2000000000000000000','5')
      expect(res2.toString()).to.equal("32000000000000000000");
      
      const resBN2 = new Big('2').pow(5).times(FIXED_POINT)
      expect(resBN2.toString()).to.equal("32000000000000000000");

      const res3 = await formulaTest.testPowBySquare18('13000000000000000000','11')
      expect(res3.toString()).to.equal("1792160394037000000000000000000");
            
      const resBN3 = new Big('13').pow(11).times(FIXED_POINT)
      expect(resBN3.toPrecision()).to.equal("1.792160394037e+30");

      const res4 = await formulaTest.testPowBySquare18('34000000000000000000','26')
      expect(res4.toString()).to.equal("6583424253569334549714045134721532297216000000000000000000");
            
      const resBN4 = new Big('34').pow(26).times(FIXED_POINT)
      expect(resBN4.toPrecision()).to.equal("6.583424253569334549714045134721532297216e+57");
    })
    
    it("X raised to N, Decimal base", async () => {
      const res1 = await formulaTest.testPowBySquare18('2979798700909879990','2')
      expect(res1.toString()).to.equal("8879200297944208424");

      const resBN1 = new Big('2.97979870090987999').pow(2).times(FIXED_POINT)
      expect(resBN1.toFixed(0)).to.equal("8879200297944208424");

      const res2 = await formulaTest.testPowBySquare18('2009797000000989080','5')
      expect(res2.toString()).to.equal("32791476202131049772");

      const resBN2 = new Big('2.00979700000098908').pow(5).times(FIXED_POINT)
      expect(resBN2.toFixed(0)).to.equal("32791476202131049772");

      const res3 = await formulaTest.testPowBySquare18('7300038383900000123','7')
      expect(res3.toString()).to.equal("1104780514135769123207840"); // 

      const resBN3 = new Big('7.300038383900000123').pow(7).times(FIXED_POINT)
      expect(resBN3.toFixed(0)).to.equal("1104780514135769123208134"); // 

      const res4 = await formulaTest.testPowBySquare18('3400000000098787000','26')
      expect(res4.toString()).to.equal("65834242585426507351880156088839"); //

      const resBN4 = new Big('3.400000000098787').pow(26).times(FIXED_POINT)
      expect(resBN4.toFixed(0)).to.equal("65834242585426507353941738055626"); //
    })

  });
});
