# E-Payment System — IFSF Simulator Documentation

## 1. System Overview

This application simulates the full IFSF (International Forecourt Standards Forum) payment flow between a Cashier POS and a Payment Terminal. It is composed of three independent services that run concurrently:

| Service | Technology | URL | Purpose |
|---------|-----------|-----|---------|
| **Frontend POS** | Angular | `http://localhost:4200` | The cashier interface — build baskets, send payments, view history |
| **Backend EPS** | Node.js + PostgreSQL | `http://localhost:3000` | Translates JSON into IFSF XML, manages the database and TCP connections |
| **Terminal Simulator** | Vanilla HTML/JS | `http://localhost:3000/simulator` | Simulates a physical card reader — card selection, PIN entry, receipts |

All three start simultaneously with a single `npm start` from the project root.

---

## 2. Supported Request Types

The system enforces a strict whitelist. Only the following operations are fully functional:

| Request Type | Trigger | Description |
|--------------|---------|-------------|
| **CardPayment** | "Send" button | Standard payment. Sends the basket, POS data, and loyalty info to the terminal for card authorization. |
| **TicketReprint** | "Send" button | Reprints a previous receipt. The cashier searches by STAN or by Request ID. The backend queries the database for the original transaction and sends a reprint command to the terminal. |
| **Diagnosis** | "Send" button | Health check. The terminal instantly responds with "DIAGNOSIS OK" without any card interaction. |
| **LoyaltyAward** | "Bonus" button | Applies loyalty discounts to the basket. This uses a dedicated flow (see Section 4) and is triggered via the green "Bonus" button, not via "Send". |

Any other request type (e.g. `Login`, `Logoff`, `PaymentRefund`) is blocked by the frontend with an alert: *"[Type] is not implemented yet."*

---

## 3. Main POS Interface

The POS page (`/`) is divided into two columns:

### Left Column — Request Information
- **Request Type**: Dropdown to select the operation.
- **Ref Number / App Sender**: Identifiers included in the outbound IFSF XML header.
- **Request ID**: Auto-incremented per transaction. Cannot be manually edited.
- **POPID / Workstation ID**: Hardware identifiers for the POS terminal.
- **STAN**: System Trace Audit Number. Auto-filled on responses, but editable for `TicketReprint` searches.

### Right Column — Response Information
Displays the parsed XML response from the terminal once a transaction completes, including `OverallResult`, `ErrorCondition`, `TerminalID`, and `STAN`.

### Action Buttons
| Button | Function |
|--------|----------|
| **Send** | Submits the current request to the backend → terminal pipeline. Disabled during `LoyaltyAward`. |
| **Clear** | Resets all form fields. |
| **Abort** | Cancels a transaction mid-flight. The terminal receives an abort signal. |
| **Bonus** | Triggers the loyalty discount flow (see Section 4). Only enabled when `LoyaltyAward` is selected. |
| **New Transaction** | Resets the entire POS state for a fresh transaction. |
| **History** | Navigates to the Transaction History page. |
| **Configuration** | Opens a modal to edit connection settings (EPS IP/Port). |

### Sub-Tabs
Below the action buttons, three tabs provide additional configuration:
- **POS Data**: Language code, shift number, clerk ID, card entry mode.
- **Basket**: Product catalog (fetched from the database), quantity inputs, total amount calculation.
- **Loyalty**: Loyalty card number (PAN) and card entry mode for loyalty operations.

### Devices Section
At the bottom of the page:
- **Display**: Shows the current terminal screen text (e.g. "ENTER PIN", "APPROVED").
- **Printer Receipt**: Renders the receipt text returned by the terminal in a monospaced font.

---

## 4. Loyalty Discount Flow

When the cashier selects `LoyaltyAward` and clicks the **Bonus** button:

1. The frontend sends the basket items and the loyalty PAN to the backend.
2. The backend loads `terminal-simulator/src/discounts.json`, which defines discount rules per card type:
   ```json
   {
     "Premium Loyalty": {
       "discountPercentage": 15.0,
       "rebateLabel": "Premium Reward - 15% Off",
       "applicableProducts": ["101", "102"]
     }
   }
   ```
3. Eligible items in the basket have their prices reduced and a `rebateLabel` is applied.
4. The UI updates the basket total to reflect the discounted prices. Original prices are shown with a strikethrough.
5. The cashier then switches to `CardPayment` and clicks **Send** to authorize the discounted amount.

The resulting `CardPayment` transaction is **linked** to the original `LoyaltyAward` via a `linkedToId`, which appears as a clickable tag in the Transaction History.

---

## 5. Split Payment Flow

When split mode is enabled in POS Data, clicking **Send** opens a modal instead of sending immediately:

