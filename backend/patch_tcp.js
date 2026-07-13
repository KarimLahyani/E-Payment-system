const fs = require('fs');
let content = fs.readFileSync('tcpHandler.js', 'utf8');

// 1. Fix processCardServiceResponse
content = content.replace(
    /const processCardServiceResponse = async \(responseXML\) => \{\r?\n    try \{\r?\n      console\.log\('Starting processCardServiceResponse with responseXML:', responseXML\);\r?\n      const parser = new xml2js\.Parser\(\{ explicitArray: false, trim: true \}\);\r?\n      const result = await parser\.parseStringPromise\(responseXML\);\r?\n\r?\n      const cardServiceResponse = result\.CardServiceResponse;\r?\n      console\.log\('Full cardServiceResponse object:', JSON\.stringify\(cardServiceResponse, null, 2\)\);\r?\n\r?\n      const overallResult = cardServiceResponse\['\\\$'\]\.OverallResult \|\| 'Unknown';\r?\n      const requestType = cardServiceResponse\['\\\$'\]\.RequestType \|\| 'Unknown';\r?\n      const requestId = cardServiceResponse\['\\\$'\]\.RequestID \|\| '0';/,
    `const processCardServiceResponse = async (responseXML) => {
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
    requestId = cardServiceResponse['$']?.RequestID || '0';`
);

// 2. Fix catch block
content = content.replace(
    /\} catch \(error\) \{\r?\n    console\.error\(`Error processing CardServiceResponse: \$\{error\.message\}`\);\r?\n    await pool\.query\(\r?\n      `INSERT INTO response_info \(id, request_type, overall_result, created_at\)\r?\n       VALUES \(\$1, \$2, \$3, CURRENT_TIMESTAMP\)\r?\n       ON CONFLICT \(id\) DO UPDATE \r?\n       SET request_type = \$2, overall_result = \$3`,\r?\n      \[requestId, 'Unknown', 'Failed'\]\r?\n    \);\r?\n  \}/,
    `} catch (error) {
    console.error(\`Error processing CardServiceResponse: \${error.message}\`);
    await pool.query(
      \`INSERT INTO response_info (id, request_type, overall_result, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE 
       SET request_type = $2, overall_result = $3\`,
      [requestId, 'Unknown', 'Failed']
    );
  }`
);

// 3. Fix sendMessage memory leak
content = content.replace(
    /const sendMessage = async \(\) => \{\r?\n  if \(messageIndex >= messagesToSend\.length\) \{\r?\n    messagesToSend = \[\];\r?\n    messageIndex = 0;\r?\n    return;\r?\n  \}\r?\n\r?\n  client = new net\.Socket\(\);\r?\n\r?\n  const attemptConnection = async \(retries = 3, delay = 1000\) => \{/,
    `const sendMessage = async () => {
  if (messageIndex >= messagesToSend.length) {
    messagesToSend = [];
    messageIndex = 0;
    return;
  }

  if (client && !client.destroyed) {
    client.destroy();
  }
  client = new net.Socket();

  const attemptConnection = async (retries = 3, delay = 1000) => {`
);

// 4. Fix client end and error handlers
content = content.replace(
    /    client\.on\('end', \(\) => \{\r?\n      messageIndex\+\+;\r?\n      setTimeout\(sendMessage, 1000000\);\r?\n    \}\);\r?\n\r?\n    client\.on\('error', \(err\) => \{\r?\n      if \(retries > 0 && \(err\.code === 'ECONNREFUSED' \|\| err\.code === 'ECONNRESET'\)\) \{\r?\n        setTimeout\(\(\) => \{\r?\n          attemptConnection\(retries - 1, delay \* 2\);\r?\n        \}, delay\);\r?\n      \} else \{\r?\n        messageIndex\+\+;\r?\n        setTimeout\(sendMessage, 1000000\);\r?\n      \}\r?\n    \}\);\r?\n  \};\r?\n\r?\n  await attemptConnection\(\);\r?\n\};/,
    `    client.on('end', () => {
      messageIndex++;
      setTimeout(sendMessage, 1000);
    });

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
  };

  attemptConnection();
};`
);

// 5. Fix module.exports syntax error
content = content.replace(
    /  `\r?\n  let io\r?\n  \r?\n  let io;\r?\n  const setSocketIo = \(socketIo\) => \{/,
    `  let io;
  const setSocketIo = (socketIo) => {`
);

fs.writeFileSync('tcpHandler.js', content, 'utf8');
console.log('Patched successfully!');
