//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MemberCard is ERC721Enumerable, Ownable, Pausable {
    uint256 private currentTokenId;
    uint256 public countOfUse;
    uint256 public cardDuration;
    uint256 public fee;

    mapping(uint256 => uint256) private availCount;
    mapping(uint256 => uint256) private expiryDate;

    event CardMinted(address receiver, uint256 indexed tokenId);
    event CardUsed(uint256 indexed tokenId);
    event SetExpiryDate(uint256 indexed value);
    event SetAvailCount(uint256 indexed value);
    event SetAvailCountFor(uint256 indexed tokenId, uint256 indexed value);

    modifier validCount(uint256 tokenId) {
        require(getAvailCount(tokenId) > 0, "Out of use");
        _;
    }

    modifier validDate(uint256 tokenId) {
        require(block.timestamp < getExpiryDate(tokenId), "Expired");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint256 count,
        uint256 duration
    ) ERC721(name, symbol) {
        cardDuration = duration;
        countOfUse = count;
        fee = 5e16;
    }

    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
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
        _transfer(from, to, tokenId);
    }

    function mintToken(address to) external payable {
        require(msg.value >= fee, "Invalid value");
        _safeMint(to, ++currentTokenId);
        availCount[currentTokenId] = countOfUse;
        expiryDate[currentTokenId] = block.timestamp + cardDuration;
        payable(owner()).transfer(msg.value);
        emit CardMinted(to, currentTokenId);
    }

    function useToken(uint256 tokenId)
        public
        validCount(tokenId)
        validDate(tokenId)
    {
        require(_msgSender() == ownerOf(tokenId), "Not owner");
        availCount[tokenId]--;
        emit CardUsed(tokenId);
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
}
