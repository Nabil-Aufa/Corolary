'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, RotateCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Segments } from '@/components/ui/segments';
import { useBackfillStatus, useStartBackfill } from '@/hooks/useApi';
import { queryKeys } from '@/lib/api/query-keys';
import { formatCount } from '@/lib/format';
import type { Address, BackfillJob } from '@/types';

/**
 * Kedalaman yang ditawarkan, dalam bulan.
 *
 * Bukan slider bebas. `historyDuration` memakai half-saturation
 * `saturating(days, 365, 200)`, jadi 12 bulan hanya menambah ~34 poin di atas
 * 6 bulan sementara biayanya naik sebanding jumlah transaksi yang ditemukan —
 * tiap transaksi dibuktikan pada tarif lazy 3,13x10^-4 CTC. Tiga pilihan
 * membuat pertukaran itu terlihat; slider menyembunyikannya di balik gerakan
 * yang terasa gratis. 24 adalah batas API.
 */
const DEPTHS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: '24', label: '24 months' },
] as const;

type Depth = (typeof DEPTHS)[number]['value'];

/**
 * Perkiraan lama MEMBACA saja, dalam menit.
 *
 * Jangkarnya satu pengukuran: pemindaian 12 bulan x 4 protokol adalah ~2.100
 * panggilan RPC dan ~20 menit (docs/indexer.md). Jumlah panggilan sebanding
 * lebar rentang blok, jadi sisanya diskalakan dari sana, bukan ditebak.
 */
const READ_MINUTES: Record<Depth, number> = { '6': 10, '12': 20, '24': 40 };

interface BackfillPanelProps {
  address: Address;
  /**
   * Jumlah fakta yang SUDAH terindeks untuk dompet ini (`factCount` dari
   * /v1/score). Wajib, dan bukan sekadar hiasan: tabel `jobs` bukan sumber
   * kebenaran untuk "sudah terindeks atau belum". Riwayat bisa masuk lewat
   * CLI indexer tanpa pernah melewati antrean job — itu yang terjadi pada
   * dompet demo, yang punya 277 fakta terbukti dan NOL baris job.
   */
  indexedFacts: number;
}

