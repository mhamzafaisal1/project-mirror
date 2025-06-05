import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, timer, forkJoin } from 'rxjs';
import { startWith, switchMap, share, retry } from 'rxjs/operators';
import { MatButtonModule } from "@angular/material/button";
import { DemoFlipperService } from '../../services/demo-flipper.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { BlanketBlasterModule } from '../blanket-blaster.module';
//import { MachineService } from '../machine.service';
//import { Duration } from 'luxon';

@Component({
  selector: 'ct-six-lane-flipper',
  templateUrl: './six-lane-flipper.component.html',
  styleUrls: ['./six-lane-flipper.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatIconModule,
    BlanketBlasterModule
  ]
})
export class SixLaneFlipperComponent implements OnInit, OnDestroy {

  sub: Subscription;
  subFiveMinutes: Subscription;
  subFifteenMinutes: Subscription;
  subHourly: Subscription;
  subDaily: Subscription;
  subStatus: Subscription;

  selectedDate: string | null = null;
  serialNumbers = [67808, 67806, 67807, 67805, 67804, 67803];

  ident(index: number, lane: any): number {
    return index;
  }

  public realDataArray: any[] = [];

  public sampleDataArray = [{
    "status": 1,
    "fault": "Run",
    "operator": "Maribel Sarco",
    "operatorId": 135814,
    "machine": "Blanket2",
    "timers": {
      "on": 0,
      "ready": 0
    },
    "displayTimers": {
      "on": "",
      "run": ""
    },
    "efficiency": {
      "today": {
        "value": 98,
        "label": "today",
        "color": "#008000"
      },
      "lastHour": {
        "value": 98,
        "label": "lastHour",
        "color": "#008000"
      },
      "lastFifteenMinutes": {
        "value": 115,
        "label": "lastFifteenMinutes",
        "color": "#008000"
      },
      "lastSixMinutes": {
        "value": 124,
        "label": "lastSixMinutes",
        "color": "#008000"
      }
    },
    "batch": {
      "item": "Bath Blankets",
      "code": 7
    }
  },
  {
    "status": 3,
    "fault": "Run",
    "operator": "Blanket2 Untracked",
    "operatorId": 967802,
    "machine": "Blanket2",
    "timers": {
      "on": 0,
      "ready": 0
    },
    "displayTimers": {
      "on": "",
      "run": ""
    },
    "efficiency": {
      "today": {
        "value": 0,
        "label": "today",
        "color": "#FF0000"
      },
      "lastHour": {
        "value": 0,
        "label": "lastHour",
        "color": "#FF0000"
      },
      "lastFifteenMinutes": {
        "value": 0,
        "label": "lastFifteenMinutes",
        "color": "#FF0000"
      },
      "lastSixMinutes": {
        "value": 0,
        "label": "lastSixMinutes",
        "color": "#FF0000"
      }
    },
    "batch": {
      "item": "Bath Blankets",
      "code": 7
    }
  },
  {
    "status": 0,
    "fault": "Run",
    "operator": "Torres Jackson",
    "operatorId": 135804,
    "machine": "Blanket2",
    "timers": {
      "on": 0,
      "ready": 0
    },
    "displayTimers": {
      "on": "",
      "run": ""
    },
    "efficiency": {
      "today": {
        "value": 116,
        "label": "today",
        "color": "#008000"
      },
      "lastHour": {
        "value": 134,
        "label": "lastHour",
        "color": "#008000"
      },
      "lastFifteenMinutes": {
        "value": 123,
        "label": "lastFifteenMinutes",
        "color": "#008000"
      },
      "lastSixMinutes": {
        "value": 131,
        "label": "lastSixMinutes",
        "color": "#008000"
      }
    },
    "batch": {
      "item": "Bath Blankets",
      "code": 7
    }
  }];

