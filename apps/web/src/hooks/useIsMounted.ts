'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * `false` di server dan pada render hydration pertama, `true` setelahnya.
 *
 * Dipakai untuk apa pun yang hanya diketahui di klien — tema aktif, wallet yang
 * tersambung. Pola `useState + useEffect(setState(true))` melakukan hal yang
 * sama tapi memicu render kedua dan ditandai `react-hooks/set-state-in-effect`;
 * useSyncExternalStore memang dirancang untuk kasus ini.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
