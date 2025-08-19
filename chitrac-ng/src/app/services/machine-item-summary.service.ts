import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

interface MachineItemSummaryResponse {
  machine: {
    name: string;
    serial: number;
  };
  sessions: {
    start: string;
    end: string;
    workedTimeMs: number;
    workedTimeFormatted: string;
    items: {
      itemId: number;
      name: string;
      countTotal: number;
      standard: number;
      pph: number;
      efficiency: number;
    }[];
  }[];
  machineSummary: {
    totalCount: number;
    workedTimeMs: number;
    workedTimeFormatted: string;
    pph: number;
    proratedStandard: number;
    efficiency: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class MachineItemSummaryService {
  constructor(private http: HttpClient) {}

  getMachineItemSummary(startTime: string, endTime: string, machineSerial?: string): Observable<MachineItemSummaryResponse[]> {
    let params = new HttpParams()
      .set('start', startTime)
      .set('end', endTime);

    if (machineSerial) {
      params = params.set('serial', machineSerial);
    }

    return this.http.get<MachineItemSummaryResponse[]>('/api/alpha/analytics/machine-item-sessions-summary', { params });
  }
}
