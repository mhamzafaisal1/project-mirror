import { Component, OnInit, OnDestroy, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MultipleLineChartComponent } from '../components/multiple-line-chart/multiple-line-chart.component';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { OeeDataService } from '../services/oee-data.service';

@Component({
  selector: 'app-operator-performance-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MultipleLineChartComponent
  ],
  templateUrl: './operator-performance-chart.component.html',
  styleUrls: ['./operator-performance-chart.component.scss']
})
export class OperatorPerformanceChartComponent implements OnInit, OnDestroy {
  startTime: string = '';
  endTime: string = '';
  machineSerial: string = '';
  chartData: any = null;
  loading: boolean = false;
  error: string | null = null;

  isDarkTheme: boolean = false;
  private observer!: MutationObserver;

  constructor(
    private oeeDataService: OeeDataService,
    private renderer: Renderer2,
    private elRef: ElementRef
  ) {}

  ngOnInit() {
    const end = new Date();
    const start = new Date();
    start.setHours(start.getHours() - 24);

    this.endTime = end.toISOString();
    this.startTime = start.toISOString();

    this.detectTheme();
    this.observer = new MutationObserver(() => {
      this.detectTheme();
    });
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  detectTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = isDark;

    const element = this.elRef.nativeElement;
    if (isDark) {
      this.renderer.setStyle(element, 'background-color', '#121212');
      this.renderer.setStyle(element, 'color', '#e0e0e0');
    } else {
      this.renderer.setStyle(element, 'background-color', '#ffffff');
      this.renderer.setStyle(element, 'color', '#000000');
    }
  }

  fetchData() {
    if (!this.machineSerial) {
      this.error = 'Please enter a machine serial number';
      return;
    }

    if (!this.startTime || !this.endTime) {
      this.error = 'Please select both start and end times';
      return;
    }

    this.loading = true;
    this.error = null;

    this.oeeDataService.getOperatorEfficiency(
      this.startTime,
      this.endTime,
      this.machineSerial
    ).subscribe({
      next: (data) => {
        this.chartData = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to fetch data. Please try again.';
        this.loading = false;
        console.error('Error fetching data:', err);
      }
    });
  }
}
