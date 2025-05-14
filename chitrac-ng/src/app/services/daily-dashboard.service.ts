import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DailyDashboardService {
  private apiUrl = '/api/alpha';

  constructor(private http: HttpClient) { }

  getMachineStatus(start: string, end: string, serial?: number): Observable<any> {
    let params = new HttpParams()
      .set('start', start)
      .set('end', end);

    if (serial) {
      params = params.set('serial', serial.toString());
    }

    return this.http.get(`${this.apiUrl}/analytics/daily-dashboard/machine-status`, { params });
  }

  getMachineOee(start: string, end: string): Observable<any> {
    const params = new HttpParams()
      .set('start', start)
      .set('end', end);
  
    return this.http.get(`${this.apiUrl}/analytics/daily-dashboard/machine-oee`, { params });
  }

  getAllMachinesItemHourlyStack(start: string, end: string): Observable<any> {
    const params = new HttpParams()
      .set('start', start)
      .set('end', end);

    return this.http.get(`${this.apiUrl}/analytics/daily-dashboard/item-hourly-stack`, { params });
  }
  
}
