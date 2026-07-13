const transactionService = require('../services/transactionService');
const dbRepository = require('../repositories/dbRepository');

async function handleRequestInfo(req, res) {
  const { requestData, posData, loyaltyData, amountData } = req.body;

  if (!requestData || !requestData.requestType) {
    return res.status(400).json({ message: 'Missing requestData or requestType in body' });
  }

  console.log(`[HTTP POST] /request-info received RequestType: ${requestData.requestType}`);

  // Payload Optimization: Only process relevant data based on RequestType
  let cleanAmountData = null;
  let cleanLoyaltyData = null;

  // AmountData is needed for these types
  const amountDataRequiredTypes = [
    'CardPayment', 'CardPreAuthorisation', 'PreAuth+Fin.Advice', 
    'CardPaymentLoyaltyRedemption', 'LoyaltyAward'
  ];

  if (amountDataRequiredTypes.includes(requestData.requestType) && amountData) {
    // Only extract selected items to avoid payload bloat
    let selectedSaleItems = [];
    if (amountData.saleItems && Array.isArray(amountData.saleItems)) {
      selectedSaleItems = amountData.saleItems.filter(item => item.isSelected === true || item.isSelected === 'true');
    }
    cleanAmountData = { ...amountData, saleItems: selectedSaleItems };
  }

  // LoyaltyData is needed for these types
  const loyaltyDataRequiredTypes = [
    'LoyaltyAward', 'LoyaltyAwardRefund', 'LoyaltyRedemption',
    'LoyaltyRedemptionRefund', 'LoyaltyBalanceQuery', 'LoyaltyLinkCard',
    'CardPaymentLoyaltyRedemption'
  ];

  if (loyaltyDataRequiredTypes.includes(requestData.requestType) && loyaltyData) {
    cleanLoyaltyData = loyaltyData;
  }

  const fullRequestData = {
    requestData,
    posData,
    amountData: cleanAmountData,
    loyaltyData: cleanLoyaltyData
  };

  try {
    const result = await transactionService.processTransaction(fullRequestData);
    return res.status(200).json({
      message: 'Data successfully recorded and XML dispatched',
      requestId: result.requestId,
      serviceRequest: result.serviceRequest
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Internal server error processing transaction' });
  }
}

async function getProducts(req, res) {
  try {
    const products = await dbRepository.getProducts();
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Internal server error fetching products' });
  }
}

async function getLastLoyaltyAwardStan(req, res) {
  try {
    const result = await dbRepository.query(
      `SELECT stan FROM response_info 
       WHERE request_type = 'LoyaltyAward' AND stan IS NOT NULL 
       ORDER BY id DESC LIMIT 1`
    );
    if (result.rows.length > 0) {
      res.status(200).json({ stan: result.rows[0].stan });
    } else {
      res.status(404).json({ message: 'No LoyaltyAward response found with a valid stan' });
    }
  } catch (error) {
    console.error('Error getting last STAN for LoyaltyAward:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}

module.exports = {
  handleRequestInfo,
  getProducts,
  getLastLoyaltyAwardStan
};
