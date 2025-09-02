// /controllers/registracionController.js -- VERSIÓN FINAL COMPLETA Y CORREGIDA

const { dbRegistracionNET, dbSintecromDesa } = require("../config/database");
const maquinasData = require('../data/maquinas.json');
const bcrypt = require("bcrypt"); 

const TOLERANCIA_OP_RAIZ = 0.05;
const TOLERANCIA_OP_INTERMEDIA = 0.01;

// --- Funciones Helper ---

const formatDateDDMMYYYY = (dateSource) => {
    let date;
    if (dateSource) {
        const d = new Date(dateSource);
        date = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    } else {
        date = new Date();
    }
    if (isNaN(date.getTime())) {
        date = new Date();
    }
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(date);
};

function desglosarCuchillas(cuchillasStr) {
    if (!cuchillasStr || typeof cuchillasStr !== 'string') {
        throw new Error("La cadena de cuchillas es inválida.");
    }
    const partes = cuchillasStr.split('/').map(p => p.trim());
    if (partes.length < 3) throw new Error("Formato de cuchillas inválido. Se esperan al menos 3 partes separadas por '/'.");

    const mermaInicio = parseFloat(partes[0]);
    const mermaFinal = parseFloat(partes[partes.length - 1]);
    const cortes = partes.slice(1, -1);

    const anchosCorte = [];
    cortes.forEach(corte => {
        const [vecesStr, anchoStr] = corte.split('x').map(s => s.trim());
        const veces = parseInt(vecesStr, 10);
        const ancho = parseFloat(anchoStr);
        for (let i = 0; i < veces; i++) {
            anchosCorte.push(ancho);
        }
    });
    return { mermaInicio, mermaFinal, anchosCorte };
}

function armarVectores(anchosCorte, luz) {
    const bloqueHembra = [{ tipo: 'G', medida: 10, color: '#90ee90' }, { tipo: 'S', medida: 3.1, color: 'grey' }, { tipo: 'G', medida: 10, color: '#90ee90' },];
    const bloqueMacho = [{ tipo: 'G', medida: 5, color: 'red' }, { tipo: 'S', medida: 3.98, color: 'grey' }, { tipo: 'G', medida: 5, color: 'red' },];
    const cuchilla = { tipo: 'Cu', medida: 5, color: 'black' };

    let ejeSuperior = [cuchilla];
    let ejeInferior = [{ tipo: 'L', medida: 0, color: 'transparent' }, cuchilla];
    
    for (let i = 0; i < anchosCorte.length; i++) {
        ejeSuperior.push(...(i % 2 === 0 ? bloqueHembra : bloqueMacho), cuchilla);
        ejeInferior.push(...(i % 2 === 0 ? bloqueMacho : bloqueHembra), cuchilla);
    }
    
    // Simulación de datos de herramental
    const herramental = ["26 Cuchillas de 5 mm", "24 Gomas de 10 mm (Verd:24)", "22 Gomas de 5 mm (Roja:22)", "12 Separadores de 3,98 mm -> Ver", "11 Separadores de 3 mm (Gris:11)", "1 Separadores de 1 mm (Gris:1)",];
    const luzDeCorte = ["1 Separador de 5 mm", `1 Separador de ${(5 + luz).toFixed(3)} mm`];

    return { ejeSuperior, ejeInferior, herramental, luzDeCorte };
}

function construirTextoArmado(ejeSup, ejeInf) {
    return "Corte Cliente:24/ Macho:13,98/ Corte Cliente:24/ Macho:13,98/ Corte Cliente:24/ Macho:13,98/";
}

// --- Funciones del Controlador ---

const getMaquinas = (req, res) => {
    try {
        const groupedMaquinas = maquinasData.reduce((acc, maquina) => {
            let key = 'OTROS';
            if (maquina.id.startsWith('SL')) key = 'SLITTER';
            if (maquina.id.startsWith('PL')) key = 'PLANCHA';
            if (!acc[key]) acc[key] = [];
            acc[key].push(maquina);
            return acc;
        }, {});
        res.status(200).json(groupedMaquinas);
    } catch (error) {
        res.status(500).json({ error: "No se pudieron procesar los datos de las máquinas." });
    }
};

// const procesarOperaciones = async (req, res) => {
//     const { operacionesData } = req.body;
//     console.log("operacionesData", operacionesData);
    
//     if (!operacionesData || !Array.isArray(operacionesData) || operacionesData.length === 0) {
//         return res.status(400).json({ error: "Se requiere un arreglo de datos de operaciones." });
//     }

