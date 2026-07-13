const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, 'backend', 'routes.js');
let content = fs.readFileSync(routesPath, 'utf8');

// Require the transaction controller at the top
content = content.replace(
  "const { addMessageToSend, updateConfigData: updateTcpConfigData",
  "const transactionController = require('./controllers/transactionController');\nconst { addMessageToSend, updateConfigData: updateTcpConfigData"
);

// Add /products route inside setupRoutes
content = content.replace(
  "const setupRoutes = (app) => {",
  "const setupRoutes = (app) => {\n  app.get('/products', transactionController.getProducts);"
);

// Replace the massive /request-info block
// We'll use regex to replace everything from app.post('/request-info' to its closing block.
// Since it's a huge block, we find the index and substring.

const postStartStr = "app.post('/request-info', async (req, res) => {";
const postStartIndex = content.indexOf(postStartStr);

// Find the end of this block by finding the next endpoint, which is app.post('/process-response/:requestId'
const nextEndpointStr = "app.post('/process-response/:requestId', async (req, res) => {";
const nextEndpointIndex = content.indexOf(nextEndpointStr);

if (postStartIndex !== -1 && nextEndpointIndex !== -1) {
  // We want to keep everything before postStartIndex, insert our controller call, and append everything from nextEndpointIndex
  
  // also remove the old handleLoyaltyAwardRefund function inside setupRoutes
  const refundFuncStart = "const handleLoyaltyAwardRefund = async (stan, currentRequestId) => {";
  const endpointLoyaltyStan = "app.get('/last-loyalty-award-stan', async (req, res) => {";
  
  const refundFuncIndex = content.indexOf(refundFuncStart);
  const endpointLoyaltyStanIndex = content.indexOf(endpointLoyaltyStan);
  
  let newContent = content.substring(0, refundFuncIndex);
  
  newContent += `
  app.get('/last-loyalty-award-stan', transactionController.getLastLoyaltyAwardStan);
  app.post('/request-info', transactionController.handleRequestInfo);
  
  `;
  
  newContent += content.substring(nextEndpointIndex);
  
  fs.writeFileSync(routesPath, newContent, 'utf8');
  console.log('Successfully refactored routes.js');
} else {
  console.error('Could not find endpoint strings for replacement');
}
