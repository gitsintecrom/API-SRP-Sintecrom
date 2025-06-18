const knex = require("knex")({
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
});

module.exports = knex;
