import { Component, Input, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
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
  standalone: true,
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
export class OperatorCyclePieChartComponent implements OnInit, OnDestroy {
  @Input() startTime: string = '';
  @Input() endTime: string = '';
  @Input() operatorId?: number;

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

    if (this.startTime && this.endTime) {
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
