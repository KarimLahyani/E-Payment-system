import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RequestInfoComponent } from './request-info/request-info.component';
import { ResponseInfoComponent } from './response-info/response-info.component';
import { PosDataComponent } from './pos-data/pos-data.component';
import { AmountComponent } from './amount/amount.component';
import { LoyaltyComponent } from './loyalty/loyalty.component';

const routes: Routes = [
  { 
    path: 'request-info', 
    component: RequestInfoComponent,
    children: [
      { path: 'pos-data', component: PosDataComponent },
      { path: 'amount', component: AmountComponent },
      { path: 'loyalty', component: LoyaltyComponent },
    ] 
  },
  { path: 'response-info', component: ResponseInfoComponent },
  { path: '', redirectTo: '/request-info', pathMatch: 'full' },
];



@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
