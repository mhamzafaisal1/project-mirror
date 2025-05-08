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
  itemColumns: any[] = ['Item Name', 'Total Count', 'Worked Time', 'PPH', 'Standard', 'Efficiency'];
  itemRows: any[] = [];
  loading: boolean = false;
  isDarkTheme: boolean = false;

  constructor(private machineAnalyticsService: MachineAnalyticsService) {}

  ngOnInit(): void {
    // Only set default dates if inputs are not provided
    if (!this.startTime || !this.endTime) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      
      this.startTime = startOfDay.toISOString();
      this.endTime = endOfDay.toISOString();
    }
    
    // Fetch data if we have all required inputs
    if (this.startTime && this.endTime) {
      this.fetchItemSummaryData();
    }
  }

  fetchItemSummaryData(): void {
    if (!this.startTime || !this.endTime) return;
  
    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();
  
    this.loading = true;
    this.machineAnalyticsService.getMachineItemSummary(formattedStart, formattedEnd, this.selectedMachineSerial).subscribe({
      next: (data: any[]) => {
        console.log('Raw API response:', data); // Debug log
        this.itemRows = data
          .flatMap(machine => {
            const items = machine.machineSummary.itemSummaries;
            return Object.entries(items).map(([_, item]: [string, any]) => ({
              'Item Name': item.name,
              'Total Count': item.countTotal,
              'Worked Time': `${item.workedTimeFormatted.hours}h ${item.workedTimeFormatted.minutes}m`,
              'PPH': item.pph,
              'Standard': item.standard,
              'Efficiency': `${item.efficiency}%`
            }));
          });
        console.log('Processed rows:', this.itemRows); // Debug log
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching item summary:', err);
        this.loading = false;
      }
    });
  }
}
