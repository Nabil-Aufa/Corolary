// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum FactKind {
    LoanOriginated, // 0
    LoanRepaid, // 1
    Liquidated, // 2
    CollateralSupplied, // 3
    CollateralWithdrawn // 4
}

struct Fact {
    bytes32 factId;
    uint64 chainKey;
    uint64 blockHeight;
    uint32 txIndex;
    uint32 txLogIndex; // posisi di receipt.receiptLogs (intra-transaksi)
    FactKind kind;
    address subject;
    address protocol;
    address asset;
    uint256 amount;
    uint64 observedAt;
    uint64 recordedAt;
}

library FactTypes {
    /// @dev factId diturunkan, tidak pernah dipasok pemanggil.
    ///
    ///      Seluruh komponen bertipe ukuran tetap (uint64/uint64/uint32/uint32),
    ///      jadi `encodePacked` di sini tidak punya ambiguitas — tidak ada tipe
    ///      dinamis yang bisa digeser untuk menabrakkan dua input berbeda ke
    ///      preimage yang sama.
    function computeFactId(uint64 chainKey, uint64 blockHeight, uint32 txIndex, uint32 txLogIndex)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(chainKey, blockHeight, txIndex, txLogIndex));
    }
}
