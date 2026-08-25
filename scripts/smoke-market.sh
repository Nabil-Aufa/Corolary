#!/usr/bin/env bash
#
# Smoke-test EfficiencyMarket end-to-end di CC3 Testnet.
#
# Kenapa cast dan bukan `forge script`: di CC3, forge melaporkan "Transaction
# Failure" palsu karena blok CC3 tidak punya `mixHash` dan block-watcher alloy
# gagal men-deserialize. Status dari forge tidak bisa dipercaya di chain ini;
# cast membaca blok yang sama tanpa masalah.
#
# Dipakai DEPLOYER, bukan SUBMITTER: submitter mengelola nonce-nya sendiri dari
# baris `submitter_state` dan indexer sedang jalan. Dua penulis untuk satu kunci
# = nonce saling menimpa.
#
# Skrip ini IDEMPOTEN. Faucet punya cooldown 1 jam dan kolateral dari run
# sebelumnya masih tersimpan, jadi tiap langkah memeriksa keadaan nyata dulu
# alih-alih mengandaikan mulai dari nol.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

RPC="${CREDITCOIN_RPC_URL:-https://rpc.cc3-testnet.creditcoin.network}"
KEY="$DEPLOYER_PRIVATE_KEY"
ME="$DEPLOYER_ADDRESS"
EM="$EFFICIENCY_MARKET_ADDRESS"
USDC="$TEST_USDC_ADDRESS"
WETH="$TEST_WETH_ADDRESS"

# type(uint256).max
MAXU=115792089237316195423570985008687907853269984665640564039457584007913129639935

# stderr dibuang: di CC3, alloy membanjiri log dengan "missing field mixHash"
# untuk transaksi yang SUKSES. Status dibaca dari JSON receipt, bukan dari
# apakah cast menulis sesuatu ke stderr.
send() {
  local label="$1"; shift
  local out
  # --gas-limit eksplisit, TIDAK mengandalkan estimasi cast.
  #
  # CC3 mengestimasi terhadap state beberapa blok lebih tua. Untuk `repay`,
  # bunga terus berjalan sehingga kebutuhan gas naik di antara estimasi dan
  # eksekusi: terukur limit 224.001 vs kebutuhan 228.804. Transaksinya mati
  # kehabisan gas dengan gejala `gasUsed == gasLimit` PERSIS — yang terbaca
  # seperti revert logika, bukan seperti kehabisan gas.
  if ! out=$(cast send "$@" --gas-limit 3000000 --rpc-url "$RPC" --private-key "$KEY" --json 2>/dev/null); then
    echo "  ✗ $label GAGAL"
    return 1
  fi
  python3 -c '
import sys,json
d=json.load(sys.stdin)
ok = d["status"] in ("0x1",1)
print(f"  {"✓" if ok else "✗"} '"$label"': {d["transactionHash"]} gas {int(d["gasUsed"],16):,}")
sys.exit(0 if ok else 1)
' <<<"$out"
}

call() { cast call "$@" --rpc-url "$RPC" 2>/dev/null | awk '{print $1}'; }
hr() { echo; echo "── $* ─────────────────────────────"; }

# Lunasi utang sisa run sebelumnya, kalau ada.
#
# Tanpa ini skrip menumpuk utang di atas kolateral yang sama tiap dijalankan:
# healthFactor merosot ke 1,03 dan `borrow` berikutnya revert dengan
# InsufficientCollateral — kontraknya benar, skripnya yang salah karena
# mengandaikan mulai dari nol.
settle_debt() {
  local debt bal need sup
  debt=$(call "$EM" 'debtBalanceOf(address,address)(uint256)' "$ME" "$USDC")
  [ "$debt" = "0" ] && { echo "  · tidak ada utang tersisa"; return 0; }

  bal=$(call "$USDC" 'balanceOf(address)(uint256)' "$ME")
  if [ "$debt" -gt "$bal" ]; then
    # Penyangga, karena utang terus bertambah di antara withdraw dan repay.
    # Tanpa ini saldo mendarat PERSIS sebesar utang lama, lalu bunga satu blok
    # membuatnya kurang lagi dan repay revert untuk kedua kalinya.
    need=$(( (debt - bal) + 1000000 ))
    sup=$(call "$EM" 'supplyBalanceOf(address,address)(uint256)' "$ME" "$USDC")
    echo "  · utang $debt > saldo $bal — tarik $need dari supply (ada $sup)"
    [ "$sup" -lt "$need" ] && { echo "  ✗ supply tidak cukup"; return 1; }
    send "withdraw $need" "$EM" 'withdraw(address,uint256)' "$USDC" "$need"
  fi
  send "repay MAX" "$EM" 'repay(address,uint256)' "$USDC" "$MAXU"
  local rest
  rest=$(call "$EM" 'debtBalanceOf(address,address)(uint256)' "$ME" "$USDC")
  echo "  sisa utang: $rest"
  [ "$rest" = "0" ]
}


