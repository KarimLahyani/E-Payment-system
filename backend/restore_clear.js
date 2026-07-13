const fs = require('fs');

let content = fs.readFileSync('backend/tcpHandler.js', 'utf8');

const clearDeviceMessagesLogic = `
const clearDeviceMessages = () => {
  lastDisplayMessage = '';
  lastPrinterMessage = '';
  lastCashierTerminalMessage = '';
  lastResponseXML = '';
};
`;

// Append just before module.exports
content = content.replace(
  /module\.exports = \{/,
  `${clearDeviceMessagesLogic}\nmodule.exports = {`
);

// Add to exports
content = content.replace(
  /module\.exports = \{/,
  `module.exports = {\n  clearDeviceMessages,`
);

fs.writeFileSync('backend/tcpHandler.js', content, 'utf8');
console.log('Restored clearDeviceMessages!');
