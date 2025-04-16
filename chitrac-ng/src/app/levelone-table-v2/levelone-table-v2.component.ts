import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { BaseTableComponent } from '../components/base-table/base-table.component';

@Component({
  selector: 'app-levelone-table-v2',
  standalone: true,
  imports: [CommonModule, BaseTableComponent],
  templateUrl: './levelone-table-v2.component.html',
  styleUrls: ['./levelone-table-v2.component.scss']
})
export class LeveloneTableV2Component {
  columns: string[] = [];
  rows: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>('assets/data/dummyData-v2.json').subscribe(data => {
      this.columns = data.columns;
      this.rows = data.rows;
    });
  }
}
