const fs = require('fs');

let content = fs.readFileSync('backend/tcpHandler.js', 'utf8');

const oldSendMessage = `const sendMessage = async () => {
  if (messageIndex >= messagesToSend.length) {
    messagesToSend = [];
    messageIndex = 0;
    return;
  }

  client = new net.Socket();

  const attemptConnection = async (retries = 3, delay = 1000) => {
    client.connect(configData.posProxyPort, configData.clientIp, async () => {
      let message = messagesToSend[messageIndex];
      if (message instanceof Promise) {
        message = await message;
      }

      const buffer = Buffer.isBuffer(message) ? message : Buffer.from(message, 'latin1');
      console.log(\`Sent message with header: length=\${buffer.length}, message=\${message.toString('latin1')}\`);
      client.write(buffer);
      setTimeout(() => {
        client.end();
      }, 1000000);
    });

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
      setTimeout(sendMessage, 1000000);
    });

    client.on('error', (err) => {
      if (retries > 0 && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET')) {
        setTimeout(() => {
          attemptConnection(retries - 1, delay * 2);
        }, delay);
      } else {
        messageIndex++;
        setTimeout(sendMessage, 1000000);
      }
    });
  };

  await attemptConnection();
};`;

const newSendMessage = `const sendMessage = async () => {
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
  if (typeof io !== 'undefined' && io) {
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

// Replace exact whitespace block using regex matching start to end
content = content.replace(
  /const sendMessage = async \(\) => \{[\s\S]*?await attemptConnection\(\);\s*\};/,
  newSendMessage
);

fs.writeFileSync('backend/tcpHandler.js', content, 'utf8');
console.log('sendMessage perfectly patched!');
