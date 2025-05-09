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

interface OperatorMachineEfficiencyResponse {
  operator: {
    id: number;
    name: string;
  };
  timeRange: {
    start: string;
    end: string;
    total: string;
  };
  hourlyData: {
    hour: string;
    averageEfficiency: number;
    machines: {
      serial: number;
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

  getOperatorDailyEfficiency(startTime: string, endTime: string, operatorId: string): Observable<{
    operator: { id: number; name: string };
    timeRange: { start: string; end: string; totalDays: number };
    data: { date: string; efficiency: number }[];
  }> {
    const params = new HttpParams()
      .set('start', startTime)
      .set('end', endTime)
      .set('operatorId', operatorId);
  
    return this.http.get<{
      operator: { id: number; name: string };
      timeRange: { start: string; end: string; totalDays: number };
      data: { date: string; efficiency: number }[];
    }>('/api/alpha/analytics/operator/daily-efficiency', { params });
  }
  
}
