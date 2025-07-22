// polling.service.ts
import { Injectable } from '@angular/core';
import { Observable, timer, Subject, BehaviorSubject } from 'rxjs';
import { switchMap, filter, takeUntil, tap, concatMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PollingService {
  private modalOpen$ = new BehaviorSubject<boolean>(false);

  setModalOpen(isOpen: boolean) {
    this.modalOpen$.next(isOpen);
  }

  poll<T>(
    pollFn: () => Observable<T>,
    intervalMs: number,
    stop$: Observable<any>,
    isModal: boolean = false,
    immediate: boolean = true // ← new param
  ): Observable<T> {
    const source$ = isModal ? this.modalOpen$ : new BehaviorSubject(true);
  
    return source$.pipe(
      filter(isActive => isActive),
      switchMap(() =>
        timer(immediate ? 0 : intervalMs, intervalMs).pipe( // ✅ toggle first emission
          takeUntil(stop$),
          concatMap(() => pollFn())
        )
      )
    );
  }
  

  // Utility method to update end timestamp to now
  updateEndTimestampToNow(): string {
    const now = new Date();
    return this.formatDateForInput(now);
  }

  private formatDateForInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  }
}
