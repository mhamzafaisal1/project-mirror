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
import { ItemConfig } from '../shared/models/item.model';

/*** Component Imports */
import { ItemDialogCuComponent } from '../item-dialog-cu/item-dialog-cu.component';

/*** Service Imports */
import { ConfigurationService } from '../configuration.service';


@Component({
    selector: 'app-item-grid',
    imports: [CommonModule, MatTableModule, MatPaginator, MatSortModule, MatCheckboxModule, MatDividerModule, MatButtonModule, MatIconModule],
    templateUrl: './item-grid.component.html',
    styleUrl: './item-grid.component.scss'
})
export class ItemGridComponent implements OnInit, OnDestroy {
  selectionModel = new SelectionModel<any>(false, []);
  page: number = 1;
  paginationSize: number = 10;
  displayedColumns: string[] = ['code', 'name', 'active'];
  dataSource: MatTableDataSource<any>;

  sub: Subscription;

  items: ItemConfig[];
  emptyItem: ItemConfig = new ItemConfig().deserialize({ code: null, name: null, active: true });


  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(private configurationService: ConfigurationService) {
  }

  private getItemsSubFunction = (res: ItemConfig[]) => {
    this.items = Object.assign({}, res);
    this.dataSource = new MatTableDataSource(res);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private getItems = timer(1, (30 * 1000))
    .pipe(
      switchMap(() => this.configurationService.getItemConfigs()),
      retry({'delay': 5000}),
      share()
    );

  readonly dialog = inject(MatDialog);


  ngOnInit() {
    this.sub = this.getItems.subscribe(this.getItemsSubFunction);
  }

  handlePageEvent(e: PageEvent) {
    this.page = e.pageIndex;
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  openDialog(item: ItemConfig): void {
    if (!item) {
      item = this.emptyItem;
    }

    let dialogRef = this.dialog.open(ItemDialogCuComponent, {
      data: item,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(dialogItem => {
      if (!dialogItem) {
        console.log('Exited');
        //cancelled
      } else if (dialogItem._id) {
        console.log('Editing submit');
        //Editing existing item
        const submitSub = this.configurationService.putOperatorConfig(dialogItem).subscribe(res => {
          console.log(res);
          this.sub.unsubscribe();
          this.sub = this.getItems.subscribe(this.getItemsSubFunction);
          this.selectionModel.clear();
        }, err => {
          dialogItem.error = err;
          dialogRef = this.dialog.open(ItemDialogCuComponent, {
            data: dialogItem,
            disableClose: true,
            panelClass: 'error-dialog',
          });
        });
      } else if (dialogItem.name) {
        console.log('Creating submit');
        const submitSub = this.configurationService.postOperatorConfig(dialogItem).subscribe(res => {
          console.log(res);
          this.sub.unsubscribe();
          this.sub = this.getItems.subscribe(this.getItemsSubFunction);
        }, err => {
          dialogItem.error = err;
          dialogRef = this.dialog.open(ItemDialogCuComponent, {
            data: dialogItem,
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

  deleteOperator(item: ItemConfig): void {
    if (item) {
      const submitSub = this.configurationService.deleteItemConfig(item._id).subscribe(res => {
        this.sub.unsubscribe();
        this.sub = this.getItems.subscribe(this.getItemsSubFunction);
      });

    }
  }

}
