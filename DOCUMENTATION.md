# The Absolute Beginner's Guide to the IFSF Cashier Simulator

Welcome! If you are completely new to web development, servers, or this specific project, you are in the right place. We are going to break down exactly what this application is, how it works, what its features are, and the exact business logic behind it. By the end of this document, you will be able to explain this app to anyone as if you built it from scratch yourself.

---

## 1. What is this Project?

Imagine a petrol station. When you pump gas and walk inside to pay, the cashier uses a computer (a Point of Sale, or POS) to scan your items, swipe your loyalty card, and process your credit card. 

The physical fuel pump outside and the cashier's computer inside need a common language to talk to each other. In Europe and many other parts of the world, that language is **IFSF** (International Forecourt Standards Forum). 

This project is a **Web-Based IFSF Simulator**. It completely mimics the behavior of the Cashier Terminal computer. Instead of needing real, expensive hardware (like a physical fuel pump and a physical cash register), this software simulates the cashier's screen on a web browser. It allows you to trigger test transactions, send loyalty cards, and reply to hardware prompts, packaging everything into perfectly formatted IFSF messages.

---

## 2. Every Single Feature Explained

If someone asks you, "What exactly can this app do?", here is the master list of every single feature and input field you control. 

The frontend UI is divided into several sections (Components) that together build one massive IFSF request.

### Feature 1: Base Request Information (`request-info`)
This is where the core instruction is defined. What are we trying to do right now?
- **Request Type**: The main action. You can select actions like `CardPayment` (paying with a card), `LoyaltyAward` (applying a loyalty card discount), `LoyaltyAwardRefund` (canceling a loyalty discount), `Login`, or `Logout`.
- **STAN (System Trace Audit Number)**: A unique tracking number used in banking/payments to track a specific transaction across the network.
- **Auto Increment**: A toggle that, when turned on, automatically generates a new Request ID every time you hit send, so you don't have to type it manually.
- **Identifiers**: Fields like `POPID` (Point of Payment ID) and `WorkstationID` so the network knows exactly which register is making the request.

### Feature 2: POS Data (`pos-data`)
This section tells the network about the current physical state of the Cashier Terminal.
- **Language Code**: (e.g., `en` for English).
- **Shift Number & Clerk ID**: Identifies which employee is logged into the register.
- **Card Entry Mode**: Tells the system how the card was read (e.g., swiped, inserted, or tapped via NFC).

### Feature 3: Payment Amounts (`amount`)
This section handles the money.
- **Currency**: E.g., `EUR` or `USD`.
- **Total Amount**: The final price the customer owes.
- **Pre-Auth Amount**: Used primarily for petrol pumps where the system "reserves" money on your card before you start pumping.

### Feature 4: The Shopping Cart / Sale Items (`sale-item`)
The simulator generates up to 35 individual items that the cashier can add to the transaction.
- Each item has an **Item ID**, **Product Code** (like a barcode), **Quantity**, and **Unit Price**.
- If a discount is applied, it will show a **Rebate Label** and alter the final Amount of that specific item.

### Feature 5: Loyalty Cards (`loyalty`)
If the customer scans a club card.
- **Loyalty PAN**: The actual card number of the loyalty card.
- **Approval Code & Acquirer ID**: Details returned from the loyalty server when a discount is approved.

### Feature 6: Asynchronous Cashier Prompts (`cashier-terminal-dialog`)
Sometimes, the external hardware needs to ask the cashier a question in the middle of a transaction (e.g., "Customer forgot receipt, print again?").
- The app has a background listener. If it receives a `CashierTerminal` prompt from the network, a popup dialog instantly appears on the Angular web UI.
- The cashier clicks **YES** or **NO**.
- The app translates that click into a binary `<InBoolean>1</InBoolean>` (YES) or `0` (NO) and sends it back to the hardware.

### Feature 7: The "Undo Loyalty" Logic (Loyalty Award Refund)
This is a very specific, highly intelligent feature built into the backend (`routes.js`).
If a cashier sends a `LoyaltyAwardRefund` request (meaning the customer canceled their loyalty card halfway through):
1. The backend searches the PostgreSQL database for the original transaction using the `STAN` tracking number.
2. It looks at the original prices of the items *before* the discount was applied.
3. It magically creates a new shopping cart in the database, undoing all discounts, resetting the `Rebate Labels`, and recalculating the original `Total Amount`.

---

## 3. The Big Picture: How Web Apps Work

Before we dive into the code, let's understand the architecture using a restaurant analogy.

