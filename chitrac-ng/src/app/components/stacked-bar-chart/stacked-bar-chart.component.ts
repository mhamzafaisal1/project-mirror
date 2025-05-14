import { Component, Input, ElementRef, ViewChild, OnChanges, SimpleChanges, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

export interface StackedBarChartData {
  title: string;
  data: {
    hours: number[];
    operators: {
      [key: string]: number[];
    };
    machineNames?: string[];
  };
}

export type StackedBarChartMode = 'time' | 'machine';

interface StackedDataPoint {
  [key: string]: number | string;
  machineName: string;
}

@Component({
  selector: 'app-stacked-bar-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stacked-bar-chart.component.html',
  styleUrl: './stacked-bar-chart.component.scss'
})
export class StackedBarChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() data: StackedBarChartData | null = null;
  @Input() mode: StackedBarChartMode = 'time';
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  private observer!: MutationObserver;
  private margin = { top: 40, right: 200, bottom: 80, left: 60 };
  private width = 1000;
  private height = 500;

  ngAfterViewInit(): void {
    this.observer = new MutationObserver(() => {
      this.renderChart();
    });

    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if (this.data) {
      this.renderChart();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private formatHour(hour: number): string {
    const days = Math.floor(hour / 24);
    const remainingHours = hour % 24;

    if (days > 0) {
      return `Day ${days + 1}, ${remainingHours}:00`;
    }
    return `${remainingHours}:00`;
  }

  renderChart(): void {
    if (!this.data) return;

    const element = this.chartContainer.nativeElement;
    element.innerHTML = '';

    const svg = d3.select(element)
      .append('svg')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', 'auto');

    const isDarkTheme = document.body.classList.contains('dark-theme');
    const textColor = isDarkTheme ? '#e0e0e0' : '#000000';

    if (this.mode === 'machine') {
      const machineCount = this.data.data.operators[Object.keys(this.data.data.operators)[0]].length;
      const machineNames = this.data.data.machineNames ||
        Array.from({ length: machineCount }, (_, i) => `Machine ${i + 1}`);
      const keys = Object.keys(this.data.data.operators);

      const colorScale = d3.scaleOrdinal<string>()
        .domain(keys)
        .range(d3.schemeTableau10.concat(d3.schemeSet3, d3.schemePaired));

      const x = d3.scaleBand()
        .domain(machineNames)
        .range([this.margin.left, this.width - this.margin.right])
        .padding(0.2);

      const stackedData = d3.stack()
        .keys(keys)
        (Array.from({ length: machineCount }, (_, i) => {
          const entry: any = {};
          keys.forEach(k => {
            entry[k] = this.data!.data.operators[k][i];
          });
          return entry;
        }));

      const y = d3.scaleLinear()
        .domain([0, d3.max(stackedData[stackedData.length - 1], d => d[1]) || 0])
        .nice()
        .range([this.height - this.margin.bottom, this.margin.top]);

      svg.append('g')
        .selectAll('g')
        .data(stackedData)
        .join('g')
        .attr('fill', d => colorScale(d.key))
        .selectAll('rect')
        .data((d, i) => d.map((point, j) => ({ ...point, machineName: machineNames[j] })))
        .join('rect')
        .attr('x', d => x(d.machineName)!)
        .attr('y', d => y(d[1]))
        .attr('height', d => y(d[0]) - y(d[1]))
        .attr('width', x.bandwidth());

      svg.append('g')
        .attr('transform', `translate(0,${this.height - this.margin.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('fill', textColor);

      svg.append('g')
        .attr('transform', `translate(${this.margin.left},0)`)
        .call(d3.axisLeft(y).ticks(10).tickFormat(d => `${d} hr`))
        .selectAll('text')
        .style('fill', textColor);

      const legend = svg.append('g')
        .attr('transform', `translate(${this.width - this.margin.right + 10}, ${this.margin.top})`);

      keys.forEach((key, i) => {
        const legendRow = legend.append('g').attr('transform', `translate(0, ${i * 16})`);
        legendRow.append('rect')
          .attr('width', 10)
          .attr('height', 10)
          .attr('fill', colorScale(key));
        legendRow.append('text')
          .attr('x', 14)
          .attr('y', 8)
          .style('font-size', '11px')
          .style('fill', textColor)
          .text(key);
      });

    } else {
      const hourLabels = new Map(
        this.data.data.hours.map(hour => [hour.toString(), this.formatHour(hour)])
      );
      const keys = Object.keys(this.data.data.operators);

      const colorScale = d3.scaleOrdinal<string>()
        .domain(keys)
        .range(d3.schemeTableau10.concat(d3.schemeSet3, d3.schemePaired));

      const x = d3.scaleBand()
        .domain(this.data.data.hours.map(String))
        .range([this.margin.left, this.width - this.margin.right])
        .padding(0.2);

      const stackedData = d3.stack()
        .keys(keys)
        (this.data.data.hours.map((hour, i) => {
          const entry: any = {};
          keys.forEach(k => {
            entry[k] = this.data!.data.operators[k][i] || 0;
          });
          entry.hour = hour;
          return entry;
        }));

      const y = d3.scaleLinear()
        .domain([0, d3.max(stackedData[stackedData.length - 1], d => d[1]) || 0])
        .nice()
        .range([this.height - this.margin.bottom, this.margin.top]);

      svg.append('g')
        .selectAll('g')
        .data(stackedData)
        .join('g')
        .attr('fill', d => colorScale(d.key))
        .selectAll('rect')
        .data(d => d)
        .join('rect')
        .attr('x', d => x(String(d.data['hour']))!)
        .attr('y', d => y(d[1]))
        .attr('height', d => y(d[0]) - y(d[1]))
        .attr('width', x.bandwidth());

      svg.append('g')
        .attr('transform', `translate(0,${this.height - this.margin.bottom})`)
        .call(
          d3.axisBottom(x)
            .tickValues(x.domain().filter((_, i) => i % 4 === 0))
            .tickFormat(d => hourLabels.get(d) || '')
            .tickSizeOuter(0)
        )
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .style('fill', textColor);

      svg.append('g')
        .attr('transform', `translate(${this.margin.left},0)`)
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('fill', textColor);

      const legend = svg.append('g')
        .attr('transform', `translate(${this.width - this.margin.right + 10}, ${this.margin.top})`);

      keys.forEach((key, i) => {
        const legendRow = legend.append('g').attr('transform', `translate(0, ${i * 16})`);
        legendRow.append('rect')
          .attr('width', 10)
          .attr('height', 10)
          .attr('fill', colorScale(key));
        legendRow.append('text')
          .attr('x', 14)
          .attr('y', 8)
          .style('font-size', '11px')
          .style('fill', textColor)
          .text(key);
      });
    }

    svg.append('text')
      .attr('x', this.width / 2)
      .attr('y', this.margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', textColor)
      .text(this.data.title);
  }
}
