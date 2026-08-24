// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {IProtocolAdapter} from "../interfaces/IProtocolAdapter.sol";
import {FactKind} from "../libraries/FactTypes.sol";

/// @title MorphoBlueAdapter
/// @notice Menerjemahkan log Morpho Blue (Ethereum mainnet) menjadi Fact Corolary.
///
/// @dev Deklarasi event dari morpho-blue `src/libraries/EventsLib.sol`
///      (diverifikasi 2026-08-25). `Id` adalah `type Id is bytes32`, jadi di
///      tanda tangan event ia muncul sebagai `bytes32`:
///
///        Borrow(Id indexed id, address caller, address indexed onBehalf,
///               address indexed receiver, uint256 assets, uint256 shares)
///        Repay(Id indexed id, address indexed caller, address indexed onBehalf,
///               uint256 assets, uint256 shares)
///        Liquidate(Id indexed id, address indexed caller, address indexed borrower,
///               uint256 repaidAssets, uint256 repaidShares, uint256 seizedAssets,
///               uint256 badDebtAssets, uint256 badDebtShares)
///        SupplyCollateral(Id indexed id, address indexed caller,
///               address indexed onBehalf, uint256 assets)
///        WithdrawCollateral(Id indexed id, address caller, address indexed onBehalf,
///               address indexed receiver, uint256 assets)
///
///      DUA jebakan yang sama seperti Aave, dan sama mematikannya:
///
///      1. `assets` TIDAK selalu di word 0. Pada `Borrow` dan `WithdrawCollateral`,
///         `caller` tidak di-index sehingga ia menempati word 0 dan `assets`
///         bergeser ke word 1. Membaca word 0 akan mencatat ALAMAT sebagai jumlah.
///      2. Subjeknya selalu `onBehalf`/`borrower`, TIDAK PERNAH `caller` atau
///         `receiver`. Memberi kredit ke `caller` berarti siapa pun bisa membeli
///         reputasi dengan melunasi utang orang lain.
///
///      Berbeda dari adapter lain, adapter ini PUNYA STATE: log Morpho membawa
///      `Id` (hash parameter pasar), bukan alamat token. Alamat token tidak bisa
///      diturunkan dari log saja, jadi kurator harus mendaftarkannya. Pasar yang
///      belum terdaftar dilewati (`ok == false`), bukan revert - kurator bisa
///      menambahkannya nanti dan fakta itu dibuktikan ulang.
contract MorphoBlueAdapter is IProtocolAdapter, AccessControl {
    address public constant MORPHO = 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb;
    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");

    bytes32 internal constant BORROW_SIG =
        0x570954540bed6b1304a87dfe815a5eda4a648f7097a16240dcd85c9b5fd42a43;
    bytes32 internal constant REPAY_SIG =
        0x52acb05cebbd3cd39715469f22afbf5a17496295ef3bc9bb5944056c63ccaa09;
    bytes32 internal constant LIQUIDATE_SIG =
        0xa4946ede45d0c6f06a0f5ce92c9ad3b4751452d2fe0e25010783bcab57a67e41;
    bytes32 internal constant SUPPLY_COLLATERAL_SIG =
        0xa3b9472a1399e17e123f3c2e6586c23e504184d504de59cdaa2b375e880c6184;
    bytes32 internal constant WITHDRAW_COLLATERAL_SIG =
        0xe80ebd7cc9223d7382aab2e0d1d6155c65651f83d53c8b9b06901d167e321142;

    /// @dev Kelima event punya tepat 3 parameter indexed.
    uint256 internal constant EXPECTED_TOPICS = 4;

    struct Market {
        address loanToken;
        address collateralToken;
        bool registered;
    }

    mapping(bytes32 => Market) public marketOf;

    event MarketRegistered(bytes32 indexed id, address loanToken, address collateralToken);

    error ZeroAddress();

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Daftarkan pemetaan Id pasar Morpho ke alamat tokennya.
    /// @dev Indexer me-resolve ini dengan memanggil `idToMarketParams(Id)` di
    ///      Morpho (Ethereum), lalu kurator mendaftarkannya di sini. Salah
    ///      mendaftarkan token akan mencatat aset yang salah pada setiap fakta
    ///      pasar itu - dan karena `amount` dinilai lewat harga per aset, itu
    ///      langsung menyalahkan nilai USD-nya.
    function setMarket(bytes32 id, address loanToken, address collateralToken)
        external
        onlyRole(CURATOR_ROLE)
    {
        if (loanToken == address(0) || collateralToken == address(0)) revert ZeroAddress();
        marketOf[id] =
            Market({loanToken: loanToken, collateralToken: collateralToken, registered: true});
        emit MarketRegistered(id, loanToken, collateralToken);
    }

    function sourceContract() external pure returns (address) {
        return MORPHO;
    }

    function protocolName() external pure returns (string memory) {
        return "Morpho Blue";
    }

    /// @inheritdoc IProtocolAdapter
    function decodeLog(EvmV1Decoder.LogEntry calldata log)
        external
        view
        returns (bool ok, FactKind kind, address subject, address asset, uint256 amount)
    {
        if (log.topics.length != EXPECTED_TOPICS) return _skip();

        Market memory m = marketOf[log.topics[1]];
        // Pasar yang belum terdaftar: tidak bisa tahu tokennya, jadi tidak bisa
        // menilai jumlahnya. Lewati - JANGAN tebak.
        if (!m.registered) return _skip();

        bytes32 sig = log.topics[0];

        if (sig == BORROW_SIG) {
            // data: [0]=caller, [1]=assets, [2]=shares -> assets di word 1
            if (log.data.length < 96) return _skip();
            return
                (
                    true,
                    FactKind.LoanOriginated,
                    _addr(log.topics[2]),
                    m.loanToken,
                    _word(log.data, 1)
                );
        }

        if (sig == REPAY_SIG) {
            // data: [0]=assets, [1]=shares. topics: [2]=caller, [3]=onBehalf
            if (log.data.length < 64) return _skip();
            return
                (true, FactKind.LoanRepaid, _addr(log.topics[3]), m.loanToken, _word(log.data, 0));
        }

        if (sig == LIQUIDATE_SIG) {
            // data: [0]=repaidAssets, ... Subjeknya `borrower` (topic 3), bukan
            // `caller` (likuidator). Jumlahnya utang yang dilunasi paksa -
            // padanan `debtToCover` di Aave, BUKAN `seizedAssets`.
            if (log.data.length < 160) return _skip();
            return
                (true, FactKind.Liquidated, _addr(log.topics[3]), m.loanToken, _word(log.data, 0));
        }

        if (sig == SUPPLY_COLLATERAL_SIG) {
            // data: [0]=assets. topics: [2]=caller, [3]=onBehalf
            if (log.data.length < 32) return _skip();
            return (
                true,
                FactKind.CollateralSupplied,
                _addr(log.topics[3]),
                m.collateralToken,
                _word(log.data, 0)
            );
        }

        if (sig == WITHDRAW_COLLATERAL_SIG) {
            // data: [0]=caller, [1]=assets -> assets di word 1
            // topics: [2]=onBehalf, [3]=receiver
            if (log.data.length < 64) return _skip();
            return (
                true,
                FactKind.CollateralWithdrawn,
                _addr(log.topics[2]),
                m.collateralToken,
                _word(log.data, 1)
            );
        }

        return _skip();
    }

    function _skip() private pure returns (bool, FactKind, address, address, uint256) {
        return (false, FactKind.LoanOriginated, address(0), address(0), 0);
    }

    function _word(bytes calldata data, uint256 index) private pure returns (uint256) {
        uint256 offset = index * 32;
        bytes calldata slice = data[offset:offset + 32];
        // Slice tepat 32 byte; pemanggil sudah memvalidasi panjang data.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(bytes32(slice));
    }

    function _addr(bytes32 topic) private pure returns (address) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return address(uint160(uint256(topic)));
    }
}
