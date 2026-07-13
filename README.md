# IFSF POS & Cashier Terminal Simulator

This project is a full-stack, web-based simulator designed to emulate an IFSF (International Forecourt Standards Forum) EPS (Electronic Payment Server) and POS interaction flow.

## Architecture

The system is composed of three main layers:
1. **Frontend (Terminal Simulator)**: A pure HTML/JS/CSS frontend served by a local development server. It simulates the Cashier Terminal where pump states, card entry, and PIN/passcode logic occur.
2. **Backend (Node.js)**: Acts as the Electronic Payment Server (EPS). It handles IFSF XML messages securely sent from the frontend via Socket.io. It also runs a separate TCP server component capable of communicating with actual POS hardware or proxy systems.
3. **Database (PostgreSQL)**: Handles persistent state storage for transactions, loyalty schemes, active cards, and authorization balances.

## Features

- **Database-Backed Card Profiles**: Instead of local browser cache, card profiles are permanently stored in a PostgreSQL `cards` table. 
- **Auto-Incremented Profiles**: New cards are automatically assigned sequential database IDs.
- **Dynamic Track Data**: The simulator automatically builds realistic IFSF compliant tokens (`T<PAN>`) securely on the fly from the card's 16-digit PAN.
- **Real-Time Balance Updates**: Card balances update persistently in PostgreSQL instantly upon transaction approval or refund via REST endpoints (`/api/cards`).
- **Complete IFSF XML Emulation**: Simulates complex sequences like `CardRequest/Response`, `DeviceRequest/Response`, `Authorisation`, and `LoyaltyAward`.

## Quick Start

### 1. Requirements
- Node.js (v20+)
- PostgreSQL (Listening on port 5432)
  - Default database: `request`
  - Default user: `postgres`
  - Default password: `976450`

### 2. Setup Database
If running for the first time, drop and reset the tables to ensure a clean slate:
```bash
cd backend
node drop_tables.js
```
The backend server will automatically run `init_db.sql` on startup, seeding 4 default card profiles.

### 3. Start the Platform
You can run both the frontend Angular/Vite dev server and the Node.js backend simultaneously:
```bash
npm start
```
The terminal simulator UI will be available at `http://localhost:4200/`. 

## Card System Rules

- **Passcodes:** When adding custom cards via the UI, a passcode is assigned securely. Standard cards require testing this passcode during the Authorization phase.
- **IDs & Sequences:** PostgreSQL handles primary keys (`id SERIAL`) automatically. You do not need to manually push IDs when calling the API.
- **Tokens Removed:** Static tokens are not stored. IFSF tokens are dynamically rendered by the terminal before transmission.
