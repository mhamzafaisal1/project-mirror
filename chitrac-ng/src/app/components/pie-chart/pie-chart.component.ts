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

    // Define margins
    const margin = {
      top: 80,     // Reduced top margin
      right: 120,  // Right margin for labels
      bottom: 80,  // Bottom margin for labels
      left: 120    // Left margin for labels
    };

    const width = 700;
    const height = 700;
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;
    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? 'white' : 'black';

    const svgBase = d3.select(element)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const svg = svgBase
      .append('g')
      .attr('transform', `translate(${width/2}, ${height/2})`);

    const color = d3.scaleOrdinal()
      .domain(this.data.map(d => d.name))
      .range(d3.schemeSet2);

    const pie = d3.pie<PieChartDataPoint>().value(d => d.value);
    const arc = d3.arc<d3.PieArcDatum<PieChartDataPoint>>()
      .innerRadius(0)
      .outerRadius(radius);

    const data_ready = pie(this.data);

    // Calculate minimum angle for readable labels (in radians)
    const minAngle = 0.2;

    // Function to calculate label position with special handling for top and bottom labels
    const calculateLabelPosition = (d: d3.PieArcDatum<PieChartDataPoint>, index: number) => {
      const angle = d.endAngle - d.startAngle;
      const midAngle = d.startAngle + angle / 2;
      
      // Get the absolute cosine value to detect vertical labels (top and bottom)
      const cosMidAngle = Math.cos(midAngle);
      const absCos = Math.abs(cosMidAngle);
      
      // Detect if this is a vertical label (top or bottom)
      const isVerticalLabel = absCos > 0.85;
      const isTopLabel = isVerticalLabel && cosMidAngle > 0;
      const isBottomLabel = isVerticalLabel && cosMidAngle < 0;
      
      // Base label distance varies by position in the data array
      // This creates a staggered effect for nearby labels
      const baseMultiplier = 1.2 + (index % 2) * 0.2; // Alternates between 1.2 and 1.4
      let labelDistance = angle < minAngle ? radius * baseMultiplier * 1.3 : radius * baseMultiplier;
      
      // For very small slices or slices close to others, increase distance further
      if (d.value < 10) {
        labelDistance *= 1.1;
      }
      
      // Adjust distance for vertical labels
      if (isTopLabel) {
        labelDistance *= 1.1;  // Reduced multiplier for top labels
      } else if (isBottomLabel) {
        labelDistance *= 1.3;  // Keep the working multiplier for bottom labels
      }
      
      // Calculate position
      let x = Math.sin(midAngle) * labelDistance;
      let y = -Math.cos(midAngle) * labelDistance;
      
      // Adjust Y position for top labels to bring them closer
      if (isTopLabel) {
        y = Math.max(y, -radius * 1.2); // Limit how far up the top label can go
      }
      
      // For labels in the same quadrant, stagger them vertically
      const quadrant = Math.floor((midAngle + Math.PI * 0.25) / (Math.PI * 0.5));
      const verticalOffset = (index % 2) * 15; // Alternate 0 and 15 pixels offset
      y += verticalOffset;
      
      return {
        x,
        y,
        isVerticalLabel,
        isTopLabel,
        isBottomLabel,
        labelDistance,
        midAngle
      };
    };

    // Draw slices
    svg.selectAll('path')
      .data(data_ready)
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.name) as string)
      .attr('stroke', 'white')
      .style('stroke-width', '2px');

    // Add polylines
    const polylines = svg.selectAll('polyline')
      .data(data_ready)
      .enter()
      .append('polyline')
      .attr('stroke', textColor)
      .attr('fill', 'none')
      .attr('stroke-width', 1);

    // Add labels
    const labels = svg.selectAll('text')
      .data(data_ready)
      .enter()
      .append('text')
      .attr('dy', '0.35em')
      .style('fill', textColor)
      .style('font-size', '12px');

    // Update polylines and labels positions
    data_ready.forEach((d, i) => {
      const angle = d.endAngle - d.startAngle;
      const labelInfo = calculateLabelPosition(d, i);
      const midAngle = labelInfo.midAngle;
      
      // Start point (on the arc)
      const startPos = arc.centroid(d);
      
      // Calculate break point - this is where the line changes direction
      // Use a shorter distance for the first segment to make it look more natural
      const breakPointDistance = radius * 0.95; // Slightly less than the radius
      const breakPointX = Math.sin(midAngle) * breakPointDistance;
      const breakPointY = -Math.cos(midAngle) * breakPointDistance;
      
      // End point (where the label will be)
      const horizontalAdjust = labelInfo.isVerticalLabel ? 0 : (midAngle < Math.PI ? 15 : -15);
      const labelPos = [labelInfo.x + horizontalAdjust, labelInfo.y];

      // Update polyline with two segments
      polylines.nodes()[i].setAttribute('points', `
        ${startPos},
        ${breakPointX},${breakPointY},
        ${labelPos}
      `.trim());

      // Update label
      const label = labels.nodes()[i];
      d3.select(label)
        .attr('transform', `translate(${labelPos})`)
        .style('text-anchor', () => {
          if (labelInfo.isVerticalLabel) return 'middle';
          return midAngle < Math.PI ? 'start' : 'end';
        })
        .text(`${d.data.name} (${d.data.value}%)`);
    });
  }
}
