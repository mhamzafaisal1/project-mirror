import { Component, Renderer2 } from '@angular/core';
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

  /*@HostBinding('class')*/
  currentTheme: 'light-theme' | 'dark-theme' = 'dark-theme';

  constructor(private renderer: Renderer2) {
    this.renderer.addClass(document.body, this.currentTheme);
  }

  isDarkMode: boolean = true;

  onThemeChanged() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      this.renderer.removeClass(document.body, this.currentTheme);
      this.currentTheme = 'dark-theme';
      this.renderer.addClass(document.body, this.currentTheme);
    } else {
      this.renderer.removeClass(document.body, this.currentTheme);
      this.currentTheme = 'light-theme'
      this.renderer.addClass(document.body, this.currentTheme);
    }
  }
}
