import { Badge } from '@/components/ui/badge';
import { FactKind } from '@/types';

const LABEL: Record<FactKind, string> = {
  [FactKind.LoanOriginated]: 'Borrowed',
  [FactKind.LoanRepaid]: 'Repaid',
  [FactKind.Liquidated]: 'Liquidated',
  [FactKind.CollateralSupplied]: 'Supplied',
  [FactKind.CollateralWithdrawn]: 'Withdrawn',
};

/**
 * Satu warna per kind, dipilih dari APA YANG DIA LAKUKAN pada kewajiban dompet
 * — bukan sekadar supaya berbeda:
 *
 *   Borrowed    kewajiban DIBUKA         → amber, "masih berjalan"
 *   Repaid      kewajiban DITUTUP        → hijau, sinyal kredit terkuat
 *   Liquidated  kewajiban GAGAL          → merah, satu-satunya yang menurunkan skor
 *   Supplied    posisi DIPERKUAT         → biru aksen, kolateral masuk
 *   Withdrawn   posisi DILEMAHKAN        → netral, kolateral keluar, tanpa penilaian
 *
 * Amber untuk Borrowed bukan peringatan bahaya — meminjam itu aktivitas biasa,
 * dan merah tetap dipesan untuk likuidasi. Ia menandai posisi yang belum
 * selesai, lawan dari hijau Repaid yang berarti sudah selesai.
 *
 * Teal `verified` sengaja TIDAK dipakai di sini. Ia milik klaim proof; sebuah
 * kind bukan klaim bahwa sesuatu terbukti — dan karena lencana proof tetap
 * lembut sementara kind berisi, keduanya kini berbeda bobot, bukan cuma hue.
 */
const TONE = {
  [FactKind.LoanOriginated]: 'solidWarning',
  [FactKind.LoanRepaid]: 'solidPositive',
  [FactKind.Liquidated]: 'solidDanger',
  [FactKind.CollateralSupplied]: 'solidAccent',
  [FactKind.CollateralWithdrawn]: 'solidNeutral',
} as const satisfies Record<FactKind, string>;

export function factKindLabel(kind: FactKind): string {
  return LABEL[kind] ?? 'Unknown';
}

export function FactKindBadge({ kind }: { kind: FactKind }) {
  return <Badge tone={TONE[kind] ?? 'neutral'}>{factKindLabel(kind)}</Badge>;
}
