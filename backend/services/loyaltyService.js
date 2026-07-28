const dbRepository = require('../repositories/dbRepository');

async function handleLoyaltyAwardRefund(stan, currentRequestId) {
  try {
    console.log(`Handling LoyaltyAwardRefund for STAN=${stan}, RequestID=${currentRequestId}`);

    // Step 1: Find the most recent LoyaltyAward request
    const loyaltyAwardResponse = await dbRepository.getLastLoyaltyAwardResponse(stan);

    if (!loyaltyAwardResponse) {
      console.error(`No LoyaltyAward response found with stan: ${stan}`);
      return { success: false, message: 'No matching LoyaltyAward response found with the provided STAN.' };
    }

    const loyaltyAwardRequestId = loyaltyAwardResponse.id;
    console.log(`Found LoyaltyAward response with id: ${loyaltyAwardRequestId}, stan: ${stan}`);

    // Step 2: Find all basket_data entries for the LoyaltyAward request
    const highestAmountData = await dbRepository.getHighestAmountDataForRequest(loyaltyAwardRequestId);

    if (!highestAmountData) {
      console.error(`No basket_data found for LoyaltyAward request id: ${loyaltyAwardRequestId}`);
      return { success: false, message: 'No amount data found for the LoyaltyAward request.' };
    }

    const originalbasketDataId = highestAmountData.id;
    const originalTotalAmount = highestAmountData.total_amount;
    const preAuthAmount = highestAmountData.pre_auth_amount || '';
    const currency = highestAmountData.currency || 'TND';
    const itemDetails = highestAmountData.item_details || {};
    console.log(`Highest total_amount found: ${originalTotalAmount} with basket_data.id: ${originalbasketDataId}`);

    // Step 3: Insert a new row in basket_data with the original total_amount
    const newbasketDataId = await dbRepository.insertAmountData({
      totalAmount: originalTotalAmount,
      preAuthAmount,
      currency,
      itemDetails
    }, currentRequestId);
    
    console.log(`Successfully inserted new row in basket_data with id ${newbasketDataId} and total_amount ${originalTotalAmount} for request_info_id ${currentRequestId}`);

    // Step 4: Copy the original sale items to the new basket_data
    const originalSaleItems = await dbRepository.getSaleItemsBybasketDataId(originalbasketDataId);

    // Map original items to new format for insertion
    const itemsToInsert = originalSaleItems.map(item => ({
      itemId: item.item_id || '',
      productName: item.product_name || '',
      productCode: item.product_code || '',
      amount: item.amount, // original amount
      quantity: item.quantity || '',
      taxCode: item.tax_code || '',
      addProdCode: item.add_prod_code || '',
      reverseSale: item.reverse_sale || '0',
      unitPrice: item.unit_price || '',
      unitMeasure: item.unit_measure || '',
      saleChannel: item.sale_channel || '',
      rebateLabel: '', // reset to empty
      addProdInfo: item.add_prod_info || '',
      isSelected: item.is_selected || false
    }));

    await dbRepository.insertSaleItems(itemsToInsert, newbasketDataId);
    console.log(`Restored ${itemsToInsert.length} original sale_items for basket_data_id ${newbasketDataId}`);

    return { success: true, message: 'LoyaltyAwardRefund successfully handled.' };
  } catch (error) {
    console.error('Error handling LoyaltyAwardRefund:', error);
    return { success: false, message: 'Internal error while processing refund.' };
  }
}

module.exports = {
  handleLoyaltyAwardRefund
};
