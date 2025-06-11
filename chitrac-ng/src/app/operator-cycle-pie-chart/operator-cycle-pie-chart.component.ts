import { Component, Input, OnInit, OnDestroy, ElementRef, Renderer2, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { PieChartComponent, PieChartDataPoint } from '../components/pie-chart/pie-chart.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { OperatorAnalyticsService } from '../services/operator-analytics.service';

@Component({
    selector: 'app-operator-cycle-pie-chart',
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule,
        PieChartComponent,
        DateTimePickerComponent
    ],
    templateUrl: './operator-cycle-pie-chart.component.html',
    styleUrl: './operator-cycle-pie-chart.component.scss'
})
export class OperatorCyclePieChartComponent implements OnInit, OnDestroy, OnChanges {
  @Input() startTime: string = '';
  @Input() endTime: string = '';
  @Input() operatorId: number;
  @Input() isModal: boolean = false;
  @Input() chartWidth: number;
  @Input() chartHeight: number;
  @Input() mode: 'standalone' | 'dashboard' = 'standalone';
  @Input() dashboardData?: any[];

  pieData: PieChartDataPoint[] = [];
  title = 'Operator Machine Time Breakdown';
  loading = false;
  error: string | null = null;
  isDarkTheme = false;
  private observer!: MutationObserver;

  constructor(
    private analyticsService: OperatorAnalyticsService,
    private renderer: Renderer2,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.detectTheme();
    this.observer = new MutationObserver(() => this.detectTheme());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if (this.mode === 'standalone' && this.startTime && this.endTime) {
      this.fetchData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.mode === 'dashboard' && changes['dashboardData']?.currentValue) {
      this.processDashboardData(changes['dashboardData'].currentValue);
    } else if (this.mode === 'standalone' && 
              (changes['startTime']?.currentValue || changes['endTime']?.currentValue)) {
      this.fetchData();
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private detectTheme(): void {
    const isDark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = isDark;
    const element = this.elRef.nativeElement;
    this.renderer.setStyle(element, 'background-color', isDark ? '#121212' : '#ffffff');
    this.renderer.setStyle(element, 'color', isDark ? '#e0e0e0' : '#000000');
  }

  private processDashboardData(data: any[]): void {
    this.loading = true;
    try {
      // Find the operator data from the dashboard data
      const operatorData = data.find(item => item.operator?.id === this.operatorId);
      if (!operatorData?.cyclePie) {
        this.error = 'No cycle pie data available';
        return;
      }

      // The cycle pie data is already in the correct format
      this.pieData = operatorData.cyclePie.map((item: any) => ({
        name: item.name,
        value: item.value
      }));
    } catch (error) {
      console.error('Error processing dashboard data:', error);
      this.error = 'Failed to process dashboard data';
    } finally {
      this.loading = false;
    }
  }

  fetchData(): void {
    if (!this.startTime || !this.endTime) return;

    this.loading = true;
    this.error = null;

    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();

    this.analyticsService.getOperatorCyclePieData(formattedStart, formattedEnd, this.operatorId)
      .subscribe({
        next: (data) => {
          this.pieData = data.map((item: any) => ({
            name: item.name,
            value: item.value
          }));
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to fetch data. Please try again.';
          this.loading = false;
          console.error('Error fetching operator cycle data:', err);
        }
      });
  }
}
