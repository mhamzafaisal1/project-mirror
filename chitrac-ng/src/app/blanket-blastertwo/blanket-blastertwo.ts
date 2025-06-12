import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlanketBlasterModule } from '../blanket-blaster/blanket-blaster.module';

@Component({
  selector: 'app-blanket-blastertwo',
  standalone: true,
  imports: [
    CommonModule,
    BlanketBlasterModule
  ],
  template: `
    <div class="container">
      <h2>Blanket Blaster Two</h2>
      <ct-demo-flipper 
        [serialNumber]="'67802'"
        [machineName]="'Blanket Blaster Two'">
      </ct-demo-flipper>
    </div>
  `,
  styles: [`
    .container {
      padding: 20px;
    }
  `]
})
export class BlanketBlastertwo {
  // Component is now a container for the demo-flipper
}
