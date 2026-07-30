# IFSF Payment Terminal Simulator

This is a self-contained browser simulator for an electronic payment terminal workflow. It is designed for testing business-specific card profiles, terminal prompts, driver/PIN code entry, authorisation decisions, and a visible app-to-terminal communication trace.

Open `index.html` in a browser to run it. No package install is required.

## What it simulates

- Merchant app sale/refund/pre-authorisation request.
- EPT-style terminal UI with card insertion, removal, display messages, PIN/code pad, and approval/decline screen.
- Business card profiles with BIN, masked PAN suffix, token, expiry, status, amount limit, offline capability, allowed product categories, and expected code.
- IFSF POS-EPS style XML message exchange over two logical channels:
  - Channel 0: service and card messages.
  - Channel 1: device prompts and receipt/display operations.
- Message pairs used by the simulator:
  - `ServiceRequest` / `ServiceResponse`
  - `CardRequest` / `CardResponse`
  - `DeviceRequest`

## IFSF compliance note

The public material around IFSF POS-EPS confirms the broad architecture: XML messages over TCP/IP-style channels, with card, service, and device message pairs. The exact normative schemas, field names, sequencing rules, conformance tests, and certification requirements are controlled by IFSF/Conexxus specifications and are not reproduced here.

So this project should be treated as an IFSF POS-EPS style simulator, not a certified IFSF implementation. To make it conform exactly, map the message builder in `src/app.js` to the licensed IFSF POS-EPS version you are targeting, then add schema validation and official conformance test cases.

## App database mapping

The simulator now maps each transaction to the schema you provided:

- `request_info`: request type, site/pop ID, reference number, workstation, sender, STAN, timestamp.
- `pos_data`: terminal state, card entry mode, batch, clerk/driver, pump/outdoor position, and POS flags.
- `basket_data`: total/pre-authorisation amount and currency.
- `sale_items`: one product row using your seeded `products.product_code` values (`101`, `102`, `201`, `301`, `202`).
- `loyalty`: used as a business-card token trace when a card profile has been inserted.
- `response_info`: final approved/declined result, terminal ID, batch, amount, and STAN.

The UI shows this under "Database write preview" and the "Copy DB" button copies the generated SQL. It is still a preview layer, not a live Postgres writer, because this workspace does not include your database connection string or backend API.

## Card profile safety

Use synthetic cards only. The simulator stores masked card data and profile tokens in browser local storage. It intentionally does not collect or store full PANs, real PIN blocks, EMV cryptograms, keys, or live acquirer credentials.

## Suggested next steps for stricter conformance

1. Choose the target IFSF version, for example POS-EPS V3 or POS-EPS API Part 4-30.
2. Replace the generic XML envelope in `buildIfsfXml()` with the exact licensed schema.
3. Add XSD/OpenAPI validation for every message before it appears in the log.
4. Add a real TCP/WebSocket adapter if your app needs to connect to the simulator as a separate process.
5. Add negative test scripts for declines, reversals, timeouts, duplicate correlation IDs, offline authorisation, and device errors.
