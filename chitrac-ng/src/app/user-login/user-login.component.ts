import { Component, inject, model, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

/*** rxjs Imports */
import { Subscription, timer } from 'rxjs';
import { startWith, switchMap, share, retry, debounceTime, distinctUntilChanged, first } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/*** Service Imports */
import { UserService } from '../user.service';

@Component({
    selector: 'app-user-login',
    imports: [
        CommonModule,
        MatFormFieldModule,
        MatInputModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule
    ],
    templateUrl: './user-login.component.html',
    styleUrl: './user-login.component.scss'
})
export class UserLoginComponent {

  sub: Subscription;

  userLoginFormGroup: FormGroup;

  user: any = {
    username: null,
    password: null
  };
  error: any = null;

  subscribeToUser(): void {
    if (this.sub) {
      this.sub.unsubscribe();
    }
    this.sub = this.userService.user.subscribe(x => this.user = x);
  }

  constructor(private userService: UserService, private route: ActivatedRoute, private router: Router) {
    
  }

  onSubmit(user: any): void {
    this.userService.postUserLogin(user).pipe(first())
      .subscribe({
        next: (user) => {
          console.log(user);
          // get return url from query parameters or default to home page
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
          this.router.navigateByUrl(returnUrl);
        },
        error: error => {
          console.log(error);
        }
      });
  }


  ngOnInit() {
    this.userLoginFormGroup = new FormGroup({
      username: new FormControl(this.user.username, [Validators.required, Validators.minLength(4)]),
      password: new FormControl(this.user.password, [Validators.required, Validators.minLength(6)]),
    });

    if (this.error) this.userLoginFormGroup.markAsDirty();

    this.userLoginFormGroup.valueChanges.pipe(
      debounceTime(1),
      distinctUntilChanged()
    ).subscribe(res => {
      this.user.username = res.username;
      this.user.password = res.password;
      this.user.active = res.active;
    });
    /*this.dialogRef.backdropClick().subscribe(result => {
      if (!this.userLoginFormGroup.pristine) {
        console.log('Are you sure?');
      } else {
        this.dialogRef.close();
      }
    });*/
  };


}
