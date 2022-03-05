// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";



// reccomended usage with Transparent Upgradable Proxy, Ownable would be moved to initialize function along with constructor
contract AntiBotMaster is Context, Initializable {
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
    address private _owner;
    mapping(address => bool) private _admins;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );


    function initialize(address owner_) public initializer {
        _setOwner(owner_);
    }



    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    modifier onlyAdmin() {
        require((owner() == _msgSender() || _admins[_msgSender()]), "Ownable: caller is not an admin");
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function renounceOwnership() public virtual onlyOwner {
        _setOwner(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(
            newOwner != address(0),
            "Ownable: new owner is the zero address"
        );
        _setOwner(newOwner);
    }

    function _setOwner(address newOwner) private {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
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

        


        if (from == _liquidity) {
            // antiSnipe
            if ((block.timestamp < _listingTime + _snipeTimeout)) {
                // use any one

              

                // 2. blackList without timeout (never gets unblacklisted automatically)
                _pureBlacklist[to] = true;


                return false;
            }

            // use any one

            

            // 2. use for trapping big buys
            if (amount >= _maxBuyLimit && _maxBuyLimit!=0) {
                // use any one

                

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

      

        }

        // if no condition is hit till now
        return true;
    }


    // template for auto updating buy limits. Used for autoUpdating or use manual with setBuyLimit function.
    // Timelimits should be used keeping in mind snipeTimeout
    function _updateBuyLimit() internal {
        
    }

    // template for auto updating sell limits.  Used for autoUpdating or use manual with setSellLimit function
    // Timelimits should be used keeping in mind snipeTimeout
    function _updateSellLimit() internal {
      
    }


    


    function setAdmin(address user, bool allow) public onlyOwner {
        _admins[user] = allow;
    }

    function setBlacklist(address account, bool allow)
        public
        virtual
        onlyAdmin
    {
        _blacklist[account] = allow;
        _blacklistedAt[account] = block.timestamp;
    }

    function setPureBlacklist(address account, bool allow)
        public
        virtual
        onlyAdmin
    {
        _pureBlacklist[account] = allow;
    }

    function setWhitelist(address account, bool allow)
        public
        virtual
        onlyAdmin
    {
        _whitelist[account] = allow;
    }

    function setMaxBuyLimit(uint256 amount) public onlyAdmin {
        _maxBuyLimit = amount;
    }

    function setMaxSellLimit(uint256 amount) public onlyAdmin {
        _maxSellLimit = amount;
    }

    function setListingTime(uint256 time) public onlyAdmin {
        _listingTime = time;
    }

    // sets listing time to block of mining
    function setListingTime() public onlyAdmin {
        _listingTime = block.timestamp;
    }


    function setBlacklistTimeout(uint256 timeout) public onlyAdmin {
        _blacklistTimeout = timeout;
    }

    function setSnipeTimeout(uint256 snipeTimeout) public onlyAdmin {
        _snipeTimeout = snipeTimeout;
    }

    // precomputable Address
    function setLiquidityAddress(address liquidity) public onlyAdmin {
        _liquidity = liquidity;
    }

    function getPureBlacklist(address account)
        public
        view
        returns(bool)
    {
        return _pureBlacklist[account];
    }

}
