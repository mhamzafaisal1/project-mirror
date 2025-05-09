import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { BaseTableComponent } from '../components/base-table/base-table.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { OperatorSummaryService } from '../services/operator-summary.service';

@Component({
  selector: 'app-operator-item-summary-table',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatButtonModule, 
    MatInputModule,
    MatFormFieldModule,
    DateTimePickerComponent, 
    BaseTableComponent
  ],
  templateUrl: './operator-item-summary-table.component.html',
  styleUrls: ['./operator-item-summary-table.component.scss']
})
export class OperatorItemSummaryTableComponent implements OnInit {
  @Input() startTime: string = '';
  @Input() endTime: string = '';
  @Input() operatorId?: number;

  itemColumns: string[] = ['Operator', 'Machine', 'Item', 'Worked Time', 'Count', 'Misfeed', 'PPH', 'Standard', 'Efficiency'];
  itemRows: any[] = [];
  loading: boolean = false;
  isDarkTheme: boolean = false;

  constructor(private operatorSummaryService: OperatorSummaryService) {}

  ngOnInit(): void {
    if (this.startTime && this.endTime) {
      this.fetchItemSummary();
    }
  }

  fetchItemSummary(): void {
    if (!this.startTime || !this.endTime) return;

    this.loading = true;
    this.itemRows = [];

    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();

    this.operatorSummaryService.getOperatorSummary(formattedStart, formattedEnd, this.operatorId).subscribe({
      next: (data: any[]) => {
        this.itemRows = data.map(row => ({
          'Operator': row.operatorName,
          'Machine': row.machineName,
          'Item': row.itemName,
          'Worked Time': `${row.workedTimeFormatted.hours}h ${row.workedTimeFormatted.minutes}m`,
          'Count': row.count,
          'Misfeed': row.misfeed,
          'PPH': row.pph,
          'Standard': row.standard,
          'Efficiency': `${row.efficiency}%`
        }));
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching operator item summary:', err);
        this.loading = false;
      }
    });
  }
}
