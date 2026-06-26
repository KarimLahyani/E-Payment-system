const express = require('express');
const cors = require('cors');
const { connectDB, disconnectDB } = require('./database');
const { startTcpServer, server } = require('./tcpHandler');
const setupRoutes = require('./routes');

const app = express();
const port = 3000;

// Variable globale pour stocker la dernière réponse XML
let lastResponseXML = '';

// Middleware Express
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

// Connexion à la base de données
connectDB().catch(err => {
  console.error('Failed to connect to database, exiting...', err);
  process.exit(1);
});

// Configuration des routes
setupRoutes(app);

// Endpoint pour récupérer la dernière réponse XML
app.get('/last-response-xml', (req, res) => {
  if (!lastResponseXML) {
    return res.status(404).json({ message: 'No response XML available' });
  }
  res.status(200).json({ responseXML: lastResponseXML });
});

// Démarrer le serveur Express et le serveur TCP
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  startTcpServer();
});

// Gestion de l'arrêt du serveur
process.on('SIGINT', () => {
  server.close(() => {
    console.log('Serveur TCP arrêté');
    disconnectDB().then(() => process.exit(0)).catch(err => {
      console.error('Error during shutdown:', err);
      process.exit(1);
    });
  });
});