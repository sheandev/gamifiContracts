//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MemberCard is ERC721Enumerable, Ownable, Pausable {
    struct UseTokenInfo {
        address vendor;
        address owner;
        uint256 usedAt;
    }

    IERC20 public cash;

    uint256 private currentTokenId;
    uint256 public countOfUse;
    uint256 public cardDuration;
    uint256 public fee;

    mapping(address => bool) public vendors;
    mapping(uint256 => UseTokenInfo[]) private useTokenInfo;
    mapping(uint256 => uint256) private availCount;
    mapping(uint256 => uint256) private expiryDate;

    event CardMinted(address receiver, uint256 indexed tokenId, uint256 mintedAt);
    event CardBurned(address owner, uint256 indexed tokenId, uint256 burnedAt);
    event CardUsed(uint256 indexed tokenId, address account);
    event SetExpiryDate(uint256 indexed value);
    event SetAvailCount(uint256 indexed value);
    event SetAvailCountFor(uint256 indexed tokenId, uint256 indexed value);

    modifier validCount(uint256 tokenId) {
        require(getAvailCount(tokenId) > 0, "Out of use");
        _;
    }

    modifier validDate(uint256 tokenId) {
        require(block.timestamp < getExpiryDate(tokenId), "Expired"); // solhint-disable-line not-rely-on-time
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        IERC20 _cash,
        uint256 _count,
        uint256 _duration
    ) ERC721(name, symbol) {
        cash = _cash;
        cardDuration = _duration;
        countOfUse = _count;
        fee = 30e18; // cost is 30 CASH token
    }

    function addVendor(address addr) external onlyOwner {
        vendors[addr] = true;
    }

    function removeVendor(address addr) external onlyOwner {
        vendors[addr] = false;
    }

    function setPaused(bool _paused) external onlyOwner {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override whenNotPaused {
        require(
            _isApprovedOrOwner(_msgSender(), tokenId),
            "ERC721: transfer caller is not owner nor approved"
        );
        require(
            balanceOf(to) == 0,
            "Only have 1 NFT per wallet"
        );
        _transfer(from, to, tokenId);
    }

    function mintToken(address to) external {
        require(
            balanceOf(to) == 0,
            "Only have 1 NFT per wallet"
        );
        cash.transferFrom(_msgSender(), owner(), fee);
        _safeMint(to, ++currentTokenId);
        availCount[currentTokenId] = countOfUse;
        emit CardMinted(to, currentTokenId, block.timestamp);
    }

    function burnExpiredTokens() external onlyOwner {
        require(totalSupply() > 0, "Total supply is empty");

        for (uint256 tokenId = 1; tokenId <= currentTokenId; tokenId++) {
            if (_exists(tokenId) && isTokenExpired(tokenId)) {
                address owner = ownerOf(tokenId);
                _burn(tokenId);
                emit CardBurned(owner, tokenId, block.timestamp);
            }
        }
    }

    function setTokenExpiry(uint256 tokenId) public onlyOwner {
        expiryDate[tokenId] = block.timestamp + cardDuration; // solhint-disable-line not-rely-on-time
    }

    function useToken(uint256 _tokenId, address _account)
        public
        validCount(_tokenId)
        validDate(_tokenId)
    {
        require(vendors[_msgSender()], "Invalid vendor");
        require(_account == ownerOf(_tokenId), "Not owner");

        availCount[_tokenId]--;
        useTokenInfo[_tokenId].push(UseTokenInfo(_msgSender(), _account, block.timestamp));
        emit CardUsed(_tokenId, _account);
    }

    function setExpiryDate(uint256 value) public onlyOwner {
        require(cardDuration != value, "Must different");
        cardDuration = value;
        emit SetExpiryDate(cardDuration);
    }

    function setAvailCountFor(uint256 tokenId, uint256 value) public onlyOwner {
        require(getAvailCount(tokenId) != value, "Must different");
        availCount[tokenId] = value;
        emit SetAvailCountFor(tokenId, value);
    }

    function setAvailCount(uint256 value) public onlyOwner {
        require(countOfUse != value, "Must different");
        countOfUse = value;
        emit SetAvailCount(countOfUse);
    }

    function getExpiryDate(uint256 tokenId) public view returns (uint256) {
        return expiryDate[tokenId];
    }

    function isTokenExpired(uint256 tokenId) public view returns (bool) {
        return block.timestamp > expiryDate[tokenId];
    }

    function getAvailCount(uint256 tokenId) public view returns (uint256) {
        return availCount[tokenId];
    }

    function tokensOfOwner(address owner)
        public
        view
        returns (uint256[] memory)
    {
        uint256 count = balanceOf(owner);
        uint256[] memory ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
        return ids;
    }

    function getuseTokenInfo(uint256 _tokenId) public view returns (UseTokenInfo[] memory info) {
        info = useTokenInfo[_tokenId];
    }
}
