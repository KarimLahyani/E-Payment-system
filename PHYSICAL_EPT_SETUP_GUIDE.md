# Physical EPT Setup Guide (IFSF/OPI)

This guide details how to connect a physical Electronic Payment Terminal (EPT) — such as an Ingenico or Verifone device — to this POS (Point of Sale) application using the IFSF over IP (TCP) protocol.

By default, this application ships with a "Web-based Cashier Terminal Simulator." To use your real hardware, you will bypass the simulator and configure the Node.js backend to communicate directly with your physical terminal over your Local Area Network (LAN).

---

## 1. Network Connectivity Prerequisites

1. **Local Area Network**: Both your PC (running the POS app) and the physical EPT must be connected to the exact same LAN.
2. **Find the IP Addresses**:
   *   **PC IP Address**: Find your computer's local IPv4 address (e.g., `192.168.1.10`).
   *   **EPT IP Address**: Find the physical terminal's IP address (e.g., `192.168.1.50`). You can usually find this in the terminal's diagnostic or network settings menu.
3. **Firewall Rules**: Ensure your PC's firewall allows incoming TCP connections on the designated IFSF ports (default: `11111` and `22222`).

---

## 2. Configure the POS Application

The POS application needs to know where to send its payment requests and what ports to listen on for terminal events (like display messages and receipt printing).

1. Launch the POS Frontend UI in your browser.
2. Navigate to the configuration or network settings section (usually found in the Request Info form).
3. Apply the following settings:
   *   **Client IP (EPS IP)**: Change this from `127.0.0.1` to the **actual IP address of your physical EPT** (e.g., `192.168.1.50`).
   *   **Server IP**: Leave this completely blank, or set it to `0.0.0.0`, or explicitly set it to your PC's LAN IP address (`192.168.1.10`). Setting this correctly ensures the POS server binds to the network adapter and not just `localhost`.
   *   **EPS Port (Channel 1)**: Keep the default `11111` (or change it if your ECR setup demands a specific port).
   *   **POS Proxy Port (Channel 2)**: Keep the default `22222` (or change it accordingly).

> [!WARNING]
> If you make changes to these ports or IPs, you may need to restart the backend (`npm start`) to ensure the TCP sockets bind to the new configurations properly.

---

## 3. Configure the Physical EPT

You must configure the physical terminal to act as an IFSF EPS device. This requires entering the Technician, Admin, or Integrator menu on the device itself.

*Note: The exact menu paths vary heavily depending on the firmware (e.g., Ingenico TETRA, Verifone Engage), but the terminology is universally standard for IFSF/OPI.*

1. **Access the Integration Menu**: Enter your technician PIN to access the ECR / POS Integration settings.
2. **Set the Protocol**: Choose **IFSF IP**, **OPI**, or **TCP/IP Cash Register**.
3. **Configure the Endpoints**:
   *   **ECR IP / POS IP Address**: Set this to the LAN IP address of your PC (e.g., `192.168.1.10`).
   *   **ECR Port / Channel 1**: Set this to match the `epsPort` in your app (default: `11111`). This is the port the terminal will connect *to* when sending display/printer events.
   *   **Terminal Listening Port / Channel 2**: Set this to match the `posProxyPort` in your app (default: `22222`). This is the port the terminal will listen *on* to receive the `CardServiceRequest` (payment initiation) from the POS.

---

## 4. Crucial: Disable the Web Simulator

> [!IMPORTANT]
> **Do not open the "Web-based Cashier Terminal Simulator" browser window.**

The software simulator is designed to hijack and bind to the exact same TCP/WebSocket ports to mimic a physical device. If you leave the simulator window open, it will steal the network connections from your physical terminal, resulting in timeouts or instant test-approvals. 

Ensure the simulator tab is fully closed before attempting a physical transaction.

---

## 5. Executing a Transaction

1. Restart your Node.js backend (`npm start`) to ensure it boots up with a clean state and binds to the network correctly.
2. Ensure the physical terminal is powered on, connected to the network, and idling on the home screen.
3. In your POS Frontend UI, initiate a transaction.
4. The POS will generate the IFSF `<CardServiceRequest>` XML payload and send it over the TCP socket directly to your physical terminal.
5. The terminal should immediately wake up, prompt for a card, and route all display text (e.g., "ENTER PIN") and receipt data back to the POS UI exactly as the simulator did!

---

## 6. Using Custom / Business-Specific Cards

Whether you are using the Software Simulator or a Physical EPT, you can process business-specific, private, or fleet cards (such as custom Agil cards or company gift cards) instead of just standard Visa/Mastercard bank cards.

### In the Software Simulator:
You can create as many custom business/fleet cards as you want without writing any code:
1. Open the Web Simulator window (`http://localhost:3000/simulator`).
2. Scroll to the **"Manage Cards"** section and click **"Add New Card"**.
3. You can give the card any custom name (e.g., "Agil Fleet"), a specific starting card number (PAN), custom balance, and PIN.
4. The simulator will instantly recognize this new card and allow you to process payments with it.

### In the Physical World (Real EPT):
If you want to use custom physical cards in a real production environment, you absolutely can!
1. **Encode Physical Cards**: Purchase blank magstripe or RFID cards and use a card encoder to write custom track data to them (for example, generating PANs that start with a specific routing BIN like `70001234...`).
2. **Terminal Routing**: You must configure your physical terminal (via its technician menu) with a **Routing Table**. This configuration tells the terminal: *"If a card is swiped that starts with `7000`, do not attempt to contact the bank's authorization server. Instead, route it directly to the POS/Cash Register."*
3. **Local POS Authorization**: When swiped, the physical terminal will send a `CardServiceResponse` containing your custom card's PAN back to this POS application over IFSF. You can then extend this POS Node.js backend to look up that custom PAN in your own database (like a fleet management database), verify its balance, and approve it locally!
