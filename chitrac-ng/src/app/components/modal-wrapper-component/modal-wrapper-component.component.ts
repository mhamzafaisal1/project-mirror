import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  ViewContainerRef,
  OnDestroy,
  inject
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-wrapper-component',
  standalone: true,
  imports: [CommonModule], // 👈 Add this line
  templateUrl: './modal-wrapper-component.component.html',
  styleUrls: ['./modal-wrapper-component.component.scss']
})

export class ModalWrapperComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', { read: ViewContainerRef }) container!: ViewContainerRef;

  dialogRef = inject(MatDialogRef<ModalWrapperComponent>);
  dialogData = inject(MAT_DIALOG_DATA);

  private observer!: MutationObserver;
  isDarkTheme: boolean = false;

  ngAfterViewInit(): void {
    this.loadComponent();
    this.syncThemeWithBody();
    this.setupThemeObserver();
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  loadComponent(): void {
    if (!this.dialogData?.component) return;

    const componentRef = this.container.createComponent(this.dialogData.component);

    if (this.dialogData.componentInputs) {
      for (const [key, value] of Object.entries(this.dialogData.componentInputs)) {
        componentRef.setInput(key, value);
      }
    }

    for (const [key, value] of Object.entries(this.dialogData)) {
      if (key !== 'component' && key !== 'componentInputs') {
        componentRef.setInput(key, value);
      }
    }
  }

  syncThemeWithBody(): void {
    this.isDarkTheme = document.body.classList.contains('dark-theme');
  }

  setupThemeObserver(): void {
    this.observer = new MutationObserver(() => {
      this.syncThemeWithBody();
    });
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  close(): void {
    this.dialogRef.close();
  }
}
