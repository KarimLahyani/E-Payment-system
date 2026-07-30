# IFSF POS & Cashier Terminal Simulator

This project is a full-stack, web-based simulator designed to emulate an IFSF (International Forecourt Standards Forum) EPS (Electronic Payment Server) and POS interaction flow.

## Architecture Overview

The system is composed of three main layers that work together to process and simulate fuel station or retail transactions:

1. **Frontend POS (Angular)**: A modern Angular application that acts as the Point of Sale system. It initiates transactions, manages the basket, and sends IFSF requests to the backend.
2. **Backend Server (Node.js)**: Acts as the IFSF EPS (Electronic Payment Server). It handles incoming HTTP requests from the POS, converts them into standard IFSF XML (e.g., `<CardServiceRequest>`), and manages the TCP socket connections to physical EPTs or the web simulator.
3. **Software Terminal Simulator**: A standalone HTML/JS simulator built into the backend that mimics the physical hardware of a credit card reader (EPT). It displays prompts like "ENTER PIN" and prints virtual receipts.
4. **Database (PostgreSQL)**: Handles persistent storage for transactions, response histories, and custom card profiles.

---

## Complete Step-by-Step Setup Guide

Follow these instructions carefully to install dependencies, set up the database, and launch the application.

### Step 1: Install Prerequisites

Before starting, ensure you have the following installed on your machine:
*   **Node.js**: Version 20 or higher. You can download it from [nodejs.org](https://nodejs.org/).
*   **PostgreSQL**: Version 14 or higher. You can download it from [postgresql.org](https://www.postgresql.org/download/).
*   **Git**: To clone the repository (optional if you downloaded the ZIP).

### Step 2: Install Project Dependencies

This project contains a root `package.json` that manages both the frontend and backend dependencies using `concurrently`.

1. Open a terminal or command prompt.
2. Navigate to the root directory of the project (where this `README.md` is located).
3. Run the following command to install dependencies for the root, frontend, and backend all at once:
   ```bash
   npm run install:all
   ```
   *(Note: This might take a few minutes as it downloads packages for both Angular and Node.js).*

### Step 3: Configure PostgreSQL

The backend requires a PostgreSQL database to store transaction and card data.

1. Open pgAdmin, psql, or your preferred database management tool.
2. Ensure you have a superuser named `postgres` with the password `976450`.
3. Create a new, completely empty database named: `request`

*(Note: If your local PostgreSQL setup uses a different username, password, or port, you must update the database connection string located in `backend/db.js` before proceeding).*

### Step 4: Initialize the Database Tables

If you are running the application for the very first time, you need to build the database schema and seed the initial data (like the default test cards).

1. Open a terminal in the root directory.
2. Navigate into the backend folder:
   ```bash
   cd backend
   ```
3. Run the table reset script:
   ```bash
   node drop_tables.js
   ```
   *(This will completely drop any existing tables and start fresh. The backend will automatically run `init_db.sql` on its next startup to rebuild everything).*
4. Navigate back to the root directory:
   ```bash
   cd ..
   ```

### Step 5: Start the Application

You are now ready to boot up the system! The root package contains a script that will start the Angular frontend and the Node.js backend simultaneously.

1. From the root directory, run:
   ```bash
   npm start
   ```
2. Wait a few moments. You should see logs indicating that the Angular Live Development Server is listening on port `4200` and the Node.js server is listening on port `3000`.

---

## How to Use the System

Once `npm start` is running successfully, you can interact with the different parts of the system via your web browser.

### 1. The POS Interface (Frontend)
Open your browser and navigate to:
**`http://localhost:4200`**

This is the main Point of Sale dashboard. Here you can build a basket of items, initiate a payment, and view the transaction history.

### 2. The Terminal Simulator
Open a **new tab** or window and navigate to:
**`http://localhost:3000/simulator`**

This is the software EPT simulator. When you click "Start Payment" on the POS, this window will "wake up", prompting you to select a card and enter a PIN. Once approved, it will display a printed receipt.

> **Important**: If you plan to connect a real, physical EPT terminal (like an Ingenico/Verifone), you **must close** this simulator tab. See the `PHYSICAL_EPT_SETUP_GUIDE.md` for detailed hardware instructions.

---

## Card System Features

*   **Database-Backed Profiles**: Card profiles (fake Visa/Mastercard/Fleet cards) are permanently stored in the `cards` table of your PostgreSQL database.
*   **Manage Cards**: You can create custom business or fleet cards directly from the Web Simulator's UI.
*   **Dynamic Tokens**: The simulator builds realistic IFSF-compliant tokens (`T<PAN>`) dynamically based on the 16-digit PANs.
*   **Card Masking**: Card numbers are strictly masked across the entire frontend and receipt generation (e.g., `**** 1234`) for visual compliance.