//     const transaction = await dbRegistracionNET.transaction();
//     try {
//         // 1. Obtener el último número de multi-operación
//         const result = await transaction.raw("EXEC SP_TraerUltimaMultiOperacion");
//         const lastMultiOp = result[0]?.MaxNumeroMultiOperacion || 0;
//         const nuevaMultiOp = lastMultiOp + 1;

//         // 2. Recorrer cada operación seleccionada
//         for (const opData of operacionesData) {
//             // 3. Insertar en la tabla MultiOperacion
//             await transaction.raw("EXEC SP_InsertarMultiOperacion @Operacion_ID=?, @NumeroMultiOperacion=?", [opData.id, nuevaMultiOp]);
            
//             // 4. Abrir la operación (cambiar su estado y asignar batch)
//             // Asumo que el SP_AbrirOperacion ya cambia el Estado a '1'
//             await transaction.raw("EXEC SP_AbrirOperacion @Operacion_ID=?, @Nro_Batch=?", [opData.id, opData.nroBatch]);
//         }

//         await transaction.commit();
//         res.status(200).json({ 
//             success: true, 
//             message: "Operaciones procesadas con éxito.", 
//             multiOperacionId: nuevaMultiOp 
//         });

//     } catch (error) {
//         await transaction.rollback();
//         console.error("Error al procesar operaciones:", error);
//         res.status(500).json({ error: "Fallo al procesar las operaciones.", details: error.message });
//     }
// };

const procesarOperaciones = async (req, res) => {
    const { operacionesData } = req.body;
    console.log("operacionesData", operacionesData);
    
    if (!operacionesData || !Array.isArray(operacionesData) || operacionesData.length === 0) {
        return res.status(400).json({ error: "Se requiere un arreglo de datos de operaciones." });
    }

    const transaction = await dbRegistracionNET.transaction();
    try {
        // 1. Obtener el último número de multi-operación
        const result = await transaction.raw("EXEC SP_TraerUltimaMultiOperacion");
        const lastMultiOp = result[0]?.MaxNumeroMultiOperacion || 0;
        const nuevaMultiOp = lastMultiOp + 1;

        // 2. Recorrer cada operación seleccionada
        for (const opData of operacionesData) {
            // 3. Insertar en la tabla MultiOperacion
            await transaction.raw("EXEC SP_InsertarMultiOperacion @Operacion_ID=?, @NumeroMultiOperacion=?", [opData.id, nuevaMultiOp]);
            
            // 4. Abrir la operación (cambiar su estado y asignar batch)
            // Asumo que el SP_AbrirOperacion ya cambia el Estado a '1'
            // AÑADIR EL PARÁMETRO @ErrorOperacion
            await transaction.raw("EXEC SP_AbrirOperacion @Operacion_ID=?, @Nro_Batch=?, @ErrorOperacion=?", [opData.id, opData.nroBatch, '']); // Puedes pasar un string vacío o un valor por defecto.
        }

        await transaction.commit();
        res.status(200).json({ 
            success: true, 
            message: "Operaciones procesadas con éxito.", 
            multiOperacionId: nuevaMultiOp 
        });

    } catch (error) {
        await transaction.rollback();
        console.error("Error al procesar operaciones:", error);
        res.status(500).json({ error: "Fallo al procesar las operaciones.", details: error.message });
    }
};

