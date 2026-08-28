'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { humanMessage } from '@/lib/api/errors';

/**
 * Ditampilkan saat data TIDAK bisa diambil. Sengaja mencolok: aturan nol-mock
 * berarti kegagalan harus terlihat sebagai kegagalan, bukan diam-diam diganti
 * angka lama yang masih terlihat masuk akal.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-danger/30 bg-danger-soft px-6 py-12 text-center">
      <AlertCircle size={20} strokeWidth={1.5} className="text-danger" />
      <p className="text-body text-ink-900">{humanMessage(error)}</p>
      {onRetry !== undefined && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
