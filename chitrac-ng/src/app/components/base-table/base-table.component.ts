import { Component, Input, Output, EventEmitter, OnInit, OnChanges, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';

@Component({
    selector: 'base-table',
    imports: [
        CommonModule,
        MatTableModule,
        MatSortModule
    ],
    templateUrl: './base-table.component.html',
    styleUrls: ['./base-table.component.scss']
})
export class BaseTableComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() columns: string[] = [];
  @Input() rows: any[] = [];
  @Input() selectedRow: any | null = null;
  @Input() disableSorting: boolean = false;
  @Input() getCellClass: ((value: any, column: string) => string) | null = null;

  @Output() rowClicked = new EventEmitter<any>();

  @ViewChild(MatSort) sort!: MatSort;
  dataSource = new MatTableDataSource<any>();

  ngOnInit() {
    this.updateData();
  }

  ngAfterViewInit() {
    this.setupSorting();
  }
  

  ngOnChanges() {
    this.updateData();
    this.setupSorting();
  }

  private setupSorting() {
    if (this.sort && !this.disableSorting) {
      this.dataSource.sort = this.sort;
      this.dataSource.sortingDataAccessor = (data: any, sortHeaderId: string) => {
        if (sortHeaderId === 'Start Time') {
          return new Date(data[sortHeaderId]).getTime();
        }
        if (sortHeaderId === 'Duration' || sortHeaderId === 'Total Duration') {
          const [hours, minutes] = data[sortHeaderId].split(' ');
          const h = parseInt(hours);
          const m = parseInt(minutes);
          return (h * 60) + m;
        }
        return data[sortHeaderId];
      };
    }
  }

  private updateData() {
    this.dataSource.data = this.rows;
  }
  

  onRowClick(row: any) {
    if (this.selectedRow !== row) {
      this.rowClicked.emit(row);
    } else {
      this.rowClicked.emit(null);
    }
  }

  isRowSelected(row: any): boolean {
    return this.selectedRow === row;
  }

  getEfficiencyClass(value: any): string {
    if (typeof value !== 'string' || !value.includes('%')) return '';

    const num = parseInt(value.replace('%', ''));
    if (isNaN(num)) return '';

    if (num >= 90) return 'green';
    if (num >= 70) return 'yellow';
    return 'red';
  }

  getCellClassForColumn(value: any, column: string): string {
    return this.getCellClass ? this.getCellClass(value, column) : '';
  }
  
  
}
