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
  totalRevenue: number = 0;
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

        const grouped: any[] = [];
        let currentGroup: any = null;

        for (const tx of rawTransactions) {
          // Clear basket total for requests that do not actually represent a financial transaction
          if (tx.requestType === 'TicketReprint' || tx.requestType === 'Login' || tx.requestType === 'Logoff') {
            tx.basketTotal = '0.00';
          }

          if (tx.isSplit && tx.splitId) {
            if (!currentGroup || currentGroup.splitId !== tx.splitId) {
              if (currentGroup) {
                currentGroup.basketTotal = currentGroup.basketTotal.toFixed(2);
                grouped.push(currentGroup);
              }
              currentGroup = {
                isGroup: true,
                id: tx.id.toString(),
                splitId: tx.splitId,
                requestTimestamp: tx.requestTimestamp,
                requestType: tx.requestType,
                basketTotal: tx.overallResult === 'Success' ? parseFloat(tx.basketTotal || '0') : 0,
                currency: tx.currency,
                stan: tx.stan ? tx.stan.toString() : '',
                linkedToId: tx.linkedToId,
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
              // Set the group's STAN to the first successful transaction's STAN if not already set, or just keep the first one
              // We do not append multiple STANs to avoid ruining the table layout
              if (!currentGroup.stan && tx.stan) {
                currentGroup.stan = tx.stan;
              }
              if (tx.linkedToId && !currentGroup.linkedToId) {
                currentGroup.linkedToId = tx.linkedToId;
              }
              currentGroup.transactions.push(tx);

              // Determine overall result logic for groups
              // If any transaction in the group was successful, the group as a whole is considered a Success
              // (because its basketTotal reflects the sum of successful payments)
              if (tx.overallResult === 'Success') {
                currentGroup.overallResult = 'Success';
              } else if (!currentGroup.overallResult || (currentGroup.overallResult !== 'Success' && (tx.overallResult === 'Failed' || tx.overallResult === 'Failure'))) {
                currentGroup.overallResult = 'Failed';
              }
            }
          } else {
            if (currentGroup) {
              currentGroup.basketTotal = currentGroup.basketTotal.toFixed(2);
              grouped.push(currentGroup);
              currentGroup = null;
            }
            if (tx.basketTotal && typeof tx.basketTotal === 'number') {
              tx.basketTotal = tx.basketTotal.toFixed(2);
            } else if (tx.basketTotal && typeof tx.basketTotal === 'string') {
              tx.basketTotal = parseFloat(tx.basketTotal).toFixed(2);
            }
            grouped.push(tx);
          }
        }
        if (currentGroup) {
          currentGroup.basketTotal = currentGroup.basketTotal.toFixed(2);
          grouped.push(currentGroup);
        }

        for (let i = 0; i < grouped.length; i++) {
          const current = grouped[i];
          if (current.requestType === 'CardPayment' && (current.overallResult === 'Success' || current.overallResult === 'Partial')) {
            for (let j = i + 1; j < grouped.length; j++) {
              const previous = grouped[j];
              if (previous.requestType === 'LoyaltyAward') {
                const currentAmount = parseFloat(current.basketTotal) || 0;
                const previousAmount = parseFloat(previous.basketTotal) || 0;
                if (Math.abs(currentAmount - previousAmount) < 0.001 && previous.overallResult === 'Success') {
                  current.linkedToId = previous.id;
                  break;
                }
              }
            }
          }
        }

        this.transactions = grouped;
        this.totalCount = data.totalCount || 0;
        
        // Use total revenue calculated by backend
        this.totalRevenue = data.totalRevenue || 0;

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

  openLinkedTransaction(linkedToId: string, event: Event): void {
    event.stopPropagation(); // Prevent the row click event from firing
    this.openDetails({ id: linkedToId });
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

  formatCardNumber(cardNumber: string | undefined): string {
    if (!cardNumber || cardNumber === 'Multiple Cards') return cardNumber || '';
    const clean = cardNumber.replace(/\*/g, '');
    if (clean.length >= 4) {
      return `**** ${clean.slice(-4)}`;
    }
    return `**** ${clean}`;
  }
}
