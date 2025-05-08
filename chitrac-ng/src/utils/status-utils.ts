export function getStatusDotByCode(code: number | undefined | null): string {
    if (code === 1) return '🟢';       // Running
    if (code === 0) return '🟡';       // Paused
    if (typeof code === 'number' && code > 1) return '🔴'; // Faulted
    return '⚪'; // Offline/Unknown
  }
  