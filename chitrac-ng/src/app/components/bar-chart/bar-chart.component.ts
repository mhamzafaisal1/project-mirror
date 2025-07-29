import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

export interface BarChartDataPoint {
  hour: number;      // for 'time' mode this is actual hour
  counts: number;    // bar height (e.g., count or oee %)
  label?: string;    // optional label for oee mode
}

@Component({
    selector: 'bar-chart',
    imports: [CommonModule],
    templateUrl: './bar-chart.component.html',
    styleUrls: ['./bar-chart.component.scss']
})
export class BarChartComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() data: BarChartDataPoint[] = [];
  @Input() title: string = '';
  @Input() mode: 'time' | 'oee' | 'count' = 'time';
  @Input() chartWidth: number = 600;
  @Input() chartHeight: number = 600;
  @Input() extraBottomMargin: boolean = false;
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  private observer!: MutationObserver;
  private fullscreenListener!: () => void;
  private isFullscreen: boolean = false;

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['data'] && this.data.length > 0) || 
        changes['chartWidth'] || 
        changes['chartHeight'] || 
        changes['extraBottomMargin']) {
      this.renderChart();
    }
  }

  ngAfterViewInit(): void {
    this.observer = new MutationObserver(() => this.renderChart());
    this.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Add fullscreen mode listener
    this.setupFullscreenListener();
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    // Remove fullscreen listener
    if (this.fullscreenListener) {
      window.removeEventListener('resize', this.fullscreenListener);
      document.removeEventListener('fullscreenchange', this.fullscreenListener);
    }
  }

  private setupFullscreenListener(): void {
    this.fullscreenListener = () => {
      const wasFullscreen = this.isFullscreen;
      this.isFullscreen =
        !!document.fullscreenElement ||
        window.innerHeight === screen.height;

      // Only re-render if fullscreen state actually changed
      if (wasFullscreen !== this.isFullscreen) {
        this.renderChart();
      }
    };

    // Listen for both F11-style fullscreen (resize) and programmatic fullscreen
    window.addEventListener('resize', this.fullscreenListener);
    document.addEventListener('fullscreenchange', this.fullscreenListener);
  }

  renderChart(): void {
    const element = this.chartContainer.nativeElement;
    element.innerHTML = '';

    // Adjust bottom margin based on fullscreen state
    const bottomMargin = this.isFullscreen 
      ? (this.extraBottomMargin ? 120 : 80)
      : (this.extraBottomMargin ? 150 : 120);

    const margin = { top: 40, right: 60, bottom: bottomMargin, left: 60 };
    const width = this.chartWidth - margin.left - margin.right;
    const height = this.chartHeight - margin.top - margin.bottom;

    const isDarkTheme = document.body.classList.contains('dark-theme');
    const textColor = isDarkTheme ? '#e0e0e0' : '#333';

    const svg = d3.select(element)
      .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .style('font-family', `'Inter', sans-serif`)
        .style('font-size', '0.875rem');

    // Move title to the top of the SVG
    svg.append('text')
      .attr('x', (width + margin.left + margin.right) / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', textColor)
      .text(this.title);

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xLabels = this.mode === 'time'
      ? this.data.map(d => this.formatHour(d.hour))
      : this.data.map(d => d.label || `#${d.hour + 1}`);

    const x = d3.scaleBand()
      .domain(xLabels)
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(this.data, d => d.counts)!])
      .nice()
      .range([height, 0]);

    chartGroup.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('fill', textColor)
        .style('font-size', '14px');

    chartGroup.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
        .style('fill', textColor)
        .style('font-size', '14px');

        chartGroup.selectAll('.bar')
        .data(this.data)
        .enter()
        .append('rect')
          .attr('class', 'bar')
          .attr('x', (d, i) => {
            const label = this.mode === 'time' ? this.formatHour(d.hour) : (d.label || `#${i + 1}`);
            return x(label)!;
          })
          .attr('y', d => y(d.counts))
          .attr('width', x.bandwidth())
          .attr('height', d => height - y(d.counts))
          .attr('fill', d => this.getBarColor(d.counts));
      
  }

  private formatHour(hour: number): string {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
  }

  private getBarColor(value: number): string {
    // unified, cohesive palette + thresholds
    if (this.mode === 'count') {
      return '#42a5f5';    // primary blue
    }
    if (value >= 85) return '#66bb6a';   // green
    if (value >= 60) return '#ffca28';   // amber
    return '#ef5350';                    // softened red
  }
}
