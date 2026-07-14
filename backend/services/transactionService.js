const dbRepository = require('../repositories/dbRepository');
const loyaltyService = require('./loyaltyService');
const { generateServiceRequest } = require('../xmlGenerator');
const { addMessageToSend } = require('../tcpHandler');

async function processTransaction(fullRequestData) {
  const { requestData, posData, basketData, loyaltyData } = fullRequestData;

  // 1. Create a brand new Request Info in the ledger
  const nextRequestId = await dbRepository.insertRequestInfo(requestData);
  console.log('Inserted new request_info with id:', nextRequestId);

  // 2. Handle LoyaltyAwardRefund logic if applicable
  if (requestData.requestType === 'LoyaltyAwardRefund' && requestData.stan) {
    const refundResult = await loyaltyService.handleLoyaltyAwardRefund(requestData.stan, nextRequestId);
    
    if (!refundResult.success) {
      await dbRepository.upsertResponseInfo(nextRequestId, requestData.requestType, 'Failed', requestData.stan);
      console.log(`Inserted/Updated response_info for failed LoyaltyAwardRefund request with id ${nextRequestId}`);
      throw new Error(refundResult.message);
    }
  } else {
    // 3. For all other transaction types, selectively save sub-data
    if (posData) {
      await dbRepository.insertPosData(posData, nextRequestId);
    }

    if (basketData) {
      const basketDataId = await dbRepository.insertBasketData(basketData, nextRequestId);
      if (basketData.saleItems && basketData.saleItems.length > 0) {
        await dbRepository.insertSaleItems(basketData.saleItems, basketDataId);
      }
    }

    if (loyaltyData) {
      await dbRepository.insertLoyaltyData(loyaltyData, nextRequestId);
    }
  }

  // Update requestData with the internal ledger ID for XML tracing
  requestData.requestId = nextRequestId.toString();

  // 4. Generate the XML payload
  const serviceRequest = await generateServiceRequest(requestData, posData, basketData, loyaltyData);
  console.log('Generated Service Request XML:', Buffer.isBuffer(serviceRequest) ? serviceRequest.toString('latin1') : serviceRequest);

  // 5. Dispatch via TCP
  await addMessageToSend(serviceRequest);

  return {
    success: true,
    requestId: nextRequestId,
    serviceRequest: Buffer.isBuffer(serviceRequest) ? serviceRequest.toString('latin1') : serviceRequest
  };
}

module.exports = {
  processTransaction
};
