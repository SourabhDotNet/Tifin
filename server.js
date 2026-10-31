import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes.js';
import { initDb } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite database tables
initDb()
  .then(() => console.log('Database tables verified/initialized.'))
  .catch((err) => console.error('Database initialization failed:', err));

// Bind APIs
app.use('/api', apiRouter);

// Serve Frontend Static Assets (if compiled)
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDistPath));

// Simple mobile-friendly API test console (works even if the frontend isn't built)
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// Fallback to React app for Client-side Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      // If frontend hasn't been built yet, show a welcome JSON
      res.status(200).json({
        message: 'Tiffin & Refreshment Billing System API is running. Build frontend to view the UI, or open /test for the API test console.',
        status: 'online'
      });
    }
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
