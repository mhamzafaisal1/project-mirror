import { Component, Input, ElementRef, ViewChild, OnChanges, SimpleChanges, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

export interface LineChartDataPoint {
  label: string;
  value: number;
}

@Component({
  selector: 'line-chart',
  standalone: true,
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.scss'],
})
export class LineChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('chartContainer') private chartContainer!: ElementRef;
  @Input() data: LineChartDataPoint[] = [];
  @Input() title: string = '';

  ngAfterViewInit(): void {
    if (this.data.length > 0) {
      this.renderChart();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.chartContainer && this.data.length > 0) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    // Clean up any D3 event listeners or timers if needed
  }

  renderChart(): void {
    const element = this.chartContainer.nativeElement;
    element.innerHTML = '';

    const margin = { top: 40, right: 30, bottom: 50, left: 50 };
    const width = 700 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? 'white' : 'black';

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint()
      .domain(this.data.map(d => d.label))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(this.data, d => d.value)!])
      .range([height, 0]);

    const line = d3.line<LineChartDataPoint>()
      .x(d => x(d.label)!)
      .y(d => y(d.value));

    // Create x-axis with custom tick format
    const xAxis = d3.axisBottom(x)
      .tickFormat((d, i) => {
        // Show label every 4 days
        return i % 4 === 0 ? d : '';
      });

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .style('fill', textColor)
      .style('font-size', '12px')
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em');

    svg.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('fill', textColor);

    svg.append('path')
      .datum(this.data)
      .attr('fill', 'none')
      .attr('stroke', '#4c2c92')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add dots for each data point
    svg.selectAll('circle')
      .data(this.data)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.label)!)
      .attr('cy', d => y(d.value))
      .attr('r', 4)
      .attr('fill', '#4c2c92');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -20)
      .attr('text-anchor', 'middle')
      .style('fill', textColor)
      .style('font-size', '16px')
      .text(this.title);
  }
}
