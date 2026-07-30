const { generateLengthHeader } = require('./utils');
const { pool } = require('./database');
const { getConfigData } = require('./tcpHandler');
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
  
  // Condition pour ServiceRequest
  if (requestType === 'TicketReprint') {
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
  const isSplit = posData?.split === true || String(posData?.split).toLowerCase() === 'true';
  const splitAttr = isSplit ? ` Split="true" BasketTotal="${basketData?.originalTotalAmount || basketData?.totalAmount || '0.00'}"` : '';

  if (requestType === 'LoyaltyAward') {
    const languageCode = String(posData?.languageCode || 'de').trim();
    const clerkLevel = String(posData?.clerkLevel || '5').trim();
    const shiftNumber = String(posData?.shiftNumber || '').trim();
    const clerkId = String(posData?.clerkId || '').trim();
    const serviceLevel = String(posData?.serviceLevel || '').trim();
    const transactionNumber = String(posData?.transactionNumber || '').trim();

    const cardEntryMode = String(posData?.cardEntryMode || '').trim();
    const cardEntryAttr = cardEntryMode ? ` CardEntryMode="${cardEntryMode}"` : '';

    const posDataLine1 = `    <POSData LanguageCode="${languageCode}" ClerkLevel="${clerkLevel}"${cardEntryAttr}${splitAttr}>`;
    const posDataLine2 = `        <POSTimeStamp>${posTimestamp}</POSTimeStamp>`;
    const posDataLine3 = serviceLevel ? `        <ServiceLevel>${serviceLevel}</ServiceLevel>` : '';
    const posDataLine4 = shiftNumber ? `        <ShiftNumber>${shiftNumber}</ShiftNumber>` : '';
    const posDataLine5 = clerkId ? `        <ClerkID>${clerkId}</ClerkID>` : '';
    const posDataLine6 = transactionNumber ? `        <TransactionNumber>${transactionNumber}</TransactionNumber>` : '';
    const posDataLine7 = `    </POSData>`;

    posDataSection = [posDataLine1, posDataLine2, posDataLine3, posDataLine4, posDataLine5, posDataLine6, posDataLine7].filter(line => line).join('\n');

  } else if (requestType === 'TicketReprint') {
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

    const posDataLine1 = `    <POSData LanguageCode="${languageCode}" ClerkLevel="${clerkLevel}" Unattended="${unattended}"${cardEntryAttr}${splitAttr}>`;
    const posDataLine2 = `        <POSTimeStamp>${posTimestamp}</POSTimeStamp>`;
    const posDataLine3 = clerkId ? `        <ClerkID>${clerkId}</ClerkID>` : '';
    
    const posDataLine5 = `    </POSData>`;

    posDataSection = [posDataLine1, posDataLine2, posDataLine3, posDataLine5].filter(line => line).join('\n');
  } else if (requestType === 'CardPayment') {
    const clerkLevel = String(posData?.clerkLevel || '5').trim();
    const languageCode = String(posData?.languageCode || 'es').trim();
    const cardEntryMode = String(posData?.cardEntryMode || '').trim();
    const cardEntryAttr = cardEntryMode ? ` CardEntryMode="${cardEntryMode}"` : '';

    const posDataLine1 = `    <POSData ClerkLevel="${clerkLevel}" LanguageCode="${languageCode}"${cardEntryAttr}${splitAttr}>`;
    const posDataLine2 = `        <POSTimeStamp>${posTimestamp}</POSTimeStamp>`;
    const posDataLine3 = `    </POSData>`;

    posDataSection = [posDataLine1, posDataLine2, posDataLine3].filter(line => line).join('\n');
  } else {
    const cardEntryMode = String(posData?.cardEntryMode || '').trim();
    const cardEntryAttr = cardEntryMode ? ` CardEntryMode="${cardEntryMode}"` : '';
    const posDataLine1 = `    <POSData${cardEntryAttr}${splitAttr}>`;
    const posDataLine2 = `        <POSTimeStamp>${posTimestamp}</POSTimeStamp>`;
    const posDataLine3 = `    </POSData>`;
    posDataSection = [posDataLine1, posDataLine2, posDataLine3].filter(line => line).join('\n');
  }
  let originalTransactionSection = '';
  if ((requestType === 'TicketReprint') && (requestData?.stan || requestData?.originalRequestId)) {
    try {
      let result;
      let searchValue;

      if (requestType === 'TicketReprint' && requestData?.reprintSearchType === 'requestId') {
        searchValue = String(requestData.originalRequestId).trim();
        const searchNum = parseInt(searchValue, 10);
        result = await pool.query(
          `SELECT terminal_id, terminal_batch, stan 
           FROM response_info 
           WHERE id = $1
           ORDER BY id DESC LIMIT 1`,
          [isNaN(searchNum) ? -1 : searchNum]
        );
      } else {
        searchValue = String(requestData.stan).trim();
        result = await pool.query(
          `SELECT terminal_id, terminal_batch, stan 
           FROM response_info 
           WHERE stan = $1 
           ORDER BY id DESC LIMIT 1`,
          [searchValue]
        );
      }

      let terminalId, terminalBatch, dbStan;
      if (result.rows.length > 0) {
        terminalId = String(result.rows[0].terminal_id || '71044283').trim();
        terminalBatch = String(result.rows[0].terminal_batch || '4711').trim();
        dbStan = String(result.rows[0].stan || searchValue).trim();
      } else {
        terminalId = '71044283';
        terminalBatch = '4711';
        dbStan = searchValue;
      }

      originalTransactionSection = `    <OriginalTransaction TerminalID="${terminalId}" TerminalBatch="${terminalBatch}" STAN="${dbStan}"></OriginalTransaction>`;
    } catch {
      const terminalId = '71044283';
      const terminalBatch = '4711';
      const stan = String(requestData.stan || '').trim();
      originalTransactionSection = `    <OriginalTransaction TerminalID="${terminalId}" TerminalBatch="${terminalBatch}" STAN="${stan}"></OriginalTransaction>`;
    }
  }

  let loyaltySection = '';
    if (requestType === 'LoyaltyAward' && loyaltyData) {
      const cardEntryMode = String(loyaltyData.cardEntryMode || 'Scanner').trim();
      const loyaltyCard = String(loyaltyData.loyaltyCard || '').trim();
      const bonusCard = String(loyaltyData.bonusCard || 'false').trim();

      const loyaltyLine1 = `    <Loyalty CardEntryMode="${cardEntryMode}" BonusCard="${bonusCard}">`;
      const loyaltyLine2 = loyaltyCard ? `        <LoyaltyCard>${loyaltyCard}</LoyaltyCard>` : '';
      const loyaltyLine3 = `    </Loyalty>`;

      loyaltySection = [loyaltyLine1, loyaltyLine2, loyaltyLine3].filter(line => line).join('\n');
    } else if (requestType === 'CardPayment' && loyaltyData) {
      const cardEntryMode = String(loyaltyData.cardEntryMode || 'Scanner').trim();
      const loyaltyCard = String(loyaltyData.loyaltyCard || '').trim();

      const loyaltyLine1 = `    <Loyalty CardEntryMode="${cardEntryMode}">`;
      const loyaltyLine2 = loyaltyCard ? `        <LoyaltyCard>${loyaltyCard}</LoyaltyCard>` : '';
      const loyaltyLine3 = `    </Loyalty>`;

      loyaltySection = [loyaltyLine1, loyaltyLine2, loyaltyLine3].filter(line => line).join('\n');
    }

  let totalAmountSection = '';
    if (requestType === 'LoyaltyAward' || requestType === 'CardPayment') {
    const totalAmount = formatNumberWithLeadingZeros(basketData?.totalAmount || '0.00', 7, 2);
    const currency = String(basketData?.currency || 'TND').trim();

    totalAmountSection = `    <TotalAmount Currency="${currency}">${totalAmount}</TotalAmount>`;
  }

  let saleItemsSection = '';
    if ((requestType === 'LoyaltyAward' || requestType === 'CardPayment') && basketData?.saleItems && Array.isArray(basketData.saleItems)) {
    const selectedItems = basketData.saleItems;

    if (selectedItems.length > 0) {
      saleItemsSection = selectedItems.map((item, index) => {
        const itemId = String(index + 1); // IFSF requires a 1-based sequential ItemID
        const productCode = String(item.productCode || '').trim();
        const amount = formatNumberWithLeadingZeros(item.amount || '0.00', 7, 2);
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
        const saleItemLine3 = `        <ItemAmount>${amount}</ItemAmount>`;
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
  if (getConfigData().opiMode) {
    const lengthHeader = generateLengthHeader(normalizedMessage);
    return Buffer.concat([lengthHeader, buffer]);
  }
  return buffer;
};

module.exports = { generateServiceRequest };