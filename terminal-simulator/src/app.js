(function () {
  

  const state = {
    cards: [],
    selectedCardId: "acme-fleet-diesel",
    transaction: null,
    terminalMode: "idle",
    insertedCardId: null,
    codeBuffer: "",
    messages: [],
    dbPreview: "",
    splitSession: null
  };

  let discountConfig = {};
  fetch('src/discounts.json').then(r => r.json()).then(data => discountConfig = data).catch(e => console.error("Could not load discounts", e));

  const el = {
    connectionStatus: document.querySelector("#connectionStatus"),
    saleForm: document.querySelector("#saleForm"),
    resultBox: document.querySelector("#resultBox"),
    amountInput: document.querySelector("#amountInput"),
    currencyInput: document.querySelector("#currencyInput"),
    transactionType: document.querySelector("#transactionType"),
    productInput: document.querySelector("#productInput"),
    siteInput: document.querySelector("#siteInput"),
    pumpInput: document.querySelector("#pumpInput"),
    driverInput: document.querySelector("#driverInput"),
    odometerInput: document.querySelector("#odometerInput"),
    offlineMode: document.querySelector("#offlineMode"),
    cardList: document.querySelector("#cardList"),
    cardForm: document.querySelector("#cardForm"),
    loadDefaultsBtn: document.querySelector("#loadDefaultsBtn"),
    insertCardBtn: document.querySelector("#insertCardBtn"),
    removeCardBtn: document.querySelector("#removeCardBtn"),
    terminalScreen: document.querySelector("#terminalScreen"),
    terminalLed: document.querySelector("#terminalLed"),
    pinpad: document.querySelector("#pinpad"),
    pinOutput: document.querySelector("#pinOutput"),
    messageLog: document.querySelector("#messageLog"),
    messageTemplate: document.querySelector("#messageTemplate"),
    clearLogBtn: document.querySelector("#clearLogBtn"),
    copyLogBtn: document.querySelector("#copyLogBtn"),
    copyDbBtn: document.querySelector("#copyDbBtn"),
    dbPreview: document.querySelector("#dbPreview"),
    resetBtn: document.querySelector("#resetBtn")
  };



  let currentRequestXml = '';

  const socket = io('http://localhost:3000');

  socket.on('connect', () => {
    setConnection('Connected to Server');
  });

  socket.on('disconnect', () => {
    setConnection('Disconnected');
  });

  socket.on('terminal:reset', () => {
    resetSimulator();
  });

  socket.on('terminal:abort', () => {
    state.splitSession = null;
    if (state.transaction) {
      setResult("Transaction aborted by Cashier.", "Failure");
      setConnection("Aborted");
      setScreen(["TRANSACTION", "ABORTED"]);
      
      const xmlResponse = buildSaleResponse(state.transaction, {
        overallResult: "Failure",
        errorCondition: "Aborted",
        errorReason: "Aborted by Cashier"
      });
      socket.emit("terminal:response", xmlResponse);

      send("TERM->APP", 1, "DeviceRequest", {
        device: "Printer",
        command: "ReceiptData",
        text: "\n" + center("TRANSACTION ABORTED") + "\n\n"
      });

      state.transaction = null;
      render();
      setTimeout(resetSimulator, 3000);
    }
  });

  socket.on('terminal:request', (xmlMessage) => {
    currentRequestXml = xmlMessage;
    
    if (xmlMessage.includes('RequestType="Diagnosis"')) {
      const reqId = xmlMessage.match(/RequestID="([^"]+)"/)?.[1] || "123";
      const popId = xmlMessage.match(/POPID="([^"]+)"/)?.[1] || "01";
      const workstationId = xmlMessage.match(/WorkstationID="([^"]+)"/)?.[1] || "POS01";

      const responseXml = `<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>
<CardServiceResponse ApplicationSender="TerminalSimulator" POPID="${popId}" RequestID="${reqId}" WorkstationID="${workstationId}" RequestType="Diagnosis" OverallResult="Success" xmlns="http://www.nrf-arts.org/IXRetail/namespace" xmlns:IFSF="http://www.ifsf.org/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.nrf-arts.org/IXRetail/namespace ./IFSF/XSD/CardServiceResponse.xsd">
  <Terminal>
    <TerminalID>TERM01</TerminalID>
    <STAN>${stan()}</STAN>
  </Terminal>
</CardServiceResponse>`;

      socket.emit('terminal:response', responseXml);
      setScreen(['DIAGNOSIS OK']);
      setTimeout(() => { if (state.terminalMode === 'idle') setScreen(['WELCOME', 'Ready for transaction']); }, 2000);
      return;
    }

    if (xmlMessage.includes('RequestType="TicketReprint"')) {
      const reqId = xmlMessage.match(/RequestID="([^"]+)"/)?.[1] || "123";
      const popId = xmlMessage.match(/POPID="([^"]+)"/)?.[1] || "01";
      const workstationId = xmlMessage.match(/WorkstationID="([^"]+)"/)?.[1] || "POS01";
      const stanToReprint = xmlMessage.match(/STAN="([^"]+)"/)?.[1];

      let receiptPromise;

      if (stanToReprint) {
        receiptPromise = fetch('http://localhost:3000/api/history?limit=100')
          .then(r => r.json())
          .then(data => {
            const targetIndex = data.transactions.findIndex(t => t.stan === stanToReprint || t.id.toString() === stanToReprint);
            if (targetIndex === -1) return "TRANSACTION NOT FOUND IN DATABASE";
            const targetTx = data.transactions[targetIndex];

            if (targetTx.is_split) {
              // Find contiguous split transactions for this group
              let startIndex = targetIndex;
              while (startIndex < data.transactions.length - 1 && data.transactions[startIndex + 1].is_split) startIndex++;
              let endIndex = targetIndex;
              while (endIndex > 0 && data.transactions[endIndex - 1].is_split) endIndex--;
              
              const splitGroup = data.transactions.slice(endIndex, startIndex + 1).reverse();
              
              return Promise.all(splitGroup.map(stx => fetch(`http://localhost:3000/api/history/${stx.id}`).then(r => r.json())))
                .then(fullTxs => {
                  const firstTx = fullTxs[0];
                  const decision = { 
                    approved: targetTx.overall_result === 'Success', 
                    authCode: targetTx.auth_code || 'N/A',
                    reason: targetTx.overall_result === 'Success' ? 'Approved' : 'Declined'
                  };
                  const card = { 
                    name: targetTx.customer_name || 'UNKNOWN', 
                    number: targetTx.card_number || '**** 0000' 
                  };
                  
                  let items = [];
                  try {
                    if (typeof firstTx.basket_data?.sale_items === 'string') {
                       items = JSON.parse(firstTx.basket_data.sale_items);
                    } else if (firstTx.sale_items && Array.isArray(firstTx.sale_items)) {
                       items = firstTx.sale_items.map(i => {
                         let info = { unitPrice: 0, unitMeasure: '', taxCode: 'A' };
                         if (typeof i.add_prod_info === 'string') {
                           const parts = i.add_prod_info.split(';');
                           if (parts.length > 1 && parts[1].includes('=')) {
                             const unitParts = parts[1].split('=')[1].split('/');
                             info.unitPrice = parseFloat(unitParts[0]) || 0;
                             info.unitMeasure = unitParts[1] || '';
                           }
                           if (parts.length > 2 && parts[2].includes('=')) {
                             info.taxCode = parts[2].split('=')[1].trim();
                           }
                         }
                         return {
                           productName: i.product_name || i.product_code,
                           amount: parseFloat(i.amount),
                           quantity: parseFloat(i.quantity),
                           unitPrice: info.unitPrice,
                           unitMeasure: info.unitMeasure,
                           taxCode: info.taxCode
                         };
                       });
                    }
                  } catch(e) {}
                  
                  const transaction = {
                    amount: parseFloat(firstTx.basket_data?.total_amount || 0),
                    currency: firstTx.basket_data?.currency || 'TND',
                    requestType: firstTx.request_info?.request_type || 'Unknown',
                    stan: stanToReprint,
                    items: items,
                    siteId: 'SITE-0142',
                    split: true
                  };
                  
                  const splitSession = { payments: [] };
                  fullTxs.forEach(ftx => {
                    splitSession.payments.push({
                      amount: parseFloat(ftx.request_info?.amount || ftx.basket_data?.total_amount || 0),
                      cardNumber: ftx.response_info?.card_number || '**** 0000',
                      cardName: ftx.response_info?.customer_name || 'UNKNOWN',
                      authCode: ftx.response_info?.auth_code || 'N/A',
                      reason: ftx.response_info?.overall_result === 'Success' ? 'Approved' : 'Declined'
                    });
                  });

                  return buildReceipt(decision, card, transaction, splitSession);
                });
            } else {
              return fetch(`http://localhost:3000/api/history/${targetTx.id}`)
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
                       items = fullTx.sale_items.map(i => {
                         let info = { unitPrice: 0, unitMeasure: '', taxCode: 'A' };
                         if (typeof i.add_prod_info === 'string') {
                           const parts = i.add_prod_info.split(';');
                           if (parts.length > 1 && parts[1].includes('=')) {
                             const unitParts = parts[1].split('=')[1].split('/');
                             info.unitPrice = parseFloat(unitParts[0]) || 0;
                             info.unitMeasure = unitParts[1] || '';
                           }
                           if (parts.length > 2 && parts[2].includes('=')) {
                             info.taxCode = parts[2].split('=')[1].trim();
                           }
                         }
                         return {
                           productName: i.product_name || i.product_code,
                           amount: parseFloat(i.amount),
                           quantity: parseFloat(i.quantity),
                           unitPrice: info.unitPrice,
                           unitMeasure: info.unitMeasure,
                           taxCode: info.taxCode
                         };
                       });
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
            }
          }).catch(e => {
            console.error(e);
            return "ERROR FETCHING FROM DB: " + e.message;
          });
      } else {
        receiptPromise = Promise.resolve(state.lastReceipt || "NO RECEIPT TO REPRINT");
      }

      const responseXml = `<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>
<CardServiceResponse ApplicationSender="TerminalSimulator" POPID="${popId}" RequestID="${reqId}" WorkstationID="${workstationId}" RequestType="TicketReprint" OverallResult="Success" xmlns="http://www.nrf-arts.org/IXRetail/namespace" xmlns:IFSF="http://www.ifsf.org/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.nrf-arts.org/IXRetail/namespace ./IFSF/XSD/CardServiceResponse.xsd">
  <Terminal>
    <TerminalID>TERM01</TerminalID>
    <STAN>${stan()}</STAN>
    <TerminalBatch>000001</TerminalBatch>
  </Terminal>
</CardServiceResponse>`;

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
          text: "\n" + paddedReprint + "\n\n" + receiptText
        });
        
        setTimeout(() => {
          socket.emit('terminal:response', responseXml);
          setScreen(['TICKET REPRINT', 'SUCCESS']);
          setTimeout(() => { if (state.terminalMode === 'idle') setScreen(['WELCOME', 'Ready for transaction']); }, 2000);
        }, 500);
      });
      
      return;
    }

    if (xmlMessage.includes('CardServiceRequest')) {
      const reqTypeMatch = xmlMessage.match(/RequestType="([^"]+)"/);
      const reqType = reqTypeMatch ? reqTypeMatch[1] : 'CardPayment';
      const amountMatch = xmlMessage.match(/<TotalAmount[^>]*>([\d\.]+)<\/TotalAmount>/);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
      const isManual = xmlMessage.includes('CardEntryMode="Typed Card Number"');
      const isSplit = xmlMessage.includes('Split="true"') || xmlMessage.includes('Split="True"');
      const basketTotalMatch = xmlMessage.match(/BasketTotal="([^"]+)"/);
      const parsedBasketTotal = basketTotalMatch ? parseFloat(basketTotalMatch[1]) : amount;
      const languageMatch = xmlMessage.match(/LanguageCode="([^"]+)"/i);
      const languageCode = languageMatch ? languageMatch[1].toUpperCase() : 'EN';
      const reqIdMatch = xmlMessage.match(/RequestID="([^"]+)"/);
      const requestId = reqIdMatch ? reqIdMatch[1] : correlationId();
      
      const items = [];
      const itemRegex = /<SaleItem[^>]*>([\s\S]*?)<\/SaleItem>/g;
      let itemMatch;
      while ((itemMatch = itemRegex.exec(xmlMessage)) !== null) {
        const itemXml = itemMatch[1];
        const productName = (itemXml.match(/<ProductName[^>]*>([^<]+)<\/ProductName>/) || [])[1] || 'Unknown';
        const productCode = (itemXml.match(/<ProductCode[^>]*>([^<]+)<\/ProductCode>/) || [])[1] || '0';
        const quantity = parseFloat((itemXml.match(/<Quantity[^>]*>([\d\.]+)<\/Quantity>/) || [])[1] || 1);
        const unitPrice = parseFloat((itemXml.match(/<UnitPrice[^>]*>([\d\.]+)<\/UnitPrice>/) || [])[1] || 0);
        const unitMeasure = (itemXml.match(/<UnitMeasure[^>]*>([^<]+)<\/UnitMeasure>/) || [])[1] || 'L';
        const amountMatch = itemXml.match(/<(?:Item)?Amount[^>]*>([\d\.]+)<\/(?:Item)?Amount>/);
        const amount = parseFloat(amountMatch ? amountMatch[1] : (quantity * unitPrice));
        const pumpId = (itemXml.match(/<OutdoorPosition[^>]*>([^<]+)<\/OutdoorPosition>/) || [])[1] || null;
        const taxCode = (itemXml.match(/<TaxCode[^>]*>([^<]+)<\/TaxCode>/) || [])[1] || 'A';
        const itemId = (itemXml.match(/ItemID="([^"]+)"/) || [])[1] || `i${items.length + 1}`;
        
        items.push({ itemId, productName, productCode, quantity, unitPrice, unitMeasure, amount, pumpId, taxCode });
      }

      state.transaction = {
        id: requestId,
        type: 'Sale',
        requestType: reqType,
        amount,
        basketTotal: parsedBasketTotal,
        currency: 'TND',
        split: isSplit,
        items: items.length > 0 ? items : [{
          productName: 'Diesel',
          productCode: '102',
          unitPrice: 1.85,
          unitMeasure: 'L',
          quantity: calculateQuantity(amount, 1.85),
          amount: amount
        }],
        siteId: "SITE-0142",
        driverId: "DRV-1008",
        odometer: "125890",
        offline: false,
        isManual: isManual,
        languageCode: languageCode,
        startedAt: new Date().toISOString(),
        stan: stan(),
        terminalBatch: terminalBatch()
      };

      state.terminalMode = isManual ? 'waitingForManualCard' : 'waitingForCard';
      state.insertedCardId = null;
      state.codeBuffer = '';
      state.dbPreview = buildDatabasePreview(null, null);

      if (isManual) {
        setResult("Manual entry requested. Type card number on the terminal.", "");
        setConnection("Waiting for manual card");
        setScreen(["TYPE CARD NUMBER", ""]);
      } else {
        setResult("Transaction started. Insert the selected card on the terminal.", "");
        setConnection("Waiting for card");
        setScreen(["INSERT CARD", `Sale ${formatMoney(amount, 'TND')}`]);
      }
      render();
    }
  });

  function loadCards() {
    fetch('http://localhost:3000/api/cards', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        state.cards = data;
        if (!state.selectedCardId && state.cards.length > 0) {
          state.selectedCardId = state.cards[0].id;
        }
        render();
      })
      .catch(err => console.error("Error loading cards:", err));
    return [];
  }

  function saveCards() { /* replaced by API calls */ }

  function selectedCard() {
    return state.cards.find((card) => card.id === state.selectedCardId) || state.cards[0];
  }

  function insertedCard() {
    return state.cards.find((card) => card.id === state.insertedCardId);
  }

  function renderCards() {
    el.cardList.innerHTML = "";
    state.cards.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `business-card${card.id === state.selectedCardId ? " selected" : ""}`;
      button.innerHTML = `
        <strong>${escapeHtml(card.name)}</strong>
        <span>**** ${escapeHtml(card.number.slice(-4))} - ID ${escapeHtml(card.id)}</span>
        <span>Expires ${escapeHtml(card.expiry)} - Credit ${formatMoney(card.balance, el.currencyInput.value)}</span>
        <span class="card-meta">
          <span>${escapeHtml(card.status)}</span>
          <span>Password: <strong>${escapeHtml(card.passcode)}</strong></span>
        </span>
      `;
      button.addEventListener("click", () => {
        state.selectedCardId = card.id;
        render();
      });
      el.cardList.appendChild(button);
    });
  }

  function renderTerminal() {
    const card = selectedCard();
    el.insertCardBtn.disabled = state.terminalMode !== "waitingForCard" || !card;
    el.removeCardBtn.disabled = !state.insertedCardId;
    
    if (state.terminalMode === "waitingForManualCard") {
      el.pinOutput.textContent = `Card: ${state.codeBuffer || "----"}`;
    } else {
      el.pinOutput.textContent = `Code: ${state.codeBuffer ? "*".repeat(state.codeBuffer.length) : "----"}`;
    }

    el.terminalLed.className = "led";
    if (["waitingForCard", "waitingForCode", "waitingForManualCard"].includes(state.terminalMode)) {
      el.terminalLed.classList.add("ready");
    } else if (["processing", "cardInserted"].includes(state.terminalMode)) {
      el.terminalLed.classList.add("busy");
    } else if (state.terminalMode === "declined") {
      el.terminalLed.classList.add("error");
    }
  }

  function setScreen(lines) {
    el.terminalScreen.innerHTML = lines
      .map((line, index) => `<span class="screen-line${index ? " dim" : ""}">${escapeHtml(line)}</span>`)
      .join("");
      
    // Send to POS display as well
    if (lines.length > 0) {
      send("TERM->APP", 1, "DeviceRequest", {
        device: "CashierDisplay",
        command: "Prompt",
        text: lines.join(" - ")
      });
    }
  }

  function renderDbPreview() {
    el.dbPreview.textContent = state.dbPreview || "Start a transaction to see SQL mapped to your app schema.";
  }

  function renderMessages() {
    el.messageLog.innerHTML = "";
    if (!state.messages.length) {
      const empty = document.createElement("div");
      empty.className = "result-box";
      empty.textContent = "Messages will appear here when a transaction starts.";
      el.messageLog.appendChild(empty);
      return;
    }

    state.messages.forEach((message) => {
      const node = el.messageTemplate.content.firstElementChild.cloneNode(true);
      const badge = node.querySelector(".badge");
      badge.textContent = `${message.channel} ${message.direction}`;
      badge.classList.toggle("outbound", message.direction === "APP->TERM");
      node.querySelector(".message-meta").textContent = `${message.type} - ${message.time}`;
      node.querySelector("pre").textContent = message.xml;
      el.messageLog.appendChild(node);
    });
    el.messageLog.scrollTop = el.messageLog.scrollHeight;
  }

  function render() {
    renderCards();
    renderTerminal();
    renderMessages();
    renderDbPreview();
  }

  function startTransaction(event) {
    event.preventDefault();
    const amount = Number(el.amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setResult("Enter a valid amount before starting a transaction.", "declined");
      return;
    }

    const transaction = {
      id: correlationId(),
      type: el.transactionType.value,
      amount,
      currency: el.currencyInput.value,
      productCode: el.productInput.value,
      productName: el.productInput.options[el.productInput.selectedIndex].text.split(" - ")[0],
      unitPrice: 1.00,
      unitMeasure: "L",
      taxCode: "A",
      quantity: amount,
      siteId: el.siteInput.value.trim() || "UNKNOWN-SITE",
      pumpId: el.pumpInput.value.trim() || "UNSPECIFIED",
      driverId: el.driverInput.value.trim() || "UNKNOWN-DRIVER",
      odometer: el.odometerInput.value,
      offline: el.offlineMode.checked,
      startedAt: new Date().toISOString(),
      stan: stan(),
      terminalBatch: terminalBatch()
    };

    state.transaction = transaction;
    state.terminalMode = "waitingForCard";
    state.insertedCardId = null;
    state.codeBuffer = "";
    setResult("Transaction started. Insert the selected card on the terminal.", "");
    setConnection("Waiting for card");
    setScreen(["INSERT CARD", `${transaction.type} ${formatMoney(amount, transaction.currency)}`]);
    state.dbPreview = buildDatabasePreview(null, null);

    send("APP->TERM", 0, "ServiceRequest", {
      transaction,
      service: "Payment",
      requestType: transaction.type
    });
    send("TERM->APP", 0, "ServiceResponse", {
      originalTransactionId: transaction.id,
      result: "Accepted",
      terminalId: "SIM-EPT-001"
    });
    send("TERM->APP", 1, "DeviceRequest", {
      device: "CashierDisplay",
      command: "Prompt",
      text: "Please insert card"
    });
    render();
  }

  function insertCard() {
    if (state.terminalMode !== "waitingForCard") return;
    const card = selectedCard();
    state.insertedCardId = card.id;
    state.terminalMode = "waitingForCode";
    state.codeBuffer = "";
    setConnection("Card inserted");
    setScreen(["ENTER CODE", `${card.name} **** ${card.number.slice(-4)}`]);
    state.dbPreview = buildDatabasePreview(card, null);
    send("TERM->APP", 0, "CardRequest", {
      requestType: "CardData",
      token: `T${card.number}`,
      maskedPan: `${card.number.slice(0, 6)}******${card.number.slice(-4)}`,
      expiry: card.expiry,
      business: card.name,
      scheme: "BusinessCard"
    });
    send("APP->TERM", 0, "CardResponse", {
      result: "CardAcceptedForProcessing",
      cardToken: `T${card.number}`
    });
    send("TERM->APP", 1, "DeviceRequest", {
      device: "CashierDisplay",
      command: "Prompt",
      text: "Enter driver code"
    });
    render();
  }

  function removeCard() {
    state.insertedCardId = null;
    state.codeBuffer = "";
    if (state.transaction && !["approved", "declined"].includes(state.terminalMode)) {
      state.terminalMode = "waitingForCard";
      setConnection("Waiting for card");
      setScreen(["INSERT CARD", `${state.transaction.type} ${formatMoney(state.transaction.amount, state.transaction.currency)}`]);
    } else {
      state.terminalMode = "idle";
      setConnection("Terminal idle");
      setScreen(["WELCOME", "Ready for transaction"]);
    }
    render();
  }

  function handlePinpad(event) {
    const target = event.target.closest("button");
    if (!target || !["waitingForCode", "waitingForManualCard"].includes(state.terminalMode)) return;

    const action = target.dataset.action;
    if (action === "clear") {
      state.codeBuffer = "";
      if (state.terminalMode === "waitingForManualCard") {
        setScreen(["TYPE CARD NUMBER", ""]);
      }
      renderTerminal();
      return;
    }

    if (action === "enter") {
      if (state.terminalMode === "waitingForManualCard") {
        if (state.codeBuffer.length === 16) {
          acceptManualCard();
        }
        return;
      }
      authoriseTransaction();
      return;
    }

    if (/^\d$/.test(target.textContent)) {
      if (state.terminalMode === "waitingForCode" && state.codeBuffer.length < 8) {
        state.codeBuffer += target.textContent;
        renderTerminal();
      } else if (state.terminalMode === "waitingForManualCard" && state.codeBuffer.length < 16) {
        state.codeBuffer += target.textContent;
        setScreen(["TYPE CARD NUMBER", state.codeBuffer]);
        renderTerminal();
      }
    }
  }

  function acceptManualCard() {
    const pan = state.codeBuffer;
    state.terminalMode = "waitingForCode";
    state.codeBuffer = "";
    
    const matchedCard = state.cards.find(c => c.number === pan);
    
    if (matchedCard) {
      state.insertedCardId = matchedCard.id;
      setConnection("Manual Card Entered");
      setScreen(["ENTER CODE", `${matchedCard.name} **** ${pan.slice(-4)}`]);
      
      send("TERM->APP", 0, "CardRequest", {
        requestType: "CardData",
        token: `T${pan}`,
        maskedPan: `${pan.slice(0, 6)}******${pan.slice(-4)}`,
        expiry: matchedCard.expiry,
        business: matchedCard.name,
        scheme: "BusinessCard"
      });
    } else {
      state.insertedCardId = "manual"; 
      state.manualPan = pan;
      setConnection("Manual Card Entered");
      setScreen(["ENTER CODE", `Manual **** ${pan.slice(-4)}`]);
      
      send("TERM->APP", 0, "CardRequest", {
        requestType: "CardData",
        token: `T${pan}`,
        maskedPan: `${pan.slice(0, 6)}******${pan.slice(-4)}`,
        expiry: "2099-12",
        business: "Manual Card",
        scheme: "BusinessCard"
      });
    }

    send("APP->TERM", 0, "CardResponse", {
      result: "CardAcceptedForProcessing",
      cardToken: `T${pan}`
    });
    send("TERM->APP", 1, "DeviceRequest", {
      device: "CashierDisplay",
      command: "Prompt",
      text: "Enter driver code"
    });
    render();
  }

  function authoriseTransaction() {
    let card;
    if (state.insertedCardId === "manual") {
      card = {
        name: "Manual Card",
        card_type: "Manual",
        status: "ACTIVE",
        passcode: "1234",
        balance: 999999,
        currency: "TND",
        number: state.manualPan || "0000000000000000",
        expiry: "2099-12"
      };
    } else {
      card = insertedCard();
    }
    if (!card || !state.transaction) return;

    state.terminalMode = "processing";
    setConnection("Authorising");
    setScreen(["PROCESSING", "Please wait"]);
    send("TERM->APP", 0, "ServiceRequest", {
      service: "Authorisation",
      transaction: state.transaction,
      card: publicCardPayload(card),
      enteredCodeLength: state.codeBuffer.length
    });
    render();

    window.setTimeout(() => {
      const decision = decide(card, state.transaction, state.codeBuffer);
      const finalMode = decision.approved ? "approved" : "declined";
      if (decision.approved && state.transaction.type === 'Sale' && state.transaction.requestType !== 'LoyaltyAward') {
        card.balance -= state.transaction.amount;
        fetch(`http://localhost:3000/api/cards/${card.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: card.balance }) }).catch(console.error);
      } else if (decision.approved && state.transaction.type === 'Refund' && state.transaction.requestType !== 'LoyaltyAwardRefund') {
        card.balance += state.transaction.amount;
        fetch(`http://localhost:3000/api/cards/${card.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance: card.balance }) }).catch(console.error);
      }

      state.terminalMode = finalMode;
      setConnection(decision.approved ? "Approved" : "Declined");
      setScreen([
        decision.approved ? "APPROVED" : "DECLINED",
        decision.approved ? `AUTH ${decision.authCode}` : decision.reason
      ]);
      setResult(decision.message, decision.approved ? "approved" : "declined");
      state.dbPreview = buildDatabasePreview(card, decision);
      send("APP->TERM", 0, "ServiceResponse", {
        originalTransactionId: state.transaction.id,
        result: decision.approved ? "Approved" : "Declined",
        responseCode: decision.responseCode,
        authorisationCode: decision.authCode || "",
        reason: decision.reason
      });
      
      const reqId = currentRequestXml.match(/RequestID="([^"]+)"/)?.[1] || "123";
      const popId = currentRequestXml.match(/POPID="([^"]+)"/)?.[1] || "01";
      const workstationId = currentRequestXml.match(/WorkstationID="([^"]+)"/)?.[1] || "POS01";

      const errorAttr = !decision.approved ? ` ErrorCondition="${decision.reason || 'Card Declined'}"` : '';
      
      const isLoyalty = state.transaction.requestType === 'LoyaltyAward';
      let totalAmount = state.transaction.amount;
      let loyaltyXml = '';
      let saleItemsXml = '';

      if (isLoyalty && decision.approved) {
        let discountInfo = discountConfig[card.card_type];
        if (discountInfo) {
          let discountPercentage = discountInfo.discountPercentage || 0;
          let applicableProducts = discountInfo.applicableProducts || [];
          let totalDiscount = 0;
          
          if (state.transaction.items && state.transaction.items.length > 0) {
            saleItemsXml = state.transaction.items.map(item => {
              let originalItemAmount = (item.quantity && item.unitPrice) ? (item.quantity * item.unitPrice) : item.amount;
              let isApplicable = applicableProducts.length === 0 || applicableProducts.includes(item.productCode);
              
              let itemDiscount = isApplicable ? originalItemAmount * (discountPercentage / 100) : 0;
              let newItemAmount = originalItemAmount - itemDiscount;
              
              // Round to 2 decimal places to prevent floating point mismatch with the frontend
              newItemAmount = parseFloat(newItemAmount.toFixed(2));
              
              let rebateLabelXml = isApplicable ? `\n    <RebateLabel>${discountInfo.rebateLabel}</RebateLabel>` : '';
              
              item.amount = newItemAmount;
              
              return `
  <SaleItem ItemID="${item.itemId}">
    <ProductCode>${item.productCode}</ProductCode>
    <Amount>${newItemAmount.toFixed(2)}</Amount>${rebateLabelXml}
  </SaleItem>`;
            }).join('');
            
            let newTotalAmount = state.transaction.items.reduce((sum, item) => sum + item.amount, 0);
            state.transaction.amount = newTotalAmount.toFixed(2);
            totalAmount = state.transaction.amount;
          }
          
          const loyaltyDate = new Date().toISOString().substring(0, 19);
          loyaltyXml = `
  <Loyalty CardCircuit="${card.card_type}" CardEntryMode="Swipe" LoyaltyTimeStamp="${loyaltyDate}">
    <LoyaltyCard>3B3730353638343032313935343132373738363D333031303536353030303030383030303030</LoyaltyCard>
    <LoyaltyApprovalCode>${decision.authCode || '123456'}</LoyaltyApprovalCode>
  </Loyalty>`;
        }
      }

      const finalResponseXml = `<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>
<CardServiceResponse ApplicationSender="TerminalSimulator" POPID="${popId}" RequestID="${reqId}" WorkstationID="${workstationId}" RequestType="${state.transaction.requestType || 'CardPayment'}" OverallResult="${decision.approved ? "Success" : "Failure"}"${errorAttr} xmlns="http://www.nrf-arts.org/IXRetail/namespace" xmlns:IFSF="http://www.ifsf.org/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.nrf-arts.org/IXRetail/namespace ./IFSF/XSD/CardServiceResponse.xsd">
  <Terminal>
    <TerminalID>TERM01</TerminalID>
    <STAN>${state.transaction.stan}</STAN>
  </Terminal>
  <Tender>
    <TotalAmount>${totalAmount}</TotalAmount>
  </Tender>
  <Card>
    <PAN>${card.number.slice(0, 6)}******${card.number.slice(-4)}</PAN>
    <ExpiryDate>${card.expiry.replace('-', '')}</ExpiryDate>
    <CustomerName>${card.name}</CustomerName>
    <AuthCode>${decision.authCode || ''}</AuthCode>
  </Card>${loyaltyXml}${saleItemsXml}
</CardServiceResponse>`;

        let shouldPrintReceipt = true;
        if (state.transaction.requestType === 'LoyaltyAward') {
          shouldPrintReceipt = false;
        }
        
        if (state.transaction.split) {
          if (!state.splitSession || state.splitSession.basketTotal !== state.transaction.basketTotal) {
            state.splitSession = {
              basketTotal: state.transaction.basketTotal,
              paidAmount: 0,
              payments: []
            };
          }
          
          const cardKey = `**** ${card.number.slice(-4)}`;
          state.splitSession.payments.push({
            cardName: card.name.toUpperCase(),
            cardNumber: cardKey,
            amount: state.transaction.amount,
            approved: decision.approved,
            authCode: decision.authCode || 'N/A',
            reason: decision.reason
          });
          
          if (decision.approved) {
            state.splitSession.paidAmount += state.transaction.amount;
          }
          
          if (state.splitSession.paidAmount < state.splitSession.basketTotal) {
            shouldPrintReceipt = false;
            setScreen([decision.approved ? "APPROVED" : "DECLINED", "WAITING FOR NEXT PAYMENT..."]);
            state.terminalMode = "waitingForCard";
            state.insertedCardId = null;
          } else {
            shouldPrintReceipt = true;
          }
        }

        if (shouldPrintReceipt) {
          const receiptText = buildReceipt(decision, card, state.transaction);
          state.lastReceipt = receiptText;
          send("TERM->APP", 1, "DeviceRequest", {
            device: "Printer",
            command: "ReceiptData",
            text: receiptText
          });
          if (decision.approved && state.splitSession) {
            state.splitSession = null; // Clear session after final receipt
          }
          
          // Auto-reset back to initial state after 5 seconds ONLY if the transaction is fully complete
          window.setTimeout(resetSimulator, 5000);
        }
        
        socket.emit('terminal:response', finalResponseXml);
        render();
    }, 650);
  }

  function decide(card, transaction, code) {
    if (card.status !== "ACTIVE") {
      return decline("Card is blocked or invalid.", "InvalidCard", "104");
    }
    if (isExpired(card.expiry)) {
      return decline("Card has expired.", "ExpiredCard", "101");
    }
    if (card.passcode !== code) {
      return decline("Driver code / PIN was not accepted.", "InvalidCode", "117");
    }
    if (transaction.amount > card.balance) {
      return decline(`Amount exceeds this card credit of ${formatMoney(card.balance, transaction.currency)}.`, "LimitExceeded", "121");
    }

    const authCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    return {
      approved: true,
      responseCode: "000",
      reason: "Approved",
      authCode,
      message: `Approved ${formatMoney(transaction.amount, transaction.currency)} for ${card.name}. Auth code ${authCode}.`
    };
  }

  function decline(message, reason, responseCode) {
    return {
      approved: false,
      responseCode,
      reason,
      authCode: "",
      message
    };
  }

  function publicCardPayload(card) {
    return {
      token: `T${card.number}`,
      maskedPan: `${card.number.slice(0, 6)}******${card.number.slice(-4)}`,
      expiry: card.expiry,
      business: card.name,
      cardProfile: card.name,
      status: card.status
    };
  }

  function send(direction, channel, type, payload) {
    const time = new Date().toLocaleTimeString();
    const xml = buildIfsfXml(direction, channel, type, payload);
    state.messages.push({
      direction,
      channel: `CH${channel}`,
      type,
      time,
      xml
    });
    
    if (direction === "TERM->APP" && type === "DeviceRequest") {
      socket.emit('terminal:request', xml);
    }
  }

  function buildIfsfXml(direction, channel, type, payload) {
    const root = direction === "APP->TERM" ? "POSMessage" : "EPSMessage";
    const body = objectToXml(type, payload, 2);
    
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const localIsoStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    return `<${root} protocol="IFSF-POS-EPS-style" channel="${channel}" created="${escapeXml(localIsoStr)}">
  <Header>
    <MessageType>${escapeXml(type)}</MessageType>
    <CorrelationId>${escapeXml(state.transaction ? state.transaction.id : correlationId())}</CorrelationId>
    <Source>${direction === "APP->TERM" ? "MerchantApp" : "TerminalSimulator"}</Source>
    <Destination>${direction === "APP->TERM" ? "TerminalSimulator" : "MerchantApp"}</Destination>
  </Header>
${body}
</${root}>`;
  }

  function objectToXml(name, value, depth) {
    const indent = " ".repeat(depth);
    if (value === null || value === undefined) return `${indent}<${name}/>`;
    if (Array.isArray(value)) {
      return `${indent}<${name}>
${value.map((item) => objectToXml("Item", item, depth + 2)).join("\n")}
${indent}</${name}>`;
    }
    if (typeof value === "object") {
      const children = Object.entries(value)
        .map(([key, child]) => objectToXml(toXmlName(key), child, depth + 2))
        .join("\n");
      return `${indent}<${name}>
${children}
${indent}</${name}>`;
    }
    return `${indent}<${name}>${escapeXml(String(value))}</${name}>`;
  }

  function toXmlName(key) {
    return key.replace(/[^a-zA-Z0-9_:-]/g, "");
  }

  function buildDatabasePreview(card, decision) {
    if (!state.transaction) return "Start a transaction to see SQL mapped to your app schema.";
    const t = state.transaction;
    const maskedPan = card ? card.number.slice(0, 6) + "******" + card.number.slice(-4) : null;
    const cardEntryMode = card ? "ICC_SIM" : "WAITING_CARD";
    const requestLines = [
      "-- Request-side writes for your app schema",
      "WITH req AS (",
      "  INSERT INTO request_info (request_type, pop_id, ref_number, workstation_id, app_sender, stan, request_timestamp)",
      "  VALUES (" + [sqlValue(t.type), sqlValue(t.siteId), sqlValue(t.id), sqlValue(t.pumpId), sqlValue("TerminalSimulator"), sqlValue(t.stan), sqlValue(t.startedAt)].join(", ") + ")",
      "  RETURNING id",
      "), pos AS (",
      "  INSERT INTO pos_data (pos_timestamp, language_code, card_entry_mode, shift_number, terminal_batch, status_request, additional_info, outdoor_position, clerk_id, clerk_level, service_level, pos_name, global, split, long_format, unattended, waiting_card, choice_pay_kind, request_info_id)",
      "  SELECT " + [sqlValue(t.startedAt), "'en'", sqlValue(cardEntryMode), "'1'", sqlValue(t.terminalBatch), "'Payment'", sqlValue(t.offline ? "Offline simulation" : "Online simulation"), sqlValue(t.pumpId), sqlValue(t.driverId), "'Operator'", "'SelfService'", "'IFSF-SIM'", "false", "false", "true", "false", sqlBool(!card), "true", "req.id"].join(", "),
      "  FROM req",
      "  RETURNING id",
      "), amt AS (",
      "  INSERT INTO amount_data (total_amount, pre_auth_amount, currency, request_info_id)",
      "  SELECT " + [sqlValue(toMoneyString(t.amount)), sqlValue(t.type === "PreAuthorisation" ? toMoneyString(t.amount) : "0.00"), sqlValue(t.currency), "req.id"].join(", "),
      "  FROM req",
      "  RETURNING id",
      "), item AS (",
      "  INSERT INTO sale_items (amount_data_id, product_code, amount, quantity, add_prod_code, reverse_sale, sale_channel, rebate_label, add_prod_info)",
      "  SELECT " + ["amt.id", sqlValue(t.productCode), sqlValue(toMoneyString(t.amount)), sqlValue(t.quantity), "NULL", sqlValue(t.type === "Refund" ? "true" : "false"), "'EPT_SIM'", "NULL", sqlValue(t.productName + "; unit=" + t.unitPrice + "/" + t.unitMeasure + "; tax=" + t.taxCode)].join(", "),
      "  FROM amt",
      "  ON CONFLICT (amount_data_id, product_code) DO UPDATE SET amount = EXCLUDED.amount, quantity = EXCLUDED.quantity",
      "  RETURNING id",
      ")"
    ];

    const loyaltyLines = card ? [
      ", loyalty_row AS (",
      "  INSERT INTO loyalty (loyalty_flag, card_entry_mode, loyalty_card, loyalty_pan, loyalty_amount, loyalty_original_amount, loyalty_approval_code, loyalty_acquirer_id, loyalty_acquirer_batch, bonus_card, request_info_id)",
      "  SELECT " + ["false", sqlValue(cardEntryMode), sqlValue(`T${card.number.slice(0, 15)}`), sqlValue(maskedPan), sqlValue(toMoneyString(t.amount)), sqlValue(toMoneyString(t.amount)), sqlValue(decision ? decision.authCode : null), "'SIM-ACQ'", sqlValue(t.terminalBatch), "false", "req.id"].join(", "),
      "  FROM req",
      "  RETURNING id",
      ")"
    ] : [];

    const requestSql = requestLines.concat(loyaltyLines).concat(["SELECT req.id AS request_info_id FROM req;"]).join("\n");
    if (!decision) return requestSql;

    const responseSql = [
      "-- Response-side write after terminal/app authorisation",
      "INSERT INTO response_info (id, request_type, overall_result, stan, terminal_id, terminal_batch, amount)",
      "SELECT id, " + [sqlValue(t.type), sqlValue(decision.approved ? "Approved" : "Declined"), sqlValue(t.stan), "'SIM-EPT-001'", sqlValue(t.terminalBatch), sqlValue(toMoneyString(t.amount))].join(", "),
      "FROM request_info",
      "WHERE ref_number = " + sqlValue(t.id),
      "ON CONFLICT (id) DO UPDATE SET",
      "  request_type = EXCLUDED.request_type,",
      "  overall_result = EXCLUDED.overall_result,",
      "  stan = EXCLUDED.stan,",
      "  terminal_id = EXCLUDED.terminal_id,",
      "  terminal_batch = EXCLUDED.terminal_batch,",
      "  amount = EXCLUDED.amount,",
      "  created_at = CURRENT_TIMESTAMP;"
    ].join("\n");

    return requestSql + "\n\n" + responseSql;
  }

  function buildReceipt(decision, card, transaction, optionalSplitSession = null) {
    if (!transaction) return "NO TRANSACTION DATA";
    
    const sessionToUse = optionalSplitSession || state.splitSession;

    const divider = "-".repeat(40);
    const dateStr = new Date().toLocaleString();
    const amountStr = parseFloat(transaction.amount).toFixed(2);
    const stanStr = transaction.stan || 'N/A';
    const center = (str, width = 40) => {
        if (str.length >= width) return str;
        const leftPadding = Math.floor((width - str.length) / 2);
        return " ".repeat(leftPadding) + str;
      };

        const leftPart = dateStr;
        const rightPart = `TRANS: ${transaction.id || stanStr}`;
        const spaces = 40 - leftPart.length - rightPart.length;
        const dateTransLine = leftPart + " ".repeat(Math.max(1, spaces)) + rightPart;
        
        const lines = [
          center("STATION SERVICE AGIL"),
          center("ROUTE DE TUNIS KM 10, SFAX"),
          center(`STATION #${transaction.siteId}`),
          divider,
          dateTransLine,
          divider
        ];
        
        const isFr = transaction.languageCode === 'FR';
        const lblSubtotal = isFr ? "SOUS-TOTAL (HT)" : "SUBTOTAL (NET)";
        const lblTax = isFr ? "TVA" : "TOTAL TAX";
        const lblTotal = isFr ? "TOTAL (TTC)" : "TOTAL (GROSS)";
        const lblCard = isFr ? "CARTE:" : "CARD:";
        const lblName = isFr ? "NOM:" : "NAME:";
        const lblAuth = "AUTH:";
        const lblStatus = isFr ? "STATUT:" : "STATUS:";
        const lblEntry = isFr ? "SAISIE:" : "ENTRY:";
        const entryVal = transaction.isManual ? (isFr ? "MANUELLE" : "TYPED") : (isFr ? "PHYSIQUE" : "PHYSICAL");
        const msgThanks = isFr ? "MERCI DE VOTRE VISITE" : "THANK YOU FOR YOUR VISIT";
    
    const taxMultipliers = {
      'A': 0.20, // 20%
      'B': 0.10, // 10%
      'C': 0.15, // 15%
      'D': 0.05
    };

    let totalGross = 0;
    let totalTax = 0;
    if (transaction.items && transaction.items.length > 0) {
      transaction.items.forEach(item => {
        const qtyStr = parseFloat(item.quantity || 1).toFixed(2);
        const unitPriceStr = parseFloat(item.unitPrice || 0).toFixed(3);
        const itemAmt = parseFloat(item.amount || (item.quantity * item.unitPrice));
        
        const taxCode = item.taxCode || 'A';
        const taxRate = taxMultipliers[taxCode] || 0;
        
        let exactTaxAmt = itemAmt - (itemAmt / (1 + taxRate));
        let taxAmt = Math.round((exactTaxAmt + Number.EPSILON) * 100) / 100;
        
        totalGross += itemAmt;
        totalTax += taxAmt;
        
        const itemAmtStr = itemAmt.toFixed(2);
        
        const pumpStr = item.pumpId ? ` (PUMP: ${item.pumpId})` : '';
        lines.push(`${qtyStr}x ${item.productName.toUpperCase()}${pumpStr}`);
        const priceLine = `${unitPriceStr} ${transaction.currency}/${item.unitMeasure}`;
        const amountPadding = 40 - priceLine.length - itemAmtStr.length;
        lines.push(priceLine + " ".repeat(Math.max(1, amountPadding)) + itemAmtStr);
        
        if (taxRate > 0) {
          const taxPercentStr = (taxRate * 100).toFixed(0) + '%';
          const lblTaxItem = isFr ? `  INCL. TVA (${taxPercentStr}):` : `  INCL. TAX (${taxPercentStr}):`;
          const taxAmtStr = taxAmt.toFixed(2);
          lines.push(lblTaxItem + " ".repeat(40 - lblTaxItem.length - taxAmtStr.length) + taxAmtStr);
        }
        lines.push("");
      });
    }
    
    // Ensure Subtotal + Tax = TotalGross mathematically
    const subtotalNet = totalGross - totalTax;
    const subtotalStr = subtotalNet.toFixed(2);
    const taxStr = totalTax.toFixed(2);
    let finalTotal = totalGross > 0 ? totalGross : parseFloat(transaction.amount || 0);
    const amountStrFormatted = finalTotal.toFixed(2);
    
    lines.push(lblSubtotal + " ".repeat(40 - lblSubtotal.length - subtotalStr.length) + subtotalStr);
    lines.push(lblTax + " ".repeat(40 - lblTax.length - taxStr.length) + taxStr);
    lines.push(lblTotal + " ".repeat(40 - lblTotal.length - amountStrFormatted.length) + amountStrFormatted);
    
      lines.push(lblTotal + " ".repeat(40 - lblTotal.length - amountStrFormatted.length) + amountStrFormatted);
      
      if (transaction.split && sessionToUse && sessionToUse.payments) {
        sessionToUse.payments.forEach(payment => {
          lines.push(divider);
          const pAmount = parseFloat(payment.amount).toFixed(2);
          const lblAmount = isFr ? "MONTANT:" : "AMOUNT:";
          lines.push(lblAmount + " ".repeat(40 - lblAmount.length - pAmount.length) + pAmount);
          lines.push(lblCard + " ".repeat(40 - lblCard.length - payment.cardNumber.length) + payment.cardNumber);
          lines.push(lblName + " ".repeat(40 - lblName.length - payment.cardName.length) + payment.cardName.toUpperCase());
          const authCode = payment.authCode || 'N/A';
          lines.push(lblAuth + " ".repeat(40 - lblAuth.length - authCode.length) + authCode);
          lines.push(lblEntry + " ".repeat(40 - lblEntry.length - entryVal.length) + entryVal);
          const reason = (payment.reason || '').toUpperCase();
          lines.push(lblStatus + " ".repeat(40 - lblStatus.length - reason.length) + reason);
        });
      } else {
        lines.push(divider);
        lines.push(lblCard + " ".repeat(40 - lblCard.length - 9) + `**** ${card.number.slice(-4)}`);
        lines.push(lblName + " ".repeat(40 - lblName.length - card.name.length) + card.name.toUpperCase());
        const authCode = decision.authCode || 'N/A';
        lines.push(lblAuth + " ".repeat(40 - lblAuth.length - authCode.length) + authCode);
        lines.push(lblEntry + " ".repeat(40 - lblEntry.length - entryVal.length) + entryVal);
        const reason = decision.reason.toUpperCase();
        lines.push(lblStatus + " ".repeat(40 - lblStatus.length - reason.length) + reason);
      }
      lines.push("");
      lines.push(center(msgThanks));
    
    return lines.join("\n");
  }

  function setResult(message, className) {
    el.resultBox.className = `result-box${className ? ` ${className}` : ""}`;
    el.resultBox.textContent = message;
  }

  function setConnection(text) {
    el.connectionStatus.textContent = text;
  }

  function resetSimulator() {
    state.transaction = null;
    state.terminalMode = "idle";
    state.insertedCardId = null;
    state.codeBuffer = "";
    state.dbPreview = "";
    setConnection("Terminal idle");
    setScreen(["WELCOME", "Ready for transaction"]);
    setResult("Configure a sale, pick a card, then start the terminal flow.", "");
    render();
  }

  function loadDefaults() { fetch('http://localhost:3000/api/cards/reset', { method: 'POST' }).then(() => { state.selectedCardId = '1'; loadCards(); }).catch(console.error); }

  function addCard(event) {
    event.preventDefault();
    const code = document.querySelector("#newCardCode").value.trim();
    if (!/^\d{1,8}$/.test(code)) {
      setResult("Use numeric code for card passcode.", "declined");
      return;
    }

    // Generate random 16 digit PAN starting with 4532
    const randomSuffix = Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
    const number = `4532${randomSuffix}`;

    const card = {
      name: document.querySelector("#newCardName").value.trim(),
      number: number,
      expiry: "2031-12",
      passcode: code,
      balance: Number(document.querySelector("#newCardBalance").value) || 100,
      status: "ACTIVE",
    };

    fetch('http://localhost:3000/api/cards', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(card) 
    })
    .then(res => res.json())
    .then(data => { 
      if (data.id) {
        state.selectedCardId = data.id; 
      }
      event.target.reset(); 
      loadCards(); 
    })
    .catch(console.error);
  }

  function copyLog() {
    const text = state.messages.map((message) => `[${message.time}] ${message.channel} ${message.direction} ${message.type}\n${message.xml}`).join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setConnection("Log copied");
      window.setTimeout(() => setConnection(state.terminalMode === "idle" ? "Terminal idle" : el.connectionStatus.textContent), 900);
    });
  }

  function clearLog() {
    state.messages = [];
    renderMessages();
  }

  function copyDbPreview() {
    navigator.clipboard.writeText(el.dbPreview.textContent).then(() => {
      setConnection("DB SQL copied");
      window.setTimeout(() => setConnection(state.terminalMode === "idle" ? "Terminal idle" : el.connectionStatus.textContent), 900);
    });
  }

  function productLabel(code) {
    return code;
  }

  function calculateQuantity(amount, price) {
    if (!amount || !price) return 0;
    return parseFloat((amount / price).toFixed(2));
  }

  function toMoneyString(amount) {
    return Number(amount || 0).toFixed(2);
  }

  function sqlValue(value) {
    if (value === null || value === undefined || value === "") return "NULL";
    if (typeof value === "boolean") return value ? "true" : "false";
    return "'" + String(value).replace(/'/g, "''") + "'";
  }

  function sqlBool(value) {
    return value ? "true" : "false";
  }

  function stan() {
    return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  }

  function terminalBatch() {
    const now = new Date();
    return "BATCH-" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0");
  }

  function isExpired(expiry) {
    const [year, month] = expiry.split("-").map(Number);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    return endOfMonth < new Date();
  }

  function formatMoney(amount, currency) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "TND"
    }).format(Number(amount || 0));
  }

  function correlationId() {
    return `SIM-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeXml(value) {
    return escapeHtml(value);
  }

  el.saleForm.addEventListener("submit", startTransaction);
  el.insertCardBtn.addEventListener("click", insertCard);
  el.removeCardBtn.addEventListener("click", removeCard);
  el.pinpad.addEventListener("click", handlePinpad);
  el.resetBtn.addEventListener("click", resetSimulator);
  el.loadDefaultsBtn.addEventListener("click", loadDefaults);
  el.cardForm.addEventListener("submit", addCard);
  el.clearLogBtn.addEventListener("click", clearLog);
  el.copyLogBtn.addEventListener("click", copyLog);
  el.copyDbBtn.addEventListener("click", copyDbPreview);
  el.currencyInput.addEventListener("change", renderCards);

  loadCards();
  resetSimulator();
})();
