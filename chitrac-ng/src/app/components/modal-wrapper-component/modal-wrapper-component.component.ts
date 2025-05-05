import { AfterViewInit, Component, ElementRef, ViewChild, ViewContainerRef, Renderer2, OnDestroy, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-modal-wrapper-component',
  standalone: true,
  templateUrl: './modal-wrapper-component.component.html',
  styleUrls: ['./modal-wrapper-component.component.scss']
})
export class ModalWrapperComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', { read: ViewContainerRef }) container!: ViewContainerRef;
  @ViewChild('modalWrapper') modalWrapperRef!: ElementRef;

  dialogRef = inject(MatDialogRef<ModalWrapperComponent>);
  dialogData = inject(MAT_DIALOG_DATA);
  renderer = inject(Renderer2);

  private observer!: MutationObserver;

  ngAfterViewInit() {
    // Dynamically load the component
    if (this.dialogData?.component) {
      const componentType = this.dialogData.component;
      const componentRef = this.container.createComponent(componentType);
      
      // Pass inputs to the component if provided
      if (this.dialogData.componentInputs) {
        Object.keys(this.dialogData.componentInputs).forEach(key => {
          componentRef.setInput(key, this.dialogData.componentInputs[key]);
        });
      }

      // Pass other data properties as inputs
      Object.keys(this.dialogData).forEach(key => {
        if (key !== 'component' && key !== 'componentInputs') {
          componentRef.setInput(key, this.dialogData[key]);
        }
      });
    }

    // Set initial theme styles
    this.applyThemeStyles();

    // Observe body class changes to detect theme switching
    this.observer = new MutationObserver(() => {
      this.applyThemeStyles();
    });

    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  applyThemeStyles() {
    const element = this.modalWrapperRef.nativeElement;
    const isDarkTheme = document.body.classList.contains('dark-theme');
  
    if (isDarkTheme) {
      this.renderer.setStyle(element, 'background-color', '#121212');
      this.renderer.setStyle(element, 'color', '#e0e0e0');
      this.renderer.setStyle(element, 'border', '2px solid rgba(255, 255, 255, 0.2)');
      this.renderer.setStyle(element, 'box-shadow', '0 8px 24px rgba(255, 255, 255, 0.15)');
    } else {
      this.renderer.setStyle(element, 'background-color', '#ffffff');
      this.renderer.setStyle(element, 'color', '#000000');
      this.renderer.setStyle(element, 'border', '2px solid rgba(0, 0, 0, 0.2)');
      this.renderer.setStyle(element, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.3)');
    }
  }

  close() {
    this.dialogRef.close();
  }
}
