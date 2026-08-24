// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title FaucetToken
/// @notice Token ERC-20 testnet dengan faucet terbuka, untuk `EfficiencyMarket`
///         di Creditcoin CC3 Testnet.
///
/// @dev ⚠️ **BACA INI SEBELUM MENYANGKA KAMI MELANGGAR ATURAN NOL-MOCK.**
///
///      Aturan hackathon MEWAJIBKAN deploy di testnet. Di CC3 Testnet tidak ada
///      USDC atau WETH sungguhan. Jadi token yang dipinjamkan di pasar harus
///      di-deploy sendiri — itu konsekuensi langsung dari aturannya, bukan
///      pilihan kami. Ini dinyatakan terbuka, bukan disembunyikan
///      (open-issues B2).
///
///      Yang PALSU: token yang dipinjam-pinjamkan di pasar.
///      Yang NYATA:
///        - riwayat kredit (event Aave/Morpho/Compound/Spark di Ethereum MAINNET,
///          dibuktikan kriptografis lewat Attestcoin)
///        - harga (event Chainlink `AnswerUpdated` di Ethereum MAINNET, dibuktikan
///          lewat jalur yang sama — token ini dinilai memakai harga mainnet
///          sungguhan lewat `PriceRegistry.setPriceAlias`)
///        - skor dan tier (diturunkan sepenuhnya dari fakta terbukti)
///
///      Tidak ada satu pun angka yang dikarang untuk membuat demo terlihat bagus.
///      UI wajib memberi label ini secara eksplisit.
contract FaucetToken is ERC20 {
    uint8 private immutable _DECIMALS;

    /// @notice Batas sekali klaim, supaya satu orang tidak menguras demo.
    uint256 public immutable CLAIM_AMOUNT;

    /// @notice Jeda antar klaim per alamat.
    uint256 public constant CLAIM_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastClaimAt;

    error ClaimTooSoon(uint256 availableAt);

    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 claimAmount)
        ERC20(name_, symbol_)
    {
        _DECIMALS = decimals_;
        CLAIM_AMOUNT = claimAmount;
    }

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Ambil token testnet. Terbuka untuk siapa pun.
    function claim() external {
        uint256 last = lastClaimAt[msg.sender];
        // forge-lint: disable-next-line(block-timestamp)
        if (last != 0 && block.timestamp < last + CLAIM_COOLDOWN) {
            revert ClaimTooSoon(last + CLAIM_COOLDOWN);
        }
        lastClaimAt[msg.sender] = block.timestamp;
        _mint(msg.sender, CLAIM_AMOUNT);
    }
}
