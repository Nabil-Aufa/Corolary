"use client";

import { useIndexerStatus } from "@/hooks/useApi";
import { formatCount } from "@/lib/format";
import { etherscanAddress } from "@/lib/explorer";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "./Reveal";

/**
 * Pengganti "logo wall": cakupan protokol adalah pembeda produk ini, bukan
 * dekorasi. Setiap kolom tertaut ke Etherscan si pemancar event, bukan ke
 * halaman marketing protokolnya — supaya klaim "dibaca dari mainnet" bisa
 * langsung diverifikasi orang yang skeptis.
 */
export function CoverageBand() {
  const { data, isPending, isError, refetch } = useIndexerStatus();

  const cursors = data?.cursors ?? [];
  const showEmpty = !isPending && (isError || cursors.length === 0);
  /* Diambil dari cursor, BUKAN dari `latestEthereumBlock`. Yang ingin
     dinyatakan adalah "sudah kami baca sampai sini", dan itu posisi cursor —
     head chain selalu di depannya. Menyebut head sebagai "terpindai" adalah
     klaim cakupan yang belum tentu benar. */
  const headBlock = cursors.reduce(
    (max, c) => Math.max(max, c.lastScannedBlock),
    0,
  );

  return (
    <section className="mx-auto max-w-[1280px] px-6 py-24 md:px-8 md:py-32">
      <Reveal as="div" distance={16}>
        <h2 className="text-center font-display text-mkt-h2 text-ink-900">
          Dibaca dari empat protokol nyata di Ethereum mainnet
        </h2>
      </Reveal>

      <div className="mt-12">
        {showEmpty ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-body text-ink-500">
              Data cakupan protokol sedang tidak bisa diambil.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-small text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {isPending
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 text-center"
                  >
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))
              : cursors.map((cursor, i) => (
                  <Reveal
                    key={cursor.protocol}
                    delay={i * 0.06}
                    className="flex flex-col items-center gap-2 text-center"
                  >
                    <a
                      href={etherscanAddress(cursor.protocol)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-body text-ink-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {cursor.protocolName}
                    </a>
                  </Reveal>
                ))}
          </div>
        )}
      </div>

      <div className={cn("mt-10 border-t border-border pt-6 text-center")}>
        {/* Cursor keempat protokol berjalan bersama, jadi angkanya memang
            identik. Diulang empat kali, data yang benar justru terbaca seperti
            placeholder yang lupa diganti — jadi ia dinyatakan sekali di sini,
            di mana ia sekaligus berarti "keempatnya sama-sama mutakhir". */}
        {headBlock > 0 && (
          <p className="text-small text-ink-500">
            Keempatnya terpindai sampai blok{" "}
            <span className="num text-ink-900">{formatCount(headBlock)}</span>{" "}
            di Ethereum mainnet.
          </p>
        )}
        <p className="mt-2 text-small text-ink-500">
          Tiap protokol menyumbang bobot yang sama persis pada skor — 25 dari
          100 poin keragaman, tidak lebih besar untuk protokol yang lebih ramai.
        </p>
      </div>
    </section>
  );
}
