/** Angular imports */
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

/** Other module imports */
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AlphaService {

  constructor(
    private router: Router,
    private http: HttpClient
  ) { }

  public getLevelOne() {
    return this.http.get<any[]>('/api/softrol/levelone/all');
  }
}
