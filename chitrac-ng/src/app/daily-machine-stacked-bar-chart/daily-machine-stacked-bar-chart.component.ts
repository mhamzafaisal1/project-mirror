import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { StackedBarChartComponent, StackedBarChartData } from '../components/stacked-bar-chart/stacked-bar-chart.component';
import { DailyDashboardService } from '../services/daily-dashboard.service';

interface MachineStatus {
  serial: number;
  name: string;
  runningMs: number;
  pausedMs: number;
  faultedMs: number;
}

@Component({
  selector: 'app-daily-machine-stacked-bar-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    DateTimePickerComponent,
    StackedBarChartComponent
  ],
  templateUrl: './daily-machine-stacked-bar-chart.component.html',
  styleUrls: ['./daily-machine-stacked-bar-chart.component.scss']
})
export class DailyMachineStackedBarChartComponent implements OnChanges {
  @Input() startTime: string = '';
  @Input() endTime: string = '';
  @Input() machineSerial: number | null = null;

  chartData: StackedBarChartData | null = null;
  loading = false;
  error = '';
  isDarkTheme = false;

  constructor(private dashboardService: DailyDashboardService) {
    // Initialize dark theme based on body class
    this.isDarkTheme = document.body.classList.contains('dark-theme');
    
    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          this.isDarkTheme = document.body.classList.contains('dark-theme');
        }
      });
    });
    
    observer.observe(document.body, { attributes: true });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['startTime'] || changes['endTime'] || changes['machineSerial']) && this.isValid()) {
      this.fetchData();
    }
  }

  isValid(): boolean {
    return !!this.startTime && !!this.endTime;
  }

  private convertMsToHours(ms: number): number {
    return ms / (1000 * 60 * 60);
  }

  private formatMachineData(data: MachineStatus[]): StackedBarChartData {
    // Create a single hour (0) since we're showing daily totals
    const hours = [0];
    
    // Create operators object with running, paused, and faulted data
    const operators = {
      'Running': data.map(machine => this.convertMsToHours(machine.runningMs)),
      'Paused': data.map(machine => this.convertMsToHours(machine.pausedMs)),
      'Faulted': data.map(machine => this.convertMsToHours(machine.faultedMs))
    };

    return {
      title: 'Daily Machine Status',
      data: {
        hours,
        operators,
        machineNames: data.map(machine => machine.name)
      }
    };
  }

  fetchData(): void {
    if (!this.isValid()) return;

    this.loading = true;
    this.error = '';
    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();

    this.dashboardService.getMachineStatus(formattedStart, formattedEnd, this.machineSerial || undefined).subscribe({
      next: (response: MachineStatus[]) => {
        this.chartData = this.formatMachineData(response);
        this.loading = false;
      },
      error: (err) => {
        console.error('Fetch failed:', err);
        this.error = 'Could not load data.';
        this.loading = false;
      }
    });
  }
}