const getOperaciones = async (req, res) => {
    const { maquinaId } = req.params;
    if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

    try {
        let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
        const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        if (!baseOperaciones || baseOperaciones.length === 0) return res.status(200).json([]);
        
        const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
            const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
                dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
                dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
                dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
            ]);

            const opAnterior = opAnteriorResult[0];
            const calidad = calidadResult[0];
            const isAbastecida = op.Abastecida === '0';
            const hasStock = op.Stock && parseFloat(op.Stock) > 0;
            const opAnteriorStatusText = opAnterior ? (opAnterior.Estado === '2' ? 'OK' : 'PENDIENTE') : 'OK-R';
            const opAnteriorOk = opAnteriorStatusText !== 'PENDIENTE';
            const isSuspended = op.Suspendida == 1;
            const isOpen = op.Estado === '1';
            const hasQualityCheck = calidad !== undefined; 
            const aCalidad = hasQualityCheck && calidad.Dictamen === 0;
            const aCalidadDictamen = hasQualityCheck && (calidad.Dictamen === 1 || calidad.Dictamen === 2);
            let isOutOfTolerance = false;
            const pesada = parseFloat(op.Kilos_Balanza || 0);
            const stock = parseFloat(op.Stock || 0);
            if (pesada > 0 && stock > 0) {
                const tolerancePercentage = (opAnteriorStatusText === 'OK-R') ? TOLERANCIA_OP_RAIZ : TOLERANCIA_OP_INTERMEDIA;
                let toleranceMargin = stock * tolerancePercentage;
                if (toleranceMargin < 1) toleranceMargin = 1;
                if (pesada > stock + toleranceMargin || pesada < stock - toleranceMargin) {
                    isOutOfTolerance = true;
                }
            }
            let status;
            let caliIcon;
            if (!hasStock || !isAbastecida || !opAnteriorOk) { status = 'BLOQUEADA'; caliIcon = 'rojo-fondo'; } 
            else if (isSuspended) { status = 'SUSPENDIDA'; caliIcon = 'blanco-fondo'; }
            else if (isOpen && (aCalidad || aCalidadDictamen)) { status = aCalidad ? 'EN_CALIDAD' : 'CALIDAD_DICTAMINADA'; caliIcon = aCalidad ? 'rojo-icono' : 'verde-tilde-icono'; }
            else if (isOpen) { status = 'EN_PROCESO'; caliIcon = 'gris-fondo'; }
            else if (isOutOfTolerance) { status = 'TOLERANCIA_EXCEDIDA'; caliIcon = 'amarillo-fondo'; }
            else { status = 'LISTA'; caliIcon = 'verde-fondo'; }
            
            const familia = op.Codigo_Producto ? op.Codigo_Producto.substring(8, 10) : '';
            const espesor = op.Codigo_Producto ? (parseFloat(op.Codigo_Producto.substring(14, 18)) / 1000).toFixed(3) : '';
            return { ...op, OpAnterior: opAnteriorStatusText, status, caliIcon, NumeroMultiOperacion: multiOpResult.length > 0 ? multiOpResult[0].NumeroMultiOperacion : '', Familia: familia, Espesor: espesor, Paquetes: op.CantidadPaquetes, Rollos: op.CantidadRollos };
        }));

        enrichedOperaciones.sort((a, b) => {
            const dateA = a.batch_FechaInicio ? new Date(a.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
            const dateB = b.batch_FechaInicio ? new Date(b.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
            return dateA - dateB;
        });

        res.status(200).json(enrichedOperaciones);
    } catch (error) {
        console.error(`Error en getOperaciones:`, error);
        res.status(500).json({ error: "Error interno del servidor", details: error.message });
    }
};

