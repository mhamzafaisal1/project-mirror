/*** Angular Imports */
import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
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
import { switchMap, retry, share } from 'rxjs/operators';

/*** Model Imports */
import { ItemConfig } from '../shared/models/item.model';

/*** Component Imports */
import { ItemDialogCuComponent } from '../item-dialog-cu/item-dialog-cu.component';

/*** Service Imports */
import { ConfigurationService } from '../configuration.service';

@Component({
  selector: 'app-item-grid',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginator,
    MatSortModule,
    MatCheckboxModule,
    MatDividerModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './item-grid.component.html',
  styleUrl: './item-grid.component.scss'
})
export class ItemGridComponent implements OnInit, OnDestroy {
  selectionModel = new SelectionModel<ItemConfig>(false, []);
  page: number = 1;
  paginationSize: number = 10;
  displayedColumns: string[] = ['number', 'name', 'active'];
  dataSource: MatTableDataSource<ItemConfig>;

  sub: Subscription;
  items: ItemConfig[];
  emptyItem: ItemConfig = new ItemConfig().deserialize({ number: null, name: null, active: true });

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(private configurationService: ConfigurationService) {}

  readonly dialog = inject(MatDialog);

  private getItemsSubFunction = (res: ItemConfig[]) => {
    this.items = res;
    this.dataSource = new MatTableDataSource(res);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  };

  private getItems = timer(1, 30 * 1000).pipe(
    switchMap(() => this.configurationService.getItemConfigs()),
    retry({ delay: 5000 }),
    share()
  );

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
    if (!item) item = this.emptyItem;

    let dialogRef = this.dialog.open(ItemDialogCuComponent, {
      data: item,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(dialogItem => {
      if (!dialogItem) {
        console.log('Cancelled');
        return;
      }

      const action$ = dialogItem._id
        ? this.configurationService.putItemConfig(dialogItem)
        : this.configurationService.postItemConfig(dialogItem);

      action$.subscribe({
        next: (res) => {
          console.log('Success:', res);
          this.sub.unsubscribe();
          this.sub = this.getItems.subscribe(this.getItemsSubFunction);
          this.selectionModel.clear();
        },
        error: (err) => {
          dialogItem.error = err;
          dialogRef = this.dialog.open(ItemDialogCuComponent, {
            data: dialogItem,
            disableClose: true,
            panelClass: 'error-dialog'
          });
        }
      });
    });
  }

  deleteItem(item: ItemConfig): void {
    if (item) {
      this.configurationService.deleteItemConfig(item._id).subscribe(res => {
        this.sub.unsubscribe();
        this.sub = this.getItems.subscribe(this.getItemsSubFunction);
      });
    }
  }
}
