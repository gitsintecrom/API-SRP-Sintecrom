const knex = require("../config/database");

const getAllClients = async (req, res) => {
  try {
    console.log("Ejecutando GetAllClients...");
    const clients = await knex.raw("EXEC GetAllClients");
    console.log("Resultado de knex.raw:", JSON.stringify(clients, null, 2));

    let clientData = [];
    if (clients.recordset && clients.recordset.length > 0) {
      console.log("Usando recordset");
      clientData = clients.recordset;
    } else if (clients.rows && clients.rows.length > 0) {
      console.log("Usando rows");
      clientData = clients.rows;
    } else if (Array.isArray(clients) && clients.length > 0) {
      console.log("Usando array raíz");
      clientData = clients;
    } else {
      console.log("No se encontraron datos en recordset, rows ni array raíz");
    }

    res.status(200).json(clientData);
  } catch (error) {
    console.error("Error al obtener clientes:", error.message, error.stack);
    res
      .status(500)
      .json({ error: "Error al obtener clientes", details: error.message });
  }
};

const createClient = async (req, res) => {
  const { name, phone, address } = req.body;
  try {
    // Validar los datos de entrada
    if (!name || !phone) {
      return res
        .status(400)
        .json({ error: "Nombre y teléfono son requeridos" });
    }

    const result = await knex.raw(
      "EXEC CreateClient @Name=?, @Phone=?, @Address=?",
      [name, phone, address || null] // Address es opcional
    );
    console.log("Resultado de knex.raw:", JSON.stringify(result, null, 2));

    let clientData;
    if (result && result.recordset && result.recordset.length > 0) {
      clientData = result.recordset[0]; // { id, name, phone, address, created_at }
    } else if (Array.isArray(result) && result.length > 0 && result[0].id) {
      clientData = result[0];
    } else {
      // Buscar manualmente si el procedimiento no devuelve datos
      const newClient = await knex("clients").where({ name, phone }).first();
      if (newClient) {
        clientData = {
          id: newClient.id,
          name: newClient.name,
          phone: newClient.phone,
          address: newClient.address,
          created_at: newClient.created_at,
        };
      } else {
        return res
          .status(500)
          .json({
            error: "No se pudieron obtener los datos del cliente creado",
          });
      }
    }

    res.status(201).json(clientData);
  } catch (error) {
    console.error("Error al crear cliente:", error.message, error.stack);
    res
      .status(500)
      .json({ error: "Error al crear cliente", details: error.message });
  }
};

const updateClient = async (req, res) => {
  const { id } = req.params;
  const { name, phone, address } = req.body;
  try {
    // Validar los datos de entrada
    if (!name || !phone) {
      return res
        .status(400)
        .json({ error: "Nombre y teléfono son requeridos" });
    }

    const result = await knex.raw(
      "EXEC UpdateClient @Id=?, @Name=?, @Phone=?, @Address=?",
      [id, name, phone, address || null] // Address es opcional
    );
    console.log("Resultado de knex.raw:", JSON.stringify(result, null, 2));

    if (result.returnValue === -1) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    let updatedClientData;
    if (result && result.recordset && result.recordset.length > 0) {
      updatedClientData = result.recordset[0]; // { id, name, phone, address, created_at }
    } else if (Array.isArray(result) && result.length > 0 && result[0].id) {
      updatedClientData = result[0];
    } else {
      // Buscar manualmente si el procedimiento no devuelve datos
      const updatedClient = await knex("clients").where({ id }).first();
      if (updatedClient) {
        updatedClientData = {
          id: updatedClient.id,
          name: updatedClient.name,
          phone: updatedClient.phone,
          address: updatedClient.address,
          created_at: updatedClient.created_at,
        };
      } else {
        return res
          .status(500)
          .json({
            error: "No se pudieron obtener los datos del cliente actualizado",
          });
      }
    }

    res.json(updatedClientData);
  } catch (error) {
    console.error("Error al actualizar cliente:", error.message, error.stack);
    res
      .status(500)
      .json({ error: "Error al actualizar cliente", details: error.message });
  }
};

const deleteClient = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await knex.raw("EXEC DeleteClient @Id=?", [id]);
    console.log("Resultado de knex.raw:", JSON.stringify(result, null, 2));

    if (result.returnValue === -1) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json({ message: "Cliente eliminado" });
  } catch (error) {
    console.error("Error al eliminar cliente:", error.message, error.stack);
    res
      .status(500)
      .json({ error: "Error al eliminar cliente", details: error.message });
  }
};

module.exports = {
  getAllClients,
  createClient,
  updateClient,
  deleteClient,
};
