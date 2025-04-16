import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
} from '@angular/core';
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

    const svgBase = d3.select(element)
    .append('svg')
    .attr('width', width + 200) // extra space on right/left for labels
    .attr('height', height + 200);
  
  const svg = svgBase
    .append('g')
    .attr('transform', `translate(${(width + 200) / 2}, ${height / 2})`);

    const color = d3.scaleOrdinal()
      .domain(this.data.map(d => d.name))
      .range(d3.schemeSet2);

    const pie = d3.pie<PieChartDataPoint>().value(d => d.value);
    const arc = d3.arc<d3.PieArcDatum<PieChartDataPoint>>()
      .innerRadius(0)
      .outerRadius(radius);

    const outerArc = d3.arc<d3.PieArcDatum<PieChartDataPoint>>()
      .innerRadius(radius * 1.1)
      .outerRadius(radius * 1.1);

    const data_ready = pie(this.data);

    // Draw slices
    svg.selectAll('path')
      .data(data_ready)
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.name) as string)
      .attr('stroke', 'white')
      .style('stroke-width', '2px');

    // Connector lines
    svg.selectAll('polyline')
      .data(data_ready)
      .enter()
      .append('polyline')
      .attr('stroke', textColor)
      .attr('fill', 'none')
      .attr('stroke-width', 1)
      .attr('points', d => {
        const posA = arc.centroid(d);
        const posB = outerArc.centroid(d);
        const posC = [...posB];
        const midAngle = (d.startAngle + d.endAngle) / 2;
        posC[0] = midAngle < Math.PI ? posC[0] + 10 : posC[0] - 10;
        return [posA, posB, posC].map(p => p.join(',')).join(' ');
      });

      svgBase.selectAll('text.label')
      .data(data_ready)
      .enter()
      .append('text')
      .attr('class', 'label')
      .text(d => `${d.data.name} (${d.data.value}%)`)
      .attr('x', d => {
        const pos = outerArc.centroid(d);
        const midAngle = (d.startAngle + d.endAngle) / 2;
        return ((width + 200) / 2) + pos[0] + (midAngle < Math.PI ? 20 : -20);
      })
      .attr('y', d => height / 2 + outerArc.centroid(d)[1] + 20)
      .style('text-anchor', d =>
        (d.startAngle + d.endAngle) / 2 < Math.PI ? 'start' : 'end'
      )
      .style('fill', textColor)
      .style('font-size', '12px')
      .style('alignment-baseline', 'middle');  }
}
