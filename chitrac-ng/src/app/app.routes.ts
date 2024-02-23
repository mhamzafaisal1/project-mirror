import { Routes } from '@angular/router';
import { ConfigGridTestComponent } from './config-grid-test/config-grid-test.component';

export const routes: Routes = [
	{ path: 'configGridTest', component: ConfigGridTestComponent },
	{ path: '**', redirectTo: '/configGridTest' }
	];