1. The modal shows the **Total Basket Amount** and a field to enter the amount to charge now.
2. Quick-select buttons (25%, 33%, 50%, 75%) pre-fill common splits.
3. On "Confirm & Send", only the specified amount is sent as a `CardPayment`.
4. After the terminal responds, the POS updates the **Paid Amount** and **Remaining Balance** in a status bar.
5. The cashier clicks **Send** again for the next chunk, repeating until the full amount is covered.

Each split chunk is saved as a separate `request_info` row in the database with its own response. In the Transaction History, split transactions are grouped together and can be expanded to see each individual payment.

---

## 6. Transaction History Page

Accessible via the **History** button or the `/history` route.

### Table Columns
| Column | Content |
|--------|---------|
| Req ID | Database primary key |
| Date & Time | Timestamp of the request |
| Request Type | `CardPayment`, `TicketReprint`, `LoyaltyAward`, etc. |
| Amount | Basket total. Shows original price struck through if a discount was applied. Split transactions display a yellow "Split" badge. |
| STAN | The System Trace Audit Number returned by the terminal |
| Customer / Card | Cardholder name and masked card number (last 4 digits only) |
| Result | Color-coded badge: green (Success), red (Failed), orange (Partial), gray (Aborted), yellow (Pending) |

### Features
- **Filters**: Date range (From/To), status (Success/Failed/Pending), and a "Clear Filters" reset.
- **Pagination**: 10, 50, 100 per page, or "All" in a scrollable view.
- **Total Revenue**: Displayed at the top — sum of all successful transaction amounts.
- **Detail Modal**: Clicking any row opens a detailed view showing Request Info, Response Info, POS Data, Payment Details, Loyalty Information, and a full Basket & Items table with per-item rebate breakdowns.
- **Linked Transactions**: `CardPayment` transactions that followed a `LoyaltyAward` show a clickable "Linked to #X" badge that jumps to the original loyalty transaction.
- **Split Breakdown**: Grouped split transactions show a table of each individual payment with its own STAN, amount, customer, and status.

---

## 7. Terminal Simulator

The simulator (`/simulator`) emulates a physical EPT (Electronic Payment Terminal).

### Card System
- Cards are stored in the PostgreSQL `cards` table with fields: name, type, PAN, expiry, passcode, balance, status.
- Default cards are seeded on first startup (e.g. "Karim Lahyani" — Premium Loyalty, "John Doe" — Standard Corporate).
- New cards can be created directly from the simulator UI.
- Cards can be `ACTIVE`, `BLOCKED`, or expired (based on expiry date).

### Transaction Flow
1. The simulator receives an XML `CardServiceRequest` via WebSocket.
2. It parses the request type, amount, and items.
3. The cashier selects a card and clicks "Insert Card".
4. The terminal prompts for PIN entry via a numeric keypad.
5. Validation checks: card status, expiry, PIN, and balance.
6. On success: deducts the amount from the card balance, builds a `CardServiceResponse` XML with `OverallResult="Success"`, and returns it.
7. The receipt is generated and sent back to the POS Display/Printer.

### Special Handling
- **Diagnosis**: Intercepted before any card logic. Returns instant success.
- **LoyaltyAward**: Processes discount rules from `discounts.json` and returns the modified basket without touching card balances.

---

## 8. Database Schema

| Table | Purpose |
|-------|---------|
| `request_info` | Core transaction record — request type, POPID, workstation ID, STAN, timestamp |
| `pos_data` | POS metadata — language, clerk ID, shift number, card entry mode, split flag |
| `basket_data` | Transaction amounts — total, pre-auth, currency |
| `sale_items` | Individual line items — product code, quantity, amount, rebate label |
| `loyalty` | Loyalty card details — PAN, card entry mode, bonus flag, discount amounts |
| `response_info` | Terminal response — overall result, error condition, STAN, terminal ID, card number, customer name |
| `products` | Product catalog — name, code, unit price, unit measure, tax code |
| `cards` | Simulated card profiles — name, type, PAN, expiry, passcode, balance, status |

---

## 9. Key Files

| File | Role |
|------|------|
| `backend/routes.js` | HTTP API endpoints, database insertions, XML dispatch |
| `backend/xmlGenerator.js` | Builds IFSF-compliant XML from JSON input |
| `backend/tcpHandler.js` | TCP socket management for physical EPT connections (port `22222`) |
| `backend/server.js` | Express server initialization, Socket.IO setup |
| `backend/init_db.sql` | Database schema and seed data |
| `frontend/src/app/request-info/` | Main POS component — forms, buttons, split modal, bonus logic |
| `frontend/src/app/transaction-history/` | History page — table, filters, pagination, detail modal |
| `frontend/src/app/basket/` | Shopping cart component — product selection, quantity, totals |
| `terminal-simulator/src/app.js` | Full terminal simulator logic — card validation, PIN, receipts, XML responses |
| `terminal-simulator/src/discounts.json` | Loyalty discount rules per card type |
