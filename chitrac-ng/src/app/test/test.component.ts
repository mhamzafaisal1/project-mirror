import { Component } from "@angular/core";
import { CarouselComponent } from "../components/carousel-component/carousel-component.component";
import { LeveloneTableV2Component } from "../levelone-table-v2/levelone-table-v2.component";
import { LeveloneLineChartComponent } from "../levelone-line-chart/levelone-line-chart.component";
import { LevelonePieChartComponent } from "../levelone-pie-chart/levelone-pie-chart.component";
import { MachineItemSummaryTableComponent } from "../machine-item-summary-table/machine-item-summary-table.component";
import { MachineItemStackedBarChartComponent } from "../machine-item-stacked-bar-chart/machine-item-stacked-bar-chart.component";
import { CommonModule } from "@angular/common";
import { MatTabsModule } from "@angular/material/tabs";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { OperatorItemSummaryTableComponent } from "../operator-item-summary-table/operator-item-summary-table.component";
import { OperatorCyclePieChartComponent } from "../operator-cycle-pie-chart/operator-cycle-pie-chart.component";
import { OperatorFaultHistoryComponent } from "../operator-fault-history/operator-fault-history.component";
import { OperatorLineChartComponent } from "../operator-line-chart/operator-line-chart.component";
import { MachineDashboardComponent } from "../machine-dashboard/machine-dashboard.component";
import { DailyMachineStackedBarChartComponent } from "../daily-machine-stacked-bar-chart/daily-machine-stacked-bar-chart.component";

@Component({
  selector: "app-test",
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    CarouselComponent,
    LeveloneTableV2Component,
    LeveloneLineChartComponent,
    LevelonePieChartComponent,
    MachineItemSummaryTableComponent,
    MachineItemStackedBarChartComponent,
    OperatorItemSummaryTableComponent,
    OperatorCyclePieChartComponent,
    OperatorFaultHistoryComponent,
    OperatorLineChartComponent,
    MachineDashboardComponent,
    DailyMachineStackedBarChartComponent
  ],
  templateUrl: "./test.component.html",
  styleUrls: ["./test.component.scss"],
})
export class TestComponent {
  tabData = [
    // { label: 'Table View', component: LeveloneTableV2Component },
    // { label: 'Line Chart', component: LeveloneLineChartComponent },
    // { label: 'Pie Chart', component: LevelonePieChartComponent },
    {
      label: "Machine Item Summary",
      component: MachineItemSummaryTableComponent,
    },
    {
      label: "Machine Item Stacked Bar Chart",
      component: MachineItemStackedBarChartComponent,
    },
    {
      label: "Operator Item Summary",
      component: OperatorItemSummaryTableComponent,
    },
    {
      label: "Operator Cycle Pie Chart",
      component: OperatorCyclePieChartComponent,
    },
    {
      label: "Operator Fault History",
      component: OperatorFaultHistoryComponent,
    },
    {
      label: "Operator Performance Chart",
      component: OperatorLineChartComponent
    },
    {
      label: "Machine Dashboard",
      component: MachineDashboardComponent
    },
    {
      label: "Daily Machine Stacked Bar Chart",
      component: DailyMachineStackedBarChartComponent
    },
  ];
}
