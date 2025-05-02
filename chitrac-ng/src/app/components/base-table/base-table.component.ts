import { Component, Input, Output, EventEmitter, OnInit, OnChanges, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';

@Component({
  selector: 'base-table',
  standalone: true,
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

  @Output() rowClicked = new EventEmitter<any>();

  @ViewChild(MatSort) sort!: MatSort;
  dataSource = new MatTableDataSource<any>();

  ngOnInit() {
    this.updateData();
  }

  ngAfterViewInit() {
    if (!this.disableSorting && this.sort) {
      this.dataSource.sort = this.sort;
    }
  }
  

  ngOnChanges() {
    this.updateData();
  }

  private updateData() {
    this.dataSource.data = this.rows;
    if (this.sort && !this.disableSorting) {
      this.dataSource.sort = this.sort;
    }
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
}
