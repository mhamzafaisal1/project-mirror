import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MachineAnalyticsService {

  constructor(private http: HttpClient) {}

  getMachinePerformance(startTime: string, endTime: string, machineSerial?: number): Observable<any> {
    let params = new HttpParams()
      .set('startTime', startTime)
      .set('endTime', endTime);

    if (machineSerial) {
      params = params.set('machineSerial', machineSerial.toString());
    }

    return this.http.get('/api/alpha/analytics/machine-performance', { params });
  }

  getRunCycles(startTime: string, endTime: string, machineSerial: number): Observable<any> {
    const params = new HttpParams()
      .set('startTime', startTime)
      .set('endTime', endTime)
      .set('machineSerial', machineSerial.toString());

    return this.http.get('/api/alpha/run-session/state/cycles', { params });
  }

  getOperatorCycles(startTime: string, endTime: string, machineSerial?: number): Observable<any> {
    let params = new HttpParams()
      .set('startTime', startTime)
      .set('endTime', endTime);

    if (machineSerial) {
      params = params.set('machineSerial', machineSerial.toString());
    }

    return this.http.get('/api/alpha/run-session/state/operator-cycles', { params });
  }
}
