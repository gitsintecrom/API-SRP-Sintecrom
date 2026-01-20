// src/controllers/pesaje/registrarPesajeNormal.js
const registrarPesajeNormal = async (req, res) => {
    const { operacionId, loteIds, atados } = req.body;
    const lineaData = req.body.lineaData || {};

    if (!operacionId || !atados?.length) {
        return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    return await procesarPesaje({ 
        req, res, 
        sobrante: 0,
        esScrapNoSeriado: false,
        permiteCalidad: true,
        requiereAtado: true 
    });
};