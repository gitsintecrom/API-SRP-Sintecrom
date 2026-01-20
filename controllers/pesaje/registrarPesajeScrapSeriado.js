// src/controllers/pesaje/registrarPesajeScrapSeriado.js
const registrarPesajeScrapSeriado = async (req, res) => {
    const { operacionId, atados } = req.body;
    if (!operacionId || !atados?.length) {
        return res.status(400).json({ error: "Faltan datos para scrap seriado." });
    }

    return await procesarPesaje({ 
        req, res, 
        sobrante: 2,
        esScrapNoSeriado: false,
        permiteCalidad: true,
        requiereAtado: true 
    });
};