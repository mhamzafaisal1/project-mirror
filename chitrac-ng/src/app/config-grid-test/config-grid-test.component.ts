import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, timer } from 'rxjs';
import { startWith, switchMap, share, retry } from 'rxjs/operators';

import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

import { FaultConfig } from '../shared/models/fault.model';

import { ConfigurationService } from '../configuration.service';

@Component({
  selector: 'app-config-grid-test',
  standalone: true,
  imports: [CommonModule, NgbPagination ],
  templateUrl: './config-grid-test.component.html',
  styleUrl: './config-grid-test.component.css'
})
export class ConfigGridTestComponent implements OnInit, OnDestroy {
  public faults: FaultConfig[];
  sub: Subscription;
  page: number = 1;
  paginationSize: number = 10;

  constructor(private configurationService: ConfigurationService) { }

  ngOnInit() {
    this.sub = timer(1, (60*5*1000))
      .pipe(
        startWith(0),
        switchMap(() => this.configurationService.getFaultConfigs()),
        retry(),
        share()
    ).subscribe(res => this.faults = res);
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

}
