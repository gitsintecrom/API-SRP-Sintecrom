require("dotenv").config();

// console.log("Configuración de conexión:", {
//   server: process.env.DB_HOST,
//   port: parseInt(process.env.DB_PORT, 10),
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   options: {
//     encrypt: true,
//     trustServerCertificate: true,
//   },
// });

module.exports = {
  development: {
    client: "mssql",
    connection: {
      server: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      options: {
        encrypt: false,
        // trustServerCertificate: true,
      },
    },
    migrations: {
      directory: "./migrations",
    },
  },
};