export function BackfillPanel({ address, indexedFacts }: BackfillPanelProps) {
  const job = useBackfillStatus(address);
  const start = useStartBackfill(address);
  const [depth, setDepth] = useState<Depth>('6');
  const queryClient = useQueryClient();

  // Skor dan daftar fakta baru berubah SETELAH pemindaian berakhir, dan tidak
  // ada satu pun peristiwa lain yang memberi tahu halaman ini. Transisi
  // running -> selesai adalah sinyalnya; tanpa ini, dial tetap menampilkan skor
  // sebelum pemindaian sampai seseorang me-reload.
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    const status = job.data?.status;
    const was = previous.current;
    previous.current = status;
    if (was === undefined || status === undefined) return;
    if ((was === 'running' || was === 'pending') && status !== 'running' && status !== 'pending') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.score(address) });
      void queryClient.invalidateQueries({ queryKey: ['api', 'facts'] });
    }
  }, [job.data?.status, address, queryClient]);

  const active = job.data?.status === 'pending' || job.data?.status === 'running';

  return (
    <Card>
      <CardBody>
        <p className="text-micro uppercase tracking-wide text-ink-400">Mainnet history</p>

        {active ? (
          <Running job={job.data as BackfillJob} />
        ) : (
          <>
            <Result job={job.data ?? null} indexedFacts={indexedFacts} />

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Segments
                value={depth}
                onChange={(v) => setDepth(v)}
                options={DEPTHS}
                className="shrink-0"
              />
              <Button
                onClick={() => start.mutate(Number(depth))}
                disabled={start.isPending}
                className="ml-auto"
              >
                {job.data === null || job.data === undefined ? (
                  <>
                    <Search size={15} strokeWidth={1.75} />
                    Scan history
                  </>
                ) : (
                  <>
                    <RotateCw size={15} strokeWidth={1.75} />
                    Scan again
                  </>
                )}
              </Button>
            </div>

            {start.isError && (
              <p className="mt-3 text-small text-danger" role="alert">
                {start.error instanceof Error ? start.error.message : 'Could not queue the scan.'}
              </p>
            )}

            {/* Cukup berapa lama, untuk kedalaman yang BENAR-BENAR dipilih.
                Sebelumnya satu kalimat statis menyebut "a deep scan" sekitar 20
                menit, padahal 20 menit itu angka 12 bulan (docs/indexer.md:
                ~2.100 panggilan RPC), sementara pilihan terdalam di sini 24
                bulan. Panggilan RPC sebanding lebar rentang blok, jadi menitnya
                ikut skala bulannya.

                Kalimat kedua ada karena angka pertama saja menyesatkan: itu
                lama MEMBACA. Membuktikan hasilnya ke CC3 terpisah dan
                bergantung pada seberapa ramai dompetnya — satu dompet aktif
                pernah memunculkan 1.277 transaksi hanya dari 10% pertama
                rentang 24 bulan. */}
            <p className="mt-4 text-micro text-ink-400">
              Reading <span className="num">{depth}</span> months takes around{' '}
              <span className="num">{READ_MINUTES[depth]}</span> minutes. Proving what it finds
              takes longer again on a busy wallet.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Running({ job }: { job: BackfillJob }) {
  return (
    <>
      <p className="mt-2 flex items-center gap-2 text-body text-ink-900">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        {job.status === 'pending' ? 'Queued' : 'Scanning'} · {job.months} months
      </p>
      {job.postponedReason === null ? (
        <p className="mt-2 text-small text-ink-500">
          The indexer is reading mainnet logs for this wallet and proving what it finds. This page
          updates itself when the scan ends, around 20 minutes for a deep scan.
        </p>
      ) : (
        // `pending` yang tidak bergerak tak terbedakan dari `pending` yang baru
        // diantre — sama-sama diam. Menjelaskannya di sini adalah satu-satunya
        // hal yang membedakan "sebentar lagi" dari "ditahan sampai backlog
        // reda", dan tanpa itu satu-satunya gejala adalah waktu.
        <p className="mt-2 text-small text-ink-500">
          Held back while the indexer catches up on its proving backlog. The scan starts on its
          own once that clears. Reported reason:{' '}
          <span className="text-ink-900">{job.postponedReason}</span>
        </p>
      )}
      {job.attempts > 1 && (
        <p className="mt-2 text-small text-ink-400">
          Attempt <span className="num">{job.attempts}</span>. An earlier attempt failed and was
          retried.
        </p>
      )}
    </>
  );
}

function Result({ job, indexedFacts }: { job: BackfillJob | null; indexedFacts: number }) {
  // Tidak ada baris job BUKAN berarti tidak ada yang terindeks. Riwayat bisa
  // masuk lewat CLI indexer tanpa melewati antrean job sama sekali, dan dompet
  // demo persis begitu: 277 fakta terbukti, nol job. Kalimat lama mengatakan
  // "nothing has been indexed for it yet" di halaman yang tepat di atasnya
  // menampilkan skor 818 dari fakta-fakta itu.
  if (job === null) {
    return indexedFacts > 0 ? (
      <p className="mt-2 text-body text-ink-500">
        <span className="num text-ink-900">{formatCount(indexedFacts)}</span> facts are already
        indexed for this wallet, read outside this panel. Scanning here can still reach further
        back than whatever window they came from.
      </p>
    ) : (
      <p className="mt-2 text-body text-ink-500">
        Nothing has been indexed for this wallet yet, which is not the same as having no history on
        mainnet. Nobody has looked.
      </p>
    );
  }

  switch (job.status) {
    case 'complete': {
      // Nol butuh kalimatnya sendiri. Percabangan lama hanya memeriksa `null`,
      // jadi dompet tanpa riwayat membaca "0 matching events were found, some
      // of which may already have been indexed before this scan" — anak
      // kalimat yang tidak berarti apa-apa pada nol, dan tidak pernah
      // mengatakan terus terang bahwa memang tidak ada apa-apa di sana.
      const nothing = job.logsFound === 0;
      return (
        <p className="mt-2 flex items-start gap-2 text-body text-ink-500">
          <Check size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-verified" />
          <span>
            Scanned <span className="num text-ink-900">{job.months}</span> months.{' '}
            {job.logsFound === null ? (
              'The scan finished.'
            ) : nothing ? (
              <>
                No lending activity on Aave, Morpho, Spark or Compound in that window. A deeper
                scan can look further back, but this wallet may simply have no history to prove.
              </>
            ) : (
              <>
                <span className="num text-ink-900">{formatCount(job.logsFound)}</span> matching
                events were found, some of which may already have been indexed before this scan.
              </>
            )}
          </span>
        </p>
      );
    }

    case 'covered':
      return (
        <p className="mt-2 text-body text-ink-500">
          Already scanned to <span className="num text-ink-900">{job.months}</span> months across
          every protocol. Scanning again at the same depth would find nothing new, so pick a deeper
          window instead.
        </p>
      );

    case 'partial':
      return (
        <p className="mt-2 flex items-start gap-2 text-body text-ink-500">
          <AlertTriangle size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-warning" />
          <span>
            The scan finished with{' '}
            <span className="num text-ink-900">{formatCount(job.failedRanges ?? 0)}</span> block
            ranges it could not read. The history has gaps, so the score below is a floor, not a
            final answer. Scanning again retries them.
          </span>
        </p>
      );

    case 'failed':
      return (
        <p className="mt-2 flex items-start gap-2 text-body text-ink-500">
          <AlertTriangle size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-danger" />
          <span>
            The last scan failed{job.lastError === null ? '.' : `: ${job.lastError}`}
          </span>
        </p>
      );

    default:
      return null;
  }
}