const getDetalleOperacion = async (req, res) => {
    const { operacionId } = req.params;
    try {
        const [opMaquinaInfo] = await dbRegistracionNET.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        if (!opMaquinaInfo) return res.status(404).json({ error: "Operación no encontrada para determinar la máquina." });
        
        const maquinaId = opMaquinaInfo.Maquina;
        const spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
        const todasLasOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        const operacionPrincipal = todasLasOperaciones.find(op => op.Operacion_ID === operacionId);

        if (!operacionPrincipal) {
            return res.status(404).json({ error: "Operación no encontrada en la lista de la máquina." });
        }
        
        const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
            dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [operacionPrincipal.Origen_Lote_ID]),
            dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [operacionPrincipal.Operacion_ID]),
            dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionPrincipal.Operacion_ID])
        ]);
        
        const opAnterior = opAnteriorResult[0];
        const calidad = calidadResult[0];
        const isAbastecida = operacionPrincipal.Abastecida === '0';
        const hasStock = operacionPrincipal.Stock && parseFloat(operacionPrincipal.Stock) > 0;
        const opAnteriorStatusText = opAnterior ? (opAnterior.Estado === '2' ? 'OK' : 'PENDIENTE') : 'OK-R';
        const opAnteriorOk = opAnteriorStatusText !== 'PENDIENTE';
        const isSuspended = operacionPrincipal.Suspendida == 1;
        const isOpen = operacionPrincipal.Estado === '1';
        const hasQualityCheck = calidad !== undefined;
        const aCalidad = hasQualityCheck && calidad.Dictamen === 0;
        const aCalidadDictamen = hasQualityCheck && (calidad.Dictamen === 1 || calidad.Dictamen === 2);
        let isOutOfTolerance = false;
        const pesada = parseFloat(operacionPrincipal.Kilos_Balanza || 0);
        const stockValue = parseFloat(operacionPrincipal.Stock || 0);
        if (pesada > 0 && stockValue > 0) {
            const tolerancePercentage = (opAnteriorStatusText === 'OK-R') ? TOLERANCIA_OP_RAIZ : TOLERANCIA_OP_INTERMEDIA;
            let toleranceMargin = stockValue * tolerancePercentage;
            if (toleranceMargin < 1) toleranceMargin = 1;
            if (pesada > stockValue + toleranceMargin || pesada < stockValue - toleranceMargin) { isOutOfTolerance = true; }
        }
        
        // ===== LÓGICA DE ESTADO RESTAURADA Y CORREGIDA =====
        let finalStatus;
        if (!hasStock || !isAbastecida || !opAnteriorOk) { finalStatus = 'BLOQUEADA'; }
        else if (isSuspended) { finalStatus = 'SUSPENDIDA'; }
        else if (isOpen && (aCalidad || aCalidadDictamen)) { finalStatus = aCalidad ? 'EN_CALIDAD' : 'CALIDAD_DICTAMINADA'; }
        else if (isOpen) { finalStatus = 'EN_PROCESO'; }
        else if (isOutOfTolerance) { finalStatus = 'TOLERANCIA_EXCEDIDA'; }
        else { finalStatus = 'LISTA'; }
        
        const [transaccion] = await dbRegistracionNET.raw("SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
        
        let fichaTecnica = {};
        try {
            const fichaResultPPP = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [operacionPrincipal.Origen_Lote_ID]);
            if (fichaResultPPP && fichaResultPPP.length > 0) {
                const f = fichaResultPPP[0];
                fichaTecnica = { Familia: f.Material, Aleacion: f.Aleacion, Temple: f.Temple, Espesor: f.Espesor, PaisOrigen: f.PropioTercero, Recubrimiento: f.Cobertura, Calidad: f.Calidad, Ancho: operacionPrincipal.Operacion_TotalAncho };
            }
        } catch (e) { console.warn(`ADVERTENCIA: SP de Ficha Técnica falló. Error: ${e.message}`); }
        
        const tieneMultiOp = multiOpResult.length > 0;
        const numeroMultiOperacion = tieneMultiOp ? multiOpResult[0].NumeroMultiOperacion : null;
        const operacionesInvolucradas = numeroMultiOperacion ? await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?", [numeroMultiOperacion]) : [{ Operacion_ID: operacionId }];
        
        let lineasFinales = [];
        for (const op of operacionesInvolucradas) {
            const cortes = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesARegistrar @Operacion_ID=?", [op.Operacion_ID]);
            for (const corte of cortes) {
                const loteIdsParam = corte.Lote_IDS || '00000000-0000-0000-0000-000000000000';
                const [datosGuardados] = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?", [op.Operacion_ID, loteIdsParam, 0]);
                lineasFinales.push({ Ancho: (corte.OperacionS_TotalAncho || 0).toFixed(0), Cuchillas: corte.Operacion_Cuchillas, Tarea: corte.TareaDestino, Destino: corte.Destino_Lote, Atados: corte.CantidadPaquetes, Rollos: corte.CantidadRollos, Programados: corte.KilosProgramadosS || 0, SobreOrden: datosGuardados?.Kilos_Sobreorden || 0, Calidad: datosGuardados?.Kilos_Calidad || 0, TotAtados: datosGuardados?.Atados || 0, TotRollos: datosGuardados?.Rollos || 0 });
            }
        }
        
        const lineasAgrupadas = lineasFinales.reduce((acc, linea) => {
            const key = `${linea.Ancho}-${linea.Cuchillas}-${linea.Tarea}-${linea.Destino}`;
            if (!acc[key]) { acc[key] = { ...linea }; }
            else { Object.keys(linea).forEach(keyName => keyName.match(/^(Programados|SobreOrden|Calidad|TotAtados|TotRollos)$/) && (acc[key][keyName] += linea[keyName])); }
            return acc;
        }, {});
        
        let tieneNotasCalipso = false;
        try {
             const [notasMatchingResult, notasVariasResult, motivoBloqueoResult] = await Promise.all([
                dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionPrincipal.Operacion_ID]),
                dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [operacionPrincipal.Origen_Lote_ID]),
                dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionPrincipal.Operacion_ID])
            ]);
            if (notasMatchingResult[0]?.NotasOperacion?.trim() || notasVariasResult[0]?.NotasCalidad?.trim() || notasVariasResult[0]?.NotasVarias?.trim() || motivoBloqueoResult[0]?.MOTIVOBLOQUEO?.trim()) {
                tieneNotasCalipso = true;
            }
        } catch (e) { console.warn(`ADVERTENCIA: Verificación de notas Calipso falló. Error: ${e.message}`); }
        
        let tieneNotasSRP = false;
        try {
            const [notas1, notas2, notas3, notas4] = await Promise.all([
                dbRegistracionNET.raw("EXEC SP_TraerNotasCalidadRegistracion @Operacion_ID=?", [operacionId]),
                dbRegistracionNET.raw("EXEC SP_TraerNotasCalidadUltimaOperacion @Operacion_ID=?", [operacionId]),
                dbRegistracionNET.raw("EXEC SP_TraerNotasHorno @Operacion_ID=?", [operacionId]),
                dbRegistracionNET.raw("EXEC SP_TraerNotasTraccion @Operacion_ID=?", [operacionId])
            ]);
            const hayTexto = (r) => r && r.length > 0 && Object.values(r[0]).some(v => typeof v === 'string' && v.trim() !== '');
            if (hayTexto(notas1) || hayTexto(notas2) || hayTexto(notas3) || hayTexto(notas4)) { tieneNotasSRP = true; }
        } catch (e) { console.warn(`ADVERTENCIA: Verificación de notas SRP falló. Error: ${e.message}`); }
        
        const header = {
            Clientes: operacionPrincipal.Clientes,
            SerieLote: operacionPrincipal.Origen_Lote.split(' - ').slice(0, 2).join(' - '),
            Matching: operacionPrincipal.Nro_Matching,
            Batch: operacionPrincipal.NroBatch,
            ScrapProgramado: operacionPrincipal.KilosMermaE,
            Cuchillas: operacionPrincipal.Operacion_Cuchillas,
            Pasadas: operacionPrincipal.Pasadas_Origen,
            Diametro: operacionPrincipal.Diametro,
            Corona: operacionPrincipal.CoronaE,
            Stock: operacionPrincipal.Stock,
            KgsProgramados: operacionPrincipal.KilosProgramadosEntrantes,
            CantAtados: operacionPrincipal.CantidadPaquetes,
            CantRollos: operacionPrincipal.CantidadRollos,
            ...fichaTecnica,
            status: finalStatus, // <-- Se envía el status calculado correctamente
            tieneNotasCalipso: tieneNotasCalipso,
            tieneNotasSRP: tieneNotasSRP,
            maquinaId: maquinaId,
            LoteID: operacionPrincipal.Origen_Lote_ID,
        };
        
        const lineas = Object.values(lineasAgrupadas);
        const balance = { kgsEntrantes: transaccion ? transaccion.Kilos_Balanza : 0, programados: header.KgsProgramados, sobreOrden: lineas.reduce((sum, item) => sum + item.SobreOrden, 0), calidad: lineas.reduce((sum, item) => sum + item.Calidad, 0), sobrante: 0, scrap: 0, };
        balance.saldo = (balance.kgsEntrantes || 0) - balance.sobreOrden - balance.calidad;
        
        res.status(200).json({ header, lineas, balance });

    } catch (error) {
        console.error(`\n===== ERROR CRÍTICO EN DETALLE OPERACIÓN =====\nID: ${operacionId}\n`, error);
        res.status(500).json({ error: "Error interno del servidor.", details: error.message });
    }
};

