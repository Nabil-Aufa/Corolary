# Sampel Referensi

Artefak nyata dari verifikasi protokol. **Bukan mock data** — ini keluaran sungguhan
dari layanan produksi, disimpan sebagai referensi bentuk data saat implementasi.

## `proof-ethereum-mainnet.json`

Respons asli dari Proof Builder Creditcoin CC3 Testnet untuk sebuah transaksi
**Ethereum mainnet nyata**.

```bash
curl https://prover.cc3-testnet.creditcoin.network/api/v1/proof-by-tx/3/\
0x82d8b138a95a87947891f8e4f9b0a148dd5050c8e691b2a965294178b9d7e594
```

Diambil 2026-08-22. Isinya:

| Field | Nilai |
|---|---|
| `chainKey` | 3 (Ethereum mainnet) |
| `headerNumber` | 25.795.652 |
| `txIndex` | 5 |
| `merkleProof.siblings` | 9 entri |
| `continuityProof.roots` | 49 entri |

Gunakan ini untuk memahami bentuk persis yang harus diteruskan indexer ke
`FactRegistry.recordFact()`. Perhatikan 49 continuity roots pada blok yang sudah agak
lama — inilah alasan **eager proving** penting (lihat `docs/attestcoin-research.md` §2.3).
