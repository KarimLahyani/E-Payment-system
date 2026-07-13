import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ConfigurationData {
  clientIp: string; // Renommé pour plus de clarté (anciennement ipAddress)
  serverIp: string; // Nouvelle propriété pour l'IP du serveur
  epsPort: number;
  posProxyPort: number;
  opiMode: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {
  private apiUrl = 'http://localhost:3000/configuration';

  constructor(private http: HttpClient) {}

  saveConfiguration(configData: ConfigurationData): Observable<ConfigurationData> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    console.log('Sending configuration data to backend:', configData);
    return this.http.post<ConfigurationData>(this.apiUrl, configData, { headers });
  }

  getConfiguration(): Observable<ConfigurationData> {
    return this.http.get<ConfigurationData>(this.apiUrl);
  }
}