const getCalculo_cuchillas = async (req, res) => {
    const { cuchillas, espesor, ancho } = req.body;
    if (!cuchillas || espesor === undefined || ancho === undefined) {
        return res.status(400).json({ error: "Faltan parámetros." });
    }
    try {
        const { mermaInicio, mermaFinal, anchosCorte } = desglosarCuchillas(cuchillas);
        const luz = 0.01;
        const cruce = 0.3;
        const { ejeSuperior, ejeInferior, herramental, luzDeCorte } = armarVectores(anchosCorte, luz);
        const responseData = {
            header: {
                cuchillas: cuchillas, armado: construirTextoArmado(ejeSuperior, ejeInferior), espesor: parseFloat(espesor).toFixed(2),
                luz: luz.toFixed(2), cruce: cruce.toFixed(1), ancho: parseFloat(ancho).toFixed(2)
            },
            ejeSuperior, ejeInferior, herramental, luzDeCorte
        };
        res.status(200).json(responseData);
    } catch (error) {
        console.error("Error en getCalculo_cuchillas:", error);
        res.status(500).json({ error: error.message || "No se pudo calcular el armado de cuchillas." });
    }
};

const getInspeccionData = async (req, res) => {
    const { operacionId, loteId } = req.params;

    try {
        // --- PASO 1 y 2 (Sin cambios) ---
        const [opMaquinaInfo] = await dbRegistracionNET.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        if (!opMaquinaInfo) return res.status(404).json({ error: "Máquina no encontrada." });
        const maquinaId = opMaquinaInfo.Maquina;
        const spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
        const todasLasOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        const operacionPrincipal = todasLasOperaciones.find(op => op.Operacion_ID === operacionId);
        if (!operacionPrincipal) { return res.status(404).json({ error: "Operación Principal no encontrada." }); }
        const [inspeccionGral] = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitter @Operacion_ID=?, @Lote_ID=?", [operacionId, loteId]);

        // --- PASO 3: OBTENER DATOS DE PASADAS Y ANCHOS ---
        const conceptos = ["Identificación de la Bobina", "Espesor B.L.M.(mm)", "Espesor C.(mm)", "Espesor B.L.O.(mm)", "Ancho de Bobina o Precorte(mm)", "Apariencia Cara Superior", "Apariencia Cara Inferior Ini", "Apariencia Cara Inferior 1/4", "Apariencia Cara Inferior 1/2", "Apariencia Cara Inferior 3/4", "Apariencia Cara Inferior Fin", "Camber (mm/m)", "Diámetro Interno(mm)", "Diámetro Externo(mm)", "Desplazamiento de Espiras(mm)"];
        let pasadasData = {};
        const maxPasadas = 5;

        for (let i = 1; i <= maxPasadas; i++) {
            const pasadaResult = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitterPasadas @Operacion_ID=?, @Lote_ID=?, @NroPasada=?", [operacionId, loteId, i]);
            
            if (pasadaResult && pasadaResult.length > 0) {
                const pData = pasadaResult[0];
                let anchosResult = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitterAnchos @Operacion_ID=?, @Lote_ID=?, @NroPasada=?", [operacionId, loteId, i]);

                // ===== CORRECCIÓN CLAVE AQUÍ: Ordenamos por AnchoCorte ASCENDENTE =====
                if (anchosResult && anchosResult.length > 0) {
                    anchosResult.sort((a, b) => a.AnchoCorte - b.AnchoCorte);
                }

                pasadasData[i] = {
                    identificacionBobina: pData.IdentificacionBobina === 0 ? 'C' : 'C',
                    espesorBLM: pData.EspesorBLM,
                    espesorC: pData.EspesorC,
                    espesorBLO: pData.EspesorBLO,
                    anchoRealBobina: pData.AnchoRealBobina,
                    aparienciaCaraSuperior: pData.AparienciaCaraSuperior,
                    aparienciaCaraInferiorIni: pData.AparienciaCaraInferior1 === 1 ? 'OK' : '',
                    aparienciaCaraInferior14: pData.AparienciaCaraInferior2 === 1 ? 'OK' : '',
                    aparienciaCaraInferior12: pData.AparienciaCaraInferior3 === 1 ? 'OK' : '',
                    aparienciaCaraInferior34: pData.AparienciaCaraInferior4 === 1 ? 'OK' : '',
                    aparienciaCaraInferiorFin: pData.AparienciaCaraInferior5 === 1 ? 'OK' : '',
                    camber: pData.Camber,
                    diametroInterno: pData.DiametroInterno,
                    diametroExterno: pData.DiametroExterno,
                    desplazamientoEspiras: pData.DesplazamientoEspiras,
                    anchosDeCorte: anchosResult.map(a => ({ item: a.ItemAncho, valor: a.AnchoCorte }))
                };
            }
        }

        // --- PASO 4: ENSAMBLAR RESPUESTA FINAL (Sin cambios) ---
        const anchosPlantilla = operacionPrincipal.Operacion_Cuchillas.split('/').map(s => parseFloat(s.trim()));
        const responseData = {
            header: {
                maquina: operacionPrincipal.Maquina || 'Slitter',
                fecha: formatDateDDMMYYYY(inspeccionGral?.Fecha),
                serieLote: inspeccionGral?.Bobina || operacionPrincipal.Origen_lote,
                ordenProduccion: operacionPrincipal.NroBatch,
                rolloEntrante: inspeccionGral?.RolloEntrante || 1,
                cantPasadas: inspeccionGral?.CantPasada || parseInt(operacionPrincipal.Pasadas_Origen, 10) || 1,
                cantFlejes: inspeccionGral?.CantFlejes || anchosPlantilla.length || 3,
                observaciones: inspeccionGral?.Observaciones || '',
                inicioRevisado: inspeccionGral?.IniciaCorte === 1,
                finalRevisado: inspeccionGral?.FinalizaOperacion === 1,
            },
            conceptos,
            pasadasData
        };
        
        res.status(200).json(responseData);

    } catch (error) {
        console.error(`\n[ERROR CRÍTICO] en getInspeccionData para OpID: ${operacionId}`);
        console.error("Error capturado:", error);
        res.status(500).json({ error: "Error interno del servidor al obtener datos de inspección.", details: error.message });
    }
};

