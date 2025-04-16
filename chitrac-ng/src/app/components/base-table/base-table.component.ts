import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'base-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './base-table.component.html',
  styleUrls: ['./base-table.component.scss']
})
export class BaseTableComponent {
  @Input() columns: string[] = [];
  @Input() rows: any[] = [];

  getEfficiencyClass(value: any): string {
    if (typeof value !== 'string' || !value.includes('%')) return '';

    const num = parseInt(value.replace('%', ''));

    if (isNaN(num)) return '';

    if (num >=90) return 'green';
    if (num >= 70) return 'yellow';
    if (num >= 40) return 'red';
    return 'red';
  }
}
// This component is a reusable table component that takes in columns and rows as inputs. It also has a method to determine the CSS class for efficiency values based on their percentage.