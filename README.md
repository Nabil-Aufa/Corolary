# Corolary

**Reputation that follows you, backed by proof.**

Portable, cryptographically proven on-chain credit history — derived from **real
Ethereum mainnet** lending activity via the **Attestcoin Protocol** — used to unlock
**collateral efficiency** in a Creditcoin lending market.

> Built for **BUIDL CTC 2026 Fall** · Track: DeFi
> Deployed and verified on **Creditcoin CC3 Testnet** (chainId `102031`)

---

## The problem

DeFi today demands 150–200% over-collateralization from *everyone*. A borrower who has
repaid 40 Aave loans over two years is treated exactly like a wallet created five
minutes ago.

**Reputation has no economic value** — not because it doesn't exist, but because that
history is locked on another chain and can't be proven where you're standing.

## The solution

Corolary proves that history cryptographically, then prices it.

```
Borrower repays a loan on Aave V3 (Ethereum mainnet)
        ↓  real event, real transaction
Attestcoin Protocol — decentralized attestors reach consensus on the block
        ↓  Merkle proof + continuity proof
FactRegistry on Creditcoin — synchronous verification via precompile 0x0FD2
        ↓  permanent fact, auditable by anyone
CreditGraph — score 0..1000, every component points to specific evidence
        ↓
EfficiencyMarket — collateral ratio 150% → 110%
```

**We are not selling uncollateralized lending.** Every loan stays over-collateralized.
Borrowers with proven reputation simply lock far less capital. The protocol remains
solvent without identity and without legal recourse — and that is what separates
Corolary from earlier on-chain credit-scoring attempts that never reached adoption.

---

## Attestcoin Protocol integration

Attestcoin is not bolted onto this project — **it is the product**.

| Usage | Detail |
|---|---|
| **Core data source** | Every credit fact originates from an Ethereum mainnet transaction proven through the Block Prover Precompile `0x…0FD2` |
| **Price oracle** | Collateral prices are proven from Chainlink `AnswerUpdated` events on Ethereum — **zero centralized oracles anywhere in the system** |
| **Eager proving** | Proofs are bought inside the <24h window (`2.59×10⁻⁵` CTC vs `3.13×10⁻⁴` lazy — **~12× cheaper**) and the resulting fact is stored permanently |
| **Batch proving** | Up to 10 transactions share one continuity proof; measured **4,198,654 gas** for a batch of 10 against ~13.1M for ten singles (**~3× cheaper**) |
| **Selective extraction** | SDK `QueryBuilder` for partial decoding instead of decoding whole receipts |
| **ChainInfo registry** | Precompile `0x…0fd3` to track attestation status before attempting a proof |

### Why this is an architectural contribution, not a function call

A ZK-coprocessor answers a *query* and charges per read. Corolary pays for a proof
**once**, then the fact is readable for free, forever, by any Creditcoin dApp. Cost
scales with the number of **facts**, not the number of **reads**.

That turns Attestcoin from a per-query oracle into a **persistent proven-data layer**.
`FactRegistry` is deliberately built as infrastructure: the scoring and market layers on
top of it are consumers, not owners.

### The pipeline, end to end

1. **Watcher** follows `Borrow` / `Repay` / `LiquidationCall` / `Supply` / `Withdraw` /
   `SupplyCollateral` / `WithdrawCollateral` / `AbsorbDebt` on Ethereum mainnet.
2. **Attestation wait** — the system waits for the containing block to be attested
   (~38 blocks, ≈8 minutes), checked via ChainInfo, instead of guessing.
3. **Eager proving** — as soon as it is attested, proofs are bought while still inside
   the cheap window, batched up to 10 transactions within a ≤999-block span.
4. **On-chain verification** — `FactRegistry.recordFact` calls the precompile
   synchronously, then applies the gates below before anything is stored.
5. **Permanent facts** — replay-protected by a `queryId` derived from
   `(chainKey, blockHeight, txIndex, logIndex)`.

