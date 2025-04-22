import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MultipleBarChartComponent, BarChartData } from '../components/multiple-bar-chart/multiple-bar-chart.component';
import { MachineAnalyticsService } from '../services/machine-analytics.service';

interface Machine {
  serial: string;
  name: string;
}

@Component({
  selector: 'app-machine-analytics-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, MultipleBarChartComponent],
  templateUrl: './machine-analytics-chart.component.html',
  styleUrls: ['./machine-analytics-chart.component.css']
})
export class MachineAnalyticsChartComponent implements OnInit {
  charts: BarChartData[] = [];
  selectedMachine: string = '';
  startTime: string = '';
  endTime: string = '';
  machines: Machine[] = [];

  constructor(private machineAnalyticsService: MachineAnalyticsService) {}

  ngOnInit(): void {
    this.setDefaultDates();
    this.fetchMachines();
    this.fetchData();
  }

  private setDefaultDates(): void {
    const now = new Date();
    // Set end time to current time
    this.endTime = now.toISOString();
    
    // Set start time to midnight of current date
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    this.startTime = startDate.toISOString();
  }

  private fetchMachines(): void {
    this.machineAnalyticsService.getMachines().subscribe({
      next: (machines: Machine[]) => {
        this.machines = machines;
      },
      error: (error: any) => {
        console.error('Error fetching machines:', error);
      }
    });
  }

  fetchData(): void {
    if (!this.startTime || !this.endTime) return;

    this.machineAnalyticsService.getMachineHourlyStates(this.selectedMachine, this.startTime, this.endTime)
      .subscribe({
        next: (data: any[]) => {
          this.processChartData(data);
        },
        error: (error: any) => {
          console.error('Error fetching hourly states:', error);
        }
      });
  }

  private processChartData(data: any[]): void {
    this.charts = data.map(machineData => {
      const hours = machineData.hours.map((hour: any) => hour.hour);
      const series = {
        'Runtime': machineData.hours.map((hour: any) => hour.runtime),
        'Paused': machineData.hours.map((hour: any) => hour.paused),
        'Faulted': machineData.hours.map((hour: any) => hour.faulted)
      };

      return {
        title: `${machineData.name || machineData.serial} (${machineData.serial})`,
        data: {
          hours,
          series
        }
      };
    });
  }

  onDateChange(): void {
    this.fetchData();
  }

  onMachineChange(): void {
    this.fetchData();
  }
}
