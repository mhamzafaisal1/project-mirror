/** Angular imports */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/** Other module imports */
import { Observable } from 'rxjs/internal/Observable';

/** Model imports */
import { FaultConfig } from './shared/models/fault.model';
import { StatusConfig } from './shared/models/status.model';

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {

  constructor(private http: HttpClient) { }

  public getFaultConfigs(code?: number): Observable<FaultConfig[]> {
    return this.http.get<FaultConfig[]>('/api/faults/config');
  }

  public getStatusConfigs(code?: number): Observable<StatusConfig[]> {
    return this.http.get<StatusConfig[]>('/api/status/config');
  }
}
