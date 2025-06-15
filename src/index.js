const app = require('./app');
require('dotenv').config();

// Usar un puerto diferente o tomarlo de variables de entorno
const port = process.env.PORT || 3001;

// Configurar rutas antes de iniciar el servidor
// Importar rutas
const authRoutes = require('./routes/auth');
const propertiesRoutes = require('./routes/properties');
const documentsRoutes = require('./routes/documents');
const historyRoutes = require('./routes/history');

// Configurar rutas
app.use('/api/auth', authRoutes);
app.use('/api/predios', propertiesRoutes);
app.use('/api/documentos', documentsRoutes);
app.use('/api/historial', historyRoutes);

// Iniciar el servidor con manejo de errores
app.listen(port, () => {
  console.log(`Servidor ejecutándose en el puerto ${port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: El puerto ${port} está ocupado. Cierra la instancia que lo está usando o cambia el puerto en .env`);
    process.exit(1);
  }
});