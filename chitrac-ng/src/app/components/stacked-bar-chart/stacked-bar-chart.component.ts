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
  };
}

@Component({
  selector: 'app-stacked-bar-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stacked-bar-chart.component.html',
  styleUrl: './stacked-bar-chart.component.scss'
})
export class StackedBarChartComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() data: StackedBarChartData | null = null;
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  private observer!: MutationObserver;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data) {
      this.renderChart();
    }
  }

  ngAfterViewInit(): void {
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
    if (!this.data) return;

    const element = this.chartContainer.nativeElement;
    element.innerHTML = ''; // Clear existing chart

    const margin = { top: 40, right: 120, bottom: 50, left: 50 };
    const width = 900 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const isDarkTheme = document.body.classList.contains('dark-theme');
    const textColor = isDarkTheme ? 'white' : 'black';
    const seriesColors = d3.schemeCategory10;

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right + 100)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare the data for stacking
    const series = Object.entries(this.data.data.operators).map(([name, values]) => {
      return this.data.data.hours.map((hour, i) => ({
        hour,
        value: values[i],
        operator: name
      }));
    });

    const stackedData = d3.stack()
      .keys(Object.keys(this.data.data.operators))
      .value((d, key) => d[key] || 0)
      (this.data.data.hours.map(hour => {
        const entry: any = { hour };
        Object.entries(this.data.data.operators).forEach(([operator, values]) => {
          entry[operator] = values[this.data.data.hours.indexOf(hour)];
        });
        return entry;
      }));

    const x = d3.scaleBand()
      .domain(this.data.data.hours.map(h => this.formatHour(h)))
      .range([0, width])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(stackedData[stackedData.length - 1], d => d[1])!])
      .nice()
      .range([height, 0]);

    // Add the stacked bars
    svg.append('g')
      .selectAll('g')
      .data(stackedData)
      .join('g')
      .attr('fill', (d, i) => seriesColors[i])
      .selectAll('rect')
      .data(d => d)
      .join('rect')
      .attr('x', d => x(this.formatHour(d.data['hour']))!)
      .attr('y', d => y(d[1]))
      .attr('height', d => y(d[0]) - y(d[1]))
      .attr('width', x.bandwidth());

    // Add x-axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('fill', textColor);

    // Add y-axis
    svg.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('fill', textColor);

    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', textColor)
      .text(this.data.title);

    // Add legend
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width + 20}, 0)`);

    Object.keys(this.data.data.operators).forEach((operator, i) => {
      const legendItem = legend.append('g')
        .attr('transform', `translate(0, ${i * 20})`);

      legendItem.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', seriesColors[i]);

      legendItem.append('text')
        .attr('x', 15)
        .attr('y', 10)
        .style('fill', textColor)
        .style('font-size', '12px')
        .text(operator);
    });
  }

  formatHour(hour: number): string {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
  }
}
