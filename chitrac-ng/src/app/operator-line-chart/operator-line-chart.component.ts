import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  Renderer2,
  Input,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { OeeDataService } from '../services/oee-data.service';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { LineChartComponent, LineChartDataPoint } from '../components/line-chart/line-chart.component';

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
  ) {
    this.detectTheme();
  }

  ngOnInit(): void {
    if (!this.startTime || !this.endTime) {
      const now = new Date();
      const before = new Date(now);
      before.setDate(before.getDate() - 27);
      this.startTime = before.toISOString();
      this.endTime = now.toISOString();
    }

    this.observeTheme();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private observeTheme(): void {
    this.detectTheme();
    this.observer = new MutationObserver(() => this.detectTheme());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  private detectTheme(): void {
    this.isDarkTheme = document.body.classList.contains('dark-theme');
    const el = this.elRef.nativeElement;
    this.renderer.setStyle(el, 'background-color', this.isDarkTheme ? '#121212' : '#ffffff');
    this.renderer.setStyle(el, 'color', this.isDarkTheme ? '#e0e0e0' : '#000000');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['operatorId'] && changes['startTime'] && changes['endTime']) {
      if (this.operatorId && this.startTime && this.endTime) {
        this.fetchData();
      }
    }
  }

  fetchData(): void {
    if (!this.startTime || !this.endTime || !this.operatorId) {
      this.error = 'All fields are required';
      return;
    }

    this.loading = true;
    this.error = null;

    console.log('Fetching data with params:', {
      startTime: this.startTime,
      endTime: this.endTime,
      operatorId: this.operatorId
    });

    this.oeeService.getOperatorDailyEfficiency(this.startTime, this.endTime, this.operatorId).subscribe({
      next: (response) => {
        console.log('Received response:', response);
        this.operatorName = response.operator.name;
        this.efficiencyData = response.data.map(entry => ({
          label: new Date(entry.date).toLocaleDateString(),
          value: entry.efficiency
        }));
        console.log('Transformed data:', this.efficiencyData);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching data:', err);
        this.error = 'Failed to fetch data';
        this.loading = false;
      }
    });
  }
}
