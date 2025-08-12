// const knex = require("knex")({
//   client: "mssql",
//   connection: {
//     server: process.env.DB_HOST,
//     port: parseInt(process.env.DB_PORT, 10),
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     options: {
//       encrypt: false,
//       // trustServerCertificate: true,
//     },
//   },
// });

// module.exports = knex;


// /config/database.js (o como se llame tu archivo de conexión)

const knex = require('knex');

// --- Configuración Base ---
// Leemos las variables de entorno una sola vez
const dbConfig = {
  client: "mssql",
  connection: {
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: false, // Cambiar a true para Azure SQL
      trustServerCertificate: true // Generalmente necesario para desarrollo local
    },
  },
};

// --- Conexión 1: RegistracionNET ---
// Creamos una nueva instancia de knex para la base de datos 'RegistracionNET'
const dbRegistracionNET = knex({
  ...dbConfig, // Copiamos la configuración base
  connection: {
    ...dbConfig.connection, // Copiamos la configuración de conexión
    database: 'RegistracionNET', // Especificamos la base de datos para esta conexión
  }
});

// --- Conexión 2: SintecromDesa (Calipso) ---
// Creamos OTRA instancia de knex para la base de datos 'SintecromDesa'
const dbSintecromDesa = knex({
  ...dbConfig, // Copiamos la configuración base
  connection: {
    ...dbConfig.connection, // Copiamos la configuración de conexión
    database: 'SintecromDesa', // Especificamos la base de datos para esta conexión
  }
});

// --- Exportamos AMBAS conexiones ---
// Ahora, en otros archivos, podremos importar la que necesitemos.
module.exports = {
  dbRegistracionNET,
  dbSintecromDesa
};