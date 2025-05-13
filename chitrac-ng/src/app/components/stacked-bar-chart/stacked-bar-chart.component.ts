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
export class StackedBarChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() data: StackedBarChartData | null = null;
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  private observer!: MutationObserver;
  private margin = { top: 40, right: 140, bottom: 80, left: 60 };
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
    const seriesColors = d3.schemeCategory10;

    // Create a mapping of original hours to formatted labels
    const hourLabels = new Map(
      this.data.data.hours.map(hour => [hour.toString(), this.formatHour(hour)])
    );

    const x = d3.scaleBand()
      .domain(this.data.data.hours.map(String))
      .range([this.margin.left, this.width - this.margin.right])
      .padding(0.2);

    const stackedData = d3.stack()
      .keys(Object.keys(this.data.data.operators))
      (this.data.data.hours.map((hour, i) => {
        const entry: any = {};
        Object.entries(this.data.data.operators).forEach(([itemName, values]) => {
          entry[itemName] = values[i] || 0;
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
      .attr('fill', (_, i) => seriesColors[i % seriesColors.length])
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
          .tickValues(x.domain().filter((d, i) => i % 4 === 0))  // Show every 4th hour
          .tickFormat(d => hourLabels.get(d) || '')  // Use formatted labels
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

    svg.append('text')
      .attr('x', this.width / 2)
      .attr('y', this.margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', textColor)
      .text(this.data.title);

    const legend = svg.append('g')
      .attr('transform', `translate(${this.width - this.margin.right + 10}, ${this.margin.top})`);

    Object.keys(this.data.data.operators).forEach((key, i) => {
      const legendRow = legend.append('g').attr('transform', `translate(0, ${i * 16})`);

      legendRow.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', seriesColors[i % seriesColors.length]);

      legendRow.append('text')
        .attr('x', 14)
        .attr('y', 8)
        .style('font-size', '11px')
        .style('fill', textColor)
        .text(key);
    });
  }
}
