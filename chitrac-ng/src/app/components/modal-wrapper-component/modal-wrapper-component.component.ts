import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  ViewContainerRef,
  OnDestroy,
  inject,
  ChangeDetectorRef
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { CarouselComponent } from '../carousel-component/carousel-component.component';
import { UseCarouselComponent } from '../../use-carousel/use-carousel.component';

@Component({
  selector: 'app-modal-wrapper-component',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule], 
  templateUrl: './modal-wrapper-component.component.html',
  styleUrls: ['./modal-wrapper-component.component.scss']
})
export class ModalWrapperComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', { read: ViewContainerRef }) container!: ViewContainerRef;

  dialogRef = inject(MatDialogRef<ModalWrapperComponent>);
  dialogData = inject(MAT_DIALOG_DATA);
  private cdr = inject(ChangeDetectorRef);

  private observer!: MutationObserver;
  isDarkTheme: boolean = false;
  hasCarousel: boolean = false;
  private useCarouselComponent?: UseCarouselComponent;

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

    if (componentRef.instance instanceof CarouselComponent) {
      this.hasCarousel = true;
      this.useCarouselComponent = componentRef.instance as any;
      this.cdr.detectChanges();
    } else if (componentRef.instance instanceof UseCarouselComponent) {
      this.hasCarousel = true;
      this.useCarouselComponent = componentRef.instance;
      this.cdr.detectChanges();
    }
  }

  goToPreviousTab(): void {
    if (this.useCarouselComponent) {
      this.useCarouselComponent.goToPrevious();
    }
  }

  goToNextTab(): void {
    if (this.useCarouselComponent) {
      this.useCarouselComponent.goToNext();
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
