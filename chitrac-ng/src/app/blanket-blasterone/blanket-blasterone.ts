import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlanketBlasterModule } from '../blanket-blaster/blanket-blaster.module';

@Component({
  selector: 'app-blanket-blasterone',
  standalone: true,
  imports: [
    CommonModule,
    BlanketBlasterModule
  ],
  template: `
    <div class="container">
      <h2>Blanket Blaster One</h2>
      <ct-demo-flipper 
        [serialNumber]="'67801'"
        [machineName]="'Blanket Blaster One'">
      </ct-demo-flipper>
    </div>
  `,
  styles: [`
    .container {
      padding: 20px;
    }
  `]
})
export class BlanketBlasterone {
  // Component is now a container for the demo-flipper
}
