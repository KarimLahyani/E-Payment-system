const { pool } = require('./database');
const { insertWithErrorHandling, prepareSaleItemValues, transformSaleItem, generateDefaultSaleItems } = require('./utils');
const { generateServiceRequest } = require('./xmlGenerator');
const { addMessageToSend, updateConfigData: updateTcpConfigData, restartTcpServer, getConfigData, getLastDisplayMessage, getLastPrinterMessage, resolveCashierTerminalResponse, getLastCashierTerminalMessage, clearDeviceMessages } = require('./tcpHandler');


const setupRoutes = (app) => {


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


  // Endpoint pour traiter les données de request-info
  app.post('/request-info', async (req, res) => {
    const { requestData, posData, loyaltyData, basketData } = req.body;

    if (!requestData) {
      return res.status(400).json({ message: 'Missing requestData in body' });
    }

    console.log('Raw request body:', req.body);
    console.log('Raw basketData:', basketData);

    let selectedSaleItems = [];
    if (basketData && basketData.saleItems && Array.isArray(basketData.saleItems)) {
      selectedSaleItems = basketData.saleItems.filter(item => item.isSelected === true || item.isSelected === 'true');
      console.log('Selected saleItems from request:', selectedSaleItems);
    } else {
      console.log('No saleItems provided in request.');
    }

    const updatedBasketData = { ...basketData, saleItems: selectedSaleItems };

    const updatedRequestData = { ...requestData, requestId: null };

    clearDeviceMessages();

    let nextRequestId;
    // Insert into request_info
      const requestResult = await pool.query(
        'INSERT INTO request_info (request_type, pop_id, ref_number, workstation_id, app_sender, stan, request_timestamp) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id',
        [
          updatedRequestData.requestType || null,
          updatedRequestData.popId || null,
          updatedRequestData.refNumber || null,
          updatedRequestData.workstationId || null,
          updatedRequestData.appSender || null,
          updatedRequestData.reprintSearchType === 'requestId' ? (updatedRequestData.originalRequestId || null) : (updatedRequestData.stan || null),
        ]
      );
      nextRequestId = requestResult.rows[0].id;
      console.log('Inserted new request_info with id:', nextRequestId);

    // Mettre à  jour updatedRequestData.requestId avec l'id généré
    updatedRequestData.requestId = nextRequestId.toString();

    // Générer le service request XML
    const serviceRequestPromise = generateServiceRequest(updatedRequestData, posData, updatedBasketData, loyaltyData);
    const serviceRequest = await serviceRequestPromise;
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
          posData.clerkId || null,
          posData.posName || null,
          posData.splitId || null,
          posData.split || false,
          posData.unattended || false,
          requestId,
        ];
        await insertWithErrorHandling(
          'INSERT INTO pos_data (pos_timestamp, language_code, card_entry_mode, shift_number, clerk_id, pos_name, split_id, split, unattended, request_info_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
          posValues,
          'Pos data inserted successfully:'
        );
      }

      if (basketData) {
        const { totalAmount, preAuthAmount, currency, itemDetails } = basketData;
        try {
          const basketResult = await pool.query(
            'INSERT INTO basket_data (total_amount, pre_auth_amount, currency, request_info_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [totalAmount || '0', preAuthAmount || '', currency || 'TND', requestId]
          );
          const basketDataId = basketResult.rows[0].id;
          console.log('Inserted basket_data with id:', basketDataId, 'for request_info_id:', requestId);

          const saleItemsQuery = `
            INSERT INTO sale_items (basket_data_id, product_code, amount, quantity, add_prod_code, reverse_sale, sale_channel, rebate_label, add_prod_info, pump_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            ON CONFLICT (basket_data_id, product_code) 
            DO UPDATE SET amount = $3, quantity = $4, add_prod_code = $5, reverse_sale = $6, sale_channel = $7, rebate_label = $8, add_prod_info = $9, pump_id = $10, created_at = CURRENT_TIMESTAMP
          `;
          
          for (const item of selectedSaleItems) {
            await insertWithErrorHandling(
              saleItemsQuery,
              prepareSaleItemValues(item, basketDataId),
              `Successfully inserted sale_item:`
            );
          }
        } catch (error) {
          console.error('Erreur lors de l\'insertion de basketData:', error);
          throw error;
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
        message: 'Data received and saved successfully',
        requestId: requestId,
        serviceRequest: Buffer.isBuffer(serviceRequest) ? serviceRequest.toString('latin1') : serviceRequest,
      });
    } catch (error) {
      console.error('Error processing request-info:', error);
      const result = await pool.query(
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


  app.get('/last-response-info', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM response_info WHERE created_at IS NOT NULL ORDER BY created_at DESC LIMIT 1'
      );
      if (result.rows.length > 0) {
        const responseData = result.rows[0];
        let saleItem = [];
        if (responseData.request_type === 'LoyaltyAward') {
          const saleItemsResult = await pool.query(`
            SELECT si.* 
            FROM sale_items si
            JOIN basket_data ad ON si.basket_data_id = ad.id
            WHERE ad.request_info_id = $1
          `, [responseData.id]);
          saleItem = saleItemsResult.rows.map(item => ({
            productCode: item.product_code,
            amount: parseFloat(item.amount),
            rebateLabel: item.rebate_label
          }));
        }

        res.status(200).json({
          cardServiceResponse: {
            attributes: {
              requestType: responseData.request_type || '',
              overallResult: responseData.overall_result || '',
              errorCondition: responseData.error_condition || '',
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
            saleItem: saleItem
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
          let saleItem = [];
          if (responseData.request_type === 'LoyaltyAward') {
            const saleItemsResult = await pool.query(`
              SELECT si.* 
              FROM sale_items si
              JOIN basket_data ad ON si.basket_data_id = ad.id
              WHERE ad.request_info_id = $1
            `, [responseData.id]);
            saleItem = saleItemsResult.rows.map(item => ({
              productCode: item.product_code,
              amount: parseFloat(item.amount),
              rebateLabel: item.rebate_label
            }));
          }

          res.status(200).json({
            cardServiceResponse: {
              attributes: {
                requestType: responseData.request_type || '',
                overallResult: responseData.overall_result || '',
                errorCondition: responseData.error_condition || '',
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
              saleItem: saleItem
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
          outdoorPosition: posData.outdoor_position || '',
          clerkId: posData.clerk_id || '',
          posName: posData.pos_name || '',
          splitId: posData.split_id || '',
          split: posData.split || false,
          unattended: posData.unattended || false,
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
          workstationId: requestData.workstation_id || '',
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

  app.get('/latest-basket-data', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM basket_data WHERE created_at IS NOT NULL ORDER BY created_at DESC LIMIT 1'
      );
      if (result.rows.length > 0) {
        const basketData = result.rows[0];
        const saleItemsResult = await pool.query(
          `SELECT si.*, p.name as button_label, p.unit_price, p.unit_measure, p.tax_code 
           FROM sale_items si 
           LEFT JOIN products p ON si.product_code = p.product_code 
           WHERE si.basket_data_id = $1 
           ORDER BY si.id`,
          [basketData.id]
        );

        const responseData = {
          id: basketData.id,
          totalAmount: basketData.total_amount || '0',
          preAuthAmount: basketData.pre_auth_amount || '0',
          currency: basketData.currency || 'TND',
          itemDetails: basketData.item_details && typeof basketData.item_details === 'string'
            ? (() => {
                try {
                  return JSON.parse(basketData.item_details);
                } catch (error) {
                  console.error('Error parsing item_details:', error);
                  return {};
                }
              })()
            : basketData.item_details || {},
          requestInfoId: basketData.request_info_id || null,
          createdAt: basketData.created_at || '',
          saleItems: saleItemsResult.rows.map(item => ({
            itemId: item.item_id || '',
            buttonLabel: item.button_label || '',
            productCode: item.product_code || '',
            amount: item.amount || '',
            quantity: item.quantity || '',
            taxCode: item.tax_code || '',
            addProdCode: item.add_prod_code || '',
            reverseSale: item.reverse_sale || '',
            saleChannel: item.sale_channel || '',
            rebateLabel: item.rebate_label || '',
            addProdInfo: item.add_prod_info || '',
            pumpId: item.pump_id || '',
            isSelected: true,
            createdAt: item.created_at || '',
          }))
        };
        res.status(200).json(responseData);
      } else {
        res.status(404).json({ message: 'No basket_data found' });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du dernier basket_data:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

  // Endpoint to fetch basket by request_info_id
  app.get('/basket/by-request/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'SELECT * FROM basket_data WHERE request_info_id = $1 ORDER BY created_at DESC LIMIT 1',
        [id]
      );
      if (result.rows.length > 0) {
        const basketData = result.rows[0];
        const saleItemsResult = await pool.query(
          `SELECT si.*, p.name as button_label, p.unit_price, p.unit_measure, p.tax_code 
           FROM sale_items si 
           LEFT JOIN products p ON si.product_code = p.product_code 
           WHERE si.basket_data_id = $1 
           ORDER BY si.id`,
          [basketData.id]
        );

        const responseData = {
          id: basketData.id,
          totalAmount: basketData.total_amount || '0',
          preAuthAmount: basketData.pre_auth_amount || '0',
          currency: basketData.currency || 'TND',
          itemDetails: basketData.item_details && typeof basketData.item_details === 'string'
            ? (() => {
                try {
                  return JSON.parse(basketData.item_details);
                } catch (error) {
                  console.error('Error parsing item_details:', error);
                  return {};
                }
              })()
            : basketData.item_details || {},
          requestInfoId: basketData.request_info_id || null,
          createdAt: basketData.created_at || '',
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
            pumpId: item.pump_id || '',
            isSelected: true,
            createdAt: item.created_at || '',
          })),
        };
        res.status(200).json(responseData);
      } else {
        res.status(404).json({ message: 'No basket data found for this request ID' });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de basket_data pour request ID:', error);
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
          pumpId: item.pump_id || '',
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
        `SELECT total_amount FROM basket_data
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

  app.get('/basket', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM basket_data LIMIT 1');
      const basketData = result.rows[0];
      if (basketData) {
        const saleItems = await pool.query(
          `SELECT si.*, p.name as button_label, p.unit_price, p.unit_measure, p.tax_code 
           FROM sale_items si 
           LEFT JOIN products p ON si.product_code = p.product_code 
           WHERE si.basket_data_id = $1 ORDER BY si.id`, 
          [basketData.id]
        );
        res.json({
          id: basketData.id,
          totalAmount: basketData.total_amount || '0',
          preAuthAmount: basketData.pre_auth_amount || '',
          currency: basketData.currency || 'TND',
          saleItems: saleItems.rows.map(transformSaleItem),
          itemDetails: basketData.item_details && typeof basketData.item_details === 'string'
            ? (() => {
                try {
                  return JSON.parse(basketData.item_details);
                } catch (error) {
                  console.error('Error parsing item_details:', error);
                  return {};
                }
              })()
            : basketData.item_details || {},
        });
      } else {
        res.json({
          id: 1,
          totalAmount: '0',
          preAuthAmount: '',
          currency: 'TND',
          saleItems: generateDefaultSaleItems(),
          itemDetails: {},
        });
      }
    } catch (error) {
      console.error('Error fetching basketData:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
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

  app.get('/api/history', async (req, res) => {
    try {
      let { page = 1, limit = 50, startDate, endDate, status } = req.query;
      page = parseInt(page, 10) || 1;
      
      let conditions = [];
      let params = [];
      let paramCount = 1;

      if (startDate) {
        conditions.push(`req.request_timestamp >= $${paramCount++}`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`req.request_timestamp <= $${paramCount++}`);
        params.push(endDate);
      }
      if (status) {
        if (status === 'Pending') {
          conditions.push(`res.overall_result IS NULL`);
        } else if (status === 'Failed') {
          conditions.push(`(res.overall_result = 'Failure' OR res.overall_result = 'Failed')`);
        } else {
          conditions.push(`res.overall_result = $${paramCount++}`);
          params.push(status);
        }
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // Count query
      const countQuery = `
        SELECT COUNT(req.id)
        FROM request_info req
        LEFT JOIN response_info res ON res.id = req.id
        ${whereClause}
      `;
      const countResult = await pool.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].count, 10);

      // Revenue calculation
      const revenueQuery = `
        SELECT DISTINCT ON (req.request_timestamp, req.id)
          b.total_amount
        FROM request_info req
        LEFT JOIN basket_data b ON b.request_info_id = req.id
        LEFT JOIN response_info res ON res.id = req.id
        ${whereClause ? whereClause + " AND " : "WHERE "}
        req.request_type = 'CardPayment' AND res.overall_result = 'Success'
      `;
      const revenueResult = await pool.query(revenueQuery, params);
      let totalRevenue = 0;
      revenueResult.rows.forEach(row => {
        if (row.total_amount) {
          const val = parseFloat(row.total_amount.replace(/[^\d.-]/g, '')) || 0;
          totalRevenue += val;
        }
      });

      // Data query
      let limitClause = '';
      if (limit !== 'all') {
        const parsedLimit = parseInt(limit, 10) || 50;
        const offset = (page - 1) * parsedLimit;
        limitClause = `LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        params.push(parsedLimit, offset);
      }

      const query = `
        SELECT DISTINCT ON (req.request_timestamp, req.id)
          req.id, 
          req.request_type, 
          COALESCE(res.stan, req.stan) AS stan, 
          req.request_timestamp,
          b.total_amount AS basket_total,
          b.currency,
          res.overall_result,
          res.error_condition,
          pos.split_id,
          pos.split AS is_split,
          res.card_number,
          res.customer_name
        FROM request_info req
        LEFT JOIN basket_data b ON b.request_info_id = req.id
        LEFT JOIN response_info res ON res.id = req.id
        LEFT JOIN pos_data pos ON pos.request_info_id = req.id
        ${whereClause}
        ORDER BY req.request_timestamp DESC, req.id DESC, b.id DESC
        ${limitClause}
      `;
      const result = await pool.query(query, params);
      
      res.status(200).json({
        totalCount,
        totalRevenue,
        transactions: result.rows.map(tx => ({
          id: tx.id,
          requestType: tx.request_type,
          stan: tx.stan,
          requestTimestamp: tx.request_timestamp,
          basketTotal: tx.basket_total,
          currency: tx.currency,
          overallResult: tx.overall_result,
          errorCondition: tx.error_condition,
          splitId: tx.split_id,
          isSplit: tx.is_split,
          cardNumber: tx.card_number,
          customerName: tx.customer_name
        })),
        page,
        limit
      });
    } catch (error) {
      console.error('Error fetching history:', error);
      res.status(500).json({ message: 'Error fetching history' });
    }
  });

  app.get('/api/history/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      const reqQuery = `SELECT * FROM request_info WHERE id = $1`;
      const resQuery = `SELECT * FROM response_info WHERE id = $1`;
      const posQuery = `SELECT * FROM pos_data WHERE request_info_id = $1`;
      const basketQuery = `SELECT * FROM basket_data WHERE request_info_id = $1 ORDER BY id DESC LIMIT 1`;
      const loyaltyQuery = `SELECT * FROM loyalty WHERE request_info_id = $1`;

      const [reqResult, resResult, posResult, basketResult, loyaltyResult] = await Promise.all([
        pool.query(reqQuery, [id]),
        pool.query(resQuery, [id]),
        pool.query(posQuery, [id]),
        pool.query(basketQuery, [id]),
        pool.query(loyaltyQuery, [id]),
      ]);

      if (reqResult.rows.length === 0) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      let saleItems = [];
      if (basketResult.rows.length > 0) {
        const basketId = basketResult.rows[0].id;
        const itemsQuery = `
          SELECT si.*, p.name as product_name, p.unit_price as base_unit_price
          FROM sale_items si
          LEFT JOIN products p ON si.product_code = p.product_code
          WHERE si.basket_data_id = $1
        `;
        const itemsResult = await pool.query(itemsQuery, [basketId]);
        saleItems = itemsResult.rows;
      }

      let originalTransactionInfo = null;
      if (reqResult.rows[0].request_type === 'TicketReprint' && reqResult.rows[0].stan) {
        const searchValue = String(reqResult.rows[0].stan).trim();
        const searchNum = parseInt(searchValue, 10);
        
        try {
          const origResult = await pool.query(
            `SELECT id, stan FROM response_info WHERE stan = $1 OR id = $2 ORDER BY id DESC LIMIT 1`,
            [searchValue, isNaN(searchNum) ? -1 : searchNum]
          );
          if (origResult.rows.length > 0) {
            originalTransactionInfo = {
              stan: origResult.rows[0].stan,
              requestId: origResult.rows[0].id
            };
          }
        } catch(e) {
          console.error('Error fetching original transaction for TicketReprint', e);
        }
      }

      const mapObj = (obj) => {
        if (!obj) return null;
        const newObj = {};
        for (const key in obj) {
          const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
          newObj[camelKey] = obj[key];
        }
        return newObj;
      };

      res.status(200).json({
        requestInfo: mapObj(reqResult.rows[0]),
        originalTransactionInfo: mapObj(originalTransactionInfo),
        responseInfo: mapObj(resResult.rows[0]),
        posData: mapObj(posResult.rows[0]),
        basketData: mapObj(basketResult.rows[0]),
        saleItems: saleItems.map(mapObj),
        loyalty: mapObj(loyaltyResult.rows[0])
      });

    } catch (error) {
      console.error('Error fetching transaction details:', error);
      res.status(500).json({ message: 'Error fetching transaction details' });
    }
  });

  // --- Cards Endpoints ---
  app.get('/api/cards', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM cards ORDER BY id ASC');
      // map snake_case to camelCase
      const cards = result.rows.map(card => ({
        id: card.id,
        name: card.name,
        card_type: card.card_type,
        number: card.number,
        expiry: card.expiry,
        passcode: card.passcode,
        balance: card.balance,
        status: card.status
      }));
      res.status(200).json(cards);
    } catch (error) {
      console.error('Error fetching cards:', error);
      res.status(500).json({ message: 'Error fetching cards' });
    }
  });

  app.post('/api/cards', async (req, res) => {
    const { name, number, expiry, passcode, balance, status } = req.body;
    try {
      // id is SERIAL, so we don't insert it explicitly
      const result = await pool.query(
        'INSERT INTO cards (name, number, expiry, passcode, balance, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [name, number, expiry, passcode, balance, status]
      );
      res.status(201).json({ id: result.rows[0].id, message: 'Card added' });
    } catch (error) {
      console.error('Error adding card:', error);
      res.status(500).json({ message: 'Error adding card' });
    }
  });

  app.put('/api/cards/:id', async (req, res) => {
    const { balance } = req.body;
    try {
      const result = await pool.query('UPDATE cards SET balance = $1 WHERE id = $2', [balance, req.params.id]);
      res.status(200).json({ message: 'Card balance updated' });
    } catch (error) {
      console.error('Error updating card:', error);
      res.status(500).json({ message: 'Error updating card' });
    }
  });

  app.post('/api/cards/reset', async (req, res) => {
    try {
      await pool.query('TRUNCATE TABLE cards RESTART IDENTITY CASCADE');
      
      const seedQuery = `
        INSERT INTO cards (name, number, expiry, passcode, balance, status) VALUES 
        ('Karim Lahyani', '4532111122229012', '2030-12', '4321', 350.00, 'ACTIVE'),
        ('John Doe', '4532333344441044', '2029-05', '2468', 180.00, 'ACTIVE'),
        ('Blocked Contractor', '4532555566665520', '2028-09', '1111', 100.00, 'BLOCKED'),
        ('Expired Service Card', '4532777788887780', '2025-01', '9999', 500.00, 'ACTIVE');
      `;
      await pool.query(seedQuery);
      res.status(200).json({ message: 'Cards reset to defaults' });
    } catch (error) {
      console.error('Error resetting cards:', error);
      res.status(500).json({ message: 'Error resetting cards' });
    }
  });

  app.post('/api/terminal/abort', async (req, res) => {
    try {
      const { requestId } = req.body || {};
      if (requestId) {
        const query = `
          INSERT INTO response_info (id, overall_result, created_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET overall_result = EXCLUDED.overall_result, created_at = EXCLUDED.created_at
        `;
        await pool.query(query, [requestId, 'Aborted', new Date().toISOString()]);
      }

      const { getSocketIo } = require('./tcpHandler');
      const io = getSocketIo();
      if (io) {
        io.emit('terminal:abort');
        res.status(200).json({ message: 'Terminal abort signal sent' });
      } else {
        res.status(500).json({ message: 'Socket.io not initialized' });
      }
    } catch (error) {
      console.error('Error aborting terminal:', error);
      res.status(500).json({ message: 'Error aborting terminal' });
    }
  });

  app.post('/api/terminal/reset', (req, res) => {
    try {
      const { getSocketIo } = require('./tcpHandler');
      const io = getSocketIo();
      if (io) {
        io.emit('terminal:reset');
        res.status(200).json({ message: 'Terminal reset signal sent' });
      } else {
        res.status(500).json({ message: 'Socket.io not initialized' });
      }
    } catch (error) {
      console.error('Error resetting terminal:', error);
      res.status(500).json({ message: 'Error resetting terminal' });
    }
  });

};

module.exports = setupRoutes;

