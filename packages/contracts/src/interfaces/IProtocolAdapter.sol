// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {FactKind} from "../libraries/FactTypes.sol";

/// @title IProtocolAdapter
/// @notice Kontrak antara FactRegistry dan pengetahuan spesifik protokol.
///         Menambah protokol = deploy adapter baru + daftarkan. Registry tidak berubah.
interface IProtocolAdapter {
    /// @notice Alamat kontrak sumber di Ethereum yang sah untuk adapter ini.
    function sourceContract() external view returns (address);

    /// @notice Nama protokol untuk tampilan, mis. "Aave V3".
    function protocolName() external view returns (string memory);

    /// @notice Terjemahkan satu log yang SUDAH terverifikasi menjadi Fact.
    /// @dev Pemanggil (FactRegistry) sudah menjamin: proof sah, receipt sukses,
    ///      dan log.address_ == sourceContract(). Adapter TIDAK perlu mengulang itu.
    ///
    ///      `view` di sini adalah batas keamanan, bukan gaya penulisan: kompiler
    ///      memancarkan STATICCALL, sehingga adapter yang jahat atau bocor tidak
    ///      bisa menulis state maupun masuk kembali ke `recordFact`.
    ///
    /// @return ok false bila log ini tidak relevan — ini BUKAN error.
    function decodeLog(EvmV1Decoder.LogEntry calldata log)
        external
        view
        returns (bool ok, FactKind kind, address subject, address asset, uint256 amount);
}
