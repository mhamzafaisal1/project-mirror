import { Component } from '@angular/core';
import { CtMainMenuComponent } from './ct-main-menu/ct-main-menu.component';
import { NavMainMenuComponent } from './nav-main-menu/nav-main-menu.component';
import { ConfigGridTestComponent } from './config-grid-test/config-grid-test.component';
import { NgIf } from '@angular/common';


@Component({
  selector: 'ct-root',
  standalone: true,
  imports: [CtMainMenuComponent, NavMainMenuComponent, ConfigGridTestComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'chitrac-ng';
}
