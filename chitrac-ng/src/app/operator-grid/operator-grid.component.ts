/*** Angular Imports */
import { Component, OnInit, OnDestroy, ViewChild, model, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/*** Material Imports */
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { PageEvent, MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';

import { MatCheckboxModule } from '@angular/material/checkbox';


/*** rxjs Imports */
import { Subscription, timer } from 'rxjs';
import { startWith, switchMap, share, retry } from 'rxjs/operators';

/*** Model Imports */
import { OperatorConfig } from '../shared/models/operator.model';

/*** Component Imports */
import { OperatorDialogCuComponent } from '../operator-dialog-cu/operator-dialog-cu.component';

/*** Service Imports */
import { ConfigurationService } from '../configuration.service';


@Component({
  selector: 'operator-grid',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatPaginator, MatSortModule, MatCheckboxModule, MatDividerModule, MatButtonModule, MatIconModule],
  templateUrl: './operator-grid.component.html',
  styleUrl: './operator-grid.component.scss'
})
export class OperatorGridComponent implements OnInit, OnDestroy {
  operators: OperatorConfig[];
  dataSource: MatTableDataSource<OperatorConfig>;
  selectionModel = new SelectionModel<OperatorConfig>(false, []);

  sub: Subscription;
  page: number = 1;
  paginationSize: number = 10;

  displayedColumns: string[] = ['code', 'name', 'active'];

  emptyOperator: OperatorConfig = new OperatorConfig().deserialize({ code: null, name: null, active: true});

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  @ViewChild(MatSort) sort: MatSort;

  constructor(private configurationService: ConfigurationService) {
   }

  private getOpsSubFunction = (res: OperatorConfig[]) => {
    this.operators = Object.assign({}, res);
    this.dataSource = new MatTableDataSource(res);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private getOps = timer(1, (30 * 1000))
    .pipe(
      switchMap(() => this.configurationService.getOperatorConfigs()),
      retry(),
      share()
  );

  readonly dialog = inject(MatDialog);

  ngOnInit() {
    this.sub = this.getOps.subscribe(this.getOpsSubFunction);
  }

  openDialog(operator: OperatorConfig): void {
    if (!operator) {
      operator = this.emptyOperator;
    }
    
    let dialogRef = this.dialog.open(OperatorDialogCuComponent, {
      data: operator,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(dialogOperator => {
      if(!dialogOperator) {
        console.log('Exited');
        //cancelled
      } else if (dialogOperator._id) {
        console.log('Editing submit');
        //Editing existing operator
      const submitSub = this.configurationService.putOperatorConfig(dialogOperator).subscribe(res => {
        console.log(res);
        this.sub.unsubscribe();
        this.sub = this.getOps.subscribe(this.getOpsSubFunction);
        this.selectionModel.clear();
      }, err => {
        dialogOperator.error = err;
        dialogRef = this.dialog.open(OperatorDialogCuComponent, {
          data: dialogOperator,
          disableClose: true,
          panelClass: 'error-dialog',
        });
      });
    } else if (dialogOperator.name) {
        console.log('Creating submit');
        const submitSub = this.configurationService.postOperatorConfig(dialogOperator).subscribe(res => {
          console.log(res);
          this.sub.unsubscribe();
          this.sub = this.getOps.subscribe(this.getOpsSubFunction);
        }, err => {
          dialogOperator.error = err;
          dialogRef = this.dialog.open(OperatorDialogCuComponent, {
            data: dialogOperator,
            disableClose: true,
            panelClass: 'error-dialog',
          });
        });          
      } else {
        console.log('Cancel');
        //cancelled
      }
    });
  }

  deleteOperator(operator: OperatorConfig): void {
    if (operator) {
      const submitSub = this.configurationService.deleteOperatorConfig(operator._id).subscribe(res => {
        this.sub.unsubscribe();
        this.sub = this.getOps.subscribe(this.getOpsSubFunction);
      });

    }
  }


  handlePageEvent(e: PageEvent) {
    this.page = e.pageIndex;
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

}