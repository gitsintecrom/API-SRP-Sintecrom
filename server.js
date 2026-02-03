// /server.js (Versión Final y Corregida)

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// --- Configuración de CORS ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.10.69',
];
// const corsOptions = {
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error('La política de CORS no permite el acceso desde este origen.'));
//     }
//   },
//   optionsSuccessStatus: 200
// };
// En server.js, en la configuración de CORS
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('❌ Origen bloqueado por CORS:', origin);
            callback(new Error('La política de CORS no permite el acceso desde este origen.'));
        }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// En server.js, justo después de app.use(express.json());

app.use((req, res, next) => {
    console.log(`🔵 [${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log(`🔵 Body:`, req.body);
    console.log(`🔵 Params:`, req.params);
    console.log(`🔵 Query:`, req.query);
    console.log('---');
    next();
});

// ===== INICIO DE LA CORRECCIÓN CLAVE =====
// --- Importar Middleware y Rutas ---
const verifyToken = require("./verifyToken"); // <-- 1. Importamos el middleware
const userRoutes = require("./routes/users");
const clientRoutes = require("./routes/clients");
const authRoutes = require("./routes/authRoutes");
const rolRoutes = require("./routes/rolRoutes");
const permisoRoutes = require("./routes/permisoRoutes");
const abastecimientoRoutes = require("./routes/abastecimientoRoutes");
const secuenciamientoRutes = require('./routes/secuenciamientoRoutes');
const rechazosRoutes = require('./routes/rechazosRoutes');
const paradasRoutes = require('./routes/paradasRoutes');
const registracionRoutes = require("./routes/registracionRoutes"); 

// --- Definir Rutas PÚBLICAS (NO necesitan token) ---
app.use("/api/auth", authRoutes);

// --- Definir Rutas PROTEGIDAS (SÍ necesitan token) ---
// 2. Aplicamos el middleware `verifyToken` ANTES de cada manejador de rutas protegido.
app.use("/api/users", verifyToken, userRoutes);
app.use("/api/clients", verifyToken, clientRoutes);
app.use("/api/roles", verifyToken, rolRoutes);
app.use("/api/permisos", verifyToken, permisoRoutes);
app.use("/api/abastecimiento", verifyToken, abastecimientoRoutes);
app.use('/api/secuenciamiento', verifyToken, secuenciamientoRutes);
app.use('/api/rechazos', verifyToken, rechazosRoutes);
app.use('/api/paradas', verifyToken, paradasRoutes); 
app.use("/api/registracion", verifyToken, registracionRoutes); 
// ===== FIN DE LA CORRECCIÓN CLAVE =====


// Ruta de prueba
app.get("/", (req, res) => {
  res.send("¡API Node.js con SQL Server funcionando perfectamente!");
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});