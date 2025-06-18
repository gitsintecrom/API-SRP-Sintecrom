// testDbConnection.js
require('dotenv').config(); // Es importante cargar dotenv ANTES de requerir database.js
                           // para que process.env esté poblado cuando database.js se ejecute.

const knexInstance = require('./config/database'); // Importa tu instancia de knex ya configurada

async function checkConnection() {
    console.log(`Intentando conectar a la base de datos...`);
    try {
        // Realiza una consulta simple para verificar la conexión.
        await knexInstance.raw('SELECT 1 AS result');
        console.log('¡Conexión a la base de datos establecida exitosamente!');
        console.log('Configuración utilizada (desde database.js):');
        // Accedemos a la configuración a través de la instancia de knex
        // La estructura puede variar ligeramente dependiendo de cómo knex la almacena internamente
        // Esto es un intento de acceder a ella, podría necesitar ajustes
        const config = knexInstance.client.config.connection;
        console.log('  Host:', config.server || process.env.DB_HOST);
        console.log('  Port:', config.port || process.env.DB_PORT);
        console.log('  User:', config.user || process.env.DB_USER);
        console.log('  Database:', config.database || process.env.DB_NAME);

    } catch (error) {
        console.error('Error al conectar a la base de datos:');
        console.error('Mensaje:', error.message);
        // console.error('Detalles:', error); // Descomentar para más detalles
        console.error('\nPor favor, verifica lo siguiente:');
        console.error(`1. Que las variables de entorno en tu archivo .env (DB_HOST=${process.env.DB_HOST}, DB_PORT=${process.env.DB_PORT}, DB_USER=${process.env.DB_USER}, DB_NAME=${process.env.DB_NAME}) sean correctas.`);
        console.error('2. Que el servidor de SQL Server esté en ejecución y accesible en ese host y puerto.');
        console.error('3. Que el puerto especificado no esté bloqueado por un firewall.');
        console.error('4. Que el usuario y contraseña sean válidos y tengan permisos para conectar a la base de datos especificada.');
        console.error(`5. Que las opciones de conexión (encrypt: ${knexInstance.client.config.connection.options?.encrypt}, trustServerCertificate: ${knexInstance.client.config.connection.options?.trustServerCertificate}) sean adecuadas para tu servidor.`);
    } finally {
        // Cierra la conexión a la base de datos para que el script termine.
        if (knexInstance) {
            await knexInstance.destroy();
            console.log('Conexión cerrada.');
        }
    }
}

checkConnection();