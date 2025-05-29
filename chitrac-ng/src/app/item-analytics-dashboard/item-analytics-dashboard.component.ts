import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

import { BaseTableComponent } from '../components/base-table/base-table.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { ItemAnalyticsService } from '../services/item-analytics.service';

@Component({
  selector: 'app-item-analytics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    MatButtonModule,
    BaseTableComponent,
    DateTimePickerComponent
  ],
  templateUrl: './item-analytics-dashboard.component.html',
  styleUrl: './item-analytics-dashboard.component.scss'
})
export class ItemAnalyticsDashboardComponent implements OnInit, OnDestroy {
  startTime = '';
  endTime = '';
  rows: any[] = [];
  columns: string[] = [];
  isDarkTheme: boolean = false;
  isLoading: boolean = false;
  private observer!: MutationObserver;

  constructor(
    private analyticsService: ItemAnalyticsService,
    private renderer: Renderer2,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.detectTheme();

    this.observer = new MutationObserver(() => this.detectTheme());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  detectTheme(): void {
    const isDark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = isDark;

    const element = this.elRef.nativeElement;
    this.renderer.setStyle(element, 'background-color', isDark ? '#121212' : '#ffffff');
    this.renderer.setStyle(element, 'color', isDark ? '#e0e0e0' : '#000000');
  }

  fetchItemAnalytics(): void {
    if (!this.startTime || !this.endTime) return;

    this.isLoading = true;
    this.analyticsService.getItemAnalytics(this.startTime, this.endTime).subscribe({
      next: (data: any[]) => {
        this.rows = data.map(row => {
          const { hours = 0, minutes = 0 } = row.workedTimeFormatted || {};
          return {
            // 'Item ID': row.itemId,
            'Item Name': row.itemName,
            'Worked Time': `${hours}h ${minutes}m`,
            'Count': row.count,
            'PPH': row.pph,
            'Standard': row.standard,
            'Efficiency (%)': row.efficiency
          };
        });        
        this.columns = Object.keys(this.rows[0]);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load item analytics', err);
        this.isLoading = false;
      }
    });
  }
}
