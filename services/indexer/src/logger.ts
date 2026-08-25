import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: null, // buang pid/hostname; field yang berguna ditambahkan per-tahap
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Stage = 'watcher' | 'attestation-waiter' | 'prover' | 'submitter' | 'prices';

/** Logger anak dengan field `stage` terpasang (docs/indexer.md §12.1). */
export function stageLogger(stage: Stage) {
  return logger.child({ stage });
}
