const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

// Cargar variables de entorno desde el archivo .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// --- CONFIGURACIÓN DE CORS PARA MÚLTIPLES ORÍGENES ---
// Lista de los orígenes que tienen permiso para acceder a esta API
const allowedOrigins = [
  'http://localhost:5173',      // Origen para desarrollo local con Vite
  'http://192.168.10.69',       // Origen para cuando la app de React esté desplegada en esta IP
  // Si tienes un dominio, añádelo aquí: 'http://tu-dominio.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    // La lógica de la función es:
    // 1. Si la petición NO tiene un 'origin' (como Postman o cURL), permitirla.
    // 2. Si el 'origin' de la petición ESTÁ en nuestra lista de 'allowedOrigins', permitirla.
    // 3. Si no, denegarla.
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('La política de CORS para este sitio no permite el acceso desde el origen especificado.'));
    }
  },
  optionsSuccessStatus: 200 // Para compatibilidad con navegadores antiguos
};

// Aplicar el middleware de CORS con la nueva configuración
app.use(cors(corsOptions));

// Aplicar otros middlewares DESPUÉS de CORS
app.use(express.json()); // Middleware para parsear JSON

// --- Importar y Usar Rutas ---
const userRoutes = require("./routes/users");
const clientRoutes = require("./routes/clients");
const authRoutes = require("./routes/authRoutes");
const rolRoutes = require("./routes/rolRoutes");
const permisoRoutes = require("./routes/permisoRoutes");
const abastecimientoRoutes = require("./routes/abastecimientoRoutes");

app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/auth", authRoutes); 
app.use("/api/roles", rolRoutes);
app.use("/api/permisos", permisoRoutes);
app.use("/api/abastecimiento", abastecimientoRoutes);

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("¡API Node.js con SQL Server funcionando perfectamente!");
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});