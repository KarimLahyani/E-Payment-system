const { pool } = require('./database');
const { insertWithErrorHandling, prepareSaleItemValues, transformSaleItem, generateDefaultSaleItems } = require('./utils');
const { generateServiceRequest, updateConfigData: updateXmlConfigData } = require('./xmlGenerator');
const { addMessageToSend, updateConfigData: updateTcpConfigData, restartTcpServer, getConfigData, getLastResponseXML, getLastDisplayMessage, getLastPinPadMessage, getLastPrinterMessage, processCardServiceResponse, resolveCashierTerminalResponse, getLastCashierTerminalMessage, clearDeviceMessages } = require('./tcpHandler');

// Variable globale pour stocker le dernier message XML généré
let lastServiceRequest = '';

const setupRoutes = (app) => {
  // Function to handle LoyaltyAwardRefund
  const handleLoyaltyAwardRefund = async (stan, currentRequestId) => {
    try {
      console.log(`Handling LoyaltyAwardRefund for STAN=${stan}, RequestID=${currentRequestId}`);

      // Step 1: Find the most recent LoyaltyAward request
      const loyaltyAwardResponseResult = await pool.query(
        `SELECT id, stan 
         FROM response_info 
         WHERE request_type = 'LoyaltyAward' 
         AND stan = $1 
         ORDER BY id DESC LIMIT 1`,
        [stan]
      );

      if (loyaltyAwardResponseResult.rows.length === 0) {
        console.error(`No LoyaltyAward response found with stan: ${stan}`);
        return { success: false, message: 'No matching LoyaltyAward response found with the provided STAN.' };
      }

      const loyaltyAwardRequestId = loyaltyAwardResponseResult.rows[0].id;
      console.log(`Found LoyaltyAward response with id: ${loyaltyAwardRequestId}, stan: ${stan}`);

      // Step 2: Find all amount_data entries for the LoyaltyAward request
      const amountDataResult = await pool.query(
        'SELECT id, total_amount, pre_auth_amount, currency FROM amount_data WHERE request_info_id = $1 ORDER BY created_at',
        [loyaltyAwardRequestId]
      );

      if (amountDataResult.rows.length === 0) {
        console.error(`No amount_data found for LoyaltyAward request id: ${loyaltyAwardRequestId}`);
        return { success: false, message: 'No amount data found for the LoyaltyAward request.' };
      }

      // Find the row with the highest total_amount
      let highestAmountData = amountDataResult.rows[0];
      for (const row of amountDataResult.rows) {
        if (parseFloat(row.total_amount) > parseFloat(highestAmountData.total_amount)) {
          highestAmountData = row;
        }
      }

      const originalAmountDataId = highestAmountData.id;
      const originalTotalAmount = highestAmountData.total_amount;
      const preAuthAmount = highestAmountData.pre_auth_amount || '';
      const currency = highestAmountData.currency || 'EUR';
      
      console.log(`Highest total_amount found: ${originalTotalAmount} with amount_data.id: ${originalAmountDataId}`);

      // Step 3: Insert a new row in amount_data with the original total_amount
      const newAmountResult = await pool.query(
        'INSERT INTO amount_data (total_amount, pre_auth_amount, currency, request_info_id, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id',
        [originalTotalAmount, preAuthAmount, currency, currentRequestId]
      );
      const newAmountDataId = newAmountResult.rows[0].id;
      console.log(`Successfully inserted new row in amount_data with id ${newAmountDataId} and total_amount ${originalTotalAmount} for request_info_id ${currentRequestId}`);

      // Step 4: Copy the original sale items to the new amount_data
      const originalSaleItemsResult = await pool.query(
        'SELECT * FROM sale_items WHERE amount_data_id = $1',
        [originalAmountDataId]
      );

      const saleItemsQuery = `
        INSERT INTO sale_items (amount_data_id, product_code, amount, quantity, add_prod_code, reverse_sale, sale_channel, rebate_label, add_prod_info, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      for (const item of originalSaleItemsResult.rows) {
        const saleItemValues = [
          newAmountDataId,             // amount_data_id (new)
          item.product_code || '',     // product_code
          item.amount,                 // amount
          item.quantity || '',         // quantity
          item.add_prod_code || '',    // add_prod_code
          item.reverse_sale || '0',    // reverse_sale
          item.sale_channel || '',     // sale_channel
          '',                          // rebate_label (reset to empty)
          item.add_prod_info || ''     // add_prod_info
        ];

        await pool.query(saleItemsQuery, saleItemValues);
        console.log(`Restored original sale_item with amount ${item.amount} for amount_data_id ${newAmountDataId}`);
      }

      return { success: true, message: 'LoyaltyAward discounts undone successfully.' };
    } catch (error) {
      console.error(`Error during LoyaltyAwardRefund processing for STAN=${stan}:`, error);
      return { success: false, message: 'Error during LoyaltyAwardRefund processing: ' + error.message };
    }
  };

  // Endpoint pour récupérer le dernier message CashierTerminal

  app.get('/products', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          name as "productName",
          product_code as "productCode",
          unit_price::text as "unitPrice",
          unit_measure as "unitMeasure",
          tax_code as "taxCode"
        FROM products
        ORDER BY product_code ASC
      `);
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: 'Internal server error fetching products' });
    }
  });

  // Endpoint pour envoyer la reponse du terminal UI (YES, NO, ou code numerique)
  app.post('/cashier-terminal-response', (req, res) => {
    const { confirmation } = req.body;
    const responseValue = String(confirmation || '').trim();

    if (!responseValue || !(/^(YES|NO)$/i.test(responseValue) || /^\d{4,8}$/.test(responseValue))) {
      return res.status(400).json({ message: 'Invalid terminal response. Use YES, NO, or a 4-8 digit code.' });
    }

    const resolved = resolveCashierTerminalResponse(responseValue.toUpperCase() === 'YES' || responseValue.toUpperCase() === 'NO'
      ? responseValue.toUpperCase()
      : responseValue);

    if (!resolved) {
      return res.status(400).json({ message: 'No pending CashierTerminal request' });
    }

    res.status(200).json({ message: 'Response sent successfully' });
  });

  // Endpoint pour récupérer les messages DeviceRequest
  app.get('/device-messages', (req, res) => {
    try {
      const displayMessage = getLastDisplayMessage();
      const printerMessage = getLastPrinterMessage();
      const cashierTerminalMessage = getLastCashierTerminalMessage();
      res.status(200).json({
        display: displayMessage,
        printer: printerMessage,
        cashierTerminal: cashierTerminalMessage
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des messages DeviceRequest:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  // Endpoint to fetch the stan from the most recent LoyaltyAward response
  app.get('/last-loyalty-award-stan', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT stan 
         FROM response_info 
         WHERE request_type = 'LoyaltyAward' 
         AND stan IS NOT NULL 
         ORDER BY id DESC LIMIT 1`
      );
      if (result.rows.length > 0) {
        res.status(200).json({ stan: result.rows[0].stan });
      } else {
        res.status(404).json({ message: 'No LoyaltyAward response found with a valid stan' });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du dernier STAN pour LoyaltyAward:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  // Endpoint pour traiter les données de request-info
  app.post('/request-info', async (req, res) => {
    const { requestData, posData, loyaltyData, amountData } = req.body;

    if (!requestData) {
      return res.status(400).json({ message: 'Missing requestData in body' });
    }

    console.log('Raw request body:', req.body);
    console.log('Raw amountData:', amountData);

    let selectedSaleItems = [];
    if (amountData && amountData.saleItems && Array.isArray(amountData.saleItems)) {
      selectedSaleItems = amountData.saleItems.filter(item => item.isSelected === true || item.isSelected === 'true');
      console.log('Selected saleItems from request:', selectedSaleItems);
    } else {
      console.log('No saleItems provided in request.');
    }

    const updatedAmountData = { ...amountData, saleItems: selectedSaleItems };

    const updatedRequestData = { ...requestData, requestId: null };

    clearDeviceMessages();

    // Handle LoyaltyAwardRefund before generating the XML
    let refundResult = { success: true, message: '' };
    let nextRequestId;

    if (updatedRequestData.requestType === 'LoyaltyAwardRefund' && updatedRequestData.stan) {
      const requestResult = await pool.query(
        'INSERT INTO request_info (request_type, pop_id, ref_number, workstation_id, app_sender, stan, request_timestamp) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id',
        [
          updatedRequestData.requestType || null,
          updatedRequestData.popId || null,
          updatedRequestData.refNumber || null,
          updatedRequestData.workId || null,
          updatedRequestData.appSender || null,
          
          updatedRequestData.stan || null,
        ]
      );
      nextRequestId = requestResult.rows[0].id;
      console.log('Inserted request_info for LoyaltyAwardRefund with id:', nextRequestId);

      refundResult = await handleLoyaltyAwardRefund(updatedRequestData.stan, nextRequestId);
      if (!refundResult.success) {
        await pool.query(
          `INSERT INTO response_info (id, request_type, overall_result, stan, created_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE 
           SET request_type = $2, overall_result = $3, stan = $4`,
          [nextRequestId, updatedRequestData.requestType, 'Failed', updatedRequestData.stan]
        );
        console.log(`Inserted/Updated response_info for failed LoyaltyAwardRefund request with id ${nextRequestId}`);
        return res.status(400).json({ message: refundResult.message });
      }
    } else {
      const requestResult = await pool.query(
        'INSERT INTO request_info (request_type, pop_id, ref_number, workstation_id, app_sender, stan, request_timestamp) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id',
        [
          updatedRequestData.requestType || null,
          updatedRequestData.popId || null,
          updatedRequestData.refNumber || null,
          updatedRequestData.workId || null,
          updatedRequestData.appSender || null,
          
          updatedRequestData.stan || null,
        ]
      );
      nextRequestId = requestResult.rows[0].id;
      console.log('Inserted new request_info with id:', nextRequestId);
    }

    // Mettre à  jour updatedRequestData.requestId avec l'id généré
    updatedRequestData.requestId = nextRequestId.toString();

    // Générer le service request XML
    const serviceRequestPromise = generateServiceRequest(updatedRequestData, posData, updatedAmountData, loyaltyData);
    const serviceRequest = await serviceRequestPromise;
    lastServiceRequest = serviceRequest;
    console.log('Generated Service Request XML:', Buffer.isBuffer(serviceRequest) ? serviceRequest.toString('latin1') : serviceRequest);
    await addMessageToSend(serviceRequest);

    try {
      const requestId = nextRequestId;

      if (posData) {
        const posValues = [
          posData.posTimestamp || null,
          posData.languageCode || null,
          posData.cardEntryMode || null,
          posData.shiftNumber || null,
          posData.terminalBatch || null,
          posData.statusRequest || null,
          posData.additionalInfo || null,
          posData.outdoorPosition || null,
          posData.clerkId || null,
          posData.clerkLevel || null,
          posData.serviceLevel || null,
          posData.posName || null,
          posData.global || false,
          posData.split || false,
          posData.longFormat || false,
          posData.unattended || false,
          posData.waitingCard || false,
          posData.choicePayKind || false,
          requestId,
        ];
        await insertWithErrorHandling(
          'INSERT INTO pos_data (pos_timestamp, language_code, card_entry_mode, shift_number, terminal_batch, status_request, additional_info, outdoor_position, clerk_id, clerk_level, service_level, pos_name, global, split, long_format, unattended, waiting_card, choice_pay_kind, request_info_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *',
          posValues,
          'Pos data inserted successfully:'
        );
      }

      if (amountData && updatedRequestData.requestType !== 'LoyaltyAwardRefund') {
        const { totalAmount, preAuthAmount, currency, itemDetails } = amountData;

          const amountResult = await pool.query(
            'INSERT INTO amount_data (total_amount, pre_auth_amount, currency, request_info_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [totalAmount || '0', preAuthAmount || '', currency || 'EUR', requestId]
          );
        const amountDataId = amountResult.rows[0].id;
        console.log('Inserted amount_data with id:', amountDataId, 'for request_info_id:', requestId);

        const saleItemsQuery = `
          INSERT INTO sale_items (amount_data_id, product_code, amount, quantity, add_prod_code, reverse_sale, sale_channel, rebate_label, add_prod_info, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
          RETURNING *
        `;

        for (const item of selectedSaleItems) {
          await insertWithErrorHandling(
            saleItemsQuery,
            prepareSaleItemValues(item, amountDataId),
            `Successfully inserted sale_item:`
          );
        }
      }

      if (loyaltyData) {
        const loyaltyValues = [
          loyaltyData.loyaltyFlag || false,
          loyaltyData.cardEntryMode || null,
          loyaltyData.loyaltyCard || null,
          loyaltyData.loyaltyPan || null,
          loyaltyData.cardEntryModeNew || null,
          loyaltyData.loyaltyCardNew || null,
          loyaltyData.loyaltyPanNew || null,
          loyaltyData.loyaltyAmount || null,
          loyaltyData.loyaltyOriginalAmount || null,
          loyaltyData.loyaltyApprovalCode || null,
          loyaltyData.loyaltyAcquirerId || null,
          loyaltyData.loyaltyAcquirerBatch || null,
          loyaltyData.bonusCard || false,
          requestId,
        ];
        await insertWithErrorHandling(
          'INSERT INTO loyalty (loyalty_flag, card_entry_mode, loyalty_card, loyalty_pan, card_entry_mode_new, loyalty_card_new, loyalty_pan_new, loyalty_amount, loyalty_original_amount, loyalty_approval_code, loyalty_acquirer_id, loyalty_acquirer_batch, bonus_card, request_info_id, loyalty_timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP) RETURNING *',
          loyaltyValues,
          'Loyalty data inserted successfully:'
        );
      }

      res.status(200).json({
        message: 'Data received and saved successfully' + (refundResult.message ? ' - ' + refundResult.message : ''),
        requestId: requestId,
        serviceRequest: Buffer.isBuffer(serviceRequest) ? serviceRequest.toString('latin1') : serviceRequest,
      });
    } catch (error) {
      console.error('Error processing request-info:', error);
      await pool.query(
        `INSERT INTO response_info (id, request_type, overall_result, stan, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE 
         SET request_type = $2, overall_result = $3, stan = $4`,
        [nextRequestId, updatedRequestData.requestType, 'Failed', updatedRequestData.stan]
      );
      console.log(`Inserted/Updated response_info for failed request with id ${nextRequestId}`);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  // Endpoint to process the CardServiceResponse
  app.post('/process-response/:requestId', async (req, res) => {
    const responseXML = getLastResponseXML();
    if (!responseXML) {
      return res.status(404).json({ message: 'No response XML available' });
    }
    console.log(`Processing response for RequestID in /process-response endpoint`);
    await processCardServiceResponse(responseXML);
    res.status(200).json({ message: 'Response processed successfully' });
  });

  // Endpoint pour récupérer la dernière ligne de loyalty
  app.get('/last-loyalty-data', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM loyalty WHERE loyalty_timestamp IS NOT NULL ORDER BY loyalty_timestamp DESC LIMIT 1');
      if (result.rows.length > 0) {
        const loyaltyData = result.rows[0];
        const responseData = {
          loyaltyFlag: loyaltyData.loyalty_flag || false,
          cardEntryMode: loyaltyData.card_entry_mode || '',
          loyaltyCard: loyaltyData.loyalty_card || '',
          loyaltyPan: loyaltyData.loyalty_pan || '',
          cardEntryModeNew: loyaltyData.card_entry_mode_new || '',
          loyaltyCardNew: loyaltyData.loyalty_card_new || '',
          loyaltyPanNew: loyaltyData.loyalty_pan_new || '',
          loyaltyTimestamp: loyaltyData.loyalty_timestamp || '',
          loyaltyAmount: loyaltyData.loyalty_amount || '',
          loyaltyOriginalAmount: loyaltyData.loyalty_original_amount || '',
          loyaltyApprovalCode: loyaltyData.loyalty_approval_code || '',
          loyaltyAcquirerId: loyaltyData.loyalty_acquirer_id || '',
          loyaltyAcquirerBatch: loyaltyData.loyalty_acquirer_batch || '',
          bonusCard: loyaltyData.bonus_card || false,
          requestInfoId: loyaltyData.request_info_id || null,
        };
        res.status(200).json(responseData);
      } else {
        res.status(404).json({ message: 'No loyalty data found with a valid timestamp' });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de loyalty:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  // Endpoint pour récupérer la dernière réponse XML
  app.get('/last-response-xml', (req, res) => {
    const responseXML = getLastResponseXML();
    if (!responseXML) {
      return res.status(404).json({ message: 'No response XML available' });
    }
    res.status(200).json({ responseXML });
  });

  // Endpoint pour récupérer la dernière réponse info
  app.get('/last-response-info', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM response_info WHERE created_at IS NOT NULL ORDER BY created_at DESC LIMIT 1'
      );
      if (result.rows.length > 0) {
        const responseData = result.rows[0];
        res.status(200).json({
          cardServiceResponse: {
            attributes: {
              requestType: responseData.request_type || '',
              overallResult: responseData.overall_result || '',
              requestId: responseData.id || '',
            },
            terminal: {
              terminalId: responseData.terminal_id || '',
              stan: responseData.stan ?? '',
              terminalBatch: responseData.terminal_batch ?? '',
            },
            tender: {
              totalAmount: {
                value: responseData.amount || '',
              },
            },
          },
        });
      } else {
        res.status(404).json({ message: 'No response info found' });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de response_info:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

    app.get('/response-info/:id', async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        const result = await pool.query(
          'SELECT * FROM response_info WHERE id = $1 ORDER BY created_at DESC LIMIT 1',
          [id]
        );
        if (result.rows.length > 0) {
          const responseData = result.rows[0];
          res.status(200).json({
            cardServiceResponse: {
              attributes: {
                requestType: responseData.request_type || '',
                overallResult: responseData.overall_result || '',
                requestId: responseData.id || '',
              },
              terminal: {
                terminalId: responseData.terminal_id || '',
                stan: responseData.stan ?? '',
                terminalBatch: responseData.terminal_batch ?? '',
              },
              tender: {
                totalAmount: {
                  value: responseData.amount || '',
                },
              },
            },
          });
        } else {
          res.status(404).json({ message: 'No response info available for this ID' });
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de /response-info/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

  app.get('/last-service-request', (req, res) => {
    if (!lastServiceRequest) {
      return res.status(404).json({ message: 'No Service Request available' });
    }
    const xmlString = Buffer.isBuffer(lastServiceRequest) ? lastServiceRequest.toString('latin1') : lastServiceRequest;
    console.log('Returning last service request:', xmlString);
    res.status(200).json({ serviceRequest: xmlString });
  });

  app.get('/last-pos-data', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM pos_data ORDER BY id DESC LIMIT 1');
      if (result.rows.length > 0) {
        const posData = result.rows[0];
        res.status(200).json({
          posTimestamp: posData.pos_timestamp || '',
          languageCode: posData.language_code || '',
          cardEntryMode: posData.card_entry_mode || '',
          shiftNumber: posData.shift_number || '',
          terminalBatch: posData.terminal_batch || '',
          statusRequest: posData.status_request || '',
          additionalInfo: posData.additional_info || '',
          outdoorPosition: posData.outdoor_position || '',
          clerkId: posData.clerk_id || '',
          clerkLevel: posData.clerk_level || '',
          serviceLevel: posData.service_level || '',
          posName: posData.pos_name || '',
          global: posData.global || false,
          split: posData.split || false,
          longFormat: posData.long_format || false,
          unattended: posData.unattended || false,
          waitingCard: posData.waiting_card || false,
          choicePayKind: posData.choice_pay_kind || false,
          requestInfoId: posData.request_info_id || null,
        });
      } else {
        res.status(404).json({ message: 'No POS data found' });
      }
    } catch (error) {
      console.error('Error fetching last POS data:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  app.get('/last-request-info', async (req, res) => {
    try {
      const nextIdResult = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM request_info');
      const nextRequestId = nextIdResult.rows[0].next_id.toString();

      const result = await pool.query(
        'SELECT * FROM request_info WHERE request_timestamp IS NOT NULL ORDER BY request_timestamp DESC LIMIT 1'
      );

      if (result.rows.length > 0) {
        const requestData = result.rows[0];
        const responseData = {
          requestType: requestData.request_type || '',
          popId: requestData.pop_id || '',
          refNumber: requestData.ref_number || '',
          workId: requestData.workstation_id || '',
          appSender: requestData.app_sender || '',
          id: requestData.id || '',
          requestId: nextRequestId, // Use nextRequestId so the form shows the upcoming ID
          requestTimestamp: requestData.request_timestamp || '',
          stan: requestData.stan || '',
        };
        res.status(200).json(responseData);
      } else {
        res.status(200).json({ requestId: nextRequestId });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de request_info:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  app.get('/last-amount', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM amount_data WHERE created_at IS NOT NULL ORDER BY created_at DESC LIMIT 1'
      );
      if (result.rows.length > 0) {
        const amountData = result.rows[0];
        const saleItemsResult = await pool.query(
          `SELECT si.*, p.name as button_label, p.unit_price, p.unit_measure, p.tax_code 
           FROM sale_items si 
           LEFT JOIN products p ON si.product_code = p.product_code 
           WHERE si.amount_data_id = $1 
           ORDER BY si.id`,
          [amountData.id]
        );

        const responseData = {
          id: amountData.id,
          totalAmount: amountData.total_amount || '0',
          preAuthAmount: amountData.pre_auth_amount || '0',
          currency: amountData.currency || 'EUR',
          itemDetails: amountData.item_details && typeof amountData.item_details === 'string'
            ? (() => {
                try {
                  return JSON.parse(amountData.item_details);
                } catch (error) {
                  console.error('Error parsing item_details:', error);
                  return {};
                }
              })()
            : amountData.item_details || {},
          requestInfoId: amountData.request_info_id || null,
          createdAt: amountData.created_at || '',
          saleItems: saleItemsResult.rows.map(item => ({
            itemId: item.item_id || '',
            buttonLabel: item.button_label || '',
            productCode: item.product_code || '',
            amount: item.amount || '',
            quantity: item.quantity || '',
            taxCode: item.tax_code || '',
            addProdCode: item.add_prod_code || '',
            reverseSale: item.reverse_sale || '',
            unitPrice: item.unit_price || '',
            unitMeasure: item.unit_measure || '',
            saleChannel: item.sale_channel || '',
            rebateLabel: item.rebate_label || '',
            addProdInfo: item.add_prod_info || '',
            isSelected: true,
            createdAt: item.created_at || '',
          })),
        };
        res.status(200).json(responseData);
      } else {
        res.status(404).json({
          id: 1,
          totalAmount: '0',
          preAuthAmount: '0',
          currency: 'EUR',
          itemDetails: {},
          requestInfoId: null,
          createdAt: '',
          saleItems: generateDefaultSaleItems(),
        });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de amount_data:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  // Endpoint to fetch amount_data by request_info_id
  app.get('/amount-data/by-request/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'SELECT * FROM amount_data WHERE request_info_id = $1 ORDER BY created_at DESC LIMIT 1',
        [id]
      );
      if (result.rows.length > 0) {
        const amountData = result.rows[0];
        const saleItemsResult = await pool.query(
          `SELECT si.*, p.name as button_label, p.unit_price, p.unit_measure, p.tax_code 
           FROM sale_items si 
           LEFT JOIN products p ON si.product_code = p.product_code 
           WHERE si.amount_data_id = $1 
           ORDER BY si.id`,
          [amountData.id]
        );

        const responseData = {
          id: amountData.id,
          totalAmount: amountData.total_amount || '0',
          preAuthAmount: amountData.pre_auth_amount || '0',
          currency: amountData.currency || 'EUR',
          itemDetails: amountData.item_details && typeof amountData.item_details === 'string'
            ? (() => {
                try {
                  return JSON.parse(amountData.item_details);
                } catch (error) {
                  console.error('Error parsing item_details:', error);
                  return {};
                }
              })()
            : amountData.item_details || {},
          requestInfoId: amountData.request_info_id || null,
          createdAt: amountData.created_at || '',
          saleItems: saleItemsResult.rows.map(item => ({
            itemId: item.item_id || '',
            buttonLabel: item.button_label || '',
            productCode: item.product_code || '',
            amount: item.amount || '',
            quantity: item.quantity || '',
            taxCode: item.tax_code || '',
            addProdCode: item.add_prod_code || '',
            reverseSale: item.reverse_sale || '',
            unitPrice: item.unit_price || '',
            unitMeasure: item.unit_measure || '',
            saleChannel: item.sale_channel || '',
            rebateLabel: item.rebate_label || '',
            addProdInfo: item.add_prod_info || '',
            isSelected: true,
            createdAt: item.created_at || '',
          })),
        };
        res.status(200).json(responseData);
      } else {
        res.status(404).json({ message: 'No amount data found for this request ID' });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de amount_data pour request ID:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  app.get('/last-sale-items', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT si.*, p.name as button_label, p.unit_price, p.unit_measure, p.tax_code 
         FROM sale_items si 
         LEFT JOIN products p ON si.product_code = p.product_code 
         WHERE si.created_at IS NOT NULL ORDER BY si.created_at DESC LIMIT 35`
      );
      if (result.rows.length > 0) {
        const saleItems = result.rows.map(item => ({
          itemId: item.item_id || '',
          buttonLabel: item.button_label || '',
          productCode: item.product_code || '',
          amount: item.amount || '',
          quantity: item.quantity || '',
          taxCode: item.tax_code || '',
          addProdCode: item.add_prod_code || '',
          reverseSale: item.reverse_sale || '',
          unitPrice: item.unit_price || '',
          unitMeasure: item.unit_measure || '',
          saleChannel: item.sale_channel || '',
          rebateLabel: item.rebate_label || '',
          addProdInfo: item.add_prod_info || '',
          isSelected: true,
          createdAt: item.created_at || '',
        }));
        res.status(200).json(saleItems);
      } else {
        res.status(404).json({ message: 'No sale items found with a valid timestamp' });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de sale_items:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  app.get('/total-amount/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT total_amount FROM amount_data
         WHERE request_info_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [id]
      );
      if (result.rows.length > 0) {
        res.status(200).json({ totalAmount: result.rows[0].total_amount || '0' });
      } else {
        res.status(404).json({ message: 'No total amount found for this id' });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de total_amount:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  app.get('/amount-data', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM amount_data LIMIT 1');
      const amountData = result.rows[0];
      if (amountData) {
        const saleItems = await pool.query(
          `SELECT si.*, p.name as button_label, p.unit_price, p.unit_measure, p.tax_code 
           FROM sale_items si 
           LEFT JOIN products p ON si.product_code = p.product_code 
           WHERE si.amount_data_id = $1 ORDER BY si.id`, 
          [amountData.id]
        );
        res.json({
          id: amountData.id,
          totalAmount: amountData.total_amount || '0',
          preAuthAmount: amountData.pre_auth_amount || '',
          currency: amountData.currency || 'EUR',
          saleItems: saleItems.rows.map(transformSaleItem),
          itemDetails: amountData.item_details && typeof amountData.item_details === 'string'
            ? (() => {
                try {
                  return JSON.parse(amountData.item_details);
                } catch (error) {
                  console.error('Error parsing item_details:', error);
                  return {};
                }
              })()
            : amountData.item_details || {},
        });
      } else {
        res.json({
          id: 1,
          totalAmount: '0',
          preAuthAmount: '',
          currency: 'EUR',
          saleItems: generateDefaultSaleItems(),
          itemDetails: {},
        });
      }
    } catch (error) {
      console.error('Error fetching amountData:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  });

  app.get('/amount-data/:id/sale-items', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT si.*, p.name as button_label, p.unit_price, p.unit_measure, p.tax_code 
         FROM sale_items si 
         LEFT JOIN products p ON si.product_code = p.product_code 
         WHERE si.amount_data_id = $1 ORDER BY si.id`, 
        [req.params.id]
      );
      res.json(result.rows.map(transformSaleItem));
    } catch (error) {
      console.error('Error fetching saleItems:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  app.post('/amount-data/:id/sale-items', async (req, res) => {
    const item = req.body;
    try {
      const result = await insertWithErrorHandling(
        'INSERT INTO sale_items (amount_data_id, product_code, amount, quantity, add_prod_code, reverse_sale, sale_channel, rebate_label, add_prod_info, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP) ON CONFLICT (amount_data_id, product_code) DO UPDATE SET amount = $3, quantity = $4, add_prod_code = $5, reverse_sale = $6, sale_channel = $7, rebate_label = $8, add_prod_info = $9, created_at = CURRENT_TIMESTAMP RETURNING *',
        prepareSaleItemValues(item, req.params.id),
        'Sale item updated successfully:'
      );
      res.json(result ? transformSaleItem(result.rows[0]) : { message: 'Failed to update sale item' });
    } catch (error) {
      console.error('Error updating sale item:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  app.post('/configuration', (req, res) => {
    const { clientIp, serverIp, epsPort, posProxyPort, opiMode } = req.body;
    console.log('Received configuration data:', {
      clientIp,
      serverIp,
      epsPort,
      posProxyPort,
      opiMode,
    });

    const newConfig = { clientIp, serverIp, epsPort, posProxyPort, opiMode };
    updateTcpConfigData(newConfig); // Mettre à  jour uniquement dans tcpHandler
    restartTcpServer();

    res.status(200).json({
      message: 'Configuration data received successfully',
      data: { clientIp, serverIp, epsPort, posProxyPort, opiMode },
    });
  });

  app.get('/configuration', (req, res) => {
    const config = getConfigData();
    res.status(200).json({
      clientIp: config.clientIp,
      serverIp: config.serverIp,
      epsPort: config.epsPort,
      posProxyPort: config.posProxyPort,
      opiMode: config.opiMode,
    });
  });
};

module.exports = setupRoutes;

