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
import { MatTimepickerModule } from '@angular/material/timepicker'; // ✅ new import

@Component({
  selector: 'app-date-time-modal',
  standalone: true,
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
    MatTimepickerModule // ✅ required
  ],
  templateUrl: './date-time-modal.component.html',
  styleUrls: ['./date-time-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateTimeModalComponent {
  startDate: Date | null = null;
  startTime: Date | null = new Date(); // ✅ must be Date for mat-timepicker
  mode: string = 'live';
}
