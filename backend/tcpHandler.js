const net = require('net');
const os = require('os');
const { generateLengthHeader } = require('./utils');

const { pool } = require('./database');
const xml2js = require('xml2js');
const iconv = require('iconv-lite');
// Ajouter le module readline pour lire les entrées du terminal
const readline = require('readline');

// Créer une interface readline pour lire les entrées utilisateur
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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

// Variable globale pour stocker la dernière réponse XML
let lastResponseXML = '';

// Variables globales pour stocker les messages DeviceRequest
let lastDisplayMessage = '';
let lastPrinterMessage = '';
let lastCashierTerminalMessage = '';
let cashierTerminalCallback = null; // Pour stocker le callback de confirmation

// Variable globale pour stocker les données de configuration
let configData = {
  clientIp: '127.0.0.1',
  serverIp: getLocalIPAddress(),
  epsPort: 11111,
  posProxyPort: 22222,
  opiMode: true,
};

// Liste des messages à envoyer
let messagesToSend = [];
let messageIndex = 0;

const server = net.createServer((socket) => {
  console.log(`Channel1 connected to (${socket.remoteAddress}, ${socket.remotePort})`);
  socket.on('data', async (data) => {
    let message = data.toString('latin1').trim();
    console.log('Received Message request on channel1');
    console.log(message);

    if (configData.opiMode) {
      message = data.slice(4).toString('latin1');
      console.log('Message after removing OPI header:');
      console.log(message);
    }

    if (message.trim().startsWith('<?xml') || message.trim().startsWith('<')) {
      try {
        const parser = new xml2js.Parser({ explicitArray: false, trim: true });
        const parsedMessage = await parser.parseStringPromise(message);

        if (parsedMessage.DeviceRequest) {
          const deviceRequest = parsedMessage.DeviceRequest;
          const output = deviceRequest.Output || {};
          const input = deviceRequest.Input || {};
          const outDeviceTarget = output['$']?.OutDeviceTarget;
          const requestId = deviceRequest['$']?.RequestID || '0';
          const applicationSender = deviceRequest['$']?.ApplicationSender || 'AP4900';
          const popId = deviceRequest['$']?.POPID || '01';
          const workstationId = deviceRequest['$']?.WorkstationID || 'POS01';
          const requestType = deviceRequest['$']?.RequestType || 'Output';

          // Gérer les messages pour CashierDisplay et Printer
          if (outDeviceTarget === 'CashierDisplay' || outDeviceTarget === 'Printer') {
            let textLines = output.TextLine || [];
            if (!Array.isArray(textLines)) {
              textLines = [textLines];
            }
            const textContent = textLines
              .map(line => {
                if (typeof line === 'string') {
                  return line;
                } else if (line && typeof line === 'object') {
                  return line._ || '';
                }
                return '';
              })
              .filter(line => line.trim() !== '')
              .join('\n');

            if (outDeviceTarget === 'CashierDisplay') {
              lastDisplayMessage = textContent || 'No message content';
              console.log(`CashierDisplay message extracted: ${lastDisplayMessage}`);
            } else if (outDeviceTarget === 'Printer') {
              lastPrinterMessage = textContent || 'No message content';
              console.log(`Printer message extracted: ${lastPrinterMessage}`);
            }

            const deviceResponse = `
              <?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>
              <DeviceResponse ApplicationSender="${applicationSender}" POPID="${popId}" RequestID="${requestId}" WorkstationID="${workstationId}" RequestType="${requestType}" OverallResult="Success" xmlns="http://www.nrf-arts.org/IXRetail/namespace" xmlns:IFSF="http://www.ifsf.org/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.nrf-arts.org/IXRetail/namespace ./IFSF/XSD/DeviceResponse.xsd">
                <Output OutDeviceTarget="${outDeviceTarget || 'Unknown'}" OutResult="Success"/>
              </DeviceResponse>
            `.trim();

            console.log(`Sent message with header: length=${deviceResponse.length}, message=${deviceResponse}`);
            if (configData.opiMode) {
              const lengthHeader = generateLengthHeader(deviceResponse);
              socket.write(Buffer.concat([lengthHeader, Buffer.from(deviceResponse, 'latin1')]));
            } else {
              socket.write(deviceResponse);
            }
          }
          // Gérer la requête CashierTerminal
          else if (outDeviceTarget === 'CashierTerminal' && input['$']?.InDeviceTarget === 'CashierTerminal') {
            let textLines = output.TextLine || [];
            if (!Array.isArray(textLines)) {
              textLines = [textLines];
            }
            const textContent = textLines
              .map(line => {
                if (typeof line === 'string') {
                  return line;
                } else if (line && typeof line === 'object') {
                  return line._ || '';
                }
                return '';
              })
              .filter(line => line.trim() !== '')
              .join('\n');

            lastCashierTerminalMessage = textContent || 'No message content';
            console.log(`CashierTerminal message extracted: ${lastCashierTerminalMessage}`);

            // Convertir l'encodage ISO-8859-1 en UTF-8
            const decodedMessage = iconv.decode(Buffer.from(lastCashierTerminalMessage, 'binary'), 'ISO-8859-1');
            lastCashierTerminalMessage = decodedMessage;
            console.log(`Decoded CashierTerminal message: ${lastCashierTerminalMessage}`);

            // Demander une entrée utilisateur via le terminal
            console.log('Veuillez entrer YES ou NO dans le terminal (90 secondes avant timeout) :');

            // Promesse pour attendre l'entrée utilisateur
            const getUserInput = () =>
              new Promise((resolve) => {
                rl.question('Réponse (YES/NO) : ', (answer) => {
                  const confirmation = answer.trim().toUpperCase();
                  if (['YES', 'NO'].includes(confirmation)) {
                    resolve(confirmation);
                  } else {
                    console.log('Entrée invalide, veuillez entrer YES ou NO.');
                    resolve(getUserInput()); // Redemander si l'entrée est invalide
                  }
                });
              });

            // Promesse pour gérer le timeout
            const timeoutPromise = new Promise((resolve) => {
              setTimeout(() => {
                resolve('NO'); // Réponse par défaut après 90 secondes
              }, 90000); // 90 secondes
            });

            // Attendre soit une entrée utilisateur, soit le timeout
            const confirmation = await Promise.race([getUserInput(), timeoutPromise]);

            if (confirmation === 'NO' && !['YES', 'NO'].includes(confirmation.trim().toUpperCase())) {
              console.log('Timeout: Aucune réponse valide reçue après 90 secondes, envoi de réponse par défaut (NO)');
            } else {
              console.log(`Réponse reçue du terminal: ${confirmation}`);
            }

            // Construire et envoyer la DeviceResponse
            const deviceResponse = `
              <?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>
              <DeviceResponse ApplicationSender="${applicationSender}" POPID="${popId}" RequestID="${requestId}" WorkstationID="${workstationId}" RequestType="${requestType}" OverallResult="Success" xmlns="http://www.nrf-arts.org/IXRetail/namespace" xmlns:IFSF="http://www.ifsf.org/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.nrf-arts.org/IXRetail/namespace ./IFSF/XSD/DeviceResponse.xsd">
                <Output OutDeviceTarget="CashierTerminal" OutResult="Success"/>
                <Input InDeviceTarget="CashierTerminal" InResult="Success">
                  <InputValue>
                    <InBoolean>${confirmation === 'YES' ? '1' : '0'}</InBoolean>
                  </InputValue>
                </Input>
              </DeviceResponse>
            `.trim();

            console.log(`Sent CashierTerminal response: confirmation=${confirmation}, message=${deviceResponse}`);
            if (configData.opiMode) {
              const lengthHeader = generateLengthHeader(deviceResponse);
              socket.write(Buffer.concat([lengthHeader, Buffer.from(deviceResponse, 'latin1')]));
            } else {
              socket.write(deviceResponse);
            }
          }
          return;
        }
      } catch (error) {
        console.error(`Error processing XML message: ${error.message}`);
      }
    }

    let response;
    if (message.includes('RequestType="Login"')) {
      response = '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?><Response><Status>Success</Status><Message>Login réussi !</Message></Response>';
    } else if (message.includes('RequestType="CardPayment"')) {
      response = '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?><Response><Status>Success</Status><Message>Paiement par carte accepté ! Montant : 20.00€</Message></Response>';
    } else if (message.includes('RequestType="Payment"')) {
      response = '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?><Response><Status>Success</Status><Message>Paiement accepté ! Montant : 50€</Message></Response>';
    } else if (message.includes('RequestType="Logout"')) {
      response = '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?><Response><Status>Success</Status><Message>Déconnexion réussie !</Message></Response>';
    } else if (!message.includes('CardServiceRequest')) {
      response = '<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?><Response><Status>Error</Status><Message>Commande inconnue sur Channel 1 !</Message></Response>';
    } else {
      console.log('Message CardServiceRequest ignoré pour la génération de réponse par défaut.');
      return;
    }

    console.log(`Sent Message response on channel1`);
    console.log(response);
    if (configData.opiMode) {
      const lengthHeader = generateLengthHeader(response);
      socket.write(Buffer.concat([lengthHeader, Buffer.from(response, 'latin1')]));
    } else {
      socket.write(response);
    }
  });

  socket.on('end', () => {
    console.log('Connections closed');
  });

  socket.on('error', (err) => {
    console.error(`Socket error: ${err.message}`);
  });
});

