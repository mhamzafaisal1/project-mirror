import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common'; //Needed for JSON Pipe

import { Subscription, timer } from 'rxjs';
import { startWith, switchMap, share, retry } from 'rxjs/operators';

import { AlphaService } from '../alpha.service';

@Component({
  selector: 'levelone-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './levelone-dashboard.component.html',
  styleUrl: './levelone-dashboard.component.scss'
})
export class LeveloneDashboardComponent {
  sub: Subscription;
  levelOne: Array<any>;

  constructor(private alphaService: AlphaService) { }

  ngOnInit() {
    this.sub = timer(1, (1000))
      .pipe(
        switchMap(() => this.alphaService.getLevelOne()),
        retry(),
        share()
      ).subscribe(res => {
        this.levelOne = res;
      });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  machineTrackBy(index: number, machine: any) {
    return machine.machineInfo?.serial;
  }
  operatorTrackBy(index: number, operator: any) {
    return operator.id;
  }
  itemTrackBy(index: number, item: any) {
    return item.id;
  }
}
