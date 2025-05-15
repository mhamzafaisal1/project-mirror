import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-chart-tile',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './chart-tile.component.html',
  styleUrls: ['./chart-tile.component.scss']
})
export class ChartTileComponent {
  @Input() title: string = '';
  @Input() icon?: string; // optional Material icon name
}
