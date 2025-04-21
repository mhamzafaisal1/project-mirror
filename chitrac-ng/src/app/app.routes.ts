import { Routes } from '@angular/router';
import { ConfigGridTestComponent } from './config-grid-test/config-grid-test.component';
//import { SettingsOperatorsComponent } from './settings-operators/settings-operators.component';
import { OperatorGridComponent } from './operator-grid/operator-grid.component';
import { ItemGridComponent } from './item-grid/item-grid.component';
import { UserLoginComponent } from './user-login/user-login.component';
import { UserRegisterComponent } from './user-register/user-register.component';
import { LeveloneDashboardComponent } from './levelone-dashboard/levelone-dashboard.component';
import { LeveloneTableComponent } from './levelone-table/levelone-table.component';
import { LeveloneTableV2Component } from './levelone-table-v2/levelone-table-v2.component';
import { LeveloneBarChartComponent } from './levelone-bar-chart/levelone-bar-chart.component';
import { LevelonePieChartComponent } from './levelone-pie-chart/levelone-pie-chart.component';
import { LeveloneLineChartComponent } from './levelone-line-chart/levelone-line-chart.component';


import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
	{ path: 'ng/configGridTest', component: ConfigGridTestComponent },
	{ path: 'ng/settings/operators', component: OperatorGridComponent, canActivate: [AuthGuard] },
	{ path: 'ng/settings/items', component: ItemGridComponent, canActivate: [AuthGuard] },
	{ path: 'ng/settings/root/users/register', component: UserRegisterComponent, canActivate: [AuthGuard] },
	{ path: 'ng/login', component: UserLoginComponent },
	{ path: 'ng/home', component: LeveloneDashboardComponent },
	{ path: 'ng/levelone-table', component: LeveloneTableComponent },
	{ path: 'ng/levelone-table-v2', component: LeveloneTableV2Component },
	{ path: 'ng/levelone-bar-chart', component: LeveloneBarChartComponent },
	{ path: 'ng/levelone-pie-chart', component: LevelonePieChartComponent },
	{ path: 'ng/levelone-line-chart', component: LeveloneLineChartComponent },
	{ path: 'ng/*', redirectTo: 'ng/home' }
	];
