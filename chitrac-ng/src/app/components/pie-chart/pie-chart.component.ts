import { Component, Input, ElementRef, ViewChild, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

export interface PieChartDataPoint {
  name: string;
  value: number;
}

@Component({
  selector: 'pie-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pie-chart.component.html',
  styleUrls: ['./pie-chart.component.scss']
})
export class PieChartComponent implements OnChanges, AfterViewInit {
  @Input() data: PieChartDataPoint[] = [];
  @Input() title: string = '';
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  ngAfterViewInit(): void {
    if (this.data.length) this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.chartContainer) {
      this.renderChart();
    }
  }

  renderChart(): void {
    const element = this.chartContainer.nativeElement;
    element.innerHTML = '';

    const width = 400;
    const height = 400;
    const radius = Math.min(width, height) / 2;
    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? 'white' : 'black';

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width)
      .attr('height', height + 40)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    const color = d3.scaleOrdinal()
      .domain(this.data.map(d => d.name))
      .range(d3.schemeSet2);

    const pie = d3.pie<PieChartDataPoint>().value(d => d.value);
    const arc = d3.arc<d3.PieArcDatum<PieChartDataPoint>>()
      .innerRadius(0)
      .outerRadius(radius);

    const data_ready = pie(this.data);

    svg.selectAll('slices')
      .data(data_ready)
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.name) as string)
      .attr('stroke', 'white')
      .style('stroke-width', '2px');

    svg.selectAll('labels')
      .data(data_ready)
      .enter()
      .append('text')
      .text(d => `${d.data.name} (${d.data.value}%)`)
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .style('text-anchor', 'middle')
      .style('fill', textColor)
      .style('font-size', '12px');

    svg.append('text')
      .attr('x', 0)
      .attr('y', -height / 2 - 10)
      .attr('text-anchor', 'middle')
      .style('fill', textColor)
      .style('font-size', '16px')
      .text(this.title);
  }

  
}
