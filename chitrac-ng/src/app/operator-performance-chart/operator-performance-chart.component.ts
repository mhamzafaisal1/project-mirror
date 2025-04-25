import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MultipleLineChartComponent } from '../components/multiple-line-chart/multiple-line-chart.component';
import { OeeDataService } from '../services/oee-data.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-operator-performance-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, MultipleLineChartComponent],
  templateUrl: './operator-performance-chart.component.html',
  styleUrl: './operator-performance-chart.component.scss'
})
export class OperatorPerformanceChartComponent implements OnInit {
  startTime: string = '';
  endTime: string = '';
  machineSerial: string = '';
  chartData: any = null;
  loading: boolean = false;
  error: string | null = null;

  constructor(private oeeDataService: OeeDataService) {}

  ngOnInit() {
    // Set default time range to last 24 hours
    const end = new Date();
    const start = new Date();
    start.setHours(start.getHours() - 24);
    
    this.endTime = end.toISOString();
    this.startTime = start.toISOString();
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
