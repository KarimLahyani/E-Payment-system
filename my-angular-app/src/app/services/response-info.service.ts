// src/app/services/response-info.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseInfo } from '../models/response-info.model';

@Injectable({
  providedIn: 'root'
})
export class ResponseInfoService {
// response-info.service.ts
private apiUrl = 'http://localhost:3000/response-info';// Ajustez selon votre serveur

  constructor(private http: HttpClient) {}

  getResponseInfo(): Observable<ResponseInfo> {
    return this.http.get<ResponseInfo>(this.apiUrl);
  }
}