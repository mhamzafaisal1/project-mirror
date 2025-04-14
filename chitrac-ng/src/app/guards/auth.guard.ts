import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

/*** Service Imports */
import { UserService, User } from '../user.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  user: User;
  constructor(
    private router: Router,
    private userService: UserService,
  ) {
    this.userService.user.subscribe(x => {
      this.user = x;
    });
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    /*this.userService.getCurrentUser().subscribe(x => { //START HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      console.log({ 'x': x });
      this.user = x;
    });*/
    let user: User = this.user;

    let isSettings = false;
    let isRoot = false;

    for (const urlPart of route.url) {
      if (urlPart.path == 'settings') {
        isSettings = true;
      }
      if (urlPart.path == 'root') {
        isRoot = true;
      }
    }

    if (user && user.username != null) {
      if (isRoot && user.username != 'root') {
        return false;
      } else {
        return true;
      }
    }

    // not logged in so redirect to login page with the return url
    this.router.navigate(['/ng/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

}