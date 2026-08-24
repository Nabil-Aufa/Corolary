// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {IProtocolAdapter} from "../interfaces/IProtocolAdapter.sol";
import {FactKind} from "../libraries/FactTypes.sol";

/// @title AaveV3StyleAdapter
/// @notice Logika decode bersama untuk Aave V3 dan turunannya.
///
/// @dev SparkLend adalah fork Aave V3, jadi deklarasi event-nya identik dan
///      topic0-nya sama persis. Menyalin logika ini dua kali berarti menyalin
///      juga jebakan offset `data[1]` - dan salinan kedua pasti akan luput
///      diperbarui saat yang pertama diperbaiki. Perbedaannya hanya alamat pool
///      dan nama, jadi itu yang dijadikan parameter.
///
/// @dev Stateless dan `view`. Pemanggil (FactRegistry) sudah menjamin proof sah,
///      receipt sukses, dan emitter == POOL. Adapter tidak mengulang cek itu.
///
///      Deklarasi event, disalin dari aave-v3-origin `IPool.sol` (diverifikasi
///      2026-08-25). Perhatikan MANA yang `indexed` - ini menentukan segalanya:
///
///        Supply(address indexed reserve, address user, address indexed onBehalfOf,
///               uint256 amount, uint16 indexed referralCode)
///        Withdraw(address indexed reserve, address indexed user, address indexed to,
///               uint256 amount)
///        Borrow(address indexed reserve, address user, address indexed onBehalfOf,
///               uint256 amount, InterestRateMode interestRateMode, uint256 borrowRate,
///               uint16 indexed referralCode)
///        Repay(address indexed reserve, address indexed user, address indexed repayer,
///               uint256 amount, bool useATokens)
///        LiquidationCall(address indexed collateralAsset, address indexed debtAsset,
///               address indexed user, uint256 debtToCover,
///               uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)
abstract contract AaveV3StyleAdapter is IProtocolAdapter {
    address internal immutable _POOL;
    string internal _NAME;

    constructor(address pool, string memory name) {
        _POOL = pool;
        _NAME = name;
    }

    bytes32 internal constant BORROW_SIG =
        0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0;
    bytes32 internal constant REPAY_SIG =
        0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051;
    bytes32 internal constant LIQ_SIG =
        0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286;
    bytes32 internal constant SUPPLY_SIG =
        0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61;
    bytes32 internal constant WITHDRAW_SIG =
        0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7;

    /// @dev Kelima event punya tepat 4 topic (signature + 3 indexed).
    uint256 internal constant EXPECTED_TOPICS = 4;

    function sourceContract() external view returns (address) {
        return _POOL;
    }

    function protocolName() external view returns (string memory) {
        return _NAME;
    }

    /// @inheritdoc IProtocolAdapter
    function decodeLog(EvmV1Decoder.LogEntry calldata log)
        external
        pure
        returns (bool ok, FactKind kind, address subject, address asset, uint256 amount)
    {
        // Log tak dikenal bukan error - satu transaksi Aave memuat banyak log
        // lain (aToken, variableDebtToken, ReserveDataUpdated).
        if (log.topics.length != EXPECTED_TOPICS) {
            return (false, FactKind.LoanOriginated, address(0), address(0), 0);
        }

        bytes32 sig = log.topics[0];

        if (sig == BORROW_SIG) {
            // data: [0]=user, [1]=amount, [2]=interestRateMode, [3]=borrowRate
            //
            // PERINGATAN: `amount` ada di word 1, BUKAN 0. `user` tidak di-index
            // sehingga ia menempati word pertama. Membaca word 0 di sini akan
            // mencatat ALAMAT DOMPET sebagai jumlah pinjaman - angka astronomis
            // yang meracuni repaymentVolume tanpa gejala apa pun.
            if (log.data.length < 128) {
                return (false, FactKind.LoanOriginated, address(0), address(0), 0);
            }
            return (
                true,
                FactKind.LoanOriginated,
                _toAddress(log.topics[2]), // onBehalfOf - PEMIKUL utang, bukan eksekutor
                _toAddress(log.topics[1]), // reserve
                _word(log.data, 1)
            );
        }

        if (sig == REPAY_SIG) {
            // data: [0]=amount, [1]=useATokens. Semua alamat di-index di sini.
            if (log.data.length < 64) {
                return (false, FactKind.LoanRepaid, address(0), address(0), 0);
            }
            return (
                true,
                FactKind.LoanRepaid,
                _toAddress(log.topics[2]), // user - PEMILIK utang, bukan repayer
                _toAddress(log.topics[1]), // reserve
                _word(log.data, 0)
            );
        }

        if (sig == LIQ_SIG) {
            // data: [0]=debtToCover, [1]=liquidatedCollateralAmount,
            //       [2]=liquidator, [3]=receiveAToken
            if (log.data.length < 128) {
                return (false, FactKind.Liquidated, address(0), address(0), 0);
            }
            return (
                true,
                FactKind.Liquidated,
                _toAddress(log.topics[3]), // user yang dilikuidasi
                _toAddress(log.topics[2]), // debtAsset - BUKAN collateralAsset
                _word(log.data, 0) // debtToCover - BUKAN liquidatedCollateralAmount
            );
        }

        if (sig == SUPPLY_SIG) {
            // data: [0]=user, [1]=amount. Sama seperti Borrow: amount di word 1.
            if (log.data.length < 64) {
                return (false, FactKind.CollateralSupplied, address(0), address(0), 0);
            }
            return (
                true,
                FactKind.CollateralSupplied,
                _toAddress(log.topics[2]), // onBehalfOf
                _toAddress(log.topics[1]), // reserve
                _word(log.data, 1)
            );
        }

        if (sig == WITHDRAW_SIG) {
            // data: [0]=amount. Ketiga alamat di-index.
            if (log.data.length < 32) {
                return (false, FactKind.CollateralWithdrawn, address(0), address(0), 0);
            }
            return (
                true,
                FactKind.CollateralWithdrawn,
                _toAddress(log.topics[2]), // user
                _toAddress(log.topics[1]), // reserve
                _word(log.data, 0)
            );
        }

        return (false, FactKind.LoanOriginated, address(0), address(0), 0);
    }

    /// @dev Baca word ke-`index` dari data non-indexed.
    function _word(bytes calldata data, uint256 index) private pure returns (uint256 value) {
        uint256 offset = index * 32;
        bytes calldata slice = data[offset:offset + 32];
        // Slice-nya tepat 32 byte, jadi konversi ke bytes32 eksak - tidak ada yang
        // bisa terpotong. Pemanggil sudah memvalidasi `data.length` sebelum masuk.
        // forge-lint: disable-next-line(unsafe-typecast)
        value = uint256(bytes32(slice));
    }

    /// @dev EVM meng-encode topic `address` yang di-index dengan padding kiri nol,
    ///      jadi 96 bit atas selalu nol untuk log yang benar-benar dipancarkan Aave.
    ///      Gerbang emitter di FactRegistry sudah memastikan log ini berasal dari
    ///      `POOL`, sehingga tidak ada jalur bagi pihak lain untuk menyelundupkan
    ///      topic berbentuk aneh ke sini.
    function _toAddress(bytes32 topic) private pure returns (address) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return address(uint160(uint256(topic)));
    }
}
