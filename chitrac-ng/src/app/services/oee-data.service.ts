import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

interface OperatorEfficiencyResponse {
  machine: {
    serial: string;
    name: string;
  };
  timeRange: {
    start: string;
    end: string;
  };
  hourlyData: {
    hour: string;
    oee: number;
    operators: {
      name: string;
      efficiency: number;
    }[];
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class OeeDataService {
  constructor(private http: HttpClient) { }

  getOperatorEfficiency(startTime: string, endTime: string, machineSerial: string): Observable<OperatorEfficiencyResponse> {
    const params = new HttpParams()
      .set('start', startTime)
      .set('end', endTime)
      .set('serial', machineSerial);

    return this.http.get<OperatorEfficiencyResponse>('/api/alpha/analytics/machine/operator-efficiency', { params });
  }
}
