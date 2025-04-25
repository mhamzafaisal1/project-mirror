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
  startDate: string = '';
  endDate: string = '';
  machines: Machine[] = [];

  constructor(private machineAnalyticsService: MachineAnalyticsService) {}

  ngOnInit(): void {
    this.setDefaultDates();
    this.fetchMachines();
    this.fetchData();
  }

  private setDefaultDates(): void {
    const now = new Date();
    this.endDate = now.toISOString().split('T')[0];

    const midnight = new Date(this.endDate);
    midnight.setHours(0, 0, 0, 0);
    this.startDate = midnight.toISOString().split('T')[0];
  }

  private buildTimestamps(): { endTime: string } {
    const end = new Date(this.endDate);
    end.setHours(23, 59, 59, 999);

    return {
      endTime: end.toISOString()
    };
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
    const { endTime } = this.buildTimestamps();

    this.machineAnalyticsService.getMachineHourlyStates(this.selectedMachine, endTime).subscribe({
      next: (data: any[]) => {
        this.processChartData(data);
      },
      error: (error: any) => {
        console.error('Error fetching hourly states:', error);
      }
    });
  }

  private processChartData(data: any[]): void {
    this.charts = data.map(machineData => ({
      title: `${machineData.machine.name || machineData.machine.serial} (${machineData.machine.serial})`,
      data: {
        hours: machineData.data.hours,
        series: {
          'Running': machineData.data.series.Running,
          'Paused': machineData.data.series.Paused,
          'Faulted': machineData.data.series.Faulted
        }
      },
      machine: {
        name: machineData.machine.name,
        serial: machineData.machine.serial
      }
    }));
  }

  onDateChange(): void {
    this.fetchData();
  }

  onMachineChange(): void {
    this.fetchData();
  }
}
