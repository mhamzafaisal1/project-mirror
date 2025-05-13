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
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { OeeDataService } from '../services/oee-data.service';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { LineChartComponent, LineChartDataPoint } from '../components/line-chart/line-chart.component';

function toDateTimeLocalString(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

@Component({
  selector: 'app-operator-line-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    DateTimePickerComponent,
    LineChartComponent
  ],
  templateUrl: './operator-line-chart.component.html',
  styleUrls: ['./operator-line-chart.component.scss']
})
export class OperatorLineChartComponent implements OnInit, OnDestroy, OnChanges {
  @Input() startTime: string = '';
  @Input() endTime: string = '';
  @Input() operatorId: string = '';

  pickerStartTime: string = '';
  pickerEndTime: string = '';

  efficiencyData: LineChartDataPoint[] = [];
  operatorName = '';
  loading = false;
  error: string | null = null;
  isDarkTheme = false;

  private observer!: MutationObserver;

  constructor(
    private oeeService: OeeDataService,
    private renderer: Renderer2,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.detectTheme();
    this.observeTheme();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['startTime'] && this.startTime) {
      this.pickerStartTime = toDateTimeLocalString(this.startTime);
    }
    if (changes['endTime'] && this.endTime) {
      this.pickerEndTime = toDateTimeLocalString(this.endTime);
    }
    if (
      (changes['startTime'] || changes['endTime'] || changes['operatorId']) &&
      this.startTime &&
      this.endTime &&
      this.operatorId
    ) {
      this.fetchData();
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private observeTheme(): void {
    this.observer = new MutationObserver(() => this.detectTheme());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  private detectTheme(): void {
    this.isDarkTheme = document.body.classList.contains('dark-theme');
    const el = this.elRef.nativeElement;
    this.renderer.setStyle(el, 'background-color', this.isDarkTheme ? '#121212' : '#ffffff');
    this.renderer.setStyle(el, 'color', this.isDarkTheme ? '#e0e0e0' : '#000000');
  }

  fetchData(): void {
    if (!this.startTime || !this.endTime || !this.operatorId) {
      this.error = 'All fields are required';
      return;
    }

    this.loading = true;
    this.error = null;

    this.oeeService.getOperatorDailyEfficiency(this.startTime, this.endTime, this.operatorId).subscribe({
      next: (response) => {
        this.operatorName = response.operator.name;
        this.efficiencyData = response.data.map(entry => ({
          label: new Date(entry.date).toLocaleDateString(),
          value: entry.efficiency
        }));
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching data:', err);
        this.error = 'Failed to fetch data';
        this.loading = false;
      }
    });
  }

  onStartTimeChange(newValue: string) {
    this.pickerStartTime = newValue;
    this.startTime = new Date(newValue).toISOString();
    this.fetchData();
  }

  onEndTimeChange(newValue: string) {
    this.pickerEndTime = newValue;
    this.endTime = new Date(newValue).toISOString();
    this.fetchData();
  }
}
