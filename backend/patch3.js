const fs = require('fs');
let content = fs.readFileSync('backend/tcpHandler.js', 'utf8');

// The replacement for sendMessage to fix the listener leak and send over WebSocket too!
const replacement = `const sendMessage = async () => {
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
};`;

// Replace from "const sendMessage = async () => {" to the end of attemptConnection(); };
content = content.replace(
    /const sendMessage = async \(\) => \{[\s\S]*?  attemptConnection\(\);\r?\n\};/,
    replacement
);

fs.writeFileSync('backend/tcpHandler.js', content, 'utf8');
console.log('sendMessage patched successfully!');
