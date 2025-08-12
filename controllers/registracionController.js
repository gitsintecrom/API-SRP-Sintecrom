// /controllers/registracionController.js -- VERSIÓN FINAL Y COMPLETA

// Importamos las dos conexiones desde nuestro archivo de configuración
const { dbRegistracionNET, dbSintecromDesa } = require("../config/database");
const maquinasData = require('../data/maquinas.json');

// --- Función para obtener la lista de máquinas ---
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
        console.error("Error en getMaquinas:", error);
        res.status(500).json({ error: "No se pudieron procesar los datos de las máquinas." });
    }
};

// --- Función para obtener la lista de operaciones para la grilla principal ---

// --- Defina estas constantes en su configuración ---
const TOLERANCIA_OP_RAIZ = 0.05; // 5% (Valor supuesto de Inicial.dToleranciaOpRaiz)
const TOLERANCIA_OP_INTERMEDIA = 0.01; // 1% (Valor supuesto de Inicial.dToleranciaOpIntermedia)

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
            const tieneMultiOp = multiOpResult.length > 0;
            
            // --- Variables de Estado ---
            const isAbastecida = op.Abastecida === '0';
            const hasStock = op.Stock && parseFloat(op.Stock) > 0;
            const opAnteriorStatusText = opAnterior ? (opAnterior.Estado === '2' ? 'OK' : 'PENDIENTE') : 'OK-R';
            const opAnteriorOk = opAnteriorStatusText !== 'PENDIENTE';
            const isSuspended = op.Suspendida == 1;
            const isOpen = op.Estado === '1';

            const hasQualityCheck = calidad !== undefined; 
            const aCalidad = hasQualityCheck && calidad.Dictamen === 0;
            const aCalidadDictamen = hasQualityCheck && (calidad.Dictamen === 1 || calidad.Dictamen === 2);

            // --- LÓGICA DE TOLERANCIA (LA PIEZA QUE FALTABA) ---
            let isOutOfTolerance = false;
            const pesada = parseFloat(op.Kilos_Balanza || 0);
            const stock = parseFloat(op.Stock || 0);

            if (pesada > 0 && stock > 0) {
                const tolerancePercentage = (opAnteriorStatusText === 'OK-R') ? TOLERANCIA_OP_RAIZ : TOLERANCIA_OP_INTERMEDIA;
                let toleranceMargin = stock * tolerancePercentage;
                
                // El código VB.NET establece una tolerancia mínima de 1 kg.
                if (toleranceMargin < 1) toleranceMargin = 1;

                if (pesada > stock + toleranceMargin || pesada < stock - toleranceMargin) {
                    isOutOfTolerance = true;
                }
            }

            let status;
            let caliIcon;

            // --- Árbol de Decisión Final ---

            // 1. CONDICIÓN DE BLOQUEO (ROJO)
            if (!hasStock || !isAbastecida || !opAnteriorOk) {
                status = 'BLOQUEADA';
                caliIcon = 'rojo-fondo';
            } 
            // 2. CONDICIÓN DE SUSPENSIÓN (AZUL/BLANCO)
            else if (isSuspended) {
                status = 'SUSPENDIDA';
                caliIcon = 'blanco-fondo';
            }
            // 3. CONDICIÓN DE OPERACIÓN ABIERTA + EN CALIDAD (AMARILLO - Camino 1)
            else if (isOpen && (aCalidad || aCalidadDictamen)) {
                status = aCalidad ? 'EN_CALIDAD' : 'CALIDAD_DICTAMINADA';
                caliIcon = aCalidad ? 'rojo-icono' : 'verde-tilde-icono';
            }
            // 4. CONDICIÓN DE OPERACIÓN ABIERTA / EN PROCESO (GRIS)
            else if (isOpen || tieneMultiOp) {
                status = 'EN_PROCESO';
                caliIcon = 'gris-fondo';
            }
            // 5. CONDICIÓN DE CERRADA FUERA DE TOLERANCIA (AMARILLO - Camino 2)
            else if (isOutOfTolerance) {
                status = 'TOLERANCIA_EXCEDIDA';
                caliIcon = 'amarillo-fondo'; // Icono de advertencia/amarillo
            }
            // 6. CONDICIÓN FINAL: CERRADA, EN TOLERANCIA Y LISTA (VERDE)
            else {
                status = 'LISTA';
                caliIcon = 'verde-fondo';
            }
            
            console.log(`Op: ${op.NumeroDocumento}, Estado: ${op.Estado}, Suspendida: ${op.Suspendida}, isOutOfTolerance: ${isOutOfTolerance}, tieneMultiOp: ${tieneMultiOp} -> STATUS FINAL: ${status}`);

            const familia = op.Codigo_Producto ? op.Codigo_Producto.substring(8, 10) : '';
            const espesor = op.Codigo_Producto ? (parseFloat(op.Codigo_Producto.substring(14, 18)) / 1000).toFixed(3) : '';
            
            return { ...op, OpAnterior: opAnteriorStatusText, status, caliIcon, NumeroMultiOperacion: tieneMultiOp ? multiOpResult[0].NumeroMultiOperacion : '', Familia: familia, Espesor: espesor, Paquetes: op.CantidadPaquetes, Rollos: op.CantidadRollos };
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

