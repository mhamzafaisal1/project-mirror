import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  AfterViewInit,
  OnInit,
  Renderer2
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

export interface StackedBarChartData {
  title: string;
  data: {
    hours: number[];
    operators: { [key: string]: number[] };
    machineNames?: string[];
  };
}

export type StackedBarChartMode = 'time' | 'machine';

interface StackedBarPoint {
  key: string;
  isTop: boolean;
  0: number;
  1: number;
  data: { [key: string]: number };
  machineName?: string;
}

@Component({
  selector: 'app-stacked-bar-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stacked-bar-chart.component.html',
  styleUrl: './stacked-bar-chart.component.scss'
})
export class StackedBarChartComponent implements OnInit, OnDestroy {
  @Input() data: StackedBarChartData | null = null;
  @Input() mode: StackedBarChartMode = 'time';
  @Input() chartWidth!: number;
  @Input() chartHeight!: number;
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  private observer!: MutationObserver;
  private margin = { top: 40, right: 40, bottom: 100, left: 40 };
  private svg: any;
  private isDarkTheme = false;

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit() {
    this.detectTheme();
    this.observer = new MutationObserver(() => this.renderChart());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if (this.data) this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['data'] || changes['chartWidth'] || changes['chartHeight']) && this.data) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.disconnect();
    if (this.svg) {
      this.svg.remove();
    }
  }

  private detectTheme() {
    const dark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = dark;
    const el = this.elRef.nativeElement;
    this.renderer.setStyle(el, 'background-color', dark ? '#121212' : '#ffffff');
    this.renderer.setStyle(el, 'color', dark ? '#e0e0e0' : '#000000');
  }

  private formatHour(hour: number): string {
    const days = Math.floor(hour / 24);
    const remainingHours = hour % 24;
    return days > 0 ? `Day ${days + 1}, ${remainingHours}:00` : `${remainingHours}:00`;
  }

  private renderLegend(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, keys: string[], textColor: string): number {
    const maxPerRow = Math.max(1, Math.floor((this.chartWidth - this.margin.left - this.margin.right) / 120));
    const rowHeight = 16;
    const rowCount = Math.ceil(keys.length / maxPerRow);

    const legend = svg.append('g')
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

    keys.forEach((key, i) => {
      const col = i % maxPerRow;
      const row = Math.floor(i / maxPerRow);
      const legendRow = legend.append('g')
        .attr('transform', `translate(${col * 120}, ${row * rowHeight})`);

      legendRow.append('circle')
        .attr('r', 5)
        .attr('cx', 5)
        .attr('cy', 5)
        .attr('fill', this.getColorScale(keys)(key));

      legendRow.append('text')
        .attr('x', 14)
        .attr('y', 9)
        .style('font-size', '11px')
        .style('fill', textColor)
        .text(key);
    });

    return rowCount * rowHeight;
  }

  private getColorScale(keys: string[]) {
    const customPalette = ['#66bb6a', '#42a5f5', '#ffca28', '#ab47bc', '#ef5350', '#29b6f6', '#ffa726', '#7e57c2', '#26c6da', '#ec407a'];
    return d3.scaleOrdinal<string>().domain(keys).range(customPalette);
  }

  renderChart(): void {
    if (!this.data) return;

    const element = this.chartContainer.nativeElement;
    element.innerHTML = '';

    const svg = d3.select(element)
      .append('svg')
      .attr('viewBox', `0 0 ${this.chartWidth} ${this.chartHeight}`)
      .attr('width', this.chartWidth)
      .attr('height', this.chartHeight)
      .style('display', 'block')
      .style('margin', '0 auto')
      .style('font-family', "'Inter', sans-serif")
      .style('font-size', '0.875rem');

    const isDarkTheme = document.body.classList.contains('dark-theme');
    const textColor = isDarkTheme ? '#e0e0e0' : '#333';

    const keys = Object.keys(this.data.data.operators);
    const colorScale = this.getColorScale(keys);
    const legendHeight = this.renderLegend(svg, keys, textColor);
    const chartTop = this.margin.top + legendHeight;

    if (this.mode === 'machine') {
      const machineCount = this.data.data.operators[keys[0]].length;
      const machineNames = this.data.data.machineNames ||
        Array.from({ length: machineCount }, (_, i) => `Machine ${i + 1}`);

      const x = d3.scaleBand()
        .domain(machineNames)
        .range([this.margin.left, this.chartWidth - this.margin.right])
        .padding(0.2);

      const stackedData = d3.stack()
        .keys(keys)
        (Array.from({ length: machineCount }, (_, i) => {
          const entry: any = {};
          keys.forEach(k => { entry[k] = this.data!.data.operators[k][i]; });
          return entry;
        }));

      const y = d3.scaleLinear()
        .domain([0, d3.max(stackedData[stackedData.length - 1], d => d[1]) || 0])
        .nice()
        .range([this.chartHeight - this.margin.bottom, chartTop]);

      svg.append('g')
        .selectAll('g')
        .data(stackedData)
        .join('g')
        .attr('fill', d => colorScale(d.key))
        .selectAll('rect')
        .data((d, i) => d.map((point, j) => ({
          ...point,
          key: d.key,
          isTop: i === stackedData.length - 1,
          machineName: this.mode === 'machine' ? machineNames[j] : undefined
        } as StackedBarPoint)))
        .join('path')
        .attr('d', d => {
          const xPos = x(this.mode === 'machine' ? d.machineName! : String(d.data['hour']))!;
          const barWidth = x.bandwidth();
          const yTop = y(d[1]);
          const barHeight = y(d[0]) - y(d[1]);
          const radius = d.isTop ? 4 : 0;
      
          if (d.isTop) {
            return `
              M${xPos},${yTop + radius}
              a${radius},${radius} 0 0 1 ${radius},-${radius}
              h${barWidth - 2 * radius}
              a${radius},${radius} 0 0 1 ${radius},${radius}
              v${barHeight - radius}
              h${-barWidth}
              Z
            `;
          } else {
            return `
              M${xPos},${yTop}
              h${barWidth}
              v${barHeight}
              h${-barWidth}
              Z
            `;
          }
        })
        .style('fill', d => colorScale(d.key))
        .style('filter', d => d.isTop ? 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' : null);
      

      svg.append('g')
        .attr('transform', `translate(0,${this.chartHeight - this.margin.bottom})`)
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

    } else {
      const hourLabels = new Map(
        this.data.data.hours.map(hour => [hour.toString(), this.formatHour(hour)])
      );

      const x = d3.scaleBand()
        .domain(this.data.data.hours.map(String))
        .range([this.margin.left, this.chartWidth - this.margin.right])
        .padding(0.2);

      const stackedData = d3.stack()
        .keys(keys)
        (this.data.data.hours.map((hour, i) => {
          const entry: any = {};
          keys.forEach(k => { entry[k] = this.data!.data.operators[k][i] || 0; });
          entry.hour = hour;
          return entry;
        }));

      const y = d3.scaleLinear()
        .domain([0, d3.max(stackedData[stackedData.length - 1], d => d[1]) || 0])
        .nice()
        .range([this.chartHeight - this.margin.bottom, chartTop]);

      svg.append('g')
        .selectAll('g')
        .data(stackedData)
        .join('g')
        .attr('fill', d => colorScale(d.key))
        .selectAll('rect')
        .data((d, i) => d.map(point => ({
          ...point,
          key: d.key,
          isTop: i === stackedData.length - 1
        } as StackedBarPoint)))
        .join('path')
        .attr('d', d => {
          const xPos = x(this.mode === 'machine' ? d.machineName! : String(d.data['hour']))!;
          const barWidth = x.bandwidth();
          const yTop = y(d[1]);
          const barHeight = y(d[0]) - y(d[1]);
          const radius = d.isTop ? 4 : 0;
      
          if (d.isTop) {
            return `
              M${xPos},${yTop + radius}
              a${radius},${radius} 0 0 1 ${radius},-${radius}
              h${barWidth - 2 * radius}
              a${radius},${radius} 0 0 1 ${radius},${radius}
              v${barHeight - radius}
              h${-barWidth}
              Z
            `;
          } else {
            return `
              M${xPos},${yTop}
              h${barWidth}
              v${barHeight}
              h${-barWidth}
              Z
            `;
          }
        })
        .style('fill', d => colorScale(d.key))
        .style('filter', d => d.isTop ? 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' : null);
      

      svg.append('g')
        .attr('transform', `translate(0,${this.chartHeight - this.margin.bottom})`)
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
    }

    svg.append('text')
      .attr('x', this.chartWidth / 2)
      .attr('y', this.margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', textColor)
      .text(this.data.title);
  }
}
