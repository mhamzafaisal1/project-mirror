import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit
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

@Component({
  selector: 'app-stacked-bar-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stacked-bar-chart.component.html',
  styleUrl: './stacked-bar-chart.component.scss'
})
export class StackedBarChartComponent implements AfterViewInit {
  @ViewChild('chartContainer', { static: true }) private chartContainer!: ElementRef;
  @Input() data: StackedBarChartData | null = null;
  @Input() mode: StackedBarChartMode = 'time';
  @Input() isDarkTheme: boolean = true;

  private chartWidth = 800;
  private chartHeight = 500;
  private margin = { top: 40, right: 150, bottom: 60, left: 60 };

  private static colorMapping = new Map<string, string>();
  private static customPalette = ['#66bb6a', '#42a5f5', '#ffca28', '#ab47bc', '#ef5350', '#29b6f6', '#ffa726', '#7e57c2', '#26c6da', '#ec407a'];
  private static nextColorIndex = 0;

  ngAfterViewInit(): void {
    if (this.data) this.createChart();
  }

  private getColorScale(keys: string[]) {
    keys.forEach(key => {
      if (!StackedBarChartComponent.colorMapping.has(key)) {
        const color = StackedBarChartComponent.customPalette[StackedBarChartComponent.nextColorIndex];
        StackedBarChartComponent.colorMapping.set(key, color);
        StackedBarChartComponent.nextColorIndex = (StackedBarChartComponent.nextColorIndex + 1) % StackedBarChartComponent.customPalette.length;
      }
    });

    return d3.scaleOrdinal<string>()
      .domain(keys)
      .range(keys.map(k => StackedBarChartComponent.colorMapping.get(k)!));
  }

  private formatHour(hour: number): string {
    const days = Math.floor(hour / 24);
    const remaining = hour % 24;
    return days > 0 ? `Day ${days + 1}, ${remaining}:00` : `${remaining}:00`;
  }

  private createChart(): void {
    if (!this.data) return;

    d3.select(this.chartContainer.nativeElement).selectAll("*").remove();
    const textColor = this.isDarkTheme ? 'white' : 'black';

    const keys = Object.keys(this.data.data.operators);
    const color = this.getColorScale(keys);

    const svg = d3.select(this.chartContainer.nativeElement)
      .append("svg")
      .attr("viewBox", `0 0 ${this.chartWidth} ${this.chartHeight}`)
      .style("width", "100%")
      .style("height", "auto")
      .style("display", "block")
      .style("font-family", "'Inter', sans-serif")
      .style("font-size", "0.875rem");

    const legend = svg.append("g")
      .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);

    keys.forEach((key, i) => {
      const g = legend.append("g")
        .attr("transform", `translate(${(i % 5) * 120}, ${Math.floor(i / 5) * 16})`);

      g.append("circle").attr("r", 5).attr("cx", 5).attr("cy", 5).attr("fill", color(key));
      g.append("text").attr("x", 14).attr("y", 9).style("font-size", "11px").style("fill", textColor).text(key);
    });

    const legendHeight = Math.ceil(keys.length / 5) * 16;
    const chartTop = this.margin.top + legendHeight;
    const chartBottom = this.chartHeight - this.margin.bottom;
    const chartRight = this.chartWidth - this.margin.right;

    const getBarPath = (x: number, y: number, width: number, height: number, isTop: boolean) => {
      const r = isTop ? 4 : 0;
      return isTop
        ? `M${x},${y + r}a${r},${r} 0 0 1 ${r},-${r}h${width - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${height - r}h${-width}Z`
        : `M${x},${y}h${width}v${height}h${-width}Z`;
    };

    const xLabels = this.mode === 'machine'
      ? (this.data.data.machineNames ?? Array.from({ length: keys.length }, (_, i) => `Machine ${i + 1}`))
      : this.data.data.hours.map(String);

    const x = d3.scaleBand()
      .domain(xLabels)
      .range([this.margin.left, chartRight])
      .padding(0.2);

    const baseData = this.mode === 'machine'
      ? Array.from({ length: xLabels.length }, (_, i) => {
          const entry: any = {};
          keys.forEach(k => entry[k] = this.data!.data.operators[k][i] || 0);
          return entry;
        })
      : this.data.data.hours.map((hour, i) => {
          const entry: any = {};
          keys.forEach(k => entry[k] = this.data!.data.operators[k][i] || 0);
          entry.hour = hour;
          return entry;
        });

    const stackedData = d3.stack().keys(keys)(baseData);

    const y = d3.scaleLinear()
      .domain([0, d3.max(stackedData[stackedData.length - 1], d => d[1]) || 0])
      .nice()
      .range([chartBottom, chartTop]);

    svg.append("g")
      .selectAll("g")
      .data(stackedData)
      .join("g")
      .attr("fill", d => color(d.key))
      .selectAll("path")
      .data((layer, i) => layer.map((d, j) => ({
        ...d,
        isTop: i === stackedData.length - 1,
        xLabel: xLabels[j]
      })))
      .join("path")
      .attr("d", d => getBarPath(
        x(d.xLabel)!,
        y(d[1]),
        x.bandwidth(),
        y(d[0]) - y(d[1]),
        d.isTop
      ))
      .style("fill", d => color((d as any).key));

    svg.append("g")
      .attr("transform", `translate(0,${chartBottom})`)
      .call(
        d3.axisBottom(x)
          .tickValues(this.mode === 'time' ? x.domain().filter((_, i) => i % 4 === 0) : x.domain())
          .tickFormat(d => this.mode === 'time' ? this.formatHour(+d) : d)
      )
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .style("fill", textColor);

    svg.append("g")
      .attr("transform", `translate(${this.margin.left},0)`)
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("fill", textColor);

    svg.append("text")
      .attr("x", this.chartWidth / 2)
      .attr("y", this.margin.top / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("fill", textColor)
      .text(this.data.title);
  }
}
