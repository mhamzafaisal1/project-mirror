import { Component, OnInit, Input, OnDestroy, ElementRef, Renderer2, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

import { OperatorCountbyitemService } from '../services/operator-countbyitem.service';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { StackedBarChartV2Component, StackedBarChartV2Data } from '../components/stacked-bar-chart-v2/stacked-bar-chart-v2.component';

interface CountByItemData {
  hour: string;
  items: {
    [key: string]: number;
  };
}

@Component({
    selector: 'app-operator-countbyitem-chart',
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        DateTimePickerComponent,
        StackedBarChartV2Component
    ],
    templateUrl: './operator-countbyitem-chart.component.html',
    styleUrl: './operator-countbyitem-chart.component.scss'
})
export class OperatorCountbyitemChartComponent implements OnInit, OnDestroy, OnChanges {
  @Input() operatorId?: number;
  @Input() startTime: string = '';
  @Input() endTime: string = '';
  @Input() isModal: boolean = false;
  @Input() chartHeight: number = 400;
  @Input() chartWidth: number = 800;
  @Input() mode: 'standalone' | 'dashboard' = 'standalone';
  @Input() dashboardData?: any[];

  chartData: StackedBarChartV2Data | null = null;
  loading = false;
  error: string | null = null;
  isDarkTheme = false;
  private observer!: MutationObserver;

  constructor(
    private countByItemService: OperatorCountbyitemService,
    private renderer: Renderer2,
    private elRef: ElementRef
  ) {}

  ngOnInit() {
    this.detectTheme();
    this.observer = new MutationObserver(() => this.detectTheme());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if (this.mode === 'standalone' && this.isValidInput()) {
      this.fetchData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.mode === 'dashboard' && changes['dashboardData']?.currentValue) {
      this.processDashboardData(changes['dashboardData'].currentValue);
    } else if (this.mode === 'standalone' && 
              (changes['startTime']?.currentValue || changes['endTime']?.currentValue)) {
      this.fetchData();
    }
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private detectTheme() {
    const dark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = dark;
    const el = this.elRef.nativeElement;
  }

  isValidInput(): boolean {
    return !!this.operatorId && !!this.startTime && !!this.endTime;
  }

  private processDashboardData(data: any[]): void {
    this.loading = true;
    try {
      // Find the operator data from the dashboard data
      const operatorData = data.find(item => item.operator?.id === this.operatorId);
      if (!operatorData?.countByItem) {
        this.error = 'No count by item data available';
        return;
      }

      // The data is already in the correct format, just use it directly
      this.chartData = {
        title: `Operator ${operatorData.operator?.name || this.operatorId} - Count by Item`,
        data: operatorData.countByItem.data
      };
    } catch (error) {
      console.error('Error processing dashboard data:', error);
      this.error = 'Failed to process dashboard data';
    } finally {
      this.loading = false;
    }
  }

  private transformData(rawData: CountByItemData[]): StackedBarChartV2Data {
    const hours = rawData.map(d => {
      const date = new Date(d.hour);
      return date.getHours();
    });

    const items = new Set<string>();
    rawData.forEach(d => {
      Object.keys(d.items).forEach(item => items.add(item));
    });

    const operators: { [key: string]: number[] } = {};
    items.forEach(item => {
      operators[item] = rawData.map(d => d.items[item] || 0);
    });

    return {
      title: `Operator ${this.operatorId} - Count by Item`,
      data: {
        hours,
        operators
      }
    };
  }

  fetchData(): void {
    if (!this.isValidInput()) return;

    this.loading = true;
    this.error = null;

    this.countByItemService.getOperatorCountByItem(this.startTime, this.endTime, this.operatorId)
      .subscribe({
        next: (data) => {
          this.chartData = data;
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to fetch data. Please try again.';
          this.loading = false;
          console.error('Error fetching operator count by item data:', err);
        }
      });
  }

  onTimeRangeChange(): void {
    if (this.mode === 'standalone') {
      this.fetchData();
    }
  }
}
