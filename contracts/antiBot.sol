// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";




// reccomended usage with Transparent Upgradable Proxy, Ownable would be moved to initialize function along with constructor
contract AntiBotMaster is Ownable {
    mapping(address => bool) private _pureBlacklist;
    mapping(address => bool) private _blacklist;
    mapping(address => bool) private _whitelist;
    mapping(address => uint256) private _blacklistedAt;

    address private _liquidity;

    uint256 private _maxBuyLimit;
    uint256 private _maxSellLimit;

    uint256 private _snipeTimeout;

    uint256 private _blacklistTimeout;
    uint256 private _listingTime;

    // all variables can be updated manually with onlyOwner functions, remove according to requirement
    constructor (address liquidity, uint256 maxBuyLimit, uint256 maxSellLimit, uint256 snipeTimeout, uint256 blacklistTimeout, uint256 listingTime) {
        _liquidity = liquidity;
        _maxBuyLimit = maxBuyLimit;
        _maxSellLimit = maxSellLimit;
        _snipeTimeout = snipeTimeout;
        _blacklistTimeout = blacklistTimeout;
        _listingTime = listingTime;
    }




    function isContract(address _addr) private view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }


    // call from _transfer function from Token contract
    // returns bool object, revert on false
    function validateTransfer(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        // skip checks for whitelisted addresses
        if (_whitelist[from]) {
            return true;
        }
        // Blacklist timeout not applicable
        if (_pureBlacklist[from]) {
            return false;
        }
        if (_blacklist[from]) {
            // blackList Disabling After Timeout
            if (block.timestamp >= _blacklistedAt[from] + _blacklistTimeout) {
                _blacklist[from] = false;
                return true;
            } else {
                return false;
            }
        }

        // use for auto Updating limits based on time
        _updateBuyLimit();
        _updateSellLimit();



        if (from == _liquidity) {
            // antiSnipe
            if ((block.timestamp < _listingTime + _snipeTimeout)) {
                // use any one

                // 1. blackList with timeout 
                _blacklist[to] = true;
                _blacklistedAt[to] = block.timestamp;

                // 2. blackList without timeout (never gets unblacklisted automatically)
                _pureBlacklist[to] = true;


                return false;
            }

            // use any one

            // 1. use for diabling big buys (whales)
            if (_maxBuyLimit!=0){
                require(amount< _maxBuyLimit);
            }

            // 2. use for trapping big buys
            if (amount >= _maxBuyLimit && _maxBuyLimit!=0) {
                // use any one

                // 1. blackList with timeout 
                _blacklist[to] = true;
                _blacklistedAt[to] = block.timestamp;

                // 2. blackList without timeout (never gets unblacklisted automatically)
                _pureBlacklist[to] = true;


                return false;
            }



            // use any one
            // 1. blocks buying from Contracts
            require(!isContract(to));

            // 2. traps buying from big contracts
            if (isContract(to)) {
                // use any one

                // 1. blackList with timeout 
                _blacklist[to] = true;
                _blacklistedAt[to] = block.timestamp;

                // 2. blackList without timeout (never gets unblacklisted automatically)
                _pureBlacklist[to] = true;

                return false;
            }
    
        }

        // reverts on Big Sells
        if (to == _liquidity) {
            if (_maxSellLimit!=0){
                require(amount < _maxSellLimit);
            }

            // blocks sells from contracts
            require(!isContract(from));

        }

        // if no condition is hit till now
        return true;
    }


    // template for auto updating buy limits. Used for autoUpdating or use manual with setBuyLimit function.
    // Timelimits should be used keeping in mind snipeTimeout
    function _updateBuyLimit() internal {
        if (block.timestamp< _listingTime+ 1*60) {
            _maxBuyLimit = 500*1e18;
        }
        if (block.timestamp>= _listingTime+ 1*60) {
            _maxBuyLimit = 1000*1e18;
        }
        if (block.timestamp>= _listingTime+ 5*60) {
            _maxBuyLimit = 5000*1e18;
        }
        if (block.timestamp>= _listingTime+ 15*60) {
            _maxBuyLimit = 20000*1e18;
        }
        if (block.timestamp>= _listingTime+ 1*60*60) {
            _maxBuyLimit = 0;
        }
    }

    // template for auto updating sell limits.  Used for autoUpdating or use manual with setSellLimit function
    // Timelimits should be used keeping in mind snipeTimeout
    function _updateSellLimit() internal {
        if (block.timestamp< _listingTime+ 1*60) {
            _maxSellLimit = 500*1e18;
        }
        if (block.timestamp>= _listingTime+ 1*60) {
            _maxSellLimit = 1000*1e18;
        }
        if (block.timestamp>= _listingTime+ 5*60) {
            _maxSellLimit = 5000*1e18;
        }
        if (block.timestamp>= _listingTime+ 15*60) {
            _maxSellLimit = 20000*1e18;
        }
        if (block.timestamp>= _listingTime+ 1*60*60) {
            _maxSellLimit = 0;
        }
    }



    function setBlacklist(address account, bool allow)
        public
        virtual
        onlyOwner
    {
        _blacklist[account] = allow;
        _blacklistedAt[account] = block.timestamp;
    }

    function setPureBlacklist(address account, bool allow)
        public
        virtual
        onlyOwner
    {
        _pureBlacklist[account] = allow;
    }

    function setWhitelist(address account, bool allow)
        public
        virtual
        onlyOwner
    {
        _whitelist[account] = allow;
    }

    function setMaxBuyLimit(uint256 amount) public onlyOwner {
        _maxBuyLimit = amount;
    }

    function setMaxSellLimit(uint256 amount) public onlyOwner {
        _maxSellLimit = amount;
    }

    function setListingTime(uint256 time) public onlyOwner {
        _listingTime = time;
    }

    // sets listing time to block of mining
    function setListingTime() public onlyOwner {
        _listingTime = block.timestamp;
    }

    function setBlacklistTimeout(uint256 timeout) public onlyOwner {
        _blacklistTimeout = timeout;
    }

    function setSnipeTimeout(uint256 snipeTimeout) public onlyOwner {
        _snipeTimeout = snipeTimeout;
    }

    // precomputable Address
    function setLiquidityAddress(address liquidity) public onlyOwner {
        _liquidity = liquidity;
    }

}
