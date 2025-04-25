import { Component, Input, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';

interface ChartData {
  machine: {
    serial: string;
    name: string;
  };
  timeRange: {
    start: string;
    end: string;
  };
  hourlyData: {
    hour: string;
    oee: number;
    operators: {
      name: string;
      efficiency: number;
    }[];
  }[];
}

interface TransformedData {
  date: Date;
  oee: number;
  operators: {
    name: string;
    efficiency: number;
  }[];
}

interface DataPoint {
  date: Date;
  value: number;
}

@Component({
  selector: 'app-multiple-line-chart',
  standalone: true,
  imports: [],
  templateUrl: './multiple-line-chart.component.html',
  styleUrl: './multiple-line-chart.component.scss'
})
export class MultipleLineChartComponent implements AfterViewInit {
  @ViewChild('chartContainer') private chartContainer!: ElementRef;
  @Input() data!: ChartData;

  // Adjusted margins to accommodate legend
  private margin = { top: 20, right: 150, bottom: 30, left: 60 };
  private width = 1100; // Increased width
  private height = 600;

  ngAfterViewInit() {
    if (this.data) {
      this.createChart();
    }
  }

  private createChart() {
    // Clear previous chart if exists
    d3.select(this.chartContainer.nativeElement).selectAll('*').remove();

    // Transform data for D3
    const transformedData = this.transformData(this.data);

    // Create SVG container with adjusted dimensions
    const svg = d3.select(this.chartContainer.nativeElement)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', [0, 0, this.width, this.height])
      .attr('style', 'max-width: 100%; height: auto;');

    // Create scales
    const x = d3.scaleTime()
      .domain(d3.extent(transformedData, d => d.date) as [Date, Date])
      .range([this.margin.left, this.width - this.margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 100]) // Assuming percentages (0-100)
      .range([this.height - this.margin.bottom, this.margin.top]);

    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0,${this.height - this.margin.bottom})`)
      .call(d3.axisBottom(x).ticks(this.width / 80).tickSizeOuter(0));

    // Add Y axis
    svg.append('g')
      .attr('transform', `translate(${this.margin.left},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').clone()
        .attr('x2', this.width - this.margin.left - this.margin.right)
        .attr('stroke-opacity', 0.1))
      .call(g => g.append('text')
        .attr('x', -this.margin.left)
        .attr('y', 10)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'start')
        .text('↑ Efficiency (%)'));

    // Create color scale for lines
    const color = d3.scaleOrdinal<string, string>()
      .domain(['OEE', ...new Set(transformedData.flatMap(d => d.operators.map(op => op.name)))])
      .range(d3.schemeCategory10);

    // Draw lines
    const line = d3.line<DataPoint>()
      .x(d => x(d.date))
      .y(d => y(d.value));

    // Draw OEE line
    svg.append('path')
      .datum(transformedData.map(d => ({ date: d.date, value: d.oee })))
      .attr('fill', 'none')
      .attr('stroke', () => color('OEE'))
      .attr('stroke-width', 2)
      .attr('d', line);

    // Draw operator lines
    const operators = new Set(transformedData.flatMap(d => d.operators.map(op => op.name)));
    operators.forEach(operator => {
      svg.append('path')
        .datum(transformedData.map(d => ({
          date: d.date,
          value: d.operators.find(op => op.name === operator)?.efficiency || 0
        })))
        .attr('fill', 'none')
        .attr('stroke', () => color(operator))
        .attr('stroke-width', 1.5)
        .attr('d', line);
    });

    // Add legend with adjusted positioning
    const legendX = this.width - this.margin.right + 40; // Move legend more to the right
    const legend = svg.append('g')
      .attr('font-family', 'sans-serif')
      .attr('font-size', 10)
      .attr('text-anchor', 'start')
      .selectAll('g')
      .data(['OEE', ...operators])
      .join('g')
      .attr('transform', (d, i) => `translate(${legendX},${this.margin.top + i * 25})`); // Increased spacing between items

    // Add colored rectangles to legend
    legend.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', d => color(d));

    // Add text to legend with more spacing
    legend.append('text')
      .attr('x', 24) // Increased spacing between rectangle and text
      .attr('y', 12)
      .text(d => d);
  }

  private transformData(data: ChartData): TransformedData[] {
    return data.hourlyData.map(hour => ({
      date: new Date(hour.hour),
      oee: hour.oee,
      operators: hour.operators
    }));
  }
}
