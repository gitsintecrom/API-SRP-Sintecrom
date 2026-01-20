// src/controllers/pesaje/registrarPesajeSobrante.js
const registrarPesajeSobrante = async (req, res) => {
    const { operacionId, atados } = req.body;
    if (!operacionId || !atados?.length) {
        return res.status(400).json({ error: "Faltan datos para sobrante." });
    }

    return await procesarPesaje({ 
        req, res, 
        sobrante: 1,
        esScrapNoSeriado: false,
        permiteCalidad: true,
        requiereAtado: true 
    });
};