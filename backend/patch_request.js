const fs = require('fs');

let content = fs.readFileSync('backend/tcpHandler.js', 'utf8');

const oldProcess = `const processCardServiceResponse = async (responseXML) => {
  try {
    console.log('Starting processCardServiceResponse with responseXML:', responseXML);
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });
    const result = await parser.parseStringPromise(responseXML);

    const cardServiceResponse = result.CardServiceResponse;
    console.log('Full cardServiceResponse object:', JSON.stringify(cardServiceResponse, null, 2));

    const overallResult = cardServiceResponse['$'].OverallResult || 'Unknown';
    const requestType = cardServiceResponse['$'].RequestType || 'Unknown';
    const requestId = cardServiceResponse['$'].RequestID || '0';`;

const newProcess = `const processCardServiceResponse = async (responseXML) => {
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
    requestId = cardServiceResponse['$']?.RequestID || '0';`;

// Regex replace this precise block, ignoring exact whitespace/newlines using [\s\S]*?
content = content.replace(
  /const processCardServiceResponse = async \(responseXML\) => \{[\s\S]*?const requestId = cardServiceResponse\['\$'\]\.RequestID \|\| '0';/,
  newProcess
);

fs.writeFileSync('backend/tcpHandler.js', content, 'utf8');
console.log('processCardServiceResponse patched for requestId!');
