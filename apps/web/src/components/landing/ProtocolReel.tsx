'use client';

import { useIndexerStatus } from '@/hooks/useApi';
import { formatCount } from '@/lib/format';

/** Nama kelas keyframe unik untuk menghindari tabrakan dengan animasi lain di halaman. */
const MARQUEE_KEYFRAMES_CLASS = 'protocol-reel-track';

/**
 * Durasi proporsional jumlah item, minimal 30 detik — pita yang terlalu cepat
 * tidak terbaca. 6 detik per item adalah kompromi: cukup lambat untuk dibaca,
 * tidak membuat penonton bosan menunggu satu putaran penuh.
 */
function marqueeDurationSeconds(itemCount: number): number {
  return Math.max(30, itemCount * 6);
}

function SkeletonReel() {
  return (
    <div className="mt-10 overflow-hidden">
      <div className="flex gap-16 pl-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex shrink-0 flex-col gap-2">
            <div className="h-9 w-40 animate-pulse rounded-card bg-border" />
            <div className="h-4 w-24 animate-pulse rounded-card bg-border" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Pita berjalan berisi protokol yang benar-benar diindeks.
 *
 * `lastScannedBlock` ditulis di bawah nama tiap protokol untuk membuktikan
 * pita ini hidup — bukan daftar logo hiasan yang bisa disalin dari mana pun.
 */
export function ProtocolReel() {
  const { data, isPending, isError } = useIndexerStatus();

  if (isPending) {
    return (
      <section className="pt-[clamp(48px,6vw,96px)]">
        <div className="mkt-container">
          <h2 className="text-center font-display text-mkt-h3 text-ink-900">
            Indexed from Ethereum mainnet, block by block
          </h2>
        </div>
        <SkeletonReel />
      </section>
    );
  }

  // Pita kosong lebih buruk daripada tidak ada pita — jangan render section-nya.
  if (isError || data === undefined || data.cursors.length === 0) {
    return null;
  }

  const cursors = data.cursors;
  const duration = marqueeDurationSeconds(cursors.length);

  return (
    <section className="pt-[clamp(48px,6vw,96px)]">
      <div className="mkt-container">
        <h2 className="text-center font-display text-mkt-h3 text-ink-900">
          Indexed from Ethereum mainnet, block by block
        </h2>
      </div>

      <div className="mt-10 overflow-hidden">
        <div
          className={`flex w-max gap-16 pl-6 ${MARQUEE_KEYFRAMES_CLASS}`}
          style={{ animationDuration: `${duration}s` }}
        >
          {/* Daftar digandakan sekali agar transform -50% menyambung mulus tanpa jeda. */}
          {[...cursors, ...cursors].map((c, i) => (
            <div key={`${c.protocol}-${i}`} className="flex shrink-0 flex-col gap-1">
              <span className="text-mkt-h3 text-ink-900">{c.protocolName}</span>
              <span className="num text-small text-ink-500">
                block {formatCount(c.lastScannedBlock)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/*
        `<style>` biasa (bukan styled-jsx) karena ini komponen App Router tanpa
        babel plugin styled-jsx aktif — keyframes global dengan nama unik
        (di-namespace lewat MARQUEE_KEYFRAMES_CLASS) cukup untuk satu marquee
        dan tidak butuh dependensi tambahan. `prefers-reduced-motion` mematikan
        animasi lewat CSS murni supaya tidak butuh deteksi di JS untuk kasus ini.
      */}
      <style>{`
        @keyframes protocol-reel-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .${MARQUEE_KEYFRAMES_CLASS} {
          animation-name: protocol-reel-scroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .${MARQUEE_KEYFRAMES_CLASS} {
            animation: none;
            overflow-x: auto;
          }
        }
      `}</style>
    </section>
  );
}
