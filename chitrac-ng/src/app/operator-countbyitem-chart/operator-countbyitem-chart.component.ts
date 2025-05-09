import { Component, OnInit, Input, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

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
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    DateTimePickerComponent, 
    StackedBarChartComponent
  ],
  templateUrl: './operator-countbyitem-chart.component.html',
  styleUrl: './operator-countbyitem-chart.component.scss'
})
export class OperatorCountbyitemChartComponent implements OnInit, OnDestroy {
  @Input() operatorId?: number;
  @Input() startTime: string = '';
  @Input() endTime: string = '';

  chartData: StackedBarChartData | null = null;
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

    if (this.isValidInput()) {
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
    this.renderer.setStyle(el, 'background-color', dark ? '#121212' : '#ffffff');
    this.renderer.setStyle(el, 'color', dark ? '#e0e0e0' : '#000000');
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
