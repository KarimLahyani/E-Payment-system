const { pool } = require('../database');

/**
 * Executes a query with error handling.
 */
async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error('Database query error:', error, 'Query:', text);
    throw error;
  }
}

async function insertRequestInfo(requestData) {
  const result = await query(
    `INSERT INTO request_info 
    (request_type, pop_id, ref_number, workstation_id, app_sender, stan, request_timestamp) 
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id`,
    [
      requestData.requestType || null,
      requestData.popId || null,
      requestData.refNumber || null,
      requestData.workstationId || null,
      requestData.appSender || null,
      requestData.stan || null
    ]
  );
  return result.rows[0].id;
}

async function insertPosData(posData, requestId) {
  if (!posData) return null;
  const result = await query(
    `INSERT INTO pos_data 
    (pos_timestamp, language_code, card_entry_mode, shift_number, terminal_batch, 
    status_request, additional_info, clerk_id, clerk_level, 
    service_level, pos_name, global, split, long_format, unattended, waiting_card, 
    choice_pay_kind, request_info_id) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
    [
      posData.posTimestamp || null,
      posData.languageCode || null,
      posData.cardEntryMode || null,
      posData.shiftNumber || null,
      posData.terminalBatch || null,
      posData.statusRequest || null,
      posData.additionalInfo || null,
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
      requestId
    ]
  );
  return result.rows[0];
}

async function insertBasketData(basketData, requestId) {
  if (!basketData) return null;
  const result = await query(
    `INSERT INTO basket_data 
    (total_amount, pre_auth_amount, currency, request_info_id) 
    VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      basketData.totalAmount || '0',
      basketData.preAuthAmount || '',
      basketData.currency || 'EUR',
      requestId
    ]
  );
  return result.rows[0].id;
}

async function insertSaleItems(saleItems, basketDataId) {
  if (!saleItems || !saleItems.length) return;
  const insertQuery = `
    INSERT INTO sale_items 
    (basket_data_id, product_code, amount, quantity, add_prod_code, reverse_sale, 
    sale_channel, rebate_label, add_prod_info, pump_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
    ON CONFLICT (basket_data_id, product_code)
    DO UPDATE SET
      amount = EXCLUDED.amount,
      quantity = EXCLUDED.quantity,
      add_prod_code = EXCLUDED.add_prod_code,
      reverse_sale = EXCLUDED.reverse_sale,
      sale_channel = EXCLUDED.sale_channel,
      rebate_label = EXCLUDED.rebate_label,
      add_prod_info = EXCLUDED.add_prod_info,
      pump_id = EXCLUDED.pump_id
  `;
  for (const item of saleItems) {
    const productCode = item.productCode || item.product_code || '';
    if (productCode) {
      await query(insertQuery, [
        basketDataId,
        productCode,
        item.itemAmount || item.amount || '',
        item.quantity || '',
        item.addProdCode || '',
        item.reverseSale || '0',
        item.saleChannel || '',
        item.rebateLabel || '',
        item.addProdInfo || '',
        item.pumpId || null
      ]);
    }
  }
}

async function insertLoyaltyData(loyaltyData, requestId) {
  if (!loyaltyData) return null;
  const result = await query(
    `INSERT INTO loyalty 
    (loyalty_flag, card_entry_mode, loyalty_card, loyalty_pan, card_entry_mode_new, 
    loyalty_card_new, loyalty_pan_new, loyalty_amount, loyalty_original_amount, 
    loyalty_approval_code, loyalty_acquirer_id, loyalty_acquirer_batch, bonus_card, 
    request_info_id, loyalty_timestamp) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP) RETURNING *`,
    [
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
      requestId
    ]
  );
  return result.rows[0];
}

async function getProducts() {
  const result = await query(`
    SELECT 
      name as "productName", 
      product_code as "productCode", 
      unit_price as "unitPrice", 
      unit_measure as "unitMeasure", 
      tax_code as "taxCode" 
    FROM products ORDER BY product_code ASC
  `);
  return result.rows;
}

async function getLastLoyaltyAwardResponse(stan) {
  const result = await query(
    `SELECT id, stan 
     FROM response_info 
     WHERE request_type = 'LoyaltyAward' 
     AND stan = $1 
     ORDER BY id DESC LIMIT 1`,
    [stan]
  );
  return result.rows[0] || null;
}

async function getHighestBasketDataForRequest(requestId) {
  const result = await query(
    'SELECT * FROM basket_data WHERE request_info_id = $1 ORDER BY created_at ASC',
    [requestId]
  );
  if (result.rows.length === 0) return null;
  
  // Find highest total_amount
  let highest = result.rows[0];
  for (const row of result.rows) {
    if (parseFloat(row.total_amount) > parseFloat(highest.total_amount)) {
      highest = row;
    }
  }
  return highest;
}

async function getSaleItemsByBasketDataId(basketDataId) {
  const result = await query(
    `SELECT 
       s.*, 
       '' as item_id,
       p.name as product_name,
       p.product_code,
       p.unit_price::text as unit_price,
       p.unit_measure,
       p.tax_code
     FROM sale_items s
     JOIN products p ON s.product_code = p.product_code
     WHERE s.basket_data_id = $1`,
    [basketDataId]
  );
  return result.rows;
}

async function upsertResponseInfo(requestId, requestType, overallResult, stan) {
  await query(
    `INSERT INTO response_info (id, request_type, overall_result, stan, created_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE 
     SET request_type = $2, overall_result = $3, stan = $4, updated_at = CURRENT_TIMESTAMP`,
    [requestId, requestType, overallResult, stan]
  );
}

async function getLastSaleItems() {
  const result = await query(
    `SELECT 
       s.*, 
       '' as item_id,
       p.name as product_name,
       p.product_code,
       p.unit_price::text as unit_price,
       p.unit_measure,
       p.tax_code
     FROM sale_items s
     JOIN products p ON s.product_code = p.product_code
     WHERE s.created_at IS NOT NULL 
     ORDER BY s.created_at DESC LIMIT 35`
  );
  return result.rows;
}

module.exports = {
  query,
  insertRequestInfo,
  insertPosData,
  insertBasketData,
  insertSaleItems,
  insertLoyaltyData,
  getProducts,
  getLastLoyaltyAwardResponse,
  getHighestBasketDataForRequest,
  getSaleItemsByBasketDataId,
  upsertResponseInfo,
  getLastSaleItems
};
