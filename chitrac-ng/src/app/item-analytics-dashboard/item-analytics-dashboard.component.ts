import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subject, takeUntil, tap } from 'rxjs';

import { BaseTableComponent } from '../components/base-table/base-table.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { ItemAnalyticsService } from '../services/item-analytics.service';
import { PollingService } from '../services/polling-service.service';

@Component({
    selector: 'app-item-analytics-dashboard',
    imports: [
        CommonModule,
        HttpClientModule,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatSlideToggleModule,
        BaseTableComponent,
        DateTimePickerComponent
    ],
    templateUrl: './item-analytics-dashboard.component.html',
    styleUrl: './item-analytics-dashboard.component.scss'
})
export class ItemAnalyticsDashboardComponent implements OnInit, OnDestroy {
  startTime = '';
  endTime = '';
  rows: any[] = [];
  columns: string[] = [];
  isDarkTheme: boolean = false;
  isLoading: boolean = false;
  liveMode: boolean = false;
  private observer!: MutationObserver;
  private pollingSubscription: any;
  private destroy$ = new Subject<void>();
  private readonly POLLING_INTERVAL = 6000; // 6 seconds

  constructor(
    private analyticsService: ItemAnalyticsService,
    private renderer: Renderer2,
    private elRef: ElementRef,
    private pollingService: PollingService
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    this.startTime = this.formatDateForInput(start);
    this.endTime = this.formatDateForInput(now);

    this.detectTheme();
    this.observer = new MutationObserver(() => this.detectTheme());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling();
  }

  detectTheme(): void {
    const isDark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = isDark;

    const element = this.elRef.nativeElement;
    this.renderer.setStyle(element, 'background-color', isDark ? '#121212' : '#ffffff');
    this.renderer.setStyle(element, 'color', isDark ? '#e0e0e0' : '#000000');
  }

  onLiveModeChange(checked: boolean): void {
    this.liveMode = checked;

    if (this.liveMode) {
      // Reset startTime to today at 00:00
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      this.startTime = this.formatDateForInput(start);

      // Reset endTime to now
      this.endTime = this.pollingService.updateEndTimestampToNow();

      // Initial data fetch
      this.fetchItemAnalytics();
      this.setupPolling();
    } else {
      this.stopPolling();
      this.rows = [];
    }
  }

  private setupPolling(): void {
    if (this.liveMode) {
      // Initial data fetch
      this.analyticsService.getItemAnalytics(this.startTime, this.endTime)
        .pipe(takeUntil(this.destroy$))
        .subscribe((data: any[]) => {
          this.updateTableData(data);
        });

      // Setup polling for subsequent updates
      this.pollingSubscription = this.pollingService.poll(
        () => {
          this.endTime = this.pollingService.updateEndTimestampToNow();
          return this.analyticsService.getItemAnalytics(this.startTime, this.endTime)
            .pipe(
              tap((data: any[]) => {
                this.updateTableData(data);
              })
            );
        },
        this.POLLING_INTERVAL,
        this.destroy$
      ).subscribe();
    }
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private updateTableData(data: any[]): void {
    this.rows = data.map(row => {
      const { hours = 0, minutes = 0 } = row.workedTimeFormatted || {};
      return {
        'Item Name': row.itemName,
        'Worked Time': `${hours}h ${minutes}m`,
        'Count': row.count,
        'PPH': row.pph,
        'Standard': row.standard,
        'Efficiency (%)': row.efficiency
      };
    });        
    this.columns = Object.keys(this.rows[0]);
  }

  fetchItemAnalytics(): void {
    if (!this.startTime || !this.endTime) return;

    this.isLoading = true;
    this.analyticsService.getItemAnalytics(this.startTime, this.endTime).subscribe({
      next: (data: any[]) => {
        this.updateTableData(data);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load item analytics', err);
        this.isLoading = false;
      }
    });
  }

  onDateChange(): void {
    if (this.liveMode) {
      this.liveMode = false;
      this.stopPolling();
    }
    this.rows = [];
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
