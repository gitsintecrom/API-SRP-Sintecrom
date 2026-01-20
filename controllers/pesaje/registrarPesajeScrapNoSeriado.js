// src/controllers/pesaje/registrarPesajeScrapNoSeriado.js
const registrarPesajeScrapNoSeriado = async (req, res) => {
    const { operacionId, atados } = req.body;
    if (!operacionId || !atados?.length) {
        return res.status(400).json({ error: "Faltan datos para scrap no seriado." });
    }

    return await procesarPesaje({ 
        req, res, 
        sobrante: 2,
        esScrapNoSeriado: true,
        permiteCalidad: false,   // ← clave
        requiereAtado: false     // ← clave
    });
};