const startTcpServer = () => {
  server.listen(configData.epsPort, configData.serverIp, () => {
    console.log(`Server listening on ${configData.serverIp}:${configData.epsPort}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Erreur : le port ${configData.epsPort} est déjà utilisé.`);
    }
  });
  server.on('listening', () => {
    console.log('Serveur TCP prêt à accepter des connexions.');
  });
};

let client = new net.Socket();

// Fonction pour traiter CardServiceResponse et insérer dans response_info
const processCardServiceResponse = async (responseXML) => {
  let requestId = '0';
  try {
    console.log('Starting processCardServiceResponse with responseXML:', responseXML);
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });
    const result = await parser.parseStringPromise(responseXML);

    const cardServiceResponse = result.CardServiceResponse || result.EPSMessage?.CardServiceResponse || result.POSMessage?.CardServiceResponse;
    if (!cardServiceResponse) throw new Error('CardServiceResponse not found in XML');
    console.log('Full cardServiceResponse object:', JSON.stringify(cardServiceResponse, null, 2));

    const overallResult = cardServiceResponse['$']?.OverallResult || 'Unknown';
    const requestType = cardServiceResponse['$']?.RequestType || 'Unknown';
    requestId = cardServiceResponse['$']?.RequestID || '0';
    const stan = cardServiceResponse.Terminal?.['$']?.STAN || cardServiceResponse.Terminal?.STAN || null;
    const terminalId = cardServiceResponse.Terminal?.['$']?.TerminalID || cardServiceResponse.Terminal?.TerminalID || null;
    const terminalBatch = cardServiceResponse.Terminal?.['$']?.TerminalBatch || cardServiceResponse.Terminal?.TerminalBatch || null;

    // Extraire le totalAmount
    let totalAmount = cardServiceResponse.Tender?.TotalAmount?._ || '0';
    if (typeof totalAmount === 'string') {
      totalAmount = totalAmount.trim();
    } else {
      totalAmount = totalAmount.toString().trim();
    }
    console.log(`Extracted totalAmount: ${totalAmount}, Raw TotalAmount object: ${JSON.stringify(cardServiceResponse.Tender?.TotalAmount)}`);

    // Insérer ou mettre à jour response_info
    await pool.query(
      `INSERT INTO response_info (id, request_type, overall_result, stan, terminal_id, terminal_batch, amount, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE 
       SET request_type = $2, overall_result = $3, stan = $4, terminal_id = $5, terminal_batch = $6, amount = $7`,
      [requestId, requestType, overallResult, stan, terminalId, terminalBatch, totalAmount]
    );
    console.log(`Successfully inserted CardServiceResponse into response_info: RequestID=${requestId}`);

    if (overallResult !== 'Success' || requestType !== 'LoyaltyAward') {
      return;
    }

    // Trouver le request_info_id correspondant
    const requestInfoResult = await pool.query(
      'SELECT id FROM request_info WHERE id = $1 LIMIT 1',
      [requestId]
    );
    if (requestInfoResult.rows.length === 0) {
      console.error('No request_info found for id:', requestId);
      return;
    }
    const requestInfoId = requestInfoResult.rows[0].id;

    // Trouver la dernière entrée amount_data
    const amountResult = await pool.query(
      'SELECT id, total_amount, pre_auth_amount, currency, item_details FROM amount_data WHERE request_info_id = $1 ORDER BY created_at DESC LIMIT 1',
      [requestInfoId]
    );
    if (amountResult.rows.length === 0) {
      console.error('No amount_data found for request_info_id:', requestInfoId);
      return;
    }
    const amountDataId = amountResult.rows[0].id;
    const originalTotalAmount = amountResult.rows[0].total_amount;
    const preAuthAmount = amountResult.rows[0].pre_auth_amount || '';
    const currency = amountResult.rows[0].currency || 'EUR';
    const itemDetails = amountResult.rows[0].item_details || {};

    // Insérer une nouvelle ligne dans amount_data avec le nouveau totalAmount
    const newAmountResult = await pool.query(
      'INSERT INTO amount_data (total_amount, pre_auth_amount, currency, item_details, request_info_id, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id',
      [totalAmount, preAuthAmount, currency, JSON.stringify(itemDetails), requestInfoId]
    );
    const newAmountDataId = newAmountResult.rows[0].id;
    console.log(`Inserted new row in amount_data with id ${newAmountDataId} et total_amount ${totalAmount} pour request_info_id ${requestInfoId}`);

    // Traiter les sale_items avec remise
    const saleItems = cardServiceResponse.SaleItem
      ? Array.isArray(cardServiceResponse.SaleItem)
        ? cardServiceResponse.SaleItem
        : [cardServiceResponse.SaleItem]
      : [];
    console.log('SaleItems extracted from response:', JSON.stringify(saleItems, null, 2));

    const originalSaleItemsResult = await pool.query(
      'SELECT * FROM sale_items WHERE amount_data_id = $1',
      [amountDataId]
    );
    const originalSaleItems = originalSaleItemsResult.rows.reduce((acc, item) => {
      acc[item.item_id] = item;
      return acc;
    }, {});
    console.log('Original sale items:', JSON.stringify(originalSaleItems, null, 2));

    const saleItemsQuery = `
      INSERT INTO sale_items (amount_data_id, item_id, button_label, product_code, amount, quantity, tax_code, add_prod_code, reverse_sale, unit_price, unit_measure, sale_channel, rebate_label, add_prod_info, is_selected, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    for (const saleItem of saleItems) {
      const itemId = saleItem['$']?.ItemID || saleItem.ItemID;
      console.log(`Processing SaleItem with ItemID=${itemId}, Raw SaleItem:`, JSON.stringify(saleItem, null, 2));

      const originalItem = originalSaleItems[itemId];
      if (!originalItem) {
        console.error(`Original sale item with item_id ${itemId} not found for amount_data_id ${amountDataId}`);
        continue;
      }

      // Extraire discountedAmount et gérer les cas où il est absent
      const discountedAmountRaw = saleItem.Amount?._ || saleItem.Amount;
      let discountedAmount = parseFloat(discountedAmountRaw) || 0;
      const rebateLabel = saleItem.RebateLabel?._ || saleItem.RebateLabel || '';
      console.log(`Extracted discountedAmount for ItemID=${itemId}: ${discountedAmountRaw} (parsed as ${discountedAmount}), RebateLabel: ${rebateLabel}`);

      let newUnitPrice, newAmount;
      const originalQuantity = parseFloat(originalItem.quantity) || 1;

      if (discountedAmount > 0) {
        // Si une remise est appliquée, calculer le nouveau unit_price et amount
        newUnitPrice = discountedAmount / originalQuantity;
        newAmount = discountedAmount; // Le discountedAmount est déjà le total pour cet item
      } else {
        // Si aucune remise n'est appliquée, conserver les valeurs originales
        console.log(`No discount applied for ItemID=${itemId}, using original values`);
        newUnitPrice = parseFloat(originalItem.unit_price) || parseFloat(originalItem.amount) / originalQuantity || 0;
        newAmount = parseFloat(originalItem.amount) || newUnitPrice * originalQuantity;
      }

      const saleItemValues = [
        newAmountDataId,
        itemId,
        originalItem.button_label || '',
        originalItem.product_code || '',
        newAmount.toString(),
        originalItem.quantity || '',
        originalItem.tax_code || '',
        originalItem.add_prod_code || '',
        originalItem.reverse_sale || '0',
        newUnitPrice.toString(),
        originalItem.unit_measure || '',
        originalItem.sale_channel || '',
        rebateLabel,
        originalItem.add_prod_info || '',
        originalItem.is_selected || false,
      ];

      await pool.query(saleItemsQuery, saleItemValues);
      console.log(`Inserted new sale_item ${itemId} with amount ${newAmount}, unit_price ${newUnitPrice}, and rebate_label ${rebateLabel} for amount_data_id ${newAmountDataId}`);
    }
  } catch (error) {
    console.error(`Error processing CardServiceResponse: ${error.message}`);
    await pool.query(
      `INSERT INTO response_info (id, request_type, overall_result, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE 
       SET request_type = $2, overall_result = $3`,
      [requestId, 'Unknown', 'Failed']
    );
  }
};

// Fonction pour définir un callback pour la confirmation CashierTerminal
const setCashierTerminalCallback = (callback) => {
  console.log('Définition du callback CashierTerminal');
  cashierTerminalCallback = callback;
};

// Fonction pour réinitialiser le callback CashierTerminal
const resetCashierTerminalCallback = () => {
  console.log('Réinitialisation du callback CashierTerminal');
  cashierTerminalCallback = null;
};

const sendMessage = async () => {
  if (messageIndex >= messagesToSend.length) {
    messagesToSend = [];
    messageIndex = 0;
    return;
  }

  let message = messagesToSend[messageIndex];
  if (message instanceof Promise) {
    message = await message;
  }
  const messageStr = typeof message === 'string' ? message : message.toString('latin1');
  
  // Send via WebSocket to Web-Based IFSF Simulator
  if (typeof io !== 'undefined' && io) {
    console.log('Sending message to Web-Based Simulator via WebSocket');
    io.emit('terminal:request', messageStr);
  }

  // Also send via TCP if needed
  if (client && !client.destroyed) {
    client.destroy();
  }
  client = new net.Socket();
  
  // Register listeners ONCE outside of attemptConnection
  client.on('data', async (data) => {
    let response;
    if (configData.opiMode) {
      response = data.slice(4).toString('latin1');
      lastResponseXML = response;
    } else {
      response = data.toString('latin1');
      lastResponseXML = response;
    }
    console.log(`Received ${messageIndex + 1} Response on channel2`);
    console.log(response);

    if (response.includes('CardServiceResponse')) {
      await processCardServiceResponse(response);
    }
  });

  client.on('end', () => {
    messageIndex++;
    setTimeout(sendMessage, 1000);
  });

  const attemptConnection = async (retries = 3, delay = 1000) => {
    client.removeAllListeners('error');
    client.on('error', (err) => {
      if (retries > 0 && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET')) {
        setTimeout(() => {
          attemptConnection(retries - 1, delay * 2);
        }, delay);
      } else {
        messageIndex++;
        setTimeout(sendMessage, 1000);
      }
    });

    client.connect(configData.posProxyPort, configData.clientIp, async () => {
      const buffer = Buffer.isBuffer(message) ? message : Buffer.from(message, 'latin1');
      console.log(`Sent message with header: length=${buffer.length}, message=${messageStr}`);
      client.write(buffer);
      setTimeout(() => {
        if (!client.destroyed) {
          client.end();
        }
      }, 1000000);
    });
  };

  attemptConnection();
};

const addMessageToSend = async (message) => {
  messagesToSend.push(message);
  await sendMessage();
};

const updateConfigData = (newConfig) => {
  configData = { ...configData, ...newConfig };
};

const restartTcpServer = () => {
  server.close(() => {
    startTcpServer();
  });
};

const getConfigData = () => configData;
const getLastResponseXML = () => lastResponseXML;
const getLastDisplayMessage = () => lastDisplayMessage;
const getLastPrinterMessage = () => lastPrinterMessage;
const getLastCashierTerminalMessage = () => lastCashierTerminalMessage;


let io;
const setSocketIo = (socketIo) => {
  io = socketIo;
  io.on('connection', (socket) => {
    console.log('Frontend terminal simulator connected');

    socket.on('terminal:request', async (xmlMessage) => {
      console.log('Received from frontend terminal simulator:');
      console.log(xmlMessage);

      if (xmlMessage.trim().startsWith('<?xml') || xmlMessage.trim().startsWith('<')) {
        try {
          const parser = new xml2js.Parser({ explicitArray: false, trim: true });
          const parsedMessage = await parser.parseStringPromise(xmlMessage);
          
          await handleDeviceRequest(parsedMessage, (resp) => {
            socket.emit('terminal:response', resp);
          });
        } catch (error) {
          console.error(`Error processing WS XML message: ${error.message}`);
        }
      }
    });

    socket.on('terminal:response', async (responseXML) => {
      console.log('Received terminal:response from POS web UI');
      lastResponseXML = responseXML;
      if (responseXML.includes('CardServiceResponse')) {
        await processCardServiceResponse(responseXML);
      }
    });

    socket.on('disconnect', () => {
      console.log('Frontend terminal simulator disconnected');
    });
  });
};

const handleDeviceRequest = async (parsedMessage, callback) => {
  const deviceRequest = parsedMessage.EPSMessage?.DeviceRequest || parsedMessage.POSMessage?.DeviceRequest;
  if (!deviceRequest) return;
  
  const device = deviceRequest.device;
  const command = deviceRequest.command;
  const text = deviceRequest.text;
  
  if (device === 'CashierDisplay') {
    lastDisplayMessage = text;
    console.log(`CashierDisplay message extracted: ${text}`);
  } else if (device === 'Printer') {
    lastPrinterMessage = text;
    console.log(`Printer message extracted:`);
    console.log(text);
  } else if (device === 'CashierTerminal') {
    lastCashierTerminalMessage = text;
    console.log(`CashierTerminal message extracted: ${text}`);
  }
};


const clearDeviceMessages = () => {
  lastDisplayMessage = '';
  lastPrinterMessage = '';
  lastCashierTerminalMessage = '';
  lastResponseXML = '';
};

module.exports = {
  clearDeviceMessages,
  setSocketIo,
  server,
  startTcpServer,
  addMessageToSend,
  updateConfigData,
  restartTcpServer,
  getConfigData,
  getLastResponseXML,
  getLastDisplayMessage,
  getLastPrinterMessage,
  getLastCashierTerminalMessage,
  configData,
  processCardServiceResponse,
  setCashierTerminalCallback,
  resetCashierTerminalCallback,
};