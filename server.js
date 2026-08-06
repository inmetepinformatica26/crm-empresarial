const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const getDatabase = require('./database');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const projectRoutes = require('./routes/projects');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

// Render usa un reverse proxy. Habilitar 'trust proxy' es necesario para que
// express-rate-limit identifique correctamente la IP real del cliente.
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes, intente de nuevo más tarde' }
});
app.use('/api/', limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint - sin token, para monitoreo
// Se registra ANTES del catch-all (*) para que no sea atrapado por el HTML.
let dbReady = false;
const { USE_POSTGRES } = require('./database');
app.get('/api/health', (req, res) => {
  res.json({
    status: dbReady ? 'ok' : 'starting',
    engine: USE_POSTGRES ? 'postgres' : 'sqlite',
    database_url_set: !!process.env.DATABASE_URL,
    render_environment: !!process.env.RENDER
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/settings', settingsRoutes);

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Initialize database then start server
async function start() {
  try {
    await getDatabase();
    dbReady = true;

    app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('===== CRM EMPRESARIAL v1.0 =====');
      console.log('Servidor iniciado correctamente');
      console.log('');
      console.log('Local:    http://localhost:' + PORT);
      console.log('Admin:    admin@crm.com / admin123');
      console.log('');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
