import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

interface OperatorSummaryResponse {
  operatorName: string;
  machineName: string;
  itemName: string;
  workedTimeFormatted: {
    hours: number;
    minutes: number;
  };
  count: number;
  misfeed: number;
  pph: number;
  standard: number;
  efficiency: number;
}

@Injectable({
  providedIn: 'root'
})
export class OperatorSummaryService {
  constructor(private http: HttpClient) {}

  getOperatorSummary(startTime: string, endTime: string, operatorId?: number): Observable<OperatorSummaryResponse[]> {
    let params = new HttpParams()
      .set('start', startTime)
      .set('end', endTime);

    if (operatorId !== undefined) {
      params = params.set('operatorId', operatorId.toString());
    }

    return this.http.get<OperatorSummaryResponse[]>('/api/alpha/analytics/operator-item-summary', { params });
  }
}
