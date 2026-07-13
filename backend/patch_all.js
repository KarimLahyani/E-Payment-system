const fs = require('fs');
let content = fs.readFileSync('backend/tcpHandler.js', 'utf8');

// 1. Fix processCardServiceResponse
content = content.replace(
  /const processCardServiceResponse = async \(responseXML\) => \{\r?\n  try \{\r?\n    console\.log\('Starting processCardServiceResponse with responseXML:', responseXML\);\r?\n    const parser = new xml2js\.Parser\(\{ explicitArray: false, trim: true \}\);\r?\n    const result = await parser\.parseStringPromise\(responseXML\);\r?\n\r?\n    const cardServiceResponse = result\.CardServiceResponse;\r?\n    console\.log\('Full cardServiceResponse object:', JSON\.stringify\(cardServiceResponse, null, 2\)\);\r?\n\r?\n    const overallResult = cardServiceResponse\['\\\$'\]\.OverallResult \|\| 'Unknown';\r?\n    const requestType = cardServiceResponse\['\\\$'\]\.RequestType \|\| 'Unknown';\r?\n    const requestId = cardServiceResponse\['\\\$'\]\.RequestID \|\| '0';/,
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

// 2. Fix processCardServiceResponse catch block
content = content.replace(
  /  \} catch \(error\) \{\r?\n    console\.error\(`Error processing CardServiceResponse: \$\{error\.message\}`\);\r?\n    await pool\.query\(\r?\n      `INSERT INTO response_info \(id, request_type, overall_result, created_at\)\r?\n       VALUES \(\$1, \$2, \$3, CURRENT_TIMESTAMP\)\r?\n       ON CONFLICT \(id\) DO UPDATE \r?\n       SET request_type = \$2, overall_result = \$3`,\r?\n      \[requestId, 'Unknown', 'Failed'\]\r?\n    \);\r?\n  \}/,
  `  } catch (error) {
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

// 3. Fix sendMessage memory leak and WebSocket bridging
content = content.replace(
  /const sendMessage = async \(\) => \{[\s\S]*?    await attemptConnection\(\);\r?\n  \};/,
  `const sendMessage = async () => {
    if (messageIndex >= messagesToSend.length) {
      messagesToSend = [];
      messageIndex = 0;
      return;
    }
  
    let message = messagesToSend[messageIndex];
    if (message instanceof Promise) {
      message = await message;
    }
    const messageStr = typeof message === 'string' ? message : message.toString('latin1');
    
    // Send via WebSocket to Web-Based IFSF Simulator
    if (io) {
      console.log('Sending message to Web-Based Simulator via WebSocket');
      io.emit('terminal:request', messageStr);
    }
  
    // Also send via TCP if needed
    if (client && !client.destroyed) {
      client.destroy();
    }
    client = new net.Socket();
    
    // Register listeners ONCE outside of attemptConnection
    client.on('data', async (data) => {
      let response;
      if (configData.opiMode) {
        response = data.slice(4).toString('latin1');
        lastResponseXML = response;
      } else {
        response = data.toString('latin1');
        lastResponseXML = response;
      }
      console.log(\`Received \${messageIndex + 1} Response on channel2\`);
      console.log(response);
  
      if (response.includes('CardServiceResponse')) {
        await processCardServiceResponse(response);
      }
    });
  
    client.on('end', () => {
      messageIndex++;
      setTimeout(sendMessage, 1000);
    });
  
    const attemptConnection = async (retries = 3, delay = 1000) => {
      client.removeAllListeners('error');
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
  
      client.connect(configData.posProxyPort, configData.clientIp, async () => {
        const buffer = Buffer.isBuffer(message) ? message : Buffer.from(message, 'latin1');
        console.log(\`Sent message with header: length=\${buffer.length}, message=\${messageStr}\`);
        client.write(buffer);
        setTimeout(() => {
          if (!client.destroyed) {
            client.end();
          }
        }, 1000000);
      });
    };
  
    attemptConnection();
  };`
);

// 4. Add terminal:response listener
content = content.replace(
  /            await handleDeviceRequest\(parsedMessage, \(resp\) => \{\r?\n              socket\.emit\('terminal:response', resp\);\r?\n            \}\);\r?\n          \} catch \(error\) \{\r?\n            console\.error\(`Error processing WS XML message: \$\{error\.message\}`\);\r?\n          \}\r?\n        \}\r?\n      \}\);\r?\n\r?\n      socket\.on\('disconnect', \(\) => \{/,
  `            await handleDeviceRequest(parsedMessage, (resp) => {
              socket.emit('terminal:response', resp);
            });
          } catch (error) {
            console.error(\`Error processing WS XML message: \${error.message}\`);
          }
        }
      });

      socket.on('terminal:response', async (responseXML) => {
        console.log('Received terminal:response from POS web UI');
        lastResponseXML = responseXML;
        if (responseXML.includes('CardServiceResponse')) {
          await processCardServiceResponse(responseXML);
        }
      });

      socket.on('disconnect', () => {`
);

fs.writeFileSync('backend/tcpHandler.js', content, 'utf8');
console.log('All patches applied successfully!');
