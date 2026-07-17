import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { RequestInfoComponent } from './request-info/request-info.component';
import { ResponseInfoComponent } from './response-info/response-info.component';
import { PosDataComponent } from './pos-data/pos-data.component';
import { BasketComponent } from './basket/basket.component';
import { LoyaltyComponent } from './loyalty/loyalty.component';
import { SaleItemComponent } from './sale-item/sale-item.component';
import { ConfigurationModalComponent } from './configuration-modal/configuration-modal.component';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogModule } from '@angular/material/dialog'; // Ajout pour la popup
import { MatButtonModule } from '@angular/material/button';
import { CashierTerminalDialogComponent } from './cashier-terminal-dialog/cashier-terminal-dialog.component';
import { TransactionHistoryComponent } from './transaction-history/transaction-history.component';

@NgModule({
  declarations: [
    AppComponent,
    RequestInfoComponent,
    ResponseInfoComponent,
    PosDataComponent,
    BasketComponent,
    LoyaltyComponent,
    SaleItemComponent,
    ConfigurationModalComponent,
    CashierTerminalDialogComponent,
    TransactionHistoryComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    MatDialogModule, // Ajouté
    MatButtonModule  // Ajouté
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