// Helper de colores actualizado
function getStatusColor(status) {
    switch (status) {
        case 'BLOQUEADA':
            return '#dc3545'; // Rojo
        case 'LISTA':
            return '#28a745'; // Verde
        case 'EN_PROCESO':
            return '#6c757d'; // Gris
        case 'EN_CALIDAD':
        case 'CALIDAD_DICTAMINADA':
        case 'TOLERANCIA_EXCEDIDA': // <-- Añadido
            return '#ffc107'; // Amarillo
        case 'SUSPENDIDA':
            return '#e9ecef'; // Gris claro
        default:
            return 'transparent';
    }
}

// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) return res.status(200).json([]);
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
//             ]);

//             const opAnterior = opAnteriorResult.length > 0 ? opAnteriorResult[0] : null;
//             const tieneMultiOp = multiOpResult.length > 0;
//             let opAnteriorStatus = opAnterior ? (opAnterior.Estado === '2' ? 'OK' : 'PENDIENTE') : 'OK-R';
//             const isAbastecida = op.Abastecida === '0';
//             const hasStock = op.Stock && parseFloat(op.Stock) > 0;
            
//             // --- Lógica de Calidad Mejorada ---
//             const tieneRegistroCalidad = calidadResult.length > 0;
//             const calidadConDictamen = tieneRegistroCalidad && (calidadResult[0].Dictamen === 1 || calidadResult[0].Dictamen === 2);
//             const calidadSinDictamen = tieneRegistroCalidad && !calidadConDictamen;

//             // --- Lógica de Tolerancia (simplificada) ---
//             // En un futuro se puede añadir el cálculo exacto si es necesario
//             const toleranciaOk = true; // Por ahora asumimos que está bien

//             // --- Lógica de Status Final (replicando C#) ---
//             let status = 'DESCONOCIDO';
//             let caliIcon = 'none';

//             if (!isAbastecida || opAnteriorStatus === 'PENDIENTE' || !hasStock) {
//                 status = 'BLOQUEADA'; // Rojo
//                 caliIcon = 'rojo-fondo';
//             } else if (op.Suspendida == 1) {
//                 status = 'SUSPENDIDA'; // Azul/Gris claro
//                 caliIcon = 'blanco-fondo';
//             } else if (op.Estado == '1' && tieneRegistroCalidad) { // ESTA ES LA CONDICIÓN CLAVE PARA EL AMARILLO
//                 status = 'EN_CALIDAD'; // Amarillo
//                 caliIcon = calidadConDictamen ? 'verde-tilde-icono' : 'rojo-icono';
//             } else if (op.Estado == '1' || tieneMultiOp) {
//                 status = 'EN_PROCESO'; // Gris
//                 caliIcon = 'gris-fondo';
//             } else if (!toleranciaOk) {
//                 status = 'EN_CALIDAD'; // Amarillo por fuera de tolerancia
//                 caliIcon = 'amarillo-fondo';
//             } else {
//                 status = 'LISTA'; // Verde
//                 caliIcon = 'verde-fondo';
//             }

//             const familia = op.Codigo_Producto ? op.Codigo_Producto.substring(8, 10) : '';
//             const espesor = op.Codigo_Producto ? (parseFloat(op.Codigo_Producto.substring(14, 18)) / 1000).toFixed(3) : '';
//             return { ...op, OpAnterior: opAnteriorStatus, status, caliIcon, NumeroMultiOperacion: tieneMultiOp ? multiOpResult[0].NumeroMultiOperacion : '', Familia: familia, Espesor: espesor, Paquetes: op.CantidadPaquetes, Rollos: op.CantidadRollos };
//         }));