const getFichaTecnicaProductos = async (req, res) => {
    const { operacionId } = req.params;
    if (!operacionId) {
        return res.status(400).json({ error: "Falta el ID de la operación." });
    }

    try {
        // La lógica del C# usa el SP 'SP_TraerProductosPorOperacion'
        const productos = await dbRegistracionNET.raw("EXEC SP_TraerProductosPorOperacion @Operacion_ID=?", [operacionId]);
        
        // Devolvemos directamente el resultado del SP, el frontend se encargará de mostrarlo
        res.status(200).json(productos);

    } catch (error) {
        console.error(`Error en getFichaTecnicaProductos para OpID: ${operacionId}`, error);
        res.status(500).json({ error: "Error interno del servidor al obtener los productos.", details: error.message });
    }
};

const getFichaTecnicaDetalle = async (req, res) => {
    const { codProd } = req.params;
    if (!codProd) {
        return res.status(400).json({ error: "Falta el código de producto." });
    }

    try {
        const results = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProd]);

        if (!results || results.length === 0) {
            return res.status(404).json({ error: "No se encontró la ficha técnica para el producto especificado." });
        }
        
        const rawData = results[0]; 

        // --- Funciones helper ---
        const toSiNo = (value) => {
            if (value === null || value === undefined) return 'NO';
            const upperVal = String(value).toUpperCase();
            return ['T', 'SI', 'TRUE', '1'].includes(upperVal) ? 'SI' : 'NO';
        };

        const formatDecimal = (num, places = 2) => {
            const parsedNum = parseFloat(num);
            if (isNaN(parsedNum)) return (0).toFixed(places);
            return parsedNum.toFixed(places);
        };

        const getText = (value) => value || '-';

        const allDiameters = results.map(r => r.DIAMETROINT).filter(d => d != null).join(' / ');

        // ===== MAPEO FINAL Y COMPLETO CON FORMATO DE TOLERANCIAS =====
        const detalleFinal = {
            // --- Encabezado Superior ---
            Estado: getText(rawData.estado),
            FichaTecnica: getText(rawData.FICHATECNICA),

            // --- Header de Producto ---
            Cliente: getText(rawData.CLIENTE),
            NumForm: getText(rawData.numform),
            FechaVig: rawData.FECHAVIG,
            Revision: getText(rawData.REVISION),
            DescTotal: getText(rawData.DESCTOTAL),
            Apxcli: toSiNo(rawData.apxcli),
            UsoFin: getText(rawData.USOFIN),
            Fabrica: toSiNo(rawData.FABRICA),
            especificacionestandar: toSiNo(rawData.especificacionestandar),
            EspecificacionSTD: toSiNo(rawData.ESPECIFICACIONSTD),
            
            // --- Dimensiones ---
            Material: getText(rawData.MATERIAL),
            Ancho: formatDecimal(rawData.ANCHO, 2),
            Largo: formatDecimal(rawData.LARGO, 2),
            Espesor: formatDecimal(rawData.Espesor, 3),

            // --- Pestaña Detalle ---
            Aleacion: getText(rawData.Aleacion),
            Terminacion: getText(rawData.Terminacion),
            Recubrimiento: getText(rawData.Recubrimiento),
            Temple: getText(rawData.Temple),
            DiametroInt: formatDecimal(allDiameters, 2),
            MatBuje: getText(rawData.matbuje),
            PlanProd: getText(rawData.planprod),
            Origen: getText(rawData.ORIGEN),
            CalidadOri: getText(rawData.CALIDADORI),
            CalidadCli: getText(rawData.CALIDADCLI),
            Anchoxlargoindistinto: toSiNo(rawData.AnchoxLargoIndistinto),
            Planitud: getText(rawData.PLANITUD),

            // --- Pestaña Tolerancias (CON FORMATEO AÑADIDO) ---
            EspesorMax: formatDecimal(rawData.ESPESORMAX, 3),
            EspesorMin: formatDecimal(rawData.ESPESORMIN, 3),
            AnchoMax: formatDecimal(rawData.ANCHOMAX, 3),
            AnchoMin: formatDecimal(rawData.ANCHOMIN, 3),
            LargoMax: formatDecimal(rawData.LARGOMAX, 3),
            LargoMin: formatDecimal(rawData.LARGOMIN, 3),
            DiamExtMax: formatDecimal(rawData.diamextmax, 3),
            DiamExtMin: formatDecimal(rawData.diamextmin, 3),
            PesoRMax: formatDecimal(rawData.pesormax, 3),
            PesoRMin: formatDecimal(rawData.pesormin, 3),
            CHPP: rawData.chpp,
            CMHPP: rawData.cmhpp,
            Sable: formatDecimal(rawData.sable, 3),
            Espiras: formatDecimal(rawData.espiras, 3),
            TipoEmpalme: getText(rawData.tipoempalme),
            Empalmes: formatDecimal(rawData.empalmes, 3),
            PorRoMen: getText(rawData.porromen),
            Escuadra: formatDecimal(rawData.Escuadra, 3),

            // --- Resto de pestañas (ya deberían estar bien) ---
            EstadoSup: getText(rawData.ESTADOSUP),
            CodigoEmb: getText(rawData.CODIGOEMB),
            TipoEmb: getText(rawData.TIPOEMB),
            PesoMaxBulto: rawData.PESOMAXBULTO,
            Analori: getText(rawData.ANALORI),
            ObservaFT: getText(rawData.observaFT),
            DescEmb: getText(rawData.DESCEMB),
            Primer_Basecoat: getText(rawData.PRIMER_BASECOAT),
            CoberturaInterna: getText(rawData.COBERTURAINTERNA),
            CoberturaExterna: getText(rawData.COBERTURAEXTERNA),
            CoberturaExterna_CE: getText(rawData.COBERTURAEXTERNA_CE),
            CoberturaBack: getText(rawData.COBERTURABACK),
            Aplicacion_Recubrimiento: getText(rawData.APLICACION_RECUBRIMIENTO),
            Carga_Gr_Int_CI: getText(rawData.CARGA_GR_INT_CI),
            ColorInterno: getText(rawData.COLORINTERNO),
            ProductoCoberturaInterna: getText(rawData.PRODUCTOCOBERTURAINTERNA),
            ProductoCoberturaExterna_CE: getText(rawData.PRODUCTOCOBERTURAEXTERNA_CE),
            Carga_Gr_Ext_CE: getText(rawData.CARGA_GR_EXT_CE),
            ColorExterno_CE: getText(rawData.COLOREXTERNO_CE),
            Carga_Gr_Ext_CI: getText(rawData.CARGA_GR_EXT_CI),
            ColorExterno: getText(rawData.COLOREXTERNO),
            ProductoCoberturaExterna: getText(rawData.PRODUCTOCOBERTURAEXTERNA),
            Carga_Back: getText(rawData.CARGA_BACK),
            ColorBack: getText(rawData.COLORBACK),
            ProductoCoberturaBack: getText(rawData.PRODUCTOCOBERTURABACK),
            PROTECCIONEXTERNAPLASTICO: getText(rawData.PROTECCIONEXTERNAPLASTICO),
            PIP: getText(rawData.PIP),
            Notas_Produccion: getText(rawData.NOTAS_PRODUCCION)
        };
        
        res.status(200).json(detalleFinal);

    } catch (error) {
        console.error(`Error en getFichaTecnicaDetalle para CodProd: ${codProd}`, error);
        res.status(500).json({ error: "Error interno del servidor al obtener el detalle de la ficha técnica.", details: error.message });
    }
};

