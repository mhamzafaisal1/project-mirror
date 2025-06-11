import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
    selector: 'ct-six-lane-flipper',
    templateUrl: './six-lane-flipper.component.html',
    styleUrls: ['./six-lane-flipper.component.scss'],
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
        BlanketBlasterModule,
        MatSlideToggleModule
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

  public liveMode: boolean = false;
  public hasFetchedData: boolean = false;
  public realDataArray: any[] = [];

  private pollingTimeout: any = null;

  constructor(private demoFlipperService: DemoFlipperService) {}

  ident(index: number, lane: any): number {
    return index;
  }

  ngOnInit() {
    this.subFiveMinutes = this.createDummySub(500);
    this.subFifteenMinutes = this.createDummySub(1000);
    this.subHourly = this.createDummySub(1000);
    this.subDaily = this.createDummySub(1000);
    this.subStatus = this.createDummySub(500);
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
    if (this.subFiveMinutes) this.subFiveMinutes.unsubscribe();
    if (this.subFifteenMinutes) this.subFifteenMinutes.unsubscribe();
    if (this.subHourly) this.subHourly.unsubscribe();
    if (this.subDaily) this.subDaily.unsubscribe();
    if (this.subStatus) this.subStatus.unsubscribe();
    this.stopLivePolling();
  }

  private createDummySub(interval: number): Subscription {
    return new Subscription(); // Replace with logic if needed
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
          if (!result || !Array.isArray(result.flipperData)) {
            console.warn(`Invalid flipperData for serial ${serial}:`, result);
            return [];
          }
          return result.flipperData;
        });
        this.hasFetchedData = true;
      },
      error: (err) => {
        console.error("Error during fetchData():", err);
      }
    });
  }

  onLiveModeChange(checked: boolean) {
    this.liveMode = checked;

    if (this.liveMode) {
      this.startLivePolling();
    } else {
      this.stopLivePolling();
    }
  }

  private startLivePolling() {
    const dateToUse = this.selectedDate || new Date().toISOString().split('T')[0];

    const poll = () => {
      const apiCalls = this.serialNumbers.map(serial =>
        this.demoFlipperService.getLiveEfficiencySummary(serial, dateToUse)
      );

      forkJoin(apiCalls).subscribe({
        next: (results: any[]) => {
          this.realDataArray = results.flatMap((result, i) => {
            const serial = this.serialNumbers[i];
            if (!result || !Array.isArray(result.flipperData)) {
              console.warn(`Invalid flipperData for serial ${serial}:`, result);
              return [];
            }
            return result.flipperData;
          });
          this.hasFetchedData = true;

          if (this.liveMode) {
            this.pollingTimeout = setTimeout(poll, 1000); // 🔁 wait 1 second after each call
          }
        },
        error: (err) => {
          console.error("Polling error:", err);

          if (this.liveMode) {
            this.pollingTimeout = setTimeout(poll, 1000); // 🔁 retry after 1s
          }
        }
      });
    };

    poll(); // start initial poll
  }

  private stopLivePolling() {
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

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
  };
}
