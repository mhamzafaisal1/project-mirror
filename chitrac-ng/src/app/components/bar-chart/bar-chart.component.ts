import { Component, Input, ElementRef, ViewChild, OnChanges, SimpleChanges, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

export interface BarChartDataPoint {
  hour: number;
  counts: number;
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
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  private observer!: MutationObserver;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data.length > 0) {
      this.renderChart();
    }
  }

  ngAfterViewInit(): void {
    // Watch for theme change on <body>
    this.observer = new MutationObserver(() => {
      this.renderChart();
    });

    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  renderChart(): void {
    const element = this.chartContainer.nativeElement;
    element.innerHTML = ''; // Clear existing chart

    const margin = { top: 40, right: 30, bottom: 50, left: 50 };
    const width = 700 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const isDarkTheme = document.body.classList.contains('dark-theme');
    const textColor = isDarkTheme ? 'white' : 'black';
    const barColor = '#4c2c92';

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(this.data.map(d => this.formatHour(d.hour)))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(this.data, d => d.counts as number)!])
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
      .attr('x', d => x(this.formatHour(d.hour))!)
      .attr('y', d => y(d.counts))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d.counts))
      .attr('fill', barColor);

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', textColor)
      .text(this.title);
  }

  formatHour(hour: number): string {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
  }
}