### Security gates — the part that is easy to get wrong

| Gate | Why it exists |
|---|---|
| **Proof verification** | The precompile proves *inclusion* in a block |
| **`receiptStatus == 1`** | Inclusion is **not** success. Without this check, an Ethereum transaction that **reverted** still produces a fact and poisons the registry. The precompile does not check this for you. |
| **Emitter → adapter** | Proving "a log exists in this transaction" is not "this log is from Aave". The adapter is selected **by the emitting address**, so a mismatched adapter cannot even be expressed. A copycat contract emitting fake Aave events has no registered adapter and is skipped. |
| **`subject != 0`** | A zero subject means a broken adapter. Stored facts use `subject != 0` as the existence marker, so a zero-subject fact would be written yet read back as absent — then silently overwritten. Hard failure instead. |
| **Batch is all-or-nothing** | Verified against the live precompile: corrupting one byte of one member's `encodedTx` in a batch of 7 reverts the **entire** batch with `Error("Merkle proof validation failed")`. No member is ever silently skipped. |

---

## Zero mock data

The hackathon requires deploying on **testnet**. We refused to use fake data. Those look
contradictory — they aren't.

Creditcoin CC3 **Testnet** supports **Ethereum Mainnet** as a source chain
(`chainKey = 3`, verified directly against the precompile). Corolary runs on testnet as
required, while consuming **genuine** Aave V3, SparkLend, Morpho Blue, Compound V3 and
Chainlink events from Ethereum mainnet.

### What is real, and the one thing that is testnet

We state the exception up front rather than waiting to be asked: CC3 Testnet has no real
USDC or WETH to lend, so the demo market uses testnet ERC20s.

| Layer | Source | Real? |
|---|---|---|
| Credit facts (Aave V3, SparkLend, Morpho Blue, Compound V3) | Ethereum **mainnet**, cryptographically proven via Attestcoin | **Yes** |
| Prices (Chainlink `AnswerUpdated`) | Ethereum **mainnet**, cryptographically proven | **Yes** |
| Scores and collateral tiers | Derived on-chain from the facts above | **Yes** |
| Tokens lent in `EfficiencyMarket` | Testnet ERC20 (`tUSDC`, `tWETH`) | **No** — unavoidable |

> **The market tokens are testnet tokens. The credit history, the prices, and the scores
> come from real Ethereum mainnet.**

The distinction matters: a testnet token is a **container**, not **data**. `tUSDC` is
even priced using genuinely proven mainnet USDC, through `PriceRegistry.setPriceAlias` —
the token is a stand-in, the price is not. What this project forbids is invented numbers,
and there are none.

---

## Live on Creditcoin CC3 Testnet

All contracts are **verified** on Blockscout — source is readable, not just bytecode.

**Network:** Creditcoin CC3 Testnet · chainId `102031` (`0x18e8f`)
**RPC:** `https://rpc.cc3-testnet.creditcoin.network`
**Explorer:** `https://creditcoin-testnet.blockscout.com`

### Core contracts

