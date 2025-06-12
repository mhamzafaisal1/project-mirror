import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { BaseTableComponent } from '../components/base-table/base-table.component';

@Component({
    selector: 'app-levelone-table',
    imports: [CommonModule, BaseTableComponent],
    templateUrl: './levelone-table.component.html',
    styleUrls: ['./levelone-table.component.scss']
})
export class LeveloneTableComponent {
  columns: string[] = [];
  rows: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>('assets/data/dummyData.json').subscribe((data) => {
      this.columns = data.columns;
      this.rows = data.rows;
    });
  }
}
// This component fetches data from a JSON file and displays it in a table format using the BaseTableComponent. The columns and rows are dynamically populated based on the data retrieved from the JSON file.