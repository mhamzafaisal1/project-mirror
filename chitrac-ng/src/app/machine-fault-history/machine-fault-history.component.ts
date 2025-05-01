import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { BaseTableComponent } from '../components/base-table/base-table.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { FaultHistoryService } from '../services/fault-history.service';

@Component({
  selector: 'app-machine-fault-history',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    BaseTableComponent,
    DateTimePickerComponent
  ],
  templateUrl: './machine-fault-history.component.html',
  styleUrls: ['./machine-fault-history.component.scss']
})
export class MachineFaultHistoryComponent implements OnInit, OnDestroy {
  startTime: string = '';
  endTime: string = '';
  serial: string = '';
  columns: string[] = [];
  rows: any[] = [];
  selectedRow: any | null = null;
  isDarkTheme: boolean = false;
  private observer!: MutationObserver;

  constructor(
    private faultHistoryService: FaultHistoryService,
    private renderer: Renderer2,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    const end = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    this.endTime = this.formatDateForInput(end);
    this.startTime = this.formatDateForInput(start);

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
    this.renderer.setStyle(element, 'background-color', isDark ? '#121212' : '#ffffff');
    this.renderer.setStyle(element, 'color', isDark ? '#e0e0e0' : '#000000');
  }

  // fetchData(): void {
  //   if (!this.startTime || !this.endTime || !this.serial) return;

  //   const serialNumber = parseInt(this.serial, 10);
  //   if (isNaN(serialNumber)) {
  //     console.error('Invalid serial number');
  //     return;
  //   }

  //   this.faultHistoryService.getFaultHistory(this.startTime, this.endTime, serialNumber)
  //     .subscribe({
  //       next: (data) => {
  //         if (data.faultCycles.length === 0) {
  //           this.rows = [];
  //           this.columns = [];
  //           return;
  //         } 

  //         console.log(data, 'data');

  //         const formattedData = data.faultCycles.map(cycle => ({
  //           'Fault Type': cycle.faultType,
  //           'Start Time': new Date(cycle.start).toLocaleString(),
  //           'End Time': new Date(cycle.end).toLocaleString(),
  //           'Duration': `${Math.floor(cycle.duration / 3600000)}h ${Math.floor((cycle.duration % 3600000) / 60000)}m`
  //         }));

  //         this.columns = Object.keys(formattedData[0]);
  //         this.rows = formattedData;
  //       },
  //       error: (error) => {
  //         console.error('Error fetching fault history:', error);
  //         this.rows = [];
  //         this.columns = [];
  //       }
  //     });
  // }

  fetchData(): void {
    if (!this.startTime || !this.endTime || !this.serial) return;
  
    const serialNumber = parseInt(this.serial, 10);
    if (isNaN(serialNumber)) {
      console.error('Invalid serial number');
      return;
    }
  
    this.faultHistoryService.getFaultHistory(this.startTime, this.endTime, serialNumber)
      .subscribe({
        next: (data) => {
          if (!data.faultSummaries || data.faultSummaries.length === 0) {
            this.rows = [];
            this.columns = [];
            return;
          }

          const formattedData = data.faultSummaries.map(summary => {
            const totalSeconds = Math.floor(summary.totalDuration / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            return {
              'Fault Type': summary.faultType,
              'Count': summary.count,
              'Total Duration': `${hours}h ${minutes}m ${seconds}s`
            };
          });
  
          this.columns = Object.keys(formattedData[0]);
          this.rows = formattedData;
        },
        error: (error) => {
          console.error('Error fetching fault history:', error);
          this.rows = [];
          this.columns = [];
        }
      });
  }
  

  onRowSelected(row: any): void {
    if (this.selectedRow === row) {
      this.selectedRow = null;
      return;
    }
    this.selectedRow = row;

    setTimeout(() => {
      const element = document.querySelector('.mat-row.selected');
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
