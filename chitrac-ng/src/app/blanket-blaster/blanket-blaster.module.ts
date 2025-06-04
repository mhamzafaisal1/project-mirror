// src/app/features/blanket-blaster/blanket-blaster.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

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
  imports: [
    CommonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule
  ],
  exports: [DemoFlipperComponent]
})
export class BlanketBlasterModule {}
