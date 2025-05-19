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
  standalone: true,
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
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  private observer!: MutationObserver;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data.length > 0) {
      this.renderChart();
    }
  }

  ngAfterViewInit(): void {
    this.observer = new MutationObserver(() => this.renderChart());
    this.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  renderChart(): void {
    const element = this.chartContainer.nativeElement;
    element.innerHTML = '';

    const margin = { top: 40, right: 40, bottom: 120, left: 40 };
    const width = this.chartWidth - margin.left - margin.right;
    const height = this.chartHeight - margin.top - margin.bottom;

    const isDarkTheme = document.body.classList.contains('dark-theme');
    const textColor = isDarkTheme ? '#e0e0e0' : '#333';

    const svg = d3.select(element)
      .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .style('font-family', `'Inter', sans-serif`)
        .style('font-size', '0.875rem')
      .append('g')
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

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('fill', textColor);

    svg.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
        .style('fill', textColor);

    svg.selectAll('.bar')
      .data(this.data)
      .enter()
      .append('rect')
        .attr('class', 'bar')
        .attr('x', (d, i) =>
          x(this.mode === 'time' ? this.formatHour(d.hour) : (d.label || `#${i + 1}`))!
        )
        .attr('y', d => y(d.counts))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.counts))
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('fill', d => this.getBarColor(d.counts));

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', textColor)
      .text(this.title);
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
