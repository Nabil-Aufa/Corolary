// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {IProtocolAdapter} from "../interfaces/IProtocolAdapter.sol";
import {FactKind} from "../libraries/FactTypes.sol";

/// @title CompoundV3Adapter
/// @notice Menerjemahkan log Compound V3 (Comet) menjadi Fact Corolary.
///
/// @dev Deklarasi event dari compound-finance/comet `CometMainInterface.sol`
///      (diverifikasi 2026-08-25):
///
///        Supply(address indexed from, address indexed dst, uint amount)
///        Withdraw(address indexed src, address indexed to, uint amount)
///        SupplyCollateral(address indexed from, address indexed dst,
///                         address indexed asset, uint amount)
///        WithdrawCollateral(address indexed src, address indexed to,
///                           address indexed asset, uint amount)
///        AbsorbDebt(address indexed absorber, address indexed borrower,
///                   uint basePaidOut, uint usdValue)
///
///      ══════════════════════════════════════════════════════════════════════
///      KENAPA `Supply`/`Withdraw` SENGAJA TIDAK DIPETAKAN
///      ══════════════════════════════════════════════════════════════════════
///
///      `docs/contracts.md` §7c mengarahkan untuk memetakan `Withdraw` →
///      `LoanOriginated` dan `Supply` → `LoanRepaid` pada aset dasar. Itu TIDAK
///      AMAN, dan ini lubang paling parah yang mungkin ada di sistem skor.
///
///      Di Comet, aset dasar memakai satu saldo bertanda: positif berarti
///      menyuplai, negatif berarti meminjam. `supplyBase` memecah jumlahnya
///      menjadi bagian "repay" dan bagian "supply"; `withdrawBase` memecahnya
///      menjadi "withdraw" dan "borrow". Kedua event hanya memancarkan TOTAL-nya.
///
///      Akibatnya, dari satu log `Supply` saja MUSTAHIL membedakan:
///        - peminjam yang melunasi utang  (LoanRepaid yang sah), dari
///        - pemberi pinjaman yang menyetor USDC  (bukan pelunasan sama sekali).
///
///      Kalau §7c diikuti apa adanya, siapa pun bisa menyetor USDC ke Compound V3
///      dan langsung memperoleh fakta `LoanRepaid` bernilai besar - reputasi
///      GRATIS tanpa pernah meminjam sepeser pun. Itu menghancurkan seluruh
///      klaim Sybil-resistance: "biaya memalsukan riwayat ≈ biaya memiliki
///      riwayat asli" runtuh menjadi "biaya = deposit yang bisa langsung ditarik".
///
///      Sinyal pembedanya ADA, tapi bukan di log ini: Comet memancarkan
///      `Transfer` terpisah hanya untuk porsi supply/withdraw-nya, jadi porsi
///      pinjam/lunas = selisihnya. Membacanya menuntut korelasi ANTAR log dalam
///      satu transaksi, sementara `IProtocolAdapter.decodeLog` sengaja hanya
///      melihat satu log agar tetap murah dan deterministik.
///
///      Keputusan: lewati keduanya. Menghitung KURANG itu aman - subjek hanya
///      kehilangan poin yang layak ia dapat. Menghitung LEBIH itu fatal dan
///      permanen. Compound V3 tetap menyumbang kolateral, likuidasi, dan
///      diversity protokol; hanya volume pelunasannya yang absen.
///
///      Lihat `docs/open-issues.md` T8 untuk jalan menuju fidelitas penuh.
contract CompoundV3Adapter is IProtocolAdapter {
    /// @notice Comet cUSDCv3 di Ethereum mainnet.
    address public immutable COMET;

    /// @notice Aset dasar pasar ini. Comet adalah satu-pasar-satu-aset-dasar,
    ///         jadi ini konstan per deployment dan di-set saat konstruksi.
    address public immutable BASE_TOKEN;

    bytes32 internal constant SUPPLY_COLLATERAL_SIG =
        0xfa56f7b24f17183d81894d3ac2ee654e3c26388d17a28dbd9549b8114304e1f4;
    bytes32 internal constant WITHDRAW_COLLATERAL_SIG =
        0xd6d480d5b3068db003533b170d67561494d72e3bf9fa40a266471351ebba9e16;
    bytes32 internal constant ABSORB_DEBT_SIG =
        0x1547a878dc89ad3c367b6338b4be6a65a5dd74fb77ae044da1e8747ef1f4f62f;

    error ZeroAddress();

    constructor(address comet, address baseToken) {
        if (comet == address(0) || baseToken == address(0)) revert ZeroAddress();
        COMET = comet;
        BASE_TOKEN = baseToken;
    }

    function sourceContract() external view returns (address) {
        return COMET;
    }

    function protocolName() external pure returns (string memory) {
        return "Compound V3";
    }

    /// @inheritdoc IProtocolAdapter
    function decodeLog(EvmV1Decoder.LogEntry calldata log)
        external
        view
        returns (bool ok, FactKind kind, address subject, address asset, uint256 amount)
    {
        uint256 topicCount = log.topics.length;
        if (topicCount == 0) return _skip();

        bytes32 sig = log.topics[0];

        if (sig == SUPPLY_COLLATERAL_SIG) {
            // topics: [1]=from, [2]=dst, [3]=asset. data: [0]=amount.
            // Subjeknya `dst` - akun yang menerima kolateral, bukan yang mengirim.
            if (topicCount != 4 || log.data.length < 32) return _skip();
            return (
                true,
                FactKind.CollateralSupplied,
                _addr(log.topics[2]),
                _addr(log.topics[3]),
                _word(log.data, 0)
            );
        }

        if (sig == WITHDRAW_COLLATERAL_SIG) {
            // topics: [1]=src, [2]=to, [3]=asset. Subjeknya `src` - akun yang
            // kolateralnya berkurang, bukan penerimanya.
            if (topicCount != 4 || log.data.length < 32) return _skip();
            return (
                true,
                FactKind.CollateralWithdrawn,
                _addr(log.topics[1]),
                _addr(log.topics[3]),
                _word(log.data, 0)
            );
        }

        if (sig == ABSORB_DEBT_SIG) {
            // topics: [1]=absorber, [2]=borrower. HANYA 3 topic, bukan 4 -
            // event ini punya dua parameter indexed, bukan tiga.
            // data: [0]=basePaidOut, [1]=usdValue.
            //
            // Ini padanan likuidasi di Comet, dan ia TIDAK ambigu: protokol
            // menyerap utang buruk milik `borrower`. `basePaidOut` adalah utang
            // dasar yang dilunasi paksa - padanan `debtToCover` Aave.
            if (topicCount != 3 || log.data.length < 64) return _skip();
            return (true, FactKind.Liquidated, _addr(log.topics[2]), BASE_TOKEN, _word(log.data, 0));
        }

        // `Supply` dan `Withdraw` pada aset dasar sengaja tidak ditangani -
        // lihat catatan panjang di header kontrak. Mereka jatuh ke sini dan
        // dilewati seperti log tak dikenal lainnya.
        return _skip();
    }

    function _skip() private pure returns (bool, FactKind, address, address, uint256) {
        return (false, FactKind.LoanOriginated, address(0), address(0), 0);
    }

    function _word(bytes calldata data, uint256 index) private pure returns (uint256) {
        uint256 offset = index * 32;
        bytes calldata slice = data[offset:offset + 32];
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(bytes32(slice));
    }

    function _addr(bytes32 topic) private pure returns (address) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return address(uint160(uint256(topic)));
    }
}