| Contract | Address |
|---|---|
| `FactRegistry` | [`0xF7283aDefb2801db75160A49dA2F7E5e8fDc36c5`](https://creditcoin-testnet.blockscout.com/address/0xF7283aDefb2801db75160A49dA2F7E5e8fDc36c5) |
| `PriceRegistry` | [`0x80B20b96E3b9c3CaD077f535f1F95D5b8a06012C`](https://creditcoin-testnet.blockscout.com/address/0x80B20b96E3b9c3CaD077f535f1F95D5b8a06012C) |
| `CreditGraph` | [`0x896E283FB7213650f2C65c239168fEd89F57e952`](https://creditcoin-testnet.blockscout.com/address/0x896E283FB7213650f2C65c239168fEd89F57e952) |
| `EfficiencyMarket` | [`0x767705FEaE080Cd30AA58BB29A63401114A4308d`](https://creditcoin-testnet.blockscout.com/address/0x767705FEaE080Cd30AA58BB29A63401114A4308d) |

### Protocol adapters

Each adapter decodes one mainnet protocol's events and is bound to that protocol's
mainnet address.

| Adapter | Decodes (Ethereum mainnet) | Address |
|---|---|---|
| `AaveV3Adapter` | Aave V3 Pool `0x8787…4fA4E2` | [`0x3175390d1c019E043CEB7a31D22C8eFE334f2EFB`](https://creditcoin-testnet.blockscout.com/address/0x3175390d1c019E043CEB7a31D22C8eFE334f2EFB) |
| `SparkAdapter` | SparkLend Pool `0xC13e…BE987` | [`0x87601b6aB6c4B0eDd5556DdBAeDda6eb7EE243b5`](https://creditcoin-testnet.blockscout.com/address/0x87601b6aB6c4B0eDd5556DdBAeDda6eb7EE243b5) |
| `MorphoBlueAdapter` | Morpho Blue `0xBBBB…EFFCb` | [`0x0f13a8A29251a0B62F5cd9e547f19F8Ccf938b27`](https://creditcoin-testnet.blockscout.com/address/0x0f13a8A29251a0B62F5cd9e547f19F8Ccf938b27) |
| `CompoundV3Adapter` | Compound V3 Comet `0xc3d6…4cdc3` | [`0xA841835736aA0a4F1ce8EEb45538583fb74A8192`](https://creditcoin-testnet.blockscout.com/address/0xA841835736aA0a4F1ce8EEb45538583fb74A8192) |

### Market tokens (testnet — see the disclosure above)

| Token | Address |
|---|---|
| `tUSDC` (6 decimals, open faucet) | [`0x66f5F2C577ec38CE5bb7BCb7054a531a72004d19`](https://creditcoin-testnet.blockscout.com/address/0x66f5F2C577ec38CE5bb7BCb7054a531a72004d19) |
| `tWETH` (18 decimals, open faucet) | [`0x886E3d92314c037206bB789Ee3A9016EE67b661E`](https://creditcoin-testnet.blockscout.com/address/0x886E3d92314c037206bB789Ee3A9016EE67b661E) |

---

## Proof it works

Read from the live registry on **2026-08-26**. Every number below is verifiable on-chain
by anyone.

| | |
|---|---|
| Facts recorded from Ethereum mainnet | **5,123** |
| Distinct wallets with proven history | **1,206** |
| Mainnet protocols indexed | **4** |

### A real wallet, scored

`0x94963B928498bE7f06637C3D57ea1E74D7f73423` — **score 813 · tier 4 · 110% collateral
ratio**, down from the 150% baseline.

| Component | Points | Max | Backed by |
|---|---|---|---|
| Repayment volume | 297 | 300 | 72 facts |
| Repayment count | 171 | 200 | 72 facts |
| History duration | 95 | 200 | first proven fact |
| Liquidation penalty | 0 | −300 | no liquidations |
| Protocol diversity | 50 | 100 | 2 of 4 protocols |
| Active standing | 200 | 200 | 130 facts |

Every component points back to specific facts, and every fact points back to a specific
Ethereum mainnet transaction. Nothing here is a black box — which is precisely the
failure mode of previous on-chain credit scores.

### Scoring model

Deterministic and fully on-chain. No off-chain model, no proprietary weights.

| Component | Max | Shape |
|---|---|---|
| Repayment volume | 300 | half-saturating at $50,000 |
| Repayment count | 200 | half-saturating at 12 repayments |
| History duration | 200 | half-saturating at 365 days |
| Protocol diversity | 100 | linear, 25 points per protocol |
| Active standing | 200 | recency-weighted over a 365-day lookback |
| Liquidation penalty | −300 | severity-weighted, capped |

| Score | Tier | Required collateral |
|---|---|---|
| ≥ 800 | 4 | **110%** |
| ≥ 600 | 3 | 120% |
| ≥ 400 | 2 | 130% |
| ≥ 200 | 1 | 140% |
| < 200 | 0 | 150% (baseline) |

The ratio is **locked at borrow time**. A later score drop cannot retroactively make a
healthy position liquidatable — it only applies to new borrows.

---

## Architecture

```
packages/contracts/    Solidity — FactRegistry, CreditGraph, EfficiencyMarket, adapters
packages/shared/       TypeScript types + ABIs (the contract between developers)
services/indexer/      Eager-proving worker (watcher → attestation → prover → submitter)
services/api/          REST API (Hono)
apps/web/              Frontend (Next.js) — separate workstream, lands before submission
```

Three layers: **FactRegistry** (infrastructure — usable by any other Creditcoin dApp)
→ **CreditGraph** (scoring) → **EfficiencyMarket** (the market).

The indexer is a single process on purpose. Its queue is Postgres, not Redis or Kafka:
at this scale one process removes cross-process coordination and, more importantly, makes
the submitter the only writer of the submitter key — so nonce management needs no
distributed lock.

---

## Running it

Requires Node 24, pnpm, Docker, and Foundry.

```bash
pnpm install
docker compose up -d                 # local Postgres
cp .env.example .env                 # then fill in the values below
pnpm db:migrate

pnpm dev:indexer                     # watcher → prover → submitter
pnpm dev:api                         # http://localhost:8080
```

**`ETHEREUM_RPC_URL` must satisfy two separate requirements:** archive-capable **and**
able to serve `eth_getLogs` over wide block ranges. Verified working: `https://eth.drpc.org`
(no signup). Alchemy's free tier is archive-capable but caps `eth_getLogs` at 10 blocks,
which makes the indexer's chunking impossible.

Contracts and quality gates:

```bash
forge build && forge test -vvv       # 128 Solidity tests
pnpm typecheck
pnpm test                            # 179 tests total across all packages
pnpm check:no-mocks                  # the zero-mock-data gate
```

`check:no-mocks` is a real gate, not a slogan. It fails the build on seed data,
hardcoded figures, and non-functional UI affordances. Development fixtures are confined
to a single file behind `NEXT_PUBLIC_USE_FIXTURES`, which defaults to `false`.

---

## API

Base: `/v1`. Every response — success or failure — uses the same envelope.

| Method | Path | Returns |
|---|---|---|
| `GET` | `/health` | Liveness and version |
| `GET` | `/chains` | Source chain and attestation status |
| `GET` | `/indexer/status` | Cursors, lag, queue depth |
| `GET` | `/facts` | Proven facts, cursor-paginated |
| `GET` | `/facts/:factId` | One fact with its proof reference |
| `GET` | `/score/:address` | Current score with per-component evidence |
| `GET` | `/score/:address/history` | Score over time |
| `GET` | `/market/summary` | TVL, utilization, average ratio |
| `GET` | `/market/reserves` | Assets and market parameters |
| `GET` | `/market/positions/:address` | Collateral, debt, health factor |
| `GET` | `/prices` | Latest proven price per asset |
| `POST` | `/prove` | Queue an eager proof for one transaction |
| `POST` | `/backfill` | Scan a wallet's mainnet history ("claim your history") |

`POST` endpoints queue work for the indexer and return `202`. The API never calls the
prover or signs a transaction itself — the submitter must remain the only writer of the
submitter key.

---

## Team

| Role | Scope |
|---|---|
| Dev A | Smart contracts, indexer, API, infrastructure |
| Dev B | Frontend, design, wallet integration |

---

## A note on this repository

The `docs/` directory holds internal working documents — design records, measured
findings, open questions, and decisions taken during the build. They are written for the
team, in Indonesian, and are **excluded from the submitted repository**.

This README is therefore self-contained: everything needed to understand, verify, and run
Corolary is here, and every claim in it is checkable against a verified contract, a
Blockscout page, or a command you can run.

---

## License

MIT
