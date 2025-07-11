import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { BaseTableComponent } from '../components/base-table/base-table.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { MachineAnalyticsService } from '../services/machine-analytics.service';

@Component({
  selector: 'app-machine-item-summary-table',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseTableComponent, DateTimePickerComponent, MatButtonModule],
  templateUrl: './machine-item-summary-table.component.html',
  styleUrls: ['./machine-item-summary-table.component.scss']
})
export class MachineItemSummaryTableComponent implements OnInit {
  @Input() startTime: string = '';
  @Input() endTime: string = '';
  @Input() selectedMachineSerial: number | null = null;
  @Input() itemSummaryData: any = null;

  itemColumns: string[] = ['Item Name', 'Total Count', 'Worked Time', 'PPH', 'Standard', 'Efficiency'];
  itemRows: any[] = [];
  loading: boolean = false;
  isDarkTheme: boolean = false;

  constructor(private machineAnalyticsService: MachineAnalyticsService) {}

  ngOnInit(): void {
    if (!this.startTime || !this.endTime) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      this.startTime = startOfDay.toISOString();
      this.endTime = endOfDay.toISOString();
    }

    // Load parent-passed summary
    if (this.itemSummaryData) {
      console.log('Received itemSummaryData:', this.itemSummaryData);
      this.itemRows = this.transformItemSummary(this.itemSummaryData);
    }
  }

  fetchItemSummaryData(): void {
    if (!this.startTime || !this.endTime || !this.selectedMachineSerial) return;

    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();

    this.loading = true;
    this.machineAnalyticsService.getMachineItemSummary(formattedStart, formattedEnd, this.selectedMachineSerial).subscribe({
      next: (data: any[]) => {
        const matched = data.find(machine => machine.machine?.serial === this.selectedMachineSerial);
        const summary = matched?.machineSummary?.itemSummaries;
        this.itemRows = summary ? this.transformItemSummary(summary) : [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching item summary:', err);
        this.loading = false;
      }
    });
  }

  private transformItemSummary(summary: any): any[] {
    if (!summary || typeof summary !== 'object') {
      console.log('Invalid summary data:', summary);
      return [];
    }

    return Object.values(summary).map((item: any) => {
      console.log('Processing item:', item);
      return {
        'Item Name': item.name || 'Unknown',
        'Total Count': item.countTotal ?? 0,
        'Worked Time': item.workedTimeFormatted 
          ? `${item.workedTimeFormatted.hours}h ${item.workedTimeFormatted.minutes}m`
          : '0h 0m',
        'PPH': item.pph ?? 0,
        'Standard': item.standard ?? 0,
        'Efficiency': item.efficiency !== undefined ? `${item.efficiency}%` : '0%'
      };
    });
  }
}

