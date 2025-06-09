import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, timer, forkJoin, Subject } from 'rxjs';
import { startWith, switchMap, takeUntil } from 'rxjs/operators';
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
  pollingSub: Subscription;
  pollingDestroy$ = new Subject<void>();

  selectedDate: string | null = null;
  serialNumbers = [67808, 67806, 67807, 67805, 67804, 67803];

  public liveMode: boolean = false;
  public hasFetchedData: boolean = false;
  public realDataArray: any[] = [];

  constructor(private demoFlipperService: DemoFlipperService) {}

  ident(index: number, lane: any): number {
    return index;
  }

  ngOnInit() {
    this.subFiveMinutes = timer(1, 500).pipe(startWith(0)).subscribe(() => {});
    this.subFifteenMinutes = timer(1, 1000).pipe(startWith(0)).subscribe(() => {});
    this.subHourly = timer(1, 1000).pipe(startWith(0)).subscribe(() => {});
    this.subDaily = timer(1, 1000).pipe(startWith(0)).subscribe(() => {});
    this.subStatus = timer(1, 500).pipe(startWith(0)).subscribe(() => {});
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
    if (this.subFiveMinutes) this.subFiveMinutes.unsubscribe();
    if (this.subFifteenMinutes) this.subFifteenMinutes.unsubscribe();
    if (this.subHourly) this.subHourly.unsubscribe();
    if (this.subDaily) this.subDaily.unsubscribe();
    if (this.subStatus) this.subStatus.unsubscribe();
    if (this.pollingSub) this.pollingSub.unsubscribe();
    this.pollingDestroy$.next();
    this.pollingDestroy$.complete();
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

      this.pollingSub = timer(0, 6000)
      .pipe(
        takeUntil(this.pollingDestroy$),
        switchMap(() => {
          const dateToUse = this.selectedDate || new Date().toISOString().split('T')[0];
          const apiCalls = this.serialNumbers.map(serial =>
            this.demoFlipperService.getLiveEfficiencySummary(serial, dateToUse)
          );
          return forkJoin(apiCalls);
        })
      )
      .subscribe({
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
          console.error('Polling error:', err);
        }
      });
    } else {
      this.pollingDestroy$.next();
      this.pollingDestroy$ = new Subject<void>();
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
