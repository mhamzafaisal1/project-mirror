import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  Renderer2,
  Inject,
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
import { MatSelectModule } from '@angular/material/select';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { BaseTableComponent } from '../components/base-table/base-table.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { FaultHistoryService } from '../services/fault-history.service';

@Component({
    selector: 'app-machine-fault-history',
    imports: [
        CommonModule,
        HttpClientModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
        BaseTableComponent,
        DateTimePickerComponent
    ],
    templateUrl: './machine-fault-history.component.html',
    styleUrls: ['./machine-fault-history.component.scss']
})
export class MachineFaultHistoryComponent implements OnInit, OnChanges, OnDestroy {
  @Input() startTime: string = '';
  @Input() endTime: string = '';
  @Input() serial: string = '';
  @Input() isModal: boolean = false;
  @Input() mode: 'standalone' | 'dashboard' = 'standalone';
  @Input() preloadedData?: any[]; // Either faultSummaries or faultCycles depending on viewType


  private _viewType: 'summary' | 'cycles' = 'summary';
  @Input()
  set viewType(val: 'summary' | 'cycles') {
    this._viewType = val;
    if (this.hasFetchedOnce) this.updateTable();
  }
  get viewType() {
    return this._viewType;
  }

  columns: string[] = [];
  rows: any[] = [];
  selectedRow: any | null = null;
  isDarkTheme: boolean = false;
  disableSorting = false;
  hasFetchedOnce = false;

  lastFetchedData: { faultCycles: any[]; faultSummaries: any[] } | null = null;
  lastParams: { startTime: string; endTime: string; serial: string } | null = null;
  private observer!: MutationObserver;

  constructor(
    private faultHistoryService: FaultHistoryService,
    private renderer: Renderer2,
    private elRef: ElementRef,
    @Inject(MAT_DIALOG_DATA) private data: any
  ) {
    if (data) {
      this.startTime = this.startTime || data.startTime || '';
      this.endTime = this.endTime || data.endTime || '';
      this.serial = this.serial || data.machineSerial || '';
    }
  }

  private handlePreloadedData(data: any) {
    this.lastFetchedData = {
      faultSummaries: this.viewType === 'summary' ? data : [],
      faultCycles: this.viewType === 'cycles' ? data : []
    };
    this.updateTable();
  }
  

  ngOnInit(): void {
    this.detectTheme();
    this.observeTheme();
  
    if (this.isModal && this.preloadedData) {
      this.handlePreloadedData(this.preloadedData);
    } else {
      this.checkAndFetch();
    }
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (this.isModal && changes['preloadedData']?.currentValue) {
      this.handlePreloadedData(changes['preloadedData'].currentValue);
    } else if (
      changes['startTime'] ||
      changes['endTime'] ||
      changes['serial'] ||
      changes['viewType']
    ) {
      this.checkAndFetch();
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

  private checkAndFetch() {
    const currentParams = {
      startTime: this.startTime,
      endTime: this.endTime,
      serial: this.serial
    };

    if (
      this.lastParams &&
      this.lastParams.startTime === currentParams.startTime &&
      this.lastParams.endTime === currentParams.endTime &&
      this.lastParams.serial === currentParams.serial
    ) {
      return; // prevent duplicate fetch
    }

    this.lastParams = currentParams;
    this.fetchData();
  }

  fetchData(): void {
    const serialNumber = parseInt(this.serial);
    if (isNaN(serialNumber)) return;

    this.faultHistoryService.getFaultHistory(this.startTime, this.endTime, serialNumber)
      .subscribe({
        next: (data) => {
          this.hasFetchedOnce = true;
          this.lastFetchedData = data;
          this.updateTable();
        },
        error: (error) => {
          console.error('Error fetching fault history:', error);
          this.rows = [];
          this.columns = [];
        }
      });
  }

  updateTable(): void {
    if (!this.lastFetchedData) return;

    if (this.viewType === 'summary') {
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
    } else {
      // Sort fault cycles by start time (latest first) for default sorting
      const sortedFaultCycles = (this.lastFetchedData.faultCycles || [])
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
      
      this.rows = sortedFaultCycles.map(cycle => ({
        'Fault Type': cycle.faultType,
        'Start Time': new Date(cycle.start).toLocaleString(),
        'Duration': `${Math.floor(cycle.duration / 3600000)}h ${Math.floor((cycle.duration % 3600000) / 60000)}m`
      }));
    }

    this.columns = this.rows.length > 0 ? Object.keys(this.rows[0]) : [];
  }

  onRowSelected(row: any): void {
    this.selectedRow = this.selectedRow === row ? null : row;
    setTimeout(() => {
      const element = document.querySelector('.mat-row.selected');
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
