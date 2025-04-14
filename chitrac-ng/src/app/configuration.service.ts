/** Angular imports */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/** Other module imports */
import { Observable } from 'rxjs/internal/Observable';

/** Model imports */
import { FaultConfig } from './shared/models/fault.model';
import { StatusConfig } from './shared/models/status.model';
import { OperatorConfig } from './shared/models/operator.model';
import { ItemConfig } from './shared/models/item.model';

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

  public getOperatorConfigs(): Observable<OperatorConfig[]> {
    return this.http.get<OperatorConfig[]>('/api/operator/config');
  }

  public postOperatorConfig(operator: OperatorConfig): Observable<OperatorConfig> {
    return this.http.post<OperatorConfig>('/api/operator/config', operator);
  }

  public putOperatorConfig(operator: OperatorConfig): Observable<OperatorConfig> {
    return this.http.put<OperatorConfig>('/api/operator/config', operator);
  }

  public deleteOperatorConfig(_id: string): Observable<OperatorConfig> {
    return this.http.delete<OperatorConfig>('/api/operator/config/' + _id);
  }

  public getItemConfigs(): Observable<ItemConfig[]> {
    return this.http.get<ItemConfig[]>('/api/item/config');
  }

  public postItemConfig(item: ItemConfig): Observable<ItemConfig> {
    return this.http.post<ItemConfig>('/api/item/config', item);
  }

  public putItemConfig(item: ItemConfig): Observable<ItemConfig> {
    return this.http.put<ItemConfig>('/api/item/config', item);
  }

  public deleteItemConfig(_id: string): Observable<ItemConfig> {
    return this.http.delete<ItemConfig>('/api/item/config/' + _id);
  }
}
