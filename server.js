const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

// Cargar variables de entorno
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuración de CORS
const corsOptions = {
  // Permitir solo peticiones desde el origen de tu frontend de Vite
  origin: process.env.HOST_ORIGIN, 
  optionsSuccessStatus: 200 // Para navegadores antiguos que pueden tener problemas
};

// 4. Aplicar Middlewares
app.use(cors(corsOptions)); // Aplicar el middleware de CORS
app.use(express.json()); // Middleware para parsear JSON

// Importar rutas
const userRoutes = require("./routes/users");
const clientRoutes = require("./routes/clients");
const authRoutes = require("./routes/authRoutes");
const rolRoutes = require("./routes/rolRoutes");
const permisoRoutes = require("./routes/permisoRoutes");

const abastecimientoRoutes = require("./routes/abastecimientoRoutes");

// Usar rutas
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
