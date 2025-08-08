export function getStatusDotByCode(code: number | undefined | null): string {
    /*if (code === 1) return '🟢';       // Running
    if (code === 0) return '🟡';       // Paused
    if (typeof code === 'number' && code > 1) return '🔴'; // Faulted
    return '⚪'; // Offline/Unknown*/
    if (code === 1) return 'Running Dot';
    if (code === 0) return 'Paused Dot';
    if (typeof code === 'number' && code > 1) return 'Faulted Dot';
    return 'Offline Dot'
    }
  