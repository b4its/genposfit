// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title GenPosFit Coin (GPC)
/// @notice ERC-1155 fungible coin used for rewards within GenPosFit.
contract GenPosFitCoin is ERC1155, ERC1155Supply, ERC1155URIStorage, Ownable {
    using Strings for uint256;

    uint256 public constant GPC_ID = 0;
    uint256 public MAX_SUPPLY = 1_000_000_000 ether; // 1 Milyar GPC

    string public name;
    string public symbol;

    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);
    event Transferred(address indexed from, address indexed to, uint256 amount);
    event MaxSupplyUpdated(uint256 newMaxSupply);

    /// @dev baseUri optional untuk token (cosmetic). Sebagai coin, bisa kosong.
    constructor(address initialOwner)
        ERC1155("https://genposfit.example/api/metadata/{id}.json")
        Ownable(initialOwner)
    {
        name = "GenPosFit Coin";
        symbol = "GPC";
    }

    /// @dev Helper agar owner bisa set khusus metadata kosong (karena ini coin).
    function uri(uint256 tokenId)
        public
        view
        virtual
        override(ERC1155, ERC1155URIStorage)
        returns (string memory)
    {
        return ERC1155URIStorage.uri(tokenId);
    }

    /// @notice Mint GPC ke alamat tertentu (hanya owner).
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "GPC: mint to zero address");
        require(
            totalSupply(GPC_ID) + amount <= MAX_SUPPLY,
            "GPC: exceeds max supply"
        );
        _mint(to, GPC_ID, amount, "");
        emit Minted(to, amount);
    }

    /// @notice Burn GPC milik admin (hanya owner).
    function burn(uint256 amount) external onlyOwner {
        _burn(msg.sender, GPC_ID, amount);
        emit Burned(msg.sender, amount);
    }

    /// @notice Burn GPC milik pemegang lain (hanya owner, misal koreksi reward).
    function burnFrom(address account, uint256 amount) external onlyOwner {
        require(
            balanceOf(account, GPC_ID) >= amount,
            "GPC: burn amount exceeds balance"
        );
        _burn(account, GPC_ID, amount);
        emit Burned(account, amount);
    }

    /// @notice Update batas maksimal suplai (hanya owner).
    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        require(
            newMaxSupply >= totalSupply(GPC_ID),
            "GPC: new max below current supply"
        );
        MAX_SUPPLY = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    /// @notice Override wajib dari ERC1155Supply.
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
        if (from == address(0)) {
            for (uint256 i = 0; i < ids.length; i++) {
                require(
                    totalSupply(ids[i]) <= MAX_SUPPLY,
                    "GPC: exceeds max supply"
                );
            }
        }
    }
}