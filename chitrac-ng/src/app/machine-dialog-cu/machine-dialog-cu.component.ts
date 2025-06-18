import { Component, OnInit, Output, EventEmitter, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogClose
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

/*** Model */
import { MachineConfig } from '../shared/models/machine.model';

@Component({
  selector: 'app-machine-dialog-cu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatSlideToggleModule
  ],
  templateUrl: './machine-dialog-cu.component.html',
  styleUrl: './machine-dialog-cu.component.scss'
})
export class MachineDialogCuComponent implements OnInit {
  @Output() submitEvent = new EventEmitter();

  readonly dialogRef = inject(MatDialogRef<MachineDialogCuComponent>);
  readonly dialogData = inject(MAT_DIALOG_DATA);

  machine: MachineConfig;
  machineName: string;
  error: any = null;
  machineFormGroup: FormGroup;

  @ViewChild('submit') submit: ElementRef;

  ngOnInit(): void {
    if (this.dialogData.error) {
      this.error = { ...this.dialogData.error };
      delete this.dialogData.error;
    }

    this.machine = { ...this.dialogData };
    this.machineName = this.machine.name + '';

    this.machineFormGroup = new FormGroup({
      serial: new FormControl(this.machine.serial, [Validators.required, Validators.min(1)]),
      name: new FormControl(this.machine.name, [Validators.required, Validators.minLength(2)]),
      ipAddress: new FormControl(this.machine.ipAddress), 
      lanes: new FormControl(this.machine.lanes, [Validators.required, Validators.min(1)]),
      active: new FormControl(this.machine.active, [Validators.required])
    });
    
    this.machineFormGroup.valueChanges
      .pipe(debounceTime(100), distinctUntilChanged())
      .subscribe(res => {
        this.machine.serial = res.serial;
        this.machine.name = res.name;
        this.machine.ipAddress = res.ipAddress;
        this.machine.lanes = res.lanes;
        this.machine.active = res.active;
      });
    

    this.dialogRef.backdropClick().subscribe(() => {
      if (!this.machineFormGroup.pristine) {
        console.log('Are you sure?');
      } else {
        this.dialogRef.close();
      }
    });
  }

  onSubmit() {
    this.submit.nativeElement.click();
  }
}
