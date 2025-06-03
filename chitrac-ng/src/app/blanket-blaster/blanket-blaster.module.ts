// src/app/features/blanket-blaster/blanket-blaster.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DemoFlipperComponent } from './demo-flipper/demo-flipper.component';
import { DataBarComponent } from './lane-components/data-bar/data-bar.component';
import { LaneFaultComponent } from './lane-fault/lane-fault.component';
import { LaneRunningComponent } from './lane-running/lane-running.component';
import { LaneRunningGreyedComponent } from './lane-running-greyed/lane-running-greyed.component';
import { LaneStopComponent } from './lane-stop/lane-stop.component';

@NgModule({
  declarations: [
    DemoFlipperComponent,
    DataBarComponent,
    LaneFaultComponent,
    LaneRunningComponent,
    LaneRunningGreyedComponent,
    LaneStopComponent
  ],
  imports: [CommonModule],
  exports: [DemoFlipperComponent]
})
export class BlanketBlasterModule {}
