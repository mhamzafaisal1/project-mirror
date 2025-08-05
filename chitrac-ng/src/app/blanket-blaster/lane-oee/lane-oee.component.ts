import { Component, OnInit, Input } from '@angular/core';

@Component({
    selector: 'ct-lane-oee',
    templateUrl: './lane-oee.component.html',
    styleUrls: ['./lane-oee.component.scss'],
    standalone: false
})
export class LaneOeeComponent implements OnInit {

  @Input()
  lane: any;

  constructor() { }

  ngOnInit() {
  }

}
