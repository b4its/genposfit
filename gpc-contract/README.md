# GenPosFit Coin (GPC) — ERC-1155 on Sepolia

Token aset digital **"GPC" (GenPosFit Coin)** — kontrak ERC-1155 fungible coin
yang berjalan **terpisah** dari stack utama GenPosFit, memakai Hardhat v2 + JavaScript
dan testnet **Sepolia** via Infura.

## Stack
- Hardhat v2 + `@nomicfoundation/hardhat-toolbox`
- OpenZeppelin ERC1155 (`ERC1155Supply`, `ERC1155URIStorage`, `Ownable`)
- Solidity `0.8.24`, EVM target `cancun`
- Network: `sepolia` (chainId 11155111) + `hardhat` (lokal, chainId 31337)

## Struktur
```
gpc-contract/
├── contracts/GPC.sol        # Kontrak GenPosFitCoin
├── scripts/                 # deploy, send, balance, info
├── test/GPC.test.js         # unit test
├── hardhat.config.js
├── Dockerfile               # image worker Hardhat
├── docker-compose.yml       # compose TERPISAH (nama project: genposfit-gpc)
└── package.json
```

## Environment (di root `.env`)
```
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID"
PRIVATE_KEY="YOUR_PRIVATE_KEY"
ETHERSCAN_API_KEY="YOUR_ETHERSCAN_API_KEY"
```

## Kontrak — Fitur
| Fiitur | Fungsi | 
|--------|--------|
| **Send / transfer** | `safeTransferFrom(from, to, 0, amount, "")` — ERC-1155 standar |
| **Amount** | `balanceOf(addr, 0)` → saldo GPC |
| **Hak milik** | `owner()` (Ownable — admin) + `mint`, `burn`, `burnFrom` |
| **Suplai** | `totalSupply(0)`, `MAX_SUPPLY` (1 Milyar GPC) |
| **Mint reward** | `mint(to, amount)` (hanya owner) |
| **Burn (koreksi)** | `burn(amount)` / `burnFrom(account, amount)` (hanya owner) |

## Command (via Makefile utama, dari root project)
```bash
make gpc-up              # build image + start container genposfit-gpc (daemon)
make gpc-down            # stop + hapus container GPC
make gpc-publish         # DEPLOY kontrak ke Sepolia + catat alamat di deployment.json
make gpc-send TARGET=0xRecipient AMOUNT=100   # kirim 100 GPC (AMOUNT dalam satuan GPC)
make gpc-balance TARGET=0xAddress            # cek saldo
make gpc-owner           # lihat alamat pemilik
make gpc-info            # info lengkap token (owner, supply, dll)
make gpc-total-supply    # total suplai GPC
make gpc-max-supply      # batas maksimal suplai
make gpc-compile         # compile saja (tanpa deploy)
make gpc-test            # jalankan unit test
```

> **⚠ Keamanan:** Jangan commit `PRIVATE_KEY` atau API key nyata ke repository.
> Gunakan `.env` (ter-ignore) untuk menyimpan secrets.

Catatan: stack GPC **terpisah** dari stack utama (db/backend/frontend). Ia punya
compose file sendiri (`gpc-contract/docker-compose.yml`) dan tidak ikut
`make up` / `make down` utama.

## Menjalankan manual (tanpa Docker)
```bash
cd gpc-contract
cp .env.example ../.env   # atau edit .env root, pastikan variabel GPC terisi
npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js --network sepolia
```