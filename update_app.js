const fs = require('fs');
let code = fs.readFileSync('terminal-simulator/src/app.js', 'utf8');

// 1. Inject TicketReprint logic before CardServiceRequest
const reprintLogic =     if (xmlMessage.includes('RequestType="TicketReprint"')) {
      const reqId = xmlMessage.match(/RequestID="([^"]+)"/)?.[1] || "123";
      const popId = xmlMessage.match(/POPID="([^"]+)"/)?.[1] || "01";
      const workstationId = xmlMessage.match(/WorkstationID="([^"]+)"/)?.[1] || "POS01";
      const stanToReprint = xmlMessage.match(/STAN="([^"]+)"/)?.[1];

      let receiptPromise;

      if (stanToReprint) {
        receiptPromise = fetch('http://localhost:3000/api/history?limit=100')
          .then(r => r.json())
          .then(data => {
            const tx = data.transactions.find(t => t.stan === stanToReprint || t.id.toString() === stanToReprint);
            if (!tx) return "TRANSACTION NOT FOUND IN DATABASE";
            return fetch(\http://localhost:3000/api/history/\\)
              .then(r => r.json())
              .then(fullTx => {
                const decision = { 
                  approved: fullTx.response_info?.overall_result === 'Success', 
                  authCode: fullTx.response_info?.auth_code || 'N/A',
                  reason: fullTx.response_info?.overall_result === 'Success' ? 'Approved' : 'Declined'
                };
                const card = { 
                  name: fullTx.response_info?.customer_name || 'UNKNOWN', 
                  number: fullTx.response_info?.card_number || '**** 0000' 
                };
                
                let items = [];
                try {
                  if (typeof fullTx.basket_data?.sale_items === 'string') {
                     items = JSON.parse(fullTx.basket_data.sale_items);
                  } else if (fullTx.sale_items && Array.isArray(fullTx.sale_items)) {
                     items = fullTx.sale_items.map(i => ({
                       productName: i.product_name,
                       itemAmount: parseFloat(i.item_amount),
                       quantity: parseFloat(i.quantity)
                     }));
                  }
                } catch(e) {}
                
                const transaction = {
                  amount: parseFloat(fullTx.basket_data?.total_amount || 0),
                  currency: fullTx.basket_data?.currency || 'TND',
                  requestType: fullTx.request_info?.request_type || 'Unknown',
                  stan: stanToReprint,
                  items: items,
                  siteId: 'SITE-0142'
                };
                return buildReceipt(decision, card, transaction);
              });
          }).catch(e => {
            console.error(e);
            return "ERROR FETCHING FROM DB: " + e.message;
          });
      } else {
        receiptPromise = Promise.resolve(state.lastReceipt || "NO RECEIPT TO REPRINT");
      }

      const responseXml = \<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>
<CardServiceResponse ApplicationSender="TerminalSimulator" POPID="\" RequestID="\" WorkstationID="\" RequestType="TicketReprint" OverallResult="Success" xmlns="http://www.nrf-arts.org/IXRetail/namespace" xmlns:IFSF="http://www.ifsf.org/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.nrf-arts.org/IXRetail/namespace ./IFSF/XSD/CardServiceResponse.xsd">
  <Terminal>
    <TerminalID>TERM01</TerminalID>
    <STAN>\</STAN>
    <TerminalBatch>000001</TerminalBatch>
  </Terminal>
</CardServiceResponse>\;

      receiptPromise.then(receiptText => {
        const centerStr = (str, width = 40) => {
          if (str.length >= width) return str;
          const leftPadding = Math.floor((width - str.length) / 2);
          return " ".repeat(leftPadding) + str;
        };
        const paddedReprint = centerStr("*** REPRINT ***");
        send("TERM->APP", 1, "DeviceRequest", {
          device: "Printer",
          command: "ReceiptData",
          text: "\\n" + paddedReprint + "\\n\\n" + receiptText
        });
        
        setTimeout(() => {
          socket.emit('terminal:response', responseXml);
          setScreen(['TICKET REPRINT', 'SUCCESS']);
          setTimeout(() => { if (state.terminalMode === 'idle') setScreen(['WELCOME', 'Ready for transaction']); }, 2000);
        }, 500);
      });
      
      return;
    }

    if (xmlMessage.includes('CardServiceRequest')) {;

code = code.replace("    if (xmlMessage.includes('CardServiceRequest')) {", reprintLogic);

// 2. Inject AuthCode in Card block
const origCardBlock = \<Card>
    <PAN>\******\</PAN>
    <ExpiryDate>\</ExpiryDate>
    <CustomerName>\</CustomerName>
  </Card>\;
const newCardBlock = \<Card>
    <PAN>\******\</PAN>
    <ExpiryDate>\</ExpiryDate>
    <CustomerName>\</CustomerName>
    <AuthCode>\</AuthCode>
  </Card>\;

code = code.replace(origCardBlock, newCardBlock);

// 3. Fix missing TOTAL line and fallback transaction.amount calculation
const origTotalLogic = \    const amountStrFormatted = totalGross.toFixed(2);
    
    lines.push(lblSubtotal + " ".repeat(40 - lblSubtotal.length - subtotalStr.length) + subtotalStr);
    lines.push(lblTax + " ".repeat(40 - lblTax.length - taxStr.length) + taxStr);\;
const newTotalLogic = \    let finalTotal = totalGross > 0 ? totalGross : parseFloat(transaction.amount || 0);
    const amountStrFormatted = finalTotal.toFixed(2);
    
    lines.push(lblSubtotal + " ".repeat(40 - lblSubtotal.length - subtotalStr.length) + subtotalStr);
    lines.push(lblTax + " ".repeat(40 - lblTax.length - taxStr.length) + taxStr);
    lines.push(lblTotal + " ".repeat(40 - lblTotal.length - amountStrFormatted.length) + amountStrFormatted);\;

code = code.replace(origTotalLogic, newTotalLogic);

fs.writeFileSync('terminal-simulator/src/app.js', code);
console.log('Update complete.');
