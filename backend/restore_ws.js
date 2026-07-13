const fs = require('fs');

let content = fs.readFileSync('backend/tcpHandler.js', 'utf8');

const setSocketIoLogic = `
let io;
const setSocketIo = (socketIo) => {
  io = socketIo;
  io.on('connection', (socket) => {
    console.log('Frontend terminal simulator connected');

    socket.on('terminal:request', async (xmlMessage) => {
      console.log('Received from frontend terminal simulator:');
      console.log(xmlMessage);

      if (xmlMessage.trim().startsWith('<?xml') || xmlMessage.trim().startsWith('<')) {
        try {
          const parser = new xml2js.Parser({ explicitArray: false, trim: true });
          const parsedMessage = await parser.parseStringPromise(xmlMessage);
          
          await handleDeviceRequest(parsedMessage, (resp) => {
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

    socket.on('disconnect', () => {
      console.log('Frontend terminal simulator disconnected');
    });
  });
};

const handleDeviceRequest = async (parsedMessage, callback) => {
  const deviceRequest = parsedMessage.EPSMessage?.DeviceRequest || parsedMessage.POSMessage?.DeviceRequest;
  if (!deviceRequest) return;
  
  const device = deviceRequest.device;
  const command = deviceRequest.command;
  const text = deviceRequest.text;
  
  if (device === 'CashierDisplay') {
    lastDisplayMessage = text;
    console.log(\`CashierDisplay message extracted: \${text}\`);
  } else if (device === 'Printer') {
    lastPrinterMessage = text;
    console.log(\`Printer message extracted:\`);
    console.log(text);
  } else if (device === 'CashierTerminal') {
    lastCashierTerminalMessage = text;
    console.log(\`CashierTerminal message extracted: \${text}\`);
  }
};
`;

// Append to file, just before module.exports
content = content.replace(
  /module\.exports = \{/,
  `${setSocketIoLogic}\nmodule.exports = {`
);

// Add setSocketIo to exports
content = content.replace(
  /module\.exports = \{/,
  `module.exports = {\n  setSocketIo,`
);

fs.writeFileSync('backend/tcpHandler.js', content, 'utf8');
console.log('Restored setSocketIo and handleDeviceRequest!');
