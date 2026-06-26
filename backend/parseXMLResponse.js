const xml2js = require('xml2js');

// Fonction pour parser le XML et retourner un objet JSON structuré
const parseXMLResponse = (xmlString) => {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });

    parser.parseString(xmlString, (err, result) => {
      if (err) {
        reject(new Error(`Erreur lors du parsing du XML: ${err.message}`));
        return;
      }

      let responseJson = {};

      // Handle CardServiceResponse
      if (result.CardServiceResponse) {
        const cardServiceResponse = result.CardServiceResponse;

        responseJson = {
          type: 'CardServiceResponse',
          cardServiceResponse: {
            attributes: {
              requestType: cardServiceResponse['$']?.RequestType || null,
              applicationSender: cardServiceResponse['$']?.ApplicationSender || null,
              workstationId: cardServiceResponse['$']?.WorkstationID || null,
              popId: cardServiceResponse['$']?.POPID || null,
              requestId: cardServiceResponse['$']?.RequestID || null,
              overallResult: cardServiceResponse['$']?.OverallResult || null,
            },
            terminal: {
              terminalId: cardServiceResponse.Terminal?.['$']?.TerminalID || null,
              terminalBatch: cardServiceResponse.Terminal?.['$']?.TerminalBatch || null,
              stan: cardServiceResponse.Terminal?.['$']?.STAN || null,
            },
            tender: {
              totalAmount: {
                currency: cardServiceResponse.Tender?.TotalAmount?.['$']?.Currency || null,
                value: cardServiceResponse.Tender?.TotalAmount?.['_'] || null,
              },
            },
            loyalty: {
              cardCircuit: cardServiceResponse.Loyalty?.['$']?.CardCircuit || null,
              cardEntryMode: cardServiceResponse.Loyalty?.['$']?.CardEntryMode || null,
              loyaltyTimeStamp: cardServiceResponse.Loyalty?.['$']?.LoyaltyTimeStamp || null,
              loyaltyCard: cardServiceResponse.Loyalty?.LoyaltyCard || null,
              loyaltyAmount: {
                originalLoyaltyAmount: cardServiceResponse.Loyalty?.LoyaltyAmount?.['$']?.OriginalLoyaltyAmount || null,
                value: cardServiceResponse.Loyalty?.LoyaltyAmount?.['_'] || null,
                currency: cardServiceResponse.Loyalty?.LoyaltyAmount?.['$']?.Currency || null,
              },
              loyaltyApprovalCode: cardServiceResponse.Loyalty?.LoyaltyApprovalCode || null,
              loyaltyAcquirerId: cardServiceResponse.Loyalty?.['$']?.LoyaltyAcquirerID || null,
              loyaltyApprovalCodeText: cardServiceResponse.Loyalty?.['$']?.LoyaltyApprovalCodeText || null,
            },
            saleItem: Array.isArray(cardServiceResponse.SaleItem)
              ? cardServiceResponse.SaleItem.map(item => ({
                  itemId: item['$']?.ItemID || null,
                  reverseSale: item['$']?.ReverseSale || null,
                  productCode: item.ProductCode || null,
                  amount: item.Amount || null,
                  unitMeasure: item.UnitMeasure || null,
                  unitPrice: item.UnitPrice || null,
                  quantity: item.Quantity || null,
                  taxCode: item.TaxCode || null,
                  additionalProductCode: item.AdditionalProductCode || null,
                  additionalProductInfo: item.AdditionalProductInfo || null,
                  saleChannel: item.SaleChannel || null,
                  rebateLabel: item.RebateLabel || null,
                }))
              : cardServiceResponse.SaleItem
              ? [
                  {
                    itemId: cardServiceResponse.SaleItem['$']?.ItemID || null,
                    reverseSale: cardServiceResponse.SaleItem['$']?.ReverseSale || null,
                    productCode: cardServiceResponse.SaleItem.ProductCode || null,
                    amount: cardServiceResponse.SaleItem.Amount || null,
                    unitMeasure: cardServiceResponse.SaleItem.UnitMeasure || null,
                    unitPrice: cardServiceResponse.SaleItem.UnitPrice || null,
                    quantity: cardServiceResponse.SaleItem.Quantity || null,
                    taxCode: cardServiceResponse.SaleItem.TaxCode || null,
                    additionalProductCode: cardServiceResponse.SaleItem.AdditionalProductCode || null,
                    additionalProductInfo: cardServiceResponse.SaleItem.AdditionalProductInfo || null,
                    saleChannel: cardServiceResponse.SaleItem.SaleChannel || null,
                    rebateLabel: cardServiceResponse.SaleItem.RebateLabel || null,
                  },
                ]
              : [],
          },
        };
      }
      // Handle ServiceResponse
      else if (result.ServiceResponse) {
        const serviceResponse = result.ServiceResponse;

        responseJson = {
          type: 'ServiceResponse',
          serviceResponse: {
            attributes: {
              requestType: serviceResponse['$']?.RequestType || null,
              applicationSender: serviceResponse['$']?.ApplicationSender || null,
              workstationId: serviceResponse['$']?.WorkstationID || null,
              popId: serviceResponse['$']?.POPID || null,
              requestId: serviceResponse['$']?.RequestID || null,
              overallResult: serviceResponse['$']?.OverallResult || null,
            },
          },
        };
      } else {
        reject(new Error('Unknown response type'));
        return;
      }

      resolve(responseJson);
    });
  });
};

module.exports = { parseXMLResponse };