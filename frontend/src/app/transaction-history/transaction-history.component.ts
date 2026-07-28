import { Component, OnInit } from '@angular/core';
import { RequestInfoService } from '../services/request-info.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-transaction-history',
  templateUrl: './transaction-history.component.html',
  styleUrls: ['./transaction-history.component.css']
})
export class TransactionHistoryComponent implements OnInit {
  transactions: any[] = [];
  isLoading: boolean = true;

  // Pagination & Filtering
  page: number = 1;
  limit: any = 10;
  totalCount: number = 0;
  filters: any = {
    startDate: '',
    endDate: '',
    status: ''
  };

  // Detailed Modal
  isModalOpen: boolean = false;
  selectedTransaction: any = null;
  isLoadingDetails: boolean = false;

  Math = Math; // To use Math.ceil in template

  constructor(
    private requestInfoService: RequestInfoService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.fetchHistory();
  }

  fetchHistory(): void {
    this.isLoading = true;
    this.requestInfoService.getHistory(this.page, this.limit, this.filters).subscribe({
      next: (data) => {
        const rawTransactions = data.transactions || [];
        // Pre-process to clean up old DB entries and link CardPayment to preceding LoyaltyAward
        for (let i = 0; i < rawTransactions.length; i++) {
          const tx = rawTransactions[i];
          // Fix old DB entries that have " TND" appended to the amount string
          if (tx.basketTotal && typeof tx.basketTotal === 'string') {
            tx.basketTotal = tx.basketTotal.replace(/ (TND|EUR|USD|GBP|'|\$|)/g, '').trim();
          }
          if (tx.originalBasketTotal && typeof tx.originalBasketTotal === 'string') {
            tx.originalBasketTotal = tx.originalBasketTotal.replace(/ (TND|EUR|USD|GBP|'|\$|)/g, '').trim();
          }
        }

        for (let i = 0; i < rawTransactions.length - 1; i++) {
          const current = rawTransactions[i];
          const previous = rawTransactions[i + 1]; // Previous in time (since order is DESC)
          if (current.requestType === 'CardPayment' && (previous.requestType === 'LoyaltyAward' || previous.requestType === 'LoyaltyAwardRefund')) {
            const currentAmount = parseFloat(current.basketTotal) || 0;
            const previousAmount = parseFloat(previous.basketTotal) || 0;
            if (currentAmount === previousAmount && current.overallResult === 'Success' && previous.overallResult === 'Success') {
              current.linkedToId = previous.id;
            }
          }
        }

        const grouped: any[] = [];
        let currentGroup: any = null;

        for (const tx of rawTransactions) {
          if (tx.isSplit) {
            if (!currentGroup) {
              currentGroup = {
                isGroup: true,
                id: tx.id.toString(),
                requestTimestamp: tx.requestTimestamp,
                requestType: tx.requestType,
                basketTotal: tx.overallResult === 'Success' ? parseFloat(tx.basketTotal || '0') : 0,
                currency: tx.currency,
                stan: tx.stan ? tx.stan.toString() : '',
                overallResult: tx.overallResult,
                customerName: tx.customerName,
                cardNumber: tx.cardNumber,
                transactions: [tx]
              };
            } else {
              currentGroup.id = currentGroup.id + ', ' + tx.id;
              if (tx.cardNumber && currentGroup.cardNumber !== tx.cardNumber && !currentGroup.cardNumber.includes('Multiple')) {
                currentGroup.cardNumber = 'Multiple Cards';
                currentGroup.customerName = 'Multiple Customers';
              }
              if (tx.overallResult === 'Success') {
                currentGroup.basketTotal += parseFloat(tx.basketTotal || '0');
              }
              currentGroup.stan += tx.stan ? (', ' + tx.stan) : '';
              currentGroup.transactions.push(tx);

              // Determine overall result logic for groups (e.g. if any failed, mark partial or failed)
              if (tx.overallResult === 'Failed' && currentGroup.overallResult === 'Success') {
                currentGroup.overallResult = 'Partial';
              } else if (tx.overallResult === 'Success' && currentGroup.overallResult === 'Failed') {
                currentGroup.overallResult = 'Partial';
              }
            }
          } else {
            if (currentGroup) {
              currentGroup.basketTotal = currentGroup.basketTotal.toFixed(2);
              grouped.push(currentGroup);
              currentGroup = null;
            }
            grouped.push(tx);
          }
        }
        if (currentGroup) {
          currentGroup.basketTotal = currentGroup.basketTotal.toFixed(2);
          grouped.push(currentGroup);
        }

        this.transactions = grouped;
        this.totalCount = data.totalCount || 0;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching history', err);
        this.isLoading = false;
      }
    });
  }

  onLimitChange(event: any): void {
    this.limit = event.target.value;
    this.page = 1;
    this.fetchHistory();
  }

  onFilterChange(): void {
    this.page = 1;
    this.fetchHistory();
  }

  clearFilters(): void {
    this.filters = { startDate: '', endDate: '', status: '' };
    this.page = 1;
    this.fetchHistory();
  }

  nextPage(): void {
    if (this.limit !== 'all' && this.page * this.limit < this.totalCount) {
      this.page++;
      this.fetchHistory();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.fetchHistory();
    }
  }

  openDetails(tx: any): void {
    this.isModalOpen = true;
    this.isLoadingDetails = true;
    this.selectedTransaction = null;

    // For grouped splits, fetch the details of the most recent split request (first in the group array)
    const targetId = tx.isGroup ? tx.transactions[0].id : tx.id;

    this.requestInfoService.getTransactionDetails(targetId).subscribe({
      next: (data) => {
        this.selectedTransaction = data;
        this.selectedTransaction.linkedToId = tx.linkedToId;
        // Inject the grouped transactions into the selectedTransaction for the modal to display
        if (tx.isGroup) {
          this.selectedTransaction.isGroup = true;
          this.selectedTransaction.groupTransactions = tx.transactions;

          // Override the total paid to reflect the sum of all splits in the group
          const groupTotal = tx.transactions.reduce((sum: number, splitTx: any) => {
            if (splitTx.overallResult === 'Success') {
              return sum + parseFloat(splitTx.basketTotal || '0');
            }
            return sum;
          }, 0);
          if (this.selectedTransaction.basketData) {
            this.selectedTransaction.basketData.totalAmount = groupTotal.toFixed(2);
          }
        }
        this.isLoadingDetails = false;
      },
      error: (err) => {
        console.error('Error fetching transaction details', err);
        this.isLoadingDetails = false;
      }
    });
  }

  getBasketItemsTotal(items: any[]): string {
    if (!items || items.length === 0) return '0.00';
    const total = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    return total.toFixed(2);
  }

  hasDiscount(items: any[]): boolean {
    if (!items || !Array.isArray(items) || items.length === 0) return false;
    return items.some(item => {
      const label = item.rebateLabel;
      return label && typeof label === 'string' && label.trim().length > 0 && label !== 'null' && label !== 'undefined';
    });
  }

  getOriginalTotal(items: any[]): number {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => {
      if (item.rebateLabel && item.baseUnitPrice) {
        return sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.baseUnitPrice) || 0));
      }
      return sum + (parseFloat(item.amount) || 0);
    }, 0);
  }

  getOriginalItemAmount(item: any): number {
    return (parseFloat(item.quantity) || 0) * (parseFloat(item.baseUnitPrice) || 0);
  }

  closeDetails(): void {
    this.isModalOpen = false;
    this.selectedTransaction = null;
  }

  goBack(): void {
    this.router.navigate(['/request-info']);
  }
}
