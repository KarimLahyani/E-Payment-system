const { generateLengthHeader } = require('./utils');
const { pool } = require('./database');
const { configData } = require('./tcpHandler');
const os = require('os'); // Importer le module os pour getLocalIPAddress

// Fonction pour obtenir l'adresse IP locale de la carte réseau
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName of Object.keys(interfaces)) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const formatNumberWithLeadingZeros = (value, integerLength, decimalLength = 0) => {
  const num = parseFloat(value) || 0;
  const [integerPart, decimalPart = ''] = num.toFixed(decimalLength).split('.');
  const paddedInteger = integerPart.padStart(integerLength, '0');
  return decimalLength > 0 ? `${paddedInteger}.${decimalPart.padEnd(decimalLength, '0')}` : paddedInteger;
};

const generateServiceRequest = async (requestData, posData, basketData, loyaltyData) => {
  const requestType = String(requestData.requestType || 'Unknown').trim();
  const requestId = String(requestData.requestId || '0').trim();
  const popId = String(requestData.popId || '01').trim();
  const workstationId = String(requestData.workstationId || 'POS01').trim();
  const applicationSender = String(requestData.appSender || 'AP4900').trim();

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp || Date.now());
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const posTimestamp = formatTimestamp(posData?.posTimestamp);

  const xmlns = 'xmlns="http://www.nrf-arts.org/IXRetail/namespace" xmlns:IFSF="http://www.ifsf.org/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
  let rootTag, schemaLocation, ipAddressAttr = '';
  
  // Condition pour Login ou Logoff
  if (requestType === 'Login' || requestType === 'Logoff') {
    rootTag = 'ServiceRequest';
    schemaLocation = 'xsi:schemaLocation="http://www.nrf-arts.org/IXRetail/namespace ./IFSF/XSD/ServiceRequest.xsd"';
    const ipAddress = getLocalIPAddress();
    ipAddressAttr = ` IPAddress="${ipAddress}"`;
  } else {
    rootTag = 'CardServiceRequest';
    schemaLocation = 'xsi:schemaLocation="http://www.nrf-arts.org/IXRetail/namespace ./IFSF/XSD/CardRequest.xsd"';
  }

  let requestStart = `<${rootTag} RequestType="${requestType}" ApplicationSender="${applicationSender}" WorkstationID="${workstationId}" POPID="${popId}" RequestID="${requestId}"${ipAddressAttr} ${xmlns} ${schemaLocation}>\n`;
  const requestEnd = `</${rootTag}>`;

  let posDataSection = '';
  if (requestType === 'LoyaltyAward') {
    const languageCode = String(posData?.languageCode || 'de').trim();
    const clerkLevel = String(posData?.clerkLevel || '5').trim();
    const shiftNumber = String(posData?.shiftNumber || '').trim();
    const clerkId = String(posData?.clerkId || '').trim();
    const serviceLevel = String(posData?.serviceLevel || '').trim();
    const transactionNumber = String(posData?.transactionNumber || '').trim();

    const cardEntryMode = String(posData?.cardEntryMode || '').trim();
    const cardEntryAttr = cardEntryMode ? ` CardEntryMode="${cardEntryMode}"` : '';

    const posDataLine1 = `    <POSData LanguageCode="${languageCode}" ClerkLevel="${clerkLevel}"${cardEntryAttr}>`;
    const posDataLine2 = `        <POSTimeStamp>${posTimestamp}</POSTimeStamp>`;
    const posDataLine3 = serviceLevel ? `        <ServiceLevel>${serviceLevel}</ServiceLevel>` : '';
    const posDataLine4 = shiftNumber ? `        <ShiftNumber>${shiftNumber}</ShiftNumber>` : '';
    const posDataLine5 = clerkId ? `        <ClerkID>${clerkId}</ClerkID>` : '';
    const posDataLine6 = transactionNumber ? `        <TransactionNumber>${transactionNumber}</TransactionNumber>` : '';
    const posDataLine7 = `    </POSData>`;

    posDataSection = [posDataLine1, posDataLine2, posDataLine3, posDataLine4, posDataLine5, posDataLine6, posDataLine7].filter(line => line).join('\n');
  } else if (requestType === 'LoyaltyAwardRefund') {
    const languageCode = String(posData?.languageCode || 'de').trim();
    const shiftNumber = String(posData?.shiftNumber || '').trim();
    const clerkId = String(posData?.clerkId || '').trim();
    const transactionNumber = String(posData?.transactionNumber || '').trim();

    const cardEntryMode = String(posData?.cardEntryMode || '').trim();
    const cardEntryAttr = cardEntryMode ? ` CardEntryMode="${cardEntryMode}"` : '';

    const posDataLine1 = `    <POSData LanguageCode="${languageCode}"${cardEntryAttr}>`;
    const posDataLine2 = `        <POSTimeStamp>${posTimestamp}</POSTimeStamp>`;
    const posDataLine3 = shiftNumber ? `        <ShiftNumber>${shiftNumber}</ShiftNumber>` : '';
    const posDataLine4 = clerkId ? `        <ClerkID>${clerkId}</ClerkID>` : '';
    const posDataLine5 = transactionNumber ? `        <TransactionNumber>${transactionNumber}</TransactionNumber>` : '';
    const posDataLine6 = `    </POSData>`;

    posDataSection = [posDataLine1, posDataLine2, posDataLine3, posDataLine4, posDataLine5, posDataLine6].filter(line => line).join('\n');
  } else if (requestType === 'PaymentRefundLoyaltyRedemptionRefund') {
    const languageCode = String(posData?.languageCode || 'de').trim();
    const shiftNumber = String(posData?.shiftNumber || '').trim();
    const clerkId = String(posData?.clerkId || '').trim();
    const clerkLevel = String(posData?.clerkLevel || '5').trim();
    const transactionNumber = String(posData?.transactionNumber || '').trim();
    const track2 = String(posData?.track2 || '').trim();
    const cardEntryMode = String(posData?.cardEntryMode || '').trim();
    const cardEntryAttr = cardEntryMode ? ` CardEntryMode="${cardEntryMode}"` : '';

    const posDataLine1 = `    <POSData LanguageCode="${languageCode}" ClerkLevel="${clerkLevel}"${track2 ? ` Track2="${track2}"` : ''}${cardEntryAttr}>`;
    const posDataLine2 = `        <POSTimeStamp>${posTimestamp}</POSTimeStamp>`;
    const posDataLine3 = shiftNumber ? `        <ShiftNumber>${shiftNumber}</ShiftNumber>` : '';
    const posDataLine4 = clerkId ? `        <ClerkID>${clerkId}</ClerkID>` : '';
    const posDataLine5 = transactionNumber ? `        <TransactionNumber>${transactionNumber}</TransactionNumber>` : '';
    const posDataLine6 = `    </POSData>`;

    posDataSection = [posDataLine1, posDataLine2, posDataLine3, posDataLine4, posDataLine5, posDataLine6].filter(line => line).join('\n');
  } else if (requestType === 'Login' || requestType === 'Logoff') {
    const languageCode = String(posData?.languageCode || 'pt').trim();
    const clerkLevel = String(posData?.clerkLevel || '5').trim();
    const unattended = String(posData?.unattended || 'false').trim();
    const firmwareVersion = String(posData?.firmwareVersion || '0306').trim();
    const serialNumber = String(posData?.serialNumber || '80026446').trim();
    const terminalType = String(posData?.terminalType || 'IPP48').trim();
    const clerkId = String(posData?.clerkId || '555').trim();
    const posName = String(posData?.posName || '8').trim();
    const cardEntryMode = String(posData?.cardEntryMode || '').trim();
    const cardEntryAttr = cardEntryMode ? ` CardEntryMode="${cardEntryMode}"` : '';

    const posDataLine1 = `    <POSData LanguageCode="${languageCode}" ClerkLevel="${clerkLevel}" Unattended="${unattended}"${cardEntryAttr}>`;
    const posDataLine2 = `        <POSTimeStamp>${posTimestamp}</POSTimeStamp>`;
    const posDataLine3 = clerkId ? `        <ClerkID>${clerkId}</ClerkID>` : '';
    
    const posDataLine5 = `    </POSData>`;

    posDataSection = [posDataLine1, posDataLine2, posDataLine3, posDataLine5].filter(line => line).join('\n');
  } else if (requestType === 'CardPayment' || requestType === 'LoyaltyBalanceQuery') {
    const clerkLevel = String(posData?.clerkLevel || '5').trim();
    const languageCode = String(posData?.languageCode || 'es').trim();
    const cardEntryMode = String(posData?.cardEntryMode || '').trim();
    const cardEntryAttr = cardEntryMode ? ` CardEntryMode="${cardEntryMode}"` : '';

    const posDataLine1 = `    <POSData ClerkLevel="${clerkLevel}" LanguageCode="${languageCode}"${cardEntryAttr}>`;
    const posDataLine2 = `        <POSTimeStamp>${posTimestamp}</POSTimeStamp>`;
    const posDataLine3 = `    </POSData>`;

    posDataSection = [posDataLine1, posDataLine2, posDataLine3].filter(line => line).join('\n');
  } else {
    const cardEntryMode = String(posData?.cardEntryMode || '').trim();
    const cardEntryAttr = cardEntryMode ? ` CardEntryMode="${cardEntryMode}"` : '';
    const posDataLine1 = `    <POSData${cardEntryAttr}>`;
    const posDataLine2 = `        <POSTimeStamp>${posTimestamp}</POSTimeStamp>`;
    const posDataLine3 = `    </POSData>`;
    posDataSection = [posDataLine1, posDataLine2, posDataLine3].filter(line => line).join('\n');
  }

  let originalTransactionSection = '';
  if (requestType === 'PaymentRefundLoyaltyRedemptionRefund' && basketData?.originalTransaction) {
    const terminalId = String(basketData.originalTransaction.terminalId || '').trim();
    const terminalBatch = String(basketData.originalTransaction.terminalBatch || '').trim();
    const stan = String(basketData.originalTransaction.stan || '').trim();

    if (terminalId && terminalBatch && stan) {
      originalTransactionSection = `    <OriginalTransaction TerminalID="${terminalId}" TerminalBatch="${terminalBatch}" STAN="${stan}"></OriginalTransaction>`;
    }
  } else if (requestType === 'LoyaltyAwardRefund' && requestData?.stan) {
    try {
      const result = await pool.query(
        `SELECT terminal_id, terminal_batch 
         FROM response_info 
         WHERE request_type = 'LoyaltyAward' 
         AND stan = $1 
         ORDER BY id DESC LIMIT 1`,
        [requestData.stan]
      );

      let terminalId, terminalBatch;
      if (result.rows.length > 0) {
        terminalId = String(result.rows[0].terminal_id || '71044283').trim();
        terminalBatch = String(result.rows[0].terminal_batch || '4711').trim();
      } else {
        terminalId = '71044283';
        terminalBatch = '4711';
      }

      const stan = String(requestData.stan || '').trim();

      if (terminalId && terminalBatch && stan) {
        originalTransactionSection = `    <OriginalTransaction TerminalID="${terminalId}" TerminalBatch="${terminalBatch}" STAN="${stan}"></OriginalTransaction>`;
      }
    } catch {
      const terminalId = '71044283';
      const terminalBatch = '4711';
      const stan = String(requestData.stan || '').trim();
      originalTransactionSection = `    <OriginalTransaction TerminalID="${terminalId}" TerminalBatch="${terminalBatch}" STAN="${stan}"></OriginalTransaction>`;
    }
  }

  let loyaltySection = '';
  if (requestType !== 'Login' && requestType !== 'Logoff') { // Exclure Loyalty pour Login et Logoff
    if (requestType === 'LoyaltyAward' && loyaltyData) {
      const cardEntryMode = String(loyaltyData.cardEntryMode || 'Scanner').trim();
      const loyaltyCard = String(loyaltyData.loyaltyCard || '').trim();
      const bonusCard = String(loyaltyData.bonusCard || 'false').trim();

      const loyaltyLine1 = `    <Loyalty CardEntryMode="${cardEntryMode}" BonusCard="${bonusCard}">`;
      const loyaltyLine2 = loyaltyCard ? `        <LoyaltyCard>${loyaltyCard}</LoyaltyCard>` : '';
      const loyaltyLine3 = `    </Loyalty>`;

      loyaltySection = [loyaltyLine1, loyaltyLine2, loyaltyLine3].filter(line => line).join('\n');
    } else if ((requestType === 'PaymentRefundLoyaltyRedemptionRefund' || requestType === 'CardPayment' || requestType === 'LoyaltyBalanceQuery') && loyaltyData) {
      const cardEntryMode = String(loyaltyData.cardEntryMode || 'Scanner').trim();
      const loyaltyCard = String(loyaltyData.loyaltyCard || '').trim();

      const loyaltyLine1 = `    <Loyalty CardEntryMode="${cardEntryMode}">`;
      const loyaltyLine2 = loyaltyCard ? `        <LoyaltyCard>${loyaltyCard}</LoyaltyCard>` : '';
      const loyaltyLine3 = `    </Loyalty>`;

      loyaltySection = [loyaltyLine1, loyaltyLine2, loyaltyLine3].filter(line => line).join('\n');
    }
  }

  let totalAmountSection = '';
  if (requestType === 'LoyaltyAward' || requestType === 'LoyaltyAwardRefund' || requestType === 'PaymentRefundLoyaltyRedemptionRefund' || requestType === 'CardPayment') {
    const totalAmount = formatNumberWithLeadingZeros(basketData?.totalAmount || '0.00', 7, 2);
    const currency = String(basketData?.currency || 'EUR').trim();

    totalAmountSection = `    <TotalAmount Currency="${currency}">${totalAmount}</TotalAmount>`;
  }

  let saleItemsSection = '';
  if ((requestType === 'LoyaltyAward' || requestType === 'LoyaltyAwardRefund' || requestType === 'PaymentRefundLoyaltyRedemptionRefund' || requestType === 'CardPayment') && basketData?.saleItems && Array.isArray(basketData.saleItems)) {
    const selectedItems = basketData.saleItems;

    if (selectedItems.length > 0) {
      saleItemsSection = selectedItems.map((item, index) => {
        const itemId = String(index + 1); // IFSF requires a 1-based sequential ItemID
        const productCode = String(item.productCode || '').trim();
        const itemAmount = formatNumberWithLeadingZeros(item.itemAmount || '0.00', 7, 2);
        const unitMeasure = String(item.unitMeasure || '').trim();
        const unitPrice = formatNumberWithLeadingZeros(item.unitPrice || '0.00', 4, 3);
        const quantity = formatNumberWithLeadingZeros(item.quantity || '0.00', 5, 2);
        const taxCode = String(item.taxCode || '').trim();
        const additionalProductCode = String(item.addProdCode || '').trim();
        const additionalProductInfo = String(item.addProdInfo || '').trim();
        const reverseSale = String(item.reverseSale || 'false').trim();
        const saleChannel = String(item.saleChannel || '').trim();

        const productName = String(item.productName || '').trim();
        const pumpId = String(item.pumpId || '').trim();
        
        const saleItemLine1 = `    <SaleItem ItemID="${itemId}"${reverseSale === 'true' ? ` ReverseSale="${reverseSale}"` : ''}>`;
        const saleItemLine2 = `        <ProductCode>${productCode}</ProductCode>`;
        const saleItemLine3 = `        <ItemAmount>${itemAmount}</ItemAmount>`;
        const saleItemLine4 = unitMeasure ? `        <UnitMeasure>${unitMeasure}</UnitMeasure>` : '';
        const saleItemLine5 = unitPrice ? `        <UnitPrice>${unitPrice}</UnitPrice>` : '';
        const saleItemLine6 = quantity ? `        <Quantity>${quantity}</Quantity>` : '';
        const saleItemLine7 = taxCode ? `        <TaxCode>${taxCode}</TaxCode>` : '';
        const saleItemLine8 = additionalProductCode ? `        <AdditionalProductCode>${additionalProductCode}</AdditionalProductCode>` : '';
        const saleItemLine9 = additionalProductInfo ? `        <AdditionalProductInfo>${additionalProductInfo}</AdditionalProductInfo>` : '';
        const saleItemLine10 = saleChannel ? `        <SaleChannel>${saleChannel}</SaleChannel>` : '';
        const saleItemLine11 = productName ? `        <ProductName>${productName}</ProductName>` : '';
        const saleItemLine12 = pumpId ? `        <OutdoorPosition>${pumpId}</OutdoorPosition>` : '';
        const saleItemLine13 = `    </SaleItem>`;

        return [saleItemLine1, saleItemLine2, saleItemLine3, saleItemLine4, saleItemLine5, saleItemLine6, saleItemLine7, saleItemLine8, saleItemLine9, saleItemLine10, saleItemLine11, saleItemLine12, saleItemLine13]
          .filter(line => line)
          .join('\n');
      }).join('\n');
    }
  }

  const xmlDeclaration = '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>\n';
  const message = [
    xmlDeclaration,
    requestStart,
    posDataSection,
    originalTransactionSection,
    loyaltySection,
    totalAmountSection,
    saleItemsSection,
    requestEnd
  ].filter(section => section).join('\n');

  const normalizedMessage = message.replace(/\r\n/g, '\n');
  console.log('Requête XML générée :', normalizedMessage);

  const buffer = Buffer.from(normalizedMessage, 'latin1');
  if (configData.opiMode) {
    const lengthHeader = generateLengthHeader(normalizedMessage);
    return Buffer.concat([lengthHeader, buffer]);
  }
  return buffer;
};

module.exports = { generateServiceRequest };