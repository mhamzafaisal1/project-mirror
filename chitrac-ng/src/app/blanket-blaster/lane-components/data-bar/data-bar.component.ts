import { Component, OnInit, Input } from '@angular/core';

@Component({
    selector: 'ct-data-bar',
    templateUrl: './data-bar.component.html',
    styleUrls: ['./data-bar.component.scss'],
    standalone: false
})
export class DataBarComponent implements OnInit {

  @Input()
  efficiency: any;

  @Input()
  margin: any;

  constructor() { }

  ngOnInit() {
  }

}
