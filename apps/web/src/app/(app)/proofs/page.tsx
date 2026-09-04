'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { Loader2, Sparkles } from 'lucide-react';
import { FactFilters } from '@/components/proofs/FactFilters';
import { FACT_COLUMNS, FactRow } from '@/components/proofs/FactRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatPill } from '@/components/shared/StatPill';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProveDialog } from '@/components/proofs/ProveDialog';
import { useFacts, useIndexerStatus } from '@/hooks/useApi';
import {
  filtersToQuery,
  filtersToSearch,
  hasAnyFilter,
  parseFilters,
  type FactFilterState,
} from '@/lib/facts-filter';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

function RowSkeletons({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-[64px] items-center gap-4 border-b border-border px-4">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-4 w-28" />
        </div>
      ))}
    </>
  );
}

function ProofsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isFullscreen, setFullscreen] = useState(false);
  const [proveOpen, setProveOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // URL adalah sumber kebenaran filter, bukan useState. Itu yang membuat hasil
  // yang tersaring bisa dibagikan sebagai satu tautan.
  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilters = useCallback(
    (next: FactFilterState) => {
      // replace, bukan push: mengubah filter bukan navigasi baru, dan tombol
      // back seharusnya membawa pengguna keluar dari /proofs.
      router.replace(`${pathname}${filtersToSearch(next)}` as Route, { scroll: false });
    },
    [router, pathname],
  );

  const query = useMemo(() => filtersToQuery(filters, PAGE_SIZE), [filters]);
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFacts(query);
  const status = useIndexerStatus();

  // Muat halaman berikutnya begitu ujung daftar terlihat, alih-alih menunggu
  // tombol ditekan. `root` adalah kotak yang men-scroll, bukan viewport —
  // halamannya sendiri memang tidak ikut bergerak.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (sentinel === null || root === null || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting === true) void fetchNextPage();
      },
      { root, rootMargin: '240px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, data]);

  // Roda mouse di MANA PUN menggerakkan daftar, bukan hanya saat kursor
  // kebetulan berada di atas tabel.
  //
  // Halaman ini sengaja tidak bisa di-scroll, jadi tanpa penerusan ini roda
  // mouse di area judul atau bar filter tidak melakukan apa-apa — dan
  // "scroll saya tidak berfungsi" adalah kesimpulan yang wajar diambil
  // pengguna sebelum ia menyadari harus mengarahkan kursor lebih ke bawah.
  useEffect(() => {
    const root = scrollRef.current;
    if (root === null) return;

    function onWheel(e: WheelEvent) {
      const target = e.target as Node | null;
      // Kursor sudah di dalam daftar: biarkan browser yang menanganinya,
      // supaya momentum dan batas atas/bawah tetap terasa alami.
      if (target !== null && root !== null && root.contains(target)) return;
      if (root !== null) root.scrollTop += e.deltaY;
    }

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // Filter yang berubah menghasilkan daftar yang sama sekali lain; membiarkan
  // posisi scroll lama berarti pengguna mendarat di tengah hasil baru.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [filters]);

  const facts = data?.pages.flatMap((p) => p.data) ?? [];
  const filtered = hasAnyFilter(filters);

  return (
    <div
      className={cn(
        'flex h-full flex-col',
        isFullscreen ? 'px-8 pb-4 pt-2 md:px-12' : 'mx-auto w-full max-w-[1280px] px-6 py-8 md:px-8',
      )}
    >
      {/* Mode fokus menyembunyikan judul dan deskripsi, bukan membuka fullscreen
          browser: yang ingin dilihat lebih banyak adalah barisnya, dan keluar
          dari mode ini harus semudah satu klik yang sama. */}
      {!isFullscreen && (
        <PageHeader
          title="Proofs"
          description="Every row is a real Ethereum mainnet transaction, cryptographically proven through Attestcoin and recorded permanently on Creditcoin."
          aside={
            <div className="flex items-center gap-3">
              <StatPill
                label="Recorded 24h"
                value={status.data ? String(status.data.queue.recorded24h) : null}
                isLoading={status.isPending}
              />
              {/* Di header, bukan sebagai kartu di dalam halaman: /proofs
                  sengaja setinggi viewport dan tidak bisa di-scroll, jadi apa
                  pun yang ditambahkan ke badannya memakan tinggi daftar. */}
              <Button variant="secondary" onClick={() => setProveOpen(true)}>
                <Sparkles size={15} strokeWidth={1.75} />
                Prove a transaction
              </Button>
            </div>
          }
        />
      )}

      <ProveDialog open={proveOpen} onClose={() => setProveOpen(false)} />

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <FactFilters
          value={filters}
          onChange={setFilters}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setFullscreen((v) => !v)}
        />

        <div
          className={`hidden h-11 shrink-0 ${FACT_COLUMNS} items-center gap-4 border-b border-border px-4 text-small text-ink-500 md:grid`}
        >
          {/* Tiga kolom kiri mengikuti perataan isinya; Amount dan Observed
              rata tengah. Keduanya kolom sempit dengan isi rata kanan, dan
              judul yang ikut menempel ke kanan tampak terlempar menjauh dari
              kolomnya sendiri. */}
          <span>Protocol</span>
          <span>Kind</span>
          <span>Subject</span>
          <span className="text-center">Amount</span>
          <span className="text-center">Observed</span>
          <span />
        </div>

        {/* Yang bergerak hanya daftarnya; halaman dan header kolom diam. */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {isError ? (
            <div className="p-6">
              <ErrorState error={error} onRetry={() => void refetch()} />
            </div>
          ) : isPending ? (
            <RowSkeletons />
          ) : facts.length === 0 ? (
            <div className="p-6">
              {filtered ? (
                <EmptyState
                  title="No facts match these filters"
                  description="Try a different kind or protocol, or clear the filters to see everything."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setFilters({})}>
                      Reset filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="No facts recorded yet"
                  description="The indexer is waiting for its first fact. Attestation runs roughly every 8 minutes."
                />
              )}
            </div>
          ) : (
            <>
              {facts.map((fact) => (
                <FactRow key={`${fact.factId}-${fact.logIndex}`} fact={fact} />
              ))}
              <div ref={sentinelRef} aria-hidden="true" />
              {isFetchingNextPage && (
                <div className="flex h-14 items-center justify-center gap-2 text-small text-ink-400">
                  <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                  Loading more
                </div>
              )}
              {!hasNextPage && (
                <p className="py-5 text-center text-small text-ink-400">
                  End of results · {facts.length} facts
                </p>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function ProofsPage() {
  return (
    <main className="h-full">
      {/* useSearchParams menangguhkan render sampai URL diketahui di klien.
          Tanpa batas Suspense, seluruh rute terpaksa dirender dinamis. */}
      <Suspense fallback={<Skeleton className="m-8 h-[32rem]" />}>
        <ProofsContent />
      </Suspense>
    </main>
  );
}
