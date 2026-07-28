const fs = require('fs');
const path = require('path');
const util = require('util');

// Create a log stream to write all logs to a file instead of the console
const logStream = fs.createWriteStream(path.join(__dirname, 'app.log'), { flags: 'a' });
const originalLog = console.log;

console.log = function(...args) {
  logStream.write(`[${new Date().toISOString()}] [INFO] ${util.format(...args)}\n`);
};

console.error = function(...args) {
  logStream.write(`[${new Date().toISOString()}] [ERROR] ${util.format(...args)}\n`);
};

console.info = console.log;
console.warn = console.error;

originalLog(`Backend starting. Logging is redirected to: ${path.join(__dirname, 'app.log')}`);

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const { connectDB, disconnectDB } = require('./database');
const { startTcpServer, server, setSocketIo } = require('./tcpHandler');
const setupRoutes = require('./routes');

const app = express();
const port = 3000;

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Provide io to tcpHandler
setSocketIo(io);


// Middleware Express
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

// Serve the standalone terminal simulator
app.use('/simulator', express.static(path.join(__dirname, '../terminal-simulator')));

// Démarrer le serveur Express et le serveur TCP
async function startServer() {
  try {
    // Connexion à la base de données
    await connectDB();
    
    // Configuration des routes
    setupRoutes(app);



    httpServer.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      startTcpServer();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

// Gestion de l'arrêt du serveur
process.on('SIGINT', () => {
  console.log('Stopping servers...');
  
  // Force exit after 1 second if graceful shutdown hangs due to open TCP connections
  setTimeout(() => {
    process.exit(0);
  }, 1000);

  server.close(() => {
    disconnectDB().then(() => process.exit(0)).catch(err => {
      process.exit(1);
    });
  });
});