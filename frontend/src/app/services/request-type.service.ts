import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RequestTypeService {
  private requestTypeSource = new BehaviorSubject<string>('');
  currentRequestType = this.requestTypeSource.asObservable();

  constructor() { }

  changeRequestType(requestType: string) {
    this.requestTypeSource.next(requestType);
  }
}