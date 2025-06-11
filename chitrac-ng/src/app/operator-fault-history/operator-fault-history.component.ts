import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  Renderer2,
  Input,
  SimpleChanges,
  OnChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { BaseTableComponent } from '../components/base-table/base-table.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { OperatorFaultHistoryService } from '../services/operator-fault-history.service';

@Component({
    selector: 'app-operator-fault-history',
    imports: [
        CommonModule,
        HttpClientModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        BaseTableComponent,
        DateTimePickerComponent
    ],
    templateUrl: './operator-fault-history.component.html',
    styleUrls: ['./operator-fault-history.component.scss']
})
export class OperatorFaultHistoryComponent implements OnInit, OnDestroy, OnChanges {
  @Input() startTime: string = '';
  @Input() endTime: string = '';
  @Input() operatorId: string = '';
  @Input() isModal: boolean = false;
  @Input() mode: 'standalone' | 'dashboard' = 'standalone';
  @Input() dashboardData?: any[];

  columns: string[] = [];
  rows: any[] = [];
  selectedRow: any | null = null;
  isDarkTheme: boolean = false;
  hasFetchedOnce = false;
  error: string | null = null;

  lastFetchedData: { faultSummaries: any[] } | null = null;
  private observer!: MutationObserver;

  constructor(
    private operatorFaultHistoryService: OperatorFaultHistoryService,
    private renderer: Renderer2,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.detectTheme();
    this.observeTheme();

    if (this.mode === 'standalone' && this.isValidInput()) {
      this.fetchData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.mode === 'dashboard' && changes['dashboardData']?.currentValue) {
      this.processDashboardData(changes['dashboardData'].currentValue);
    } else if (this.mode === 'standalone' && 
              (changes['startTime'] || changes['endTime'] || changes['operatorId']) &&
              this.isValidInput()) {
      this.fetchData();
    }
  }

  ngOnDestroy() {
    if (this.observer) this.observer.disconnect();
  }

  private observeTheme() {
    this.observer = new MutationObserver(() => this.detectTheme());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  private detectTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = isDark;
    const el = this.elRef.nativeElement;
    this.renderer.setStyle(el, 'background-color', isDark ? '#121212' : '#ffffff');
    this.renderer.setStyle(el, 'color', isDark ? '#e0e0e0' : '#000000');
  }

  private isValidInput(): boolean {
    return !!this.startTime && !!this.endTime && !!this.operatorId;
  }

  private processDashboardData(data: any[]): void {
    try {
      const operatorData = data.find(item => item.operator?.id === parseInt(this.operatorId));
      if (!operatorData?.faultHistory) {
        this.error = 'No fault history data available';
        this.rows = [];
        this.columns = [];
        return;
      }

      this.lastFetchedData = operatorData.faultHistory;
      this.updateTable();
    } catch (error) {
      console.error('Error processing dashboard data:', error);
      this.error = 'Failed to process dashboard data';
      this.rows = [];
      this.columns = [];
    }
  }

  fetchData(): void {
    const operatorIdNum = parseInt(this.operatorId);
    if (isNaN(operatorIdNum)) {
      this.error = 'Invalid operator ID';
      this.rows = [];
      this.columns = [];
      return;
    }

    this.error = null;
    this.operatorFaultHistoryService.getOperatorFaultHistory(this.startTime, this.endTime, operatorIdNum)
      .subscribe({
        next: (data) => {
          this.hasFetchedOnce = true;
          this.lastFetchedData = data;
          this.updateTable();
        },
        error: (error) => {
          console.error('Error fetching operator fault history:', error);
          this.error = 'Failed to fetch fault history. Please try again.';
          this.rows = [];
          this.columns = [];
        }
      });
  }

  updateTable(): void {
    if (!this.lastFetchedData) return;

    this.rows = (this.lastFetchedData.faultSummaries || []).map(summary => {
      const totalSeconds = Math.floor(summary.totalDuration / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return {
        'Fault Type': summary.faultType,
        'Count': summary.count,
        'Total Duration': `${hours}h ${minutes}m ${seconds}s`
      };
    });

    this.columns = this.rows.length > 0 ? Object.keys(this.rows[0]) : [];
  }

  onRowSelected(row: any): void {
    this.selectedRow = this.selectedRow === row ? null : row;
    setTimeout(() => {
      const element = document.querySelector('.mat-row.selected');
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }
}
