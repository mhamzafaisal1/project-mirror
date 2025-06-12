import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-date-time-picker',
    imports: [CommonModule, FormsModule],
    templateUrl: './date-time-picker.component.html',
    styleUrls: ['./date-time-picker.component.scss']
})
export class DateTimePickerComponent implements OnInit, OnDestroy {
  @Input() label: string = '';
  @Input() value: string = '';
  @Input() disabled: boolean = false;
  @Output() valueChange = new EventEmitter<string>();

  isDarkTheme = false;
  private observer!: MutationObserver;

  get inputId(): string {
    return this.label.toLowerCase().replace(/\s+/g, '-') + '-input';
  }

  constructor(private renderer: Renderer2, private elRef: ElementRef) {}

  ngOnInit() {
    this.detectTheme();
    this.observer = new MutationObserver(() => this.detectTheme());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private detectTheme() {
    const dark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = dark;
    const el = this.elRef.nativeElement;
    this.renderer.setStyle(el, 'background-color', dark ? '#121212' : '#ffffff');
    this.renderer.setStyle(el, 'color', dark ? '#e0e0e0' : '#000000');
  }
}
