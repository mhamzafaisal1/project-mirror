/** Angular imports */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/** Other module imports */
import { Observable } from 'rxjs/internal/Observable';

/** Model imports */
import { FaultConfig } from './shared/models/fault.model';

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {

  constructor(private http: HttpClient) { }

  public getFaultConfigs(code?: number): Observable<FaultConfig[]> {
    return this.http.get<FaultConfig[]>('/api/faults/config');
  }
}
