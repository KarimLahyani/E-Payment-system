import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfigurationService, ConfigurationData } from '../services/configuration.service';

@Component({
  selector: 'app-configuration-modal',
  templateUrl: './configuration-modal.component.html',
  styleUrls: ['./configuration-modal.component.css']
})
export class ConfigurationModalComponent {
  configData: ConfigurationData = {
    clientIp: '127.0.0.1', // Valeur par défaut pour le client
    serverIp: '', // Initialisé vide, sera rempli par le backend
    epsPort: 11111,
    posProxyPort: 22222, // Mis à jour pour correspondre au backend
    opiMode: true
  };

  constructor(
    public dialogRef: MatDialogRef<ConfigurationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfigurationData,
    private configurationService: ConfigurationService
  ) {
    if (data) {
      this.configData = { ...data };
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.configurationService.saveConfiguration(this.configData).subscribe(
      (response) => {
        console.log('Configuration saved to backend:', response);
        this.dialogRef.close(this.configData);
      },
      (error) => {
        console.error('Error saving configuration to backend:', error);
        alert('Échec de l\'enregistrement de la configuration.');
      }
    );
  }
}
