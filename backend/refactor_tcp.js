const fs = require('fs');
let data = fs.readFileSync('backend/tcpHandler.js', 'utf8');

// 1. Remove require('./parseXMLResponse')
data = data.replace("const { parseXMLResponse } = require('./parseXMLResponse');", "");

// 2. Extract handleDeviceRequest and setSocketIo
const startStr = "if (parsedMessage.DeviceRequest) {";
const startIndex = data.indexOf(startStr);
const matchResponse = data.match(/let response;[\r\n\s]*if \(message\.includes\('RequestType="Login"'\)\) \{/);
const endIndex = matchResponse.index;

if (startIndex === -1 || !matchResponse) {
    console.error("Could not find block", { startIndex, hasMatch: !!matchResponse });
    process.exit(1);
}

// Find catch block end
const catchStr = "} catch (error) {";
const catchIndex = data.indexOf(catchStr, startIndex);
if (catchIndex === -1) {
    console.error("Could not find catch block");
    process.exit(1);
}
// The end of the block we want to replace is exactly the line before `let response;`
const endOfReplace = endIndex;

const beforeBlock = data.substring(0, startIndex);
const afterBlock = data.substring(endOfReplace); 

const replacement = `const handled = await handleDeviceRequest(parsedMessage, (deviceResponse) => {
            if (configData.opiMode) {
              const lengthHeader = generateLengthHeader(deviceResponse);
              socket.write(Buffer.concat([lengthHeader, Buffer.from(deviceResponse, 'latin1')]));
            } else {
              socket.write(deviceResponse);
            }
          });
          if (handled) return;
        } catch (error) {
          console.error(\`Error processing XML message: \${error.message}\`);
        }
      }

      `;

const handleDeviceRequestFn = `
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

    socket.on('disconnect', () => {
      console.log('Frontend terminal simulator disconnected');
    });
  });
};

const handleDeviceRequest = async (parsedMessage, respondFn) => {
  const deviceRequest = parsedMessage.DeviceRequest || parsedMessage.EPSMessage?.DeviceRequest || parsedMessage.POSMessage?.DeviceRequest;
  if (deviceRequest) {
    const output = deviceRequest.Output || {};
    const input = deviceRequest.Input || {};
    const outDeviceTarget = output['$']?.OutDeviceTarget || output.OutDeviceTarget || deviceRequest.device || deviceRequest.Device;
    const requestId = deviceRequest['$']?.RequestID || deviceRequest.RequestID || '0';
    const applicationSender = deviceRequest['$']?.ApplicationSender || deviceRequest.ApplicationSender || 'AP4900';
    const popId = deviceRequest['$']?.POPID || deviceRequest.POPID || '01';
    const workstationId = deviceRequest['$']?.WorkstationID || deviceRequest.WorkstationID || 'POS01';
    const requestType = deviceRequest['$']?.RequestType || deviceRequest.RequestType || 'Output';

    // Gérer les messages pour CashierDisplay et Printer
    if (outDeviceTarget === 'CashierDisplay' || outDeviceTarget === 'Printer') {
      let textLines = output.TextLine || deviceRequest.text || deviceRequest.Text || [];
      if (!Array.isArray(textLines)) {
        textLines = [textLines];
      }
      const textContent = textLines
        .map(line => {
          if (typeof line === 'string') {
            return line;
          } else if (line && typeof line === 'object') {
            return line._ || '';
          }
          return '';
        })
        .filter(line => line.trim() !== '')
        .join('\\n');

      if (outDeviceTarget === 'CashierDisplay') {
        lastDisplayMessage = textContent || 'No message content';
        console.log(\`CashierDisplay message extracted: \${lastDisplayMessage}\`);
      } else if (outDeviceTarget === 'Printer') {
        lastPrinterMessage = textContent || 'No message content';
        console.log(\`Printer message extracted: \${lastPrinterMessage}\`);
      }

      const deviceResponse = \`
        <?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>
        <DeviceResponse ApplicationSender="\${applicationSender}" POPID="\${popId}" RequestID="\${requestId}" WorkstationID="\${workstationId}" RequestType="\${requestType}" OverallResult="Success" xmlns="http://www.nrf-arts.org/IXRetail/namespace" xmlns:IFSF="http://www.ifsf.org/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.nrf-arts.org/IXRetail/namespace ./IFSF/XSD/DeviceResponse.xsd">
          <Output OutDeviceTarget="\${outDeviceTarget || 'Unknown'}" OutResult="Success"/>
        </DeviceResponse>
      \`.trim();

      respondFn(deviceResponse);
      return true;
    }
    else if (outDeviceTarget === 'CashierTerminal' && input['$']?.InDeviceTarget === 'CashierTerminal') {
      let textLines = output.TextLine || [];
      if (!Array.isArray(textLines)) {
        textLines = [textLines];
      }
      const textContent = textLines
        .map(line => {
          if (typeof line === 'string') {
            return line;
          } else if (line && typeof line === 'object') {
            return line._ || '';
          }
          return '';
        })
        .filter(line => line.trim() !== '')
        .join('\\n');

      lastCashierTerminalMessage = textContent || 'No message content';
      console.log(\`CashierTerminal message extracted: \${lastCashierTerminalMessage}\`);

      let confirmation = 'NO';
      if (cashierTerminalCallback) {
        console.log('Utilisation du callback CashierTerminal (dialogue UI)...');
        confirmation = await cashierTerminalCallback(lastCashierTerminalMessage);
      } else {
        console.log('Aucun callback défini, fallback à YES.');
        confirmation = 'YES';
      }

      console.log(\`Réponse reçue: \${confirmation}\`);
      const deviceResponse = \`
        <?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>
        <DeviceResponse ApplicationSender="\${applicationSender}" POPID="\${popId}" RequestID="\${requestId}" WorkstationID="\${workstationId}" RequestType="\${requestType}" OverallResult="Success" xmlns="http://www.nrf-arts.org/IXRetail/namespace" xmlns:IFSF="http://www.ifsf.org/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.nrf-arts.org/IXRetail/namespace ./IFSF/XSD/DeviceResponse.xsd">
          <Output OutDeviceTarget="CashierTerminal" OutResult="Success"/>
          <Input InDeviceTarget="CashierTerminal" InResult="Success">
            <InputValue>
              <InBoolean>\${confirmation === 'YES' ? '1' : '0'}</InBoolean>
            </InputValue>
          </Input>
        </DeviceResponse>
      \`.trim();

      console.log(\`Sent CashierTerminal response: \${deviceResponse}\`);
      respondFn(deviceResponse);
      return true;
    }
  }
  return false;
};

const clearDeviceMessages = () => {
  lastDisplayMessage = '';
  lastPrinterMessage = '';
  lastCashierTerminalMessage = '';
};
`;

let newData = beforeBlock + replacement + afterBlock;
// Use string manipulation to avoid $' bugs in replace()
const exportIndex = newData.lastIndexOf('module.exports = {');
newData = newData.substring(0, exportIndex) + handleDeviceRequestFn + '\nmodule.exports = {\n  clearDeviceMessages,\n  setSocketIo,\n' + newData.substring(exportIndex + 19);

fs.writeFileSync('backend/tcpHandler.js', newData);
console.log('Refactored successfully');
