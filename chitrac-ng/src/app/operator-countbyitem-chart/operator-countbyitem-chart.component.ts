import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Inject, Optional } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';

import { OperatorCountbyitemService } from '../services/operator-countbyitem.service';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { StackedBarChartComponent } from '../components/stacked-bar-chart/stacked-bar-chart.component';

interface CountByItemData {
  hour: string;
  items: {
    [key: string]: number;
  };
}

interface StackedBarChartData {
  title: string;
  data: {
    hours: number[];
    operators: {
      [key: string]: number[];
    };
  };
}

@Component({
  selector: 'app-operator-countbyitem-chart',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    DateTimePickerComponent, 
    StackedBarChartComponent,
    MatDialogModule
  ],
  templateUrl: './operator-countbyitem-chart.component.html',
  styleUrl: './operator-countbyitem-chart.component.scss'
})
export class OperatorCountbyitemChartComponent implements OnInit {
  @Input() operatorId?: number;
  @Input() startTime: string = '';
  @Input() endTime: string = '';

  chartData: StackedBarChartData | null = null;
  loading = false;
  error: string | null = null;

  constructor(
    private countByItemService: OperatorCountbyitemService,
    @Optional() @Inject(MAT_DIALOG_DATA) public dialogData: any
  ) {}

  ngOnInit() {
    if (this.dialogData) {
      this.operatorId = this.dialogData.operatorId;
      this.startTime = this.dialogData.startTime;
      this.endTime = this.dialogData.endTime;
      this.fetchData();
    }
  }

  isValidInput(): boolean {
    return !!this.operatorId && !!this.startTime && !!this.endTime;
  }

  private transformData(rawData: CountByItemData[]): StackedBarChartData {
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
    this.fetchData();
  }
}
