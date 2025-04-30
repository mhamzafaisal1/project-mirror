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
  @Input() isDarkTheme: boolean = false;

  private margin = { top: 40, right: 100, bottom: 50, left: 60 };
  private width = 900;
  private height = 400;
  

  ngAfterViewInit() {
    if (this.data) {
      this.createChart();
    }
  }

  private createChart() {
    d3.select(this.chartContainer.nativeElement).selectAll('*').remove();
    const textColor = this.isDarkTheme ? '#e0e0e0' : '#000000';
    const transformedData = this.transformData(this.data);
  
    const svg = d3.select(this.chartContainer.nativeElement)
      .append('svg')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('max-width', '100%')
      .style('height', 'auto')
      .style('font-family', 'sans-serif');
  
    const x = d3.scaleTime()
      .domain(d3.extent(transformedData, d => d.date) as [Date, Date])
      .range([this.margin.left, this.width - this.margin.right]);
  
    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([this.height - this.margin.bottom, this.margin.top]);
  
    svg.append('g')
      .attr('transform', `translate(0,${this.height - this.margin.bottom})`)
      .call(d3.axisBottom(x).ticks(this.width / 80).tickSizeOuter(0));
  
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
        .attr('fill', textColor)
        .attr('text-anchor', 'start')
        .text('↑ Efficiency (%)'));
  
    svg.selectAll('.tick text').style('fill', textColor);
    svg.selectAll('.tick line').style('stroke', textColor).style('stroke-opacity', 0.2);
  
    const color = d3.scaleOrdinal<string, string>()
      .domain(['OEE', ...new Set(transformedData.flatMap(d => d.operators.map(op => op.name)))])
      .range(d3.schemeCategory10);
  
    const line = d3.line<DataPoint>()
      .x(d => x(d.date))
      .y(d => y(d.value));
  
    const drawLineWithPeak = (label: string, points: DataPoint[]) => {
      svg.append('path')
        .datum(points)
        .attr('fill', 'none')
        .attr('stroke', color(label))
        .attr('stroke-width', 1.8)
        .attr('d', line);
  
      const peak = points.reduce((max, p) => (p.value > max.value ? p : max), points[0]);
  
      svg.append('circle')
        .attr('cx', x(peak.date))
        .attr('cy', y(peak.value))
        .attr('r', 3)
        .attr('fill', color(label));
  
      const labelText = `${Math.round(peak.value)}%`;
  
      const text = svg.append('text')
  .attr('x', x(peak.date) + 6)
  .attr('y', y(peak.value) - 4)
  .text(labelText)
  .attr('text-anchor', 'start')
  .style('font-size', '11px')
  .style('font-weight', 'bold')
  .style('fill', '#ffffff'); // ← White text

  
      text.clone(true)
        .lower()
        .attr('fill', 'none')
        .attr('stroke', this.isDarkTheme ? '#121212' : '#ffffff')
        .attr('stroke-width', 4);
    };
  
    const oeePoints = transformedData.map(d => ({ date: d.date, value: d.oee }));
    drawLineWithPeak('OEE', oeePoints);
  
    const operators = new Set(transformedData.flatMap(d => d.operators.map(op => op.name)));
    operators.forEach(operator => {
      const points = transformedData.map(d => ({
        date: d.date,
        value: d.operators.find(op => op.name === operator)?.efficiency ?? 0
      }));
      drawLineWithPeak(operator, points);
    });
  
    const legend = svg.append('g')
      .attr('font-size', 10)
      .attr('text-anchor', 'start')
      .selectAll('g')
      .data(['OEE', ...operators])
      .join('g')
      .attr('transform', (d, i) => `translate(${this.width - this.margin.right + 10},${this.margin.top + i * 20})`);
  
    legend.append('rect')
      .attr('width', 14)
      .attr('height', 14)
      .attr('fill', d => color(d));
  
    legend.append('text')
      .attr('x', 20)
      .attr('y', 11)
      .style('fill', textColor)
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
