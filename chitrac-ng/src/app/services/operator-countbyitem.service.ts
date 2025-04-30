import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OperatorCountbyitemService {
  constructor(private http: HttpClient) { }

  getOperatorCountByItem(startTime: string, endTime: string, operatorId?: number): Observable<any> {
    let params = new HttpParams()
      .set('startTime', startTime)
      .set('endTime', endTime);

    if (operatorId) {
      params = params.set('operatorId', operatorId.toString());
    }

    return this.http.get('/api/alpha/analytics/operator-countbyitem', { params });
  }
}
