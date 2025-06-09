import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'ct-lane-stop',
  templateUrl: './lane-stop.component.html',
  styleUrls: ['./lane-stop.component.scss']
})
export class LaneStopComponent implements OnInit {

  @Input()
  lane: any;

  constructor() { }

  ngOnInit() {
  }

}