hr "0. Keadaan awal"
echo "  aktor            : $ME"
echo "  skor/tier        : $(cast call "$CREDIT_GRAPH_ADDRESS" 'scoreOf(address)(uint16,uint8)' "$ME" --rpc-url "$RPC" 2>/dev/null | tr '\n' ' ')"
echo "  effectiveRatioBps: $(call "$EM" 'effectiveRatioBps(address)(uint16)' "$ME")"

hr "1. Faucet (cooldown 1 jam — dilewati kalau belum habis)"
send "claim tUSDC" "$USDC" 'claim()' || echo "  · cooldown aktif, pakai saldo yang ada"
send "claim tWETH" "$WETH" 'claim()' || echo "  · cooldown aktif, pakai saldo yang ada"


hr "1b. Bersihkan utang run sebelumnya"
settle_debt || exit 1

# Saldo WAJIB dibaca SESUDAH settle_debt, bukan sebelumnya.
# Melunasi menghabiskan tUSDC, jadi angka yang dibaca lebih dulu menggambarkan
# dompet yang sudah tidak ada — dan `supply` berikutnya revert karena saldo
# kurang, dengan gejala yang terlihat seperti bug pasar.
USDC_BAL=$(call "$USDC" 'balanceOf(address)(uint256)' "$ME")
WETH_BAL=$(call "$WETH" 'balanceOf(address)(uint256)' "$ME")
COLL=$(call "$EM" 'collateralBalanceOf(address,address)(uint256)' "$ME" "$WETH")
echo "  saldo tUSDC      : $USDC_BAL"
echo "  saldo tWETH      : $WETH_BAL"
echo "  kolateral tWETH  : $COLL"

hr "2. Approve pasar (tak terbatas)"
send "approve tUSDC" "$USDC" 'approve(address,uint256)' "$EM" "$MAXU"
[ "$WETH_BAL" -gt 0 ] && send "approve tWETH" "$WETH" 'approve(address,uint256)' "$EM" "$MAXU"

hr "3. Supply likuiditas tUSDC"
SUPPLY=$((USDC_BAL / 2))
if [ "$SUPPLY" -gt 0 ]; then
  send "supply $SUPPLY" "$EM" 'supply(address,uint256)' "$USDC" "$SUPPLY"
else
  echo "  · saldo tUSDC nol, dilewati"
fi
echo "  supplyBalanceOf: $(call "$EM" 'supplyBalanceOf(address,address)(uint256)' "$ME" "$USDC")"

hr "4. Setor kolateral tWETH"
if [ "$WETH_BAL" -gt 0 ]; then
  send "depositCollateral $WETH_BAL" "$EM" 'depositCollateral(address,uint256)' "$WETH" "$WETH_BAL"
  COLL=$(call "$EM" 'collateralBalanceOf(address,address)(uint256)' "$ME" "$WETH")
elif [ "$COLL" -gt 0 ]; then
  echo "  · saldo dompet nol, tapi kolateral run sebelumnya masih ada"
else
  echo "  ✗ tidak ada kolateral dan faucet cooldown — tidak bisa meminjam"; exit 1
fi
echo "  collateralBalanceOf: $COLL"

hr "5. Pinjam tUSDC"
# Sengaja kecil. Tujuan smoke-test adalah membuktikan jalurnya hidup, bukan
# menguji batas kolateral — dan pinjaman besar membuat healthFactor mepet ke 1
# sehingga run berikutnya gagal karena posisi warisan, bukan karena bug.
BORROW=1000000000
send "borrow $BORROW" "$EM" 'borrow(address,uint256)' "$USDC" "$BORROW"
echo "  debtBalanceOf     : $(call "$EM" 'debtBalanceOf(address,address)(uint256)' "$ME" "$USDC")"
echo "  healthFactor      : $(call "$EM" 'healthFactor(address)(uint256)' "$ME")"
echo "  capitalSavedUsdWad: $(call "$EM" 'capitalSavedUsdWad(address)(uint256)' "$ME")"

hr "6. Lunasi PENUH"
settle_debt || exit 1

hr "LULUS — supply → kolateral → pinjam → lunas, utang nol"