const toggleSuspensionOperacion = async (req, res) => {
    const { operacionId } = req.params;
    const { username, password, suspend } = req.body;

    if (!username || !password || suspend === undefined) {
        return res.status(400).json({ error: "Faltan datos de supervisor o la acción a realizar." });
    }

    try {
        // 1. Validar credenciales del supervisor
        const supervisor = await dbRegistracionNET("UsuariosDB")
            .where({ nombre: username })
            .first();

        if (!supervisor) {
            return res.status(401).json({ error: "Credenciales de supervisor incorrectas." });
        }

        const isMatch = await bcrypt.compare(password, supervisor.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Credenciales de supervisor incorrectas." });
        }
        
        // 2. Obtener el NumeroMultiOperacion usando el SP, tal como lo hace el código original
        const [multiOpResult] = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionId]);
        
        const suspendValue = suspend ? 1 : 0;
        
        // 3. Decidir si suspender el lote o solo la operación individual
        if (multiOpResult && multiOpResult.NumeroMultiOperacion) {
            // Si tiene multioperación, obtenemos todas las operaciones de ese lote y las actualizamos
            const operacionesDelLote = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?", [multiOpResult.NumeroMultiOperacion]);
            
            for (const op of operacionesDelLote) {
                await dbRegistracionNET("OperacionesCalipso")
                    .where({ Operacion_ID: op.Operacion_ID })
                    .update({ Suspendida: suspendValue });
            }
        } else {
            // Si no tiene multioperación, se actualiza solo a sí misma
             await dbRegistracionNET("OperacionesCalipso")
                .where({ Operacion_ID: operacionId })
                .update({ Suspendida: suspendValue });
        }
        
        const actionText = suspend ? "suspendida" : "activada";
        res.status(200).json({ message: `La operación ha sido ${actionText} exitosamente.` });

    } catch (error) {
        console.error("Error al suspender/activar operación:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};


module.exports = {
    getMaquinas,
    getOperaciones,
    procesarOperaciones,
    getDetalleOperacion,
    getCalculo_cuchillas,
    getInspeccionData,
    getFichaTecnicaProductos,
    getFichaTecnicaDetalle,
    toggleSuspensionOperacion
};