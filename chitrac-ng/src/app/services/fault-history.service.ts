import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FaultCycle {
  start: string;
  end: string;
  duration: number;
  faultType: string;
}

export interface FaultSummary {
  faultType: string;
  count: number;
  totalDuration: number;
  formatted: {
    hours: number;
    minutes: number;
    seconds: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class FaultHistoryService {
  private readonly API_URL = 'http://localhost:9090/api/alpha/analytics/fault-history';

  constructor(private http: HttpClient) {}

  getFaultHistory(
    start: string,
    end: string,
    serial: number
  ): Observable<{ faultCycles: FaultCycle[]; faultSummaries: FaultSummary[] }> {
    const params = new HttpParams()
      .set('start', start)
      .set('end', end)
      .set('serial', serial.toString());

    return this.http.get<{ faultCycles: FaultCycle[]; faultSummaries: FaultSummary[] }>(
      this.API_URL,
      { params }
    );
  }
}
