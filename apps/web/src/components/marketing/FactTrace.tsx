'use client';

import { ArrowUpRight } from 'lucide-react';
import { FactKind } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useFact, useFacts } from '@/hooks/useApi';
import { creditcoinTx, etherscanBlock, etherscanTx } from '@/lib/explorer';
import { formatCount, formatTokenAmount, formatUsd, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';
import { SectionIntro } from './SectionIntro';

/**
 * Perjalanan SATU fakta, dari transaksi Ethereum sampai poin skor.
 *
 * Ini bagian yang paling berat membawa argumen produk, dan alasannya bukan
 * desain: dua dari empat kartunya adalah tautan keluar ke explorer pihak
 * ketiga. Pengunjung bisa memverifikasi klaim kami **tanpa mempercayai kami** —
 * sesuatu yang tidak bisa dilakukan halaman mana pun yang hanya menampilkan
 * angka miliknya sendiri.
 *
 * Faktanya diambil hidup, bukan ditulis di kode. Yang dipilih adalah pelunasan
 * (`LoanRepaid`) terbaru: itu sinyal kredit terkuat, dan kartu keempat bicara
 * tentang poin skor yang hanya diberikan oleh pelunasan.
 */
export function FactTrace() {
  // Satu pelunasan terbaru. `limit: 1` — halaman ini tidak butuh daftar,
  // dan meminta lebih berarti membayar transfer yang langsung dibuang.
  const list = useFacts({ kind: FactKind.LoanRepaid, limit: 1 });
  const head = list.data?.pages[0]?.data?.[0];

  // Info proof (ukuran batch, jam saat dibuktikan) hanya ada di endpoint
  // detail, jadi ia diminta menyusul setelah factId diketahui.
  const detail = useFact(head?.factId);

  const isPending = list.isPending || (head !== undefined && detail.isPending);
  const failed = list.isError || detail.isError || (!list.isPending && head === undefined);

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-24 md:px-8 md:py-32">
      <SectionIntro label="SATU FAKTA, UJUNG KE UJUNG" onPanel>
        Ambil satu pelunasan nyata di Ethereum dan ikuti sampai ia jadi poin skor. Dua langkah di
        tengah bisa kamu periksa sendiri di explorer.
      </SectionIntro>

      {isPending ? (
        <div className="mt-14 grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-[var(--radius-card)] bg-panel-raised" />
          ))}
        </div>
      ) : failed || head === undefined ? (
        <Unavailable onRetry={() => void list.refetch()} />
      ) : (
        <div className="mt-14 grid gap-4 md:grid-cols-4">
          <Step
            index={1}
            title="Pelunasan di Ethereum"
            delay={0}
            href={etherscanTx(head.txHash)}
            hrefLabel="Lihat di Etherscan"
          >
            <Figure
              value={`${formatTokenAmount(head.amount, head.assetDecimals)} ${head.assetSymbol}`}
              note={
                head.amountUsd === null
                  ? head.protocolName
                  : `${formatUsd(head.amountUsd)} · ${head.protocolName}`
              }
            />
            <p className="mt-4 text-small text-panel-ink-500">
              Dompet {shortenAddress(head.subject)} menutup kewajibannya. Kami tidak menerbitkan
              peristiwa ini — kami mengamatinya.
            </p>
          </Step>

          <Step
            index={2}
            title="Blok itu di-attest"
            delay={0.07}
            href={etherscanBlock(head.blockHeight)}
            hrefLabel="Lihat bloknya"
          >
            <Figure value={formatCount(head.blockHeight)} note="blok Ethereum" />
            <p className="mt-4 text-small text-panel-ink-500">
              Jaringan Attestcoin menyepakati blok ini lebih dulu. Sebelum itu, tidak ada yang bisa
              dibuktikan tentangnya.
            </p>
          </Step>

          <Step
            index={3}
            title="Proof dibangun dan dikirim"
            delay={0.14}
            href={creditcoinTx(head.creditcoinTxHash)}
            hrefLabel="Lihat di Blockscout"
          >
            {detail.data === undefined ? (
              <Figure value="–" note="menunggu detail proof" />
            ) : (
              <Figure
                value={`${detail.data.proof.batchSize} tx`}
                note={`satu batch · dibuktikan ${detail.data.proof.provedWithinHours} jam setelah transaksi`}
              />
            )}
            <p className="mt-4 text-small text-panel-ink-500">
              Batch dibayar sekali untuk beberapa transaksi sekaligus. Membuktikan di bawah 24 jam
              sepuluh kali lebih murah daripada belakangan.
            </p>
          </Step>

          <Step index={4} title="Menjadi poin skor" delay={0.21}>
            {/* Dua komponen, bukan tanda "+". Sebuah pelunasan menaikkan
                `repaymentVolume` DAN `repaymentCount` sekaligus, dan
                menyebut keduanya jauh lebih informatif daripada isyarat
                bahwa "sesuatu naik". */}
            <Figure value="2 komponen" note="volume dan jumlah pelunasan" verified />
            <p className="mt-4 text-small text-panel-ink-500">
              CreditGraph menaikkan kedua komponen pelunasan dompet ini, dan EfficiencyMarket
              menurunkan kolateral yang harus ia kunci. Tanpa penilai manusia di antaranya.
            </p>
          </Step>
        </div>
      )}
    </div>
  );
}

function Step({
  index,
  title,
  children,
  delay,
  href,
  hrefLabel,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
  delay: number;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="flex h-full flex-col rounded-[var(--radius-card)] bg-panel-raised p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-body font-medium text-panel-ink-900">{title}</h3>
          <span className="num text-small text-panel-ink-500">0{index}</span>
        </div>

        <div className="mt-6 flex-1">{children}</div>

        {href !== undefined && hrefLabel !== undefined && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            // Teal, bukan biru: ini tautan yang MEMBUKTIKAN sesuatu, dan itu
            // satu-satunya hal yang teal boleh tandai di produk ini.
            className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-small font-medium text-verified hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {hrefLabel}
            <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
          </a>
        )}
      </div>
    </Reveal>
  );
}

function Figure({
  value,
  note,
  verified = false,
}: {
  value: string;
  note: string;
  verified?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          'num font-display text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-none tracking-[-0.02em]',
          verified ? 'text-verified' : 'text-panel-ink-900',
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-small text-panel-ink-500">{note}</p>
    </div>
  );
}

function Unavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-14 rounded-[var(--radius-card)] bg-panel-raised p-10">
      <p className="font-display text-mkt-statement font-medium text-panel-ink-900">
        Jejak fakta sedang tidak bisa diambil.
      </p>
      <p className="mt-3 max-w-lg text-body text-panel-ink-500">
        Seluruh isi bagian ini datang dari satu transaksi nyata. Kami memilih tidak menampilkan
        contoh daripada menampilkan sesuatu yang tidak bisa kamu periksa.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 min-h-11 rounded-full border border-panel-border px-5 text-body font-medium text-panel-ink-900 transition-colors hover:border-panel-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Coba lagi
      </button>
    </div>
  );
}
