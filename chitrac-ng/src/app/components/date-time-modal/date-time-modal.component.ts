import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

@Component({
    selector: 'app-date-time-modal',
    imports: [
        CommonModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatRadioModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule
    ],
    templateUrl: './date-time-modal.component.html',
    styleUrls: ['./date-time-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateTimeModalComponent {
  startDate: Date | null = new Date();
  mode: string = 'live';

  hours = Array.from({ length: 24 }, (_, i) => i);
  minutes = Array.from({ length: 60 }, (_, i) => i);
  selectedHour: number = new Date().getHours();
  selectedMinute: number = new Date().getMinutes();

  get startTime(): string {
    return `${this.pad(this.selectedHour)}:${this.pad(this.selectedMinute)}`;
  }

  private pad(val: number): string {
    return val.toString().padStart(2, '0');
  }
}