1. **The Frontend (The Dining Room & Menu)**: This is what you see on your screen. It has buttons, text fields, and popups. In a restaurant, this is the menu you read and the waiter you talk to.
2. **The Backend (The Kitchen)**: This is the hidden engine. It processes rules, talks to other computers, and saves data. In a restaurant, it's the kitchen cooking your food.
3. **The Database (The Pantry/Ledger)**: Where all the permanent information is stored (like old receipts).

In our project, these three parts are constantly talking to each other.

---

## 4. The Technologies We Use

### A. The Frontend: Angular
**What is it?** Angular is a tool created by Google for building websites. It uses **HTML** (for structure), **CSS** (for styling), and **TypeScript** (a stricter version of JavaScript for logic).
**Why use it?** It allows us to build a "Single Page Application" (SPA). This means when you click a button, the page doesn't go blank and reload. It instantly updates the screen.
**Where is it?** Everything inside the `frontend/` folder.

### B. The Backend: Node.js & Express
**What is it?** Node.js allows us to run JavaScript code on our computer (the server). Express is a tiny framework built on top of Node.js that makes it easy to receive HTTP requests (like when the frontend asks for data).
**Why use it?** It acts as the bridge. It takes button clicks from Angular and translates them into heavy network commands.
**Where is it?** Everything inside the `backend/` folder.

### C. The Network Protocol: TCP & XML
**What is it?** **TCP** (Transmission Control Protocol) is a way for computers to open a continuous, open pipeline of communication. **XML** is a way of writing data using tags (like `<TotalAmount>20.00</TotalAmount>`). 
**Why use it?** Real-world petrol station hardware uses TCP and XML. Our backend has to use exactly this method to successfully pretend to be a Cashier Terminal.

### D. The Database: PostgreSQL
**What is it?** A powerful, structured database system.
**Why use it?** When we simulate a payment, we want to save the receipt (`request_info`, `sale_items`, `response_info`) so we can look at it later or perform Refunds.

---

## 5. A Tour of the Folders

Let's walk through your project folder by folder.

### `package.json` (Root Directory)
This is the master instruction booklet. If you type `npm start`, this file tells the computer: *"Hey, launch the backend kitchen AND the frontend dining room at the exact same time."*

### `/frontend` (The Angular App)
- **`src/app/`**: This is where all the visual blocks (called **Components**) live. Every feature mentioned above (`amount`, `loyalty`, `pos-data`) has its own dedicated folder here containing its HTML and logic.
- **`src/app/services/`**: These are the "waiters". When a component needs data from the kitchen (backend), it uses a service to make an HTTP request (like saving the transaction).
- **`src/app/models/`**: Contains TypeScript interfaces. This defines the strict shape of our data so the app doesn't accidentally send letters instead of numbers for prices.

### `/backend` (The Node.js Server)
- **`server.js`**: The main power switch for the backend. It starts the engine.
- **`routes.js`**: The order ticket window. It receives all the data from the Angular forms and decides what to do with it (like executing the Loyalty Refund logic).
- **`tcpHandler.js`**: The most complex part. This opens the raw TCP network socket. It listens for incoming XML messages, processes them, handles timeouts, and sends XML replies.
- **`xmlGenerator.js`**: A master translator. It takes the plain JSON data from Angular and builds the massive, complex IFSF XML strings required by the hardware.
- **`database.js`**: The file that logs into your PostgreSQL database.

---

## 6. Step-by-Step Example: Triggering a Card Payment

To really understand how everything works together, here is the exact chronological flow of a Card Payment:

1. **The Cashier (You)**: Fills out the `request-info` form, sets Amount to 50 EUR, and clicks "Send Request" on the Angular UI.
2. **The Waiter (Angular)**: The `request-info.service.ts` gathers all your inputs into a single JSON object and sends an HTTP POST request to the backend.
3. **The Kitchen (Node.js)**: `routes.js` receives the data. It saves a record of the transaction into the PostgreSQL database (`INSERT INTO request_info...`).
4. **The Translator**: `routes.js` hands the data to `xmlGenerator.js`, which spits out a massive `<CardServiceRequest>` XML string.
5. **The Network (TCP)**: `tcpHandler.js` takes that XML string and shoots it across a TCP port (22222) to the external payment controller.
6. **The Response**: The external payment controller approves the payment and sends back a `<CardServiceResponse>` XML over TCP.
7. **The Update**: `tcpHandler.js` reads the response, sees `OverallResult="Success"`, and saves that Success to the database.
8. **The UI Update**: The Angular `response-info` component (which is constantly polling the backend) sees the new response and displays a bright green "Success" message to the cashier!

## Summary
You now know everything there is to know about this application. You know the features it simulates, the exact technologies it uses, the folder structure it lives in, and the chronological flow of how data moves from a simple button click down to a raw TCP network socket!
