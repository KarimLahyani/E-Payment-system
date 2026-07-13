const fs = require('fs');
let content = fs.readFileSync('tcpHandler.js', 'utf8');

const replacement = `            await handleDeviceRequest(parsedMessage, (resp) => {
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

      socket.on('disconnect', () => {`;

content = content.replace(
    /            await handleDeviceRequest\(parsedMessage, \(resp\) => \{\r?\n              socket\.emit\('terminal:response', resp\);\r?\n            \}\);\r?\n          \} catch \(error\) \{\r?\n            console\.error\(`Error processing WS XML message: \$\{error\.message\}`\);\r?\n          \}\r?\n        \}\r?\n      \}\);\r?\n\r?\n      socket\.on\('disconnect', \(\) => \{/,
    replacement
);

fs.writeFileSync('tcpHandler.js', content, 'utf8');
console.log('Added terminal:response listener successfully!');