//         enrichedOperaciones.sort((a, b) => {
//             const dateA = a.batch_FechaInicio ? new Date(a.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
//             const dateB = b.batch_FechaInicio ? new Date(b.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
//             return dateA - dateB;
//         });

//         res.status(200).json(enrichedOperaciones);
//     } catch (error) {
//         console.error(`Error en getOperaciones:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };







// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) return res.status(200).json([]);
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//             ]);
            
//             // Enviamos los datos en bruto al frontend para que él decida el color
//             return {
//                 ...op, // Todos los campos originales
//                 OpAnteriorData: opAnteriorResult.length > 0 ? opAnteriorResult[0] : null,
//                 CalidadData: calidadResult.length > 0 ? calidadResult[0] : null,
//             };
//         }));

//         enrichedOperaciones.sort((a, b) => { /* ... sin cambios ... */ });
//         res.status(200).json(enrichedOperaciones);

//     } catch (error) {
//         console.error(`Error en getOperaciones:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };








// --- Función para obtener la lista de operaciones para la grilla principal ---
// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) return res.status(200).json([]);
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//             ]);
            
//             return {
//                 ...op,
//                 OpAnteriorData: opAnteriorResult.length > 0 ? opAnteriorResult[0] : null,
//                 CalidadData: calidadResult.length > 0 ? calidadResult[0] : null,
//             };
//         }));

//         enrichedOperaciones.sort((a, b) => {
//             const dateA = a.batch_FechaInicio ? new Date(a.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
//             const dateB = b.batch_FechaInicio ? new Date(b.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
//             return dateA - dateB;
//         });

//         res.status(200).json(enrichedOperaciones);
//     } catch (error) {
//         console.error(`Error en getOperaciones:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };








// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     console.log(`\n\n[getOperaciones] INICIO de la petición para máquina: ${maquinaId}`);

//     if (!maquinaId) {
//         console.error("[getOperaciones] ERROR: No se proporcionó maquinaId.");
//         return res.status(400).json({ error: "El ID de la máquina es requerido." });
//     }

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         console.log(`[getOperaciones] Ejecutando SP: ${spName}`);
        
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         console.log(`[getOperaciones] SP ejecutado. Se encontraron ${baseOperaciones.length} operaciones.`);

//         if (!baseOperaciones || baseOperaciones.length === 0) {
//             console.log(`[getOperaciones] FIN: No hay operaciones. Enviando array vacío.`);
//             return res.status(200).json([]);
//         }
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             // Esta parte puede ser lenta si hay muchas operaciones
//             const [opAnteriorResult, calidadResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//             ]);
            
//             return {
//                 ...op,
//                 OpAnteriorData: opAnteriorResult.length > 0 ? opAnteriorResult[0] : null,
//                 CalidadData: calidadResult.length > 0 ? calidadResult[0] : null,
//             };
//         }));

//         enrichedOperaciones.sort((a, b) => {
//             const dateA = a.batch_FechaInicio ? new Date(a.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
//             const dateB = b.batch_FechaInicio ? new Date(b.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
//             return dateA - dateB;
//         });

//         console.log(`[getOperaciones] FIN: Procesamiento completo. Enviando ${enrichedOperaciones.length} operaciones enriquecidas.`);
//         res.status(200).json(enrichedOperaciones);

//     } catch (error) {
//         console.error(`\n===== ERROR CRÍTICO en getOperaciones =====\nMáquina: ${maquinaId}\n`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };




// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) return res.status(200).json([]);
        
//         // El único cambio es que AHORA TAMBIÉN BUSCAMOS CALIDAD
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]), // <-- ESTA LÍNEA ES LA CLAVE
//             ]);
            
//             // Y la añadimos a la respuesta
//             return {
//                 ...op,
//                 OpAnteriorData: opAnteriorResult.length > 0 ? opAnteriorResult[0] : null,
//                 CalidadData: calidadResult.length > 0 ? calidadResult[0] : null, // <-- ESTA LÍNEA ES LA CLAVE
//             };
//         }));

//         // El resto de la función se mantiene igual
//         enrichedOperaciones.sort((a, b) => { /* ... tu lógica de orden ... */ });
//         res.status(200).json(enrichedOperaciones);

//     } catch (error) {
//         console.error(`Error en getOperaciones:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };





// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) return res.status(200).json([]);
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//             ]);
            
//             const isAbastecida = op.Abastecida === '0';
//             const hasStock = op.Stock && parseFloat(op.Stock) > 0;
//             const opAnteriorOk = !opAnteriorResult[0] || opAnteriorResult[0].Estado === '2';
//             const tieneRegistroCalidad = calidadResult.length > 0;
//             const isAbierta = String(op.Estado).trim() === '1';

//             let status = 'lista'; // verde por defecto
//             if (!isAbastecida || !opAnteriorOk || !hasStock) status = 'bloqueada'; // rojo
//             else if (op.Suspendida == 1) status = 'suspendida'; // gris claro
//             else if (isAbierta && tieneRegistroCalidad) status = 'en_calidad'; // amarillo
//             else if (isAbierta) status = 'en_proceso'; // gris oscuro

//             return { ...op, status };
//         }));

//         res.status(200).json(enrichedOperaciones);
//     } catch (error) {
//         console.error(`Error en getOperaciones:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };





// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) {
//         return res.status(400).json({ error: "El ID de la máquina es requerido." });
//     }

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) {
//             return res.status(200).json([]);
//         }
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
//             ]);
            
//             return {
//                 ...op,
//                 OpAnteriorData: opAnteriorResult.length > 0 ? opAnteriorResult[0] : null,
//                 CalidadData: calidadResult.length > 0 ? calidadResult[0] : null,
//                 NumeroMultiOperacion: multiOpResult.length > 0 ? multiOpResult[0].NumeroMultiOperacion : null
//             };
//         }));

//         enrichedOperaciones.sort((a, b) => {
//             const dateA = a.batch_FechaInicio ? new Date(a.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
//             const dateB = b.batch_FechaInicio ? new Date(b.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
//             return dateA - dateB;
//         });

//         res.status(200).json(enrichedOperaciones);
//     } catch (error) {
//         console.error(`Error en getOperaciones para ${maquinaId}:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };



// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) return res.status(200).json([]);
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             // Obtenemos los datos en bruto para que el frontend decida
//             const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
//             ]);
            
//             // Replicamos la lógica de C# directamente aquí en el backend
//             const isAbastecida = op.Abastecida === '0';
//             const hasStock = op.Stock && parseFloat(op.Stock) > 0;
//             const opAnteriorOk = !opAnteriorResult[0] || opAnteriorResult[0].Estado === '2';
//             const tieneRegistroCalidad = calidadResult.length > 0;
//             const isAbierta = String(op.Estado).trim() === '1';
//             const conMulti = multiOpResult.length > 0;

//             let status = 'lista'; // verde por defecto
//             if (!isAbastecida || !opAnteriorOk || !hasStock) {
//                 status = 'bloqueada'; // rojo
//             } else if (op.Suspendida == 1) {
//                 status = 'suspendida'; // gris claro
//             } else if (isAbierta && tieneRegistroCalidad) {
//                 status = 'en_calidad'; // amarillo
//             } else if (isAbierta || conMulti) { // Si está abierta O ya tiene multioperación
//                 status = 'en_proceso'; // gris oscuro
//             }

//             return { ...op, status };
//         }));

//         res.status(200).json(enrichedOperaciones);
//     } catch (error) {
//         console.error(`Error en getOperaciones:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };



// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) return res.status(200).json([]);
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
//             ]);
            
//             const isAbastecida = op.Abastecida === '0';
//             const hasStock = op.Stock && parseFloat(op.Stock) > 0;
//             const opAnteriorOk = !opAnteriorResult[0] || opAnteriorResult[0].Estado === '2';
//             const tieneRegistroCalidad = calidadResult.length > 0;
//             const isAbierta = String(op.Estado).trim() === '1';
//             const conMulti = multiOpResult.length > 0;

//             let status = 'lista';
//             if (!isAbastecida || !opAnteriorOk || !hasStock) status = 'bloqueada';
//             else if (op.Suspendida == 1) status = 'suspendida';
//             else if (isAbierta && tieneRegistroCalidad) status = 'en_calidad';
//             else if (isAbierta || conMulti) status = 'en_proceso';

//             return { 
//                 ...op, 
//                 status,
//                 NumeroMultiOperacion: conMulti ? multiOpResult[0].NumeroMultiOperacion : null
//             };
//         }));

//         res.status(200).json(enrichedOperaciones);
//     } catch (error) {
//         console.error(`Error en getOperaciones para ${maquinaId}:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };





// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) {
//         return res.status(400).json({ error: "El ID de la máquina es requerido." });
//     }

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) {
//             return res.status(200).json([]);
//         }
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
//             ]);
            
//             const isAbastecida = op.Abastecida === '0';
//             const hasStock = op.Stock && parseFloat(op.Stock) > 0;
//             const opAnteriorOk = !opAnteriorResult[0] || opAnteriorResult[0].Estado === '2';
//             const tieneRegistroCalidad = calidadResult.length > 0;
//             const isAbierta = String(op.Estado).trim() === '1';
//             const conMulti = multiOpResult.length > 0;

//             let status = 'lista';
//             if (!isAbastecida || !opAnteriorOk || !hasStock) status = 'bloqueada';
//             else if (op.Suspendida == 1) status = 'suspendida';
//             else if (isAbierta && tieneRegistroCalidad) status = 'en_calidad';
//             else if (isAbierta || conMulti) status = 'en_proceso';

//             return { 
//                 ...op, 
//                 status,
//                 NumeroMultiOperacion: conMulti ? multiOpResult[0].NumeroMultiOperacion : null
//             };
//         }));

//         res.status(200).json(enrichedOperaciones);
//     } catch (error) {
//         console.error(`Error en getOperaciones para ${maquinaId}:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };




// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) {
//         return res.status(400).json({ error: "El ID de la máquina es requerido." });
//     }

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) {
//             return res.status(200).json([]);
//         }
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
//             ]);
            
//             const isAbastecida = op.Abastecida === '0';
//             const hasStock = op.Stock && parseFloat(op.Stock) > 0;
//             const opAnteriorOk = !opAnteriorResult[0] || opAnteriorResult[0].Estado === '2';
//             const tieneRegistroCalidad = calidadResult.length > 0;
//             const isAbierta = String(op.Estado).trim() === '1';
//             const conMulti = multiOpResult.length > 0;

//             let status = 'lista';
//             if (!isAbastecida || !opAnteriorOk || !hasStock) status = 'bloqueada';
//             else if (op.Suspendida == 1) status = 'suspendida';
//             else if (isAbierta && tieneRegistroCalidad) status = 'en_calidad';
//             else if (isAbierta || conMulti) status = 'en_proceso';

//             return { 
//                 ...op, 
//                 status,
//                 NumeroMultiOperacion: conMulti ? multiOpResult[0].NumeroMultiOperacion : null
//             };
//         }));

//         res.status(200).json(enrichedOperaciones);
//     } catch (error) {
//         console.error(`Error en getOperaciones para ${maquinaId}:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };



// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) {
//         return res.status(400).json({ error: "El ID de la máquina es requerido." });
//     }

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) {
//             return res.status(200).json([]);
//         }
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
//             ]);
            
//             const isAbastecida = op.Abastecida === '0';
//             const hasStock = op.Stock && parseFloat(op.Stock) > 0;
//             const opAnteriorOk = !opAnteriorResult[0] || opAnteriorResult[0].Estado === '2';
//             const tieneRegistroCalidad = calidadResult.length > 0;
//             const isAbierta = String(op.Estado).trim() === '1';
//             const conMulti = multiOpResult.length > 0;

//             let status = 'lista';
//             if (!isAbastecida || !opAnteriorOk || !hasStock) status = 'bloqueada';
//             else if (op.Suspendida == 1) status = 'suspendida';
//             else if (isAbierta && tieneRegistroCalidad) status = 'en_calidad';
//             else if (isAbierta || conMulti) status = 'en_proceso';

//             return { 
//                 ...op, 
//                 status,
//                 NumeroMultiOperacion: conMulti ? multiOpResult[0].NumeroMultiOperacion : null
//             };
//         }));

//         res.status(200).json(enrichedOperaciones);
//     } catch (error) {
//         console.error(`Error en getOperaciones para ${maquinaId}:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };


// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         if (!baseOperaciones || baseOperaciones.length === 0) return res.status(200).json([]);
        
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             // Obtenemos los datos en bruto para que el frontend decida
//             const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
//             ]);
            
//             return {
//                 ...op, // Todos los campos originales de la operación
//                 OpAnteriorData: opAnteriorResult.length > 0 ? opAnteriorResult[0] : null,
//                 CalidadData: calidadResult.length > 0 ? calidadResult[0] : null,
//                 NumeroMultiOperacion: multiOpResult.length > 0 ? multiOpResult[0].NumeroMultiOperacion : null
//             };
//         }));

//         res.status(200).json(enrichedOperaciones);
//     } catch (error) {
//         console.error(`Error en getOperaciones para ${maquinaId}:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };






// const getOperaciones = async (req, res) => {
//     const { maquinaId } = req.params;
//     if (!maquinaId) {
//         return res.status(400).json({ error: "El ID de la máquina es requerido." });
//     }

//     try {
//         let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
//         const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        
//         if (!baseOperaciones || baseOperaciones.length === 0) {
//             return res.status(200).json([]);
//         }
        
//         // El frontend se encargará de la lógica de colores, pero le pasamos toda la información necesaria
//         const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
//             const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
//                 dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
//             ]);
            
//             // Unimos el resultado de la tabla Transacciones para tener el 'Estado' correcto
//             const [transaccion] = await dbRegistracionNET('Transacciones').where('Operacion_ID', op.Operacion_ID).select('Estado');

//             return {
//                 ...op, // Todos los campos originales de la operación
//                 Estado: transaccion ? transaccion.Estado : op.Estado, // Sobrescribimos el Estado si lo encontramos en Transacciones
//                 OpAnteriorData: opAnteriorResult.length > 0 ? opAnteriorResult[0] : null,
//                 CalidadData: calidadResult.length > 0 ? calidadResult[0] : null,
//                 NumeroMultiOperacion: multiOpResult.length > 0 ? multiOpResult[0].NumeroMultiOperacion : null
//             };
//         }));

//         res.status(200).json(enrichedOperaciones);

//     } catch (error) {
//         console.error(`Error en getOperaciones para ${maquinaId}:`, error);
//         res.status(500).json({ error: "Error interno del servidor", details: error.message });
//     }
// };



// --- Función para procesar la selección (multi-operación) ---
const procesarOperaciones = async (req, res) => {
    const { operacionesData } = req.body;
    if (!operacionesData || !Array.isArray(operacionesData) || operacionesData.length === 0) {
        return res.status(400).json({ error: "Se requiere un arreglo de datos de operaciones." });
    }

    // Todas estas operaciones son en RegistracionNET
    const transaction = await dbRegistracionNET.transaction();
    try {
        const result = await transaction.raw("EXEC SP_TraerUltimaMultiOperacion");
        const nuevaMultiOp = (result[0]?.MaxNumeroMultiOperacion || 0) + 1;
        for (const opData of operacionesData) {
            await transaction.raw("EXEC SP_InsertarMultiOperacion @Operacion_ID=?, @NumeroMultiOperacion=?", [opData.id, nuevaMultiOp]);
            await transaction.raw("EXEC SP_AbrirOperacion @Operacion_ID=?, @Nro_Batch=?", [opData.id, opData.nroBatch]);
        }
        await transaction.commit();
        res.status(200).json({ success: true, message: "Operaciones procesadas con éxito.", multiOperacionId: nuevaMultiOp });
    } catch (error) {
        await transaction.rollback();
        console.error("Error al procesar operaciones:", error);
        res.status(500).json({ error: "Fallo al procesar las operaciones.", details: error.message });
    }
};

const getDetalleOperacion = async (req, res) => {
    const { operacionId } = req.params;

    try {
        // PASO 1: Obtener la operación principal. SABEMOS QUE ESTO FUNCIONA.
        const [operacionPrincipal] = await dbRegistracionNET.raw("SELECT * FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        if (!operacionPrincipal) return res.status(404).json({ error: "Operación no encontrada." });

        // PASO 2: Obtener datos de tablas relacionadas en consultas SEPARADAS y seguras.
        const [transaccion] = await dbRegistracionNET.raw("SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
        const [stock] = await dbRegistracionNET.raw("SELECT KgsCalipso FROM Stock WHERE LOTE_ID = ?", [operacionPrincipal.Origen_Lote_ID]);

        // PASO 3: Obtener Ficha Técnica (con fallback y try-catch)
        let fichaTecnica = {};
        try {
            const fichaResultPPP = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [operacionPrincipal.Origen_Lote_ID]);
            if (fichaResultPPP && fichaResultPPP.length > 0) {
                const f = fichaResultPPP[0];
                fichaTecnica = { 
                    Familia: f.Material, Aleacion: f.Aleacion, Temple: f.Temple, 
                    Espesor: f.Espesor, PaisOrigen: f.PropioTercero, 
                    Recubrimiento: f.Cobertura, Calidad: f.Calidad, 
                    Ancho: operacionPrincipal.Operacion_TotalAncho 
                };
            }
        } catch (e) { console.warn(`ADVERTENCIA: SP de Ficha Técnica falló. Continuando. Error: ${e.message}`); }
        
        // PASO 4: Obtener Lógica de Multi-Operación
        const multiOpNumResult = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionId]);
        const numeroMultiOperacion = multiOpNumResult.length > 0 ? multiOpNumResult[0].NumeroMultiOperacion : null;
        
        const operacionesInvolucradas = numeroMultiOperacion
            ? await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?", [numeroMultiOperacion])
            : [{ Operacion_ID: operacionId }];
        
        // PASO 5: Obtener Cortes y Datos Guardados
        let lineasFinales = [];
        for (const op of operacionesInvolucradas) {
            const cortes = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesARegistrar @Operacion_ID=?", [op.Operacion_ID]);
            for (const corte of cortes) {
                const loteIdsParam = corte.Lote_IDS || '00000000-0000-0000-0000-000000000000';
                const [datosGuardados] = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?", [op.Operacion_ID, loteIdsParam, 0]);
                lineasFinales.push({
                    Ancho: (corte.OperacionS_TotalAncho || 0).toFixed(0), Cuchillas: corte.Operacion_Cuchillas,
                    Tarea: corte.TareaDestino, Destino: corte.Destino_Lote,
                    Atados: corte.CantidadPaquetes, Rollos: corte.CantidadRollos,
                    Programados: corte.KilosProgramadosS || 0, SobreOrden: datosGuardados?.Kilos_Sobreorden || 0,
                    Calidad: datosGuardados?.Kilos_Calidad || 0, TotAtados: datosGuardados?.Atados || 0,
                    TotRollos: datosGuardados?.Rollos || 0,
                });
            }
        }
        
        const lineasAgrupadas = lineasFinales.reduce((acc, linea) => {
            const key = `${linea.Ancho}-${linea.Cuchillas}-${linea.Tarea}-${linea.Destino}`;
            if (!acc[key]) { acc[key] = { ...linea }; }
            else { Object.keys(linea).forEach(key => key.match(/^(Programados|SobreOrden|Calidad|TotAtados|TotRollos)$/) && (acc[key][key] += linea[key])); }
            return acc;
        }, {});
        
        // PASO 6: Ensamblar la respuesta final con todos los datos correctos
        const header = {
            Clientes: operacionPrincipal.Clientes,
            SerieLote: operacionPrincipal.Origen_Lote, // <-- Corregido para usar el nombre correcto
            Matching: operacionPrincipal.Nro_Matching,
            Batch: operacionPrincipal.NroBatch,
            ScrapProgramado: operacionPrincipal.KilosMermaE,
            Cuchillas: operacionPrincipal.Operacion_Cuchillas,
            Pasadas: operacionPrincipal.Pasadas_Origen,
            Diametro: operacionPrincipal.Diametro,
            Corona: operacionPrincipal.CoronaE,
            Stock: stock ? stock.KgsCalipso : 0,
            KgsProgramados: operacionPrincipal.KilosProgramadosEntrantes,
            CantAtados: operacionPrincipal.CantidadPaquetes,
            CantRollos: operacionPrincipal.CantidadRollos,
            ...fichaTecnica
        };
        const lineas = Object.values(lineasAgrupadas);
        
        const balance = {
            kgsEntrantes: transaccion ? transaccion.Kilos_Balanza : 0,
            programados: header.KgsProgramados,
            sobreOrden: lineas.reduce((sum, item) => sum + item.SobreOrden, 0),
            calidad: lineas.reduce((sum, item) => sum + item.Calidad, 0),
            sobrante: 0, 
            scrap: 0,
        };
        balance.saldo = (balance.kgsEntrantes || 0) - balance.sobreOrden - balance.calidad;
        
        res.status(200).json({ header, lineas, balance });

    } catch (error) {
        console.error(`\n===== ERROR CRÍTICO FINAL =====\nID: ${operacionId}\n`, error);
        res.status(500).json({ error: "Error interno del servidor.", details: error.message });
    }
};

module.exports = {
    getMaquinas,
    getOperaciones,
    procesarOperaciones,
    getDetalleOperacion
};