  public samplecDataArray = [{
    status: 1,
    fault: 'Run',
    operator: 'Brian Iguchi',
    machine: 'Flipper 1',
    timers: {
      on: 0,
      ready: 0,
    },
    displayTimers: {
      on: '',
      run: ''
    },
    efficiency: {
      lastFiveMinutes: {
        value: 97,
        label: 'Current',
        color: '#008000'
      },
      lastFifteenMinutes: {
        value: 89,
        label: '15 mins',
        color: '#008000'
      },
      lastHour: {
        value: 73,
        label: '1 hr',
        color: '#F89406'
      },
      today: {
        value: 54,
        label: 'Today',
        color: '#FF0000'
      }
    },
    batch: {
      item: 'Mixed Towels',
      customer: 'Hilton Chicago',
      code: 65518
    }
  }, {
    status: 1,
    fault: 'Run',
    operator: null,
    machine: 'Flipper 2',
    timers: {
      on: 0,
      ready: 0,
    },
    displayTimers: {
      on: '00:12:34',
      run: '00:56:12'
    },
    efficiency: {
      lastFiveMinutes: {
        value: 64,
        label: 'Current',
        color: '#555'
      },
      lastFifteenMinutes: {
        value: 99.5,
        label: '15 mins',
        color: '#555'
      },
      lastHour: {
        value: 105,
        label: '1 hr',
        color: '#555'
      },
      today: {
        value: 50,
        label: 'Today',
        color: '#555'
      }
    },
    batch: {
      item: 'Hand Towels',
      customer: 'Hilton Chicago',
      code: 65519
    }
  }, {
    status: -1,
    fault: 'STOPPED',
    operator: 'Jeremy Jones',
    machine: 'Flipper 3',
    timers: {
      on: 0,
      ready: 0,
    },
    displayTimers: {
      on: '00:12:34',
      run: '00:56:12'
    },
    efficiency: {
      lastFiveMinutes: {
        value: 88,
        label: 'Current',
        color: '#008000'
      },
      lastFifteenMinutes: {
        value: 87,
        label: '15 mins',
        color: '#008000'
      },
      lastHour: {
        value: 90,
        label: '1 hr',
        color: '#008000'
      },
      today: {
        value: 89,
        label: 'Today',
        color: '#008000'
      }
    },
    batch: {
      item: 'Gym Towels',
      customer: 'Hilton Chicago',
      code: 60647
    }
  }, {
    status: 30,
    fault: 'JAM @ PRIMARY',
    operator: 'Jake Carpenter',
    machine: 'Flipper 4',
    timers: {
      on: 0,
      ready: 0,
    },
    displayTimers: {
      on: '00:12:34',
      run: '00:56:12'
    },
    efficiency: {
      lastFiveMinutes: {
        value: 82,
        label: 'Current',
        color: '#F89406'
      },
      lastFifteenMinutes: {
        value: 91,
        label: '15 mins',
        color: '#008000'
      },
      lastHour: {
        value: 20,
        label: '1 hr',
        color: '#FF0000'
      },
      today: {
        value: 5,
        label: 'Today',
        color: '#FF0000'
      }
    },
    batch: {
      item: 'Gym Towels',
      customer: 'Hilton Chicago',
      code: 60647
    }
  }];

  constructor(private demoFlipperService: DemoFlipperService) { }

  public colorPicker = function(result: any) {
    if ((result.runTime < ((result.timeframe * 60) * 0.85)) && (result.timeframe != 1440 && result.timeframe != 5)) {
      return '#555';
    } else {
      if (result.efficiency >= 85) {
        return '#008000';
      } else if (result.efficiency >= 50) {
        return '#F89406';
      } else {
        return '#FF0000';
      }
    }
  }

  ngOnInit() {
    // Using dummy data instead of service calls
    this.subFiveMinutes = timer(1, 500)
      .pipe(
        startWith(0),
      ).subscribe(() => {
        // Keep existing data
      });

    this.subFifteenMinutes = timer(1, 1000)
      .pipe(
        startWith(0),
      ).subscribe(() => {
        // Keep existing data
      });

    this.subHourly = timer(1, 1000)
      .pipe(
        startWith(0),
      ).subscribe(() => {
        // Keep existing data
      });

    this.subDaily = timer(1, 1000)
      .pipe(
        startWith(0),
      ).subscribe(() => {
        // Keep existing data
      });

    this.subStatus = timer(1, 500)
      .pipe(
        startWith(0),
      ).subscribe(() => {
        // Keep existing data
      });
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
    if (this.subFiveMinutes) this.subFiveMinutes.unsubscribe();
    if (this.subFifteenMinutes) this.subFifteenMinutes.unsubscribe();
    if (this.subHourly) this.subHourly.unsubscribe();
    if (this.subDaily) this.subDaily.unsubscribe();
    if (this.subStatus) this.subStatus.unsubscribe();
  }

  fetchData() {
  
    const date = this.selectedDate || new Date().toISOString().split('T')[0];
  
    const apiCalls = this.serialNumbers.map(serial => 
      this.demoFlipperService.getLiveEfficiencySummary(serial, date)
    );
  
    forkJoin(apiCalls).subscribe({
      next: (results: any[]) => {
  
  
        this.realDataArray = results.flatMap((result, i) => {
          const serial = this.serialNumbers[i];
  
          if (!result) {
            console.warn(`No result returned for serial ${serial}`);
            return [];
          }
  
          if (!Array.isArray(result.flipperData)) {
            console.warn(`Invalid or missing flipperData for serial ${serial}:`, result);
            return [];
          }
  
          return result.flipperData;
        });
      },
      error: (err) => {
        console.error("Error during fetchData():", err);
      }
    });
  }
  
}
