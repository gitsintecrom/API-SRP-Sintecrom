// // // /controllers/calidadController.js

// const { dbRegistracionNET } = require("../config/database");

// // // ============================================================================
// // // OBTENER DETALLE DE OPERACIÓN PARA EL MODAL DE CALIDAD (VERSIÓN INFALIBLE)
// // // ============================================================================
// // const getDetalleOperacionCalidad = async (req, res) => {
// //     const { operacionId } = req.params;
    
// //     try {
// //         console.log('🔵 [Calidad] Obteniendo detalle para Operacion_ID:', operacionId);
        
// //         // 1. Obtener datos de la operación desde la grilla principal
// //         const operacionesResult = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
// //         const operacionesArray = Array.isArray(operacionesResult) ? operacionesResult : (operacionesResult[0] || []);
        
// //         const operacionData = operacionesArray.find(op => 
// //             op.Operacion_ID === operacionId || op.Operacion_ID?.toString() === operacionId
// //         );
        
// //         if (!operacionData) {
// //             return res.status(404).json({ error: "Operación no encontrada" });
// //         }
        
// //         console.log('✅ Datos de operación:', { 
// //             Maquina: operacionData.Maquina, 
// //             Lote_IDS: operacionData.Lote_IDS,
// //             Sobrante: operacionData.Sobrante
// //         });
        
// //         const maquina = operacionData.Maquina;
// //         const loteIdCorrecto = operacionData.Lote_IDS || '';
        
// //         // 2. Obtener KilosProgramadosEntrantes
// //         let kilosProgramados = 0;
// //         try {
// //             const regResult = await dbRegistracionNET.raw(
// //                 `EXEC dbo.SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
// //                 [operacionId, loteIdCorrecto, operacionData.Sobrante || 0]
// //             );
// //             const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
// //             if (regArray.length > 0) {
// //                 kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
// //                 console.log('✅ KilosProgramadosEntrantes:', kilosProgramados);
// //             }
// //         } catch (error) {
// //             console.error('⚠️ Error al obtener registración:', error.message);
// //         }
        
// //         // 3. Obtener defectos existentes (SOLUCIÓN INFALIBLE)
// //         let defectosFiltrados = [];
// //         try {
// //             console.log('🔍 Verificando valores REALES en tabla Calidad...');
            
// //             // Obtenemos los valores REALES de Sobrante y Sobreorden del registro en Calidad
// //             const calidadCheck = await dbRegistracionNET.raw(
// //                 `SELECT TOP 1 Sobrante, Sobreorden FROM Calidad WHERE Operacion_ID = ? AND Dictamen = 0`,
// //                 [operacionId]
// //             );
            
// //             let realSobrante = operacionData.Sobrante || 0;
// //             let realSobreorden = 0;
            
// //             if (calidadCheck && calidadCheck.length > 0) {
// //                 realSobrante = calidadCheck[0].Sobrante !== null ? parseInt(calidadCheck[0].Sobrante) : 0;
// //                 realSobreorden = calidadCheck[0].Sobreorden !== null ? parseInt(calidadCheck[0].Sobreorden) : 0;
// //                 console.log(`🎯 Valores REALES en BD: Sobrante=${realSobrante}, Sobreorden=${realSobreorden}`);
// //             } else {
// //                 console.log('⚠️ No hay registros con Dictamen=0 en tabla Calidad. Usando valores de operación.');
// //             }

// //             console.log('🔍 Ejecutando SP_TraerCalidad con valores corregidos...');
// //             const spName = 'dbo.SP_TraerCalidad';
// //             const params = [operacionId, loteIdCorrecto, realSobrante, realSobreorden];
            
// //             const placeholders = params.map(() => '?').join(', ');
// //             const defectosResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
// //             const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
            
// //             console.log('📊 Total defectos del SP:', defectosArray.length);
            
// //             defectosFiltrados = defectosArray
// //                 .filter(row => parseInt(row.Dictamen) === 0)
// //                 .map(row => ({
// //                     id: row.ID || (Date.now() + Math.random()),
// //                     defecto: row.Codigo,
// //                     descripcion: row.Descripcion,
// //                     gravedad: row.Gravedad,
// //                     gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
// //                                  row.Gravedad === '1' ? '[1, Grave]' :
// //                                  row.Gravedad === '2' ? '[2, Moderado]' :
// //                                  row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
// //                     ubicacion: row.Ubicacion,
// //                     ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
// //                                   row.Ubicacion === '1' ? '[2, Centro]' :
// //                                   row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
// //                     nota: row.Nota || ''
// //                 }));
            
// //             console.log('✅ Defectos filtrados (Dictamen=0):', defectosFiltrados.length);
// //         } catch (error) {
// //             console.error('❌ Error al obtener defectos:', error.message);
// //         }
        
// //         // // 4. Construir response
// //         // const response = {
// //         //     header: {
// //         //         cliente: operacionData.Cliente || operacionData.Clientes || 'N/A',
// //         //         numeroPedido: operacionData.NumeroPedido || 'N/A',
// //         //         pasadas: operacionData.PasadasDestino || '1',
// //         //         tareaDestino: operacionData.TareaDestino || operacionData.Tarea || 'N/A',
// //         //         ancho: parseFloat(operacionData.Ancho || operacionData.Operacion_TotalAncho || operacionData.OperacionS_TotalAncho || 0),
// //         //         destinoLote: operacionData.Destino_Lote || operacionData.SerieLote || 'N/A',
// //         //         kgsProgramados: kilosProgramados,
// //         //         kgsSobreOrden: parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0),
// //         //         kgsCalidad: parseFloat(operacionData.Kilos_Calidad || 0),
// //         //         atados: parseInt(operacionData.Atados || 0),
// //         //         rollos: parseInt(operacionData.Rollos || 0)
// //         //     },
// //         //     defectos: defectosFiltrados
// //         // };







// //         // 4. Construir response
// //         const response = {
// //             header: {
// //                 cliente: operacionData.Cliente || operacionData.Clientes || 'N/A',
// //                 numeroPedido: operacionData.NumeroPedido || 'N/A',
// //                 pasadas: operacionData.PasadasDestino || '1',
// //                 tareaDestino: operacionData.TareaDestino || operacionData.Tarea || 'N/A',
// //                 ancho: parseFloat(operacionData.Ancho || operacionData.Operacion_TotalAncho || operacionData.OperacionS_TotalAncho || 0),
// //                 destinoLote: operacionData.Destino_Lote || operacionData.SerieLote || 'N/A',
// //                 kgsProgramados: kilosProgramados,
// //                 kgsSobreOrden: parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0),
// //                 kgsCalidad: parseFloat(operacionData.Kilos_Calidad || 0),
// //                 atados: parseInt(operacionData.Atados || 0),
// //                 rollos: parseInt(operacionData.Rollos || 0),
// //                 esSobreorden: realSobreorden === 1 // ✅ NUEVO: Indica si es Sobreorden (SO) para ocultar botones
// //             },
// //             defectos: defectosFiltrados
// //         };






        
        
// //         console.log('\n📤 Response final:', JSON.stringify(response, null, 2));
// //         res.status(200).json(response);
        
// //     } catch (error) {
// //         console.error("❌ Error en getDetalleOperacionCalidad:", error);
// //         res.status(500).json({ 
// //             error: error.message,
// //             details: process.env.NODE_ENV === 'development' ? error.stack : undefined
// //         });
// //     }
// // };




















// // ============================================================================
// // OBTENER DETALLE DE OPERACIÓN PARA EL MODAL DE CALIDAD (VERSIÓN CORREGIDA)
// // ============================================================================
// // const getDetalleOperacionCalidad = async (req, res) => {
// //     const { operacionId } = req.params;
    
// //     try {
// //         console.log('🔵 [Calidad] Obteniendo detalle para Operacion_ID:', operacionId);
        
// //         // 1. Obtener datos de la operación desde la grilla principal
// //         const operacionesResult = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
// //         const operacionesArray = Array.isArray(operacionesResult) ? operacionesResult : (operacionesResult[0] || []);
        
// //         const operacionData = operacionesArray.find(op => 
// //             op.Operacion_ID === operacionId || op.Operacion_ID?.toString() === operacionId
// //         );
        
// //         if (!operacionData) {
// //             return res.status(404).json({ error: "Operación no encontrada" });
// //         }
        
// //         console.log('✅ Datos de operación:', { 
// //             Maquina: operacionData.Maquina, 
// //             Lote_IDS: operacionData.Lote_IDS,
// //             Sobrante: operacionData.Sobrante
// //         });
        
// //         const maquina = operacionData.Maquina;
// //         const loteIdCorrecto = operacionData.Lote_IDS || '';
        
// //         // 2. Obtener KilosProgramadosEntrantes
// //         let kilosProgramados = 0;
// //         try {
// //             const regResult = await dbRegistracionNET.raw(
// //                 `EXEC dbo.SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
// //                 [operacionId, loteIdCorrecto, operacionData.Sobrante || 0]
// //             );
// //             const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
// //             if (regArray.length > 0) {
// //                 kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
// //                 console.log('✅ KilosProgramadosEntrantes:', kilosProgramados);
// //             }
// //         } catch (error) {
// //             console.error('⚠️ Error al obtener registración:', error.message);
// //         }
        
// //         // 3. Obtener defectos existentes
// //         let defectosFiltrados = [];
        
// //         // ✅ CORRECCIÓN CLAVE: Declarar estas variables FUERA del try para que sean accesibles al construir el response
// //         let realSobrante = operacionData.Sobrante || 0;
// //         let realSobreorden = 0;
        
// //         try {
// //             console.log('🔍 Verificando valores REALES en tabla Calidad...');
            
// //             const calidadCheck = await dbRegistracionNET.raw(
// //                 `SELECT TOP 1 Sobrante, Sobreorden FROM Calidad WHERE Operacion_ID = ? AND Dictamen = 0`,
// //                 [operacionId]
// //             );
            
// //             if (calidadCheck && calidadCheck.length > 0) {
// //                 realSobrante = calidadCheck[0].Sobrante !== null ? parseInt(calidadCheck[0].Sobrante) : 0;
// //                 realSobreorden = calidadCheck[0].Sobreorden !== null ? parseInt(calidadCheck[0].Sobreorden) : 0;
// //                 console.log(`🎯 Valores REALES en BD: Sobrante=${realSobrante}, Sobreorden=${realSobreorden}`);
// //             } else {
// //                 console.log('⚠️ No hay registros con Dictamen=0 en tabla Calidad. Usando valores de operación.');
// //             }

// //             console.log('🔍 Ejecutando SP_TraerCalidad con valores corregidos...');
// //             const spName = 'dbo.SP_TraerCalidad';
// //             const params = [operacionId, loteIdCorrecto, realSobrante, realSobreorden];
            
// //             const placeholders = params.map(() => '?').join(', ');
// //             const defectosResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
// //             const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
            
// //             console.log('📊 Total defectos del SP:', defectosArray.length);
            
// //             defectosFiltrados = defectosArray
// //                 .filter(row => parseInt(row.Dictamen) === 0)
// //                 .map(row => ({
// //                     id: row.ID || (Date.now() + Math.random()),
// //                     defecto: row.Codigo,
// //                     descripcion: row.Descripcion,
// //                     gravedad: row.Gravedad,
// //                     gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
// //                                  row.Gravedad === '1' ? '[1, Grave]' :
// //                                  row.Gravedad === '2' ? '[2, Moderado]' :
// //                                  row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
// //                     ubicacion: row.Ubicacion,
// //                     ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
// //                                   row.Ubicacion === '1' ? '[2, Centro]' :
// //                                   row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
// //                     nota: row.Nota || ''
// //                 }));
            
// //             console.log('✅ Defectos filtrados (Dictamen=0):', defectosFiltrados.length);
// //         } catch (error) {
// //             console.error('❌ Error al obtener defectos:', error.message);
// //         }

// //         // 4. Construir response
// //         const response = {
// //             header: {
// //                 cliente: operacionData.Cliente || operacionData.Clientes || 'N/A',
// //                 numeroPedido: operacionData.NumeroPedido || 'N/A',
// //                 pasadas: operacionData.PasadasDestino || '1',
// //                 tareaDestino: operacionData.TareaDestino || operacionData.Tarea || 'N/A',
// //                 ancho: parseFloat(operacionData.Ancho || operacionData.Operacion_TotalAncho || operacionData.OperacionS_TotalAncho || 0),
// //                 destinoLote: operacionData.Destino_Lote || operacionData.SerieLote || 'N/A',
// //                 kgsProgramados: kilosProgramados,
// //                 kgsSobreOrden: parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0),
// //                 kgsCalidad: parseFloat(operacionData.Kilos_Calidad || 0),
// //                 atados: parseInt(operacionData.Atados || 0),
// //                 rollos: parseInt(operacionData.Rollos || 0),
// //                 esSobreorden: realSobreorden === 1 // ✅ Ahora sí funciona porque la variable está en el scope correcto
// //             },
// //             defectos: defectosFiltrados
// //         };
        
// //         console.log('\n📤 Response final:', JSON.stringify(response, null, 2));
// //         res.status(200).json(response);
        
// //     } catch (error) {
// //         console.error("❌ Error en getDetalleOperacionCalidad:", error);
// //         res.status(500).json({ 
// //             error: error.message,
// //             details: process.env.NODE_ENV === 'development' ? error.stack : undefined
// //         });
// //     }
// // };

























// const getDetalleOperacionCalidad = async (req, res) => {
//     const { operacionId } = req.params;
    
//     try {
//         console.log('🔵 [Calidad] Obteniendo detalle para Operacion_ID:', operacionId);
        
//         const operacionesResult = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
//         const operacionesArray = Array.isArray(operacionesResult) ? operacionesResult : (operacionesResult[0] || []);
        
//         const operacionData = operacionesArray.find(op => 
//             op.Operacion_ID === operacionId || op.Operacion_ID?.toString() === operacionId
//         );
        
//         if (!operacionData) {
//             return res.status(404).json({ error: "Operación no encontrada" });
//         }
        
//         console.log('✅ Datos de operación:', { 
//             Maquina: operacionData.Maquina, 
//             Lote_IDS: operacionData.Lote_IDS,
//             Sobrante: operacionData.Sobrante
//         });
        
//         const maquina = operacionData.Maquina;
//         const loteIdCorrecto = operacionData.Lote_IDS || '';
        
//         let kilosProgramados = 0;
//         try {
//             const regResult = await dbRegistracionNET.raw(
//                 `EXEC dbo.SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
//                 [operacionId, loteIdCorrecto, operacionData.Sobrante || 0]
//             );
//             const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
//             if (regArray.length > 0) {
//                 kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
//                 console.log('✅ KilosProgramadosEntrantes:', kilosProgramados);
//             }
//         } catch (error) {
//             console.error('⚠️ Error al obtener registración:', error.message);
//         }
        
//         let defectosFiltrados = [];
//         let realSobrante = operacionData.Sobrante || 0;
//         let realSobreorden = 0;
        
//         try {
//             console.log('🔍 Verificando valores REALES en tabla Calidad...');
//             const calidadCheck = await dbRegistracionNET.raw(
//                 `SELECT TOP 1 Sobrante, Sobreorden FROM Calidad WHERE Operacion_ID = ? AND Dictamen = 0`,
//                 [operacionId]
//             );
            
//             if (calidadCheck && calidadCheck.length > 0) {
//                 realSobrante = calidadCheck[0].Sobrante !== null ? parseInt(calidadCheck[0].Sobrante) : 0;
//                 realSobreorden = calidadCheck[0].Sobreorden !== null ? parseInt(calidadCheck[0].Sobreorden) : 0;
//                 console.log(`🎯 Valores REALES en BD: Sobrante=${realSobrante}, Sobreorden=${realSobreorden}`);
//             } else {
//                 console.log('⚠️ No hay registros con Dictamen=0 en tabla Calidad. Usando valores de operación.');
//             }

//             console.log('🔍 Ejecutando SP_TraerCalidad con valores corregidos...');
//             const spName = 'dbo.SP_TraerCalidad';
//             const params = [operacionId, loteIdCorrecto, realSobrante, realSobreorden];
            
//             const placeholders = params.map(() => '?').join(', ');
//             const defectosResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
//             const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
            
//             console.log('📊 Total defectos del SP:', defectosArray.length);
            
//             defectosFiltrados = defectosArray
//                 .filter(row => parseInt(row.Dictamen) === 0)
//                 .map(row => ({
//                     id: row.ID || (Date.now() + Math.random()),
//                     defecto: row.Codigo,
//                     descripcion: row.Descripcion,
//                     gravedad: row.Gravedad,
//                     gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
//                                  row.Gravedad === '1' ? '[1, Grave]' :
//                                  row.Gravedad === '2' ? '[2, Moderado]' :
//                                  row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
//                     ubicacion: row.Ubicacion,
//                     ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
//                                   row.Ubicacion === '1' ? '[2, Centro]' :
//                                   row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
//                     nota: row.Nota || ''
//                 }));
            
//             console.log('✅ Defectos filtrados (Dictamen=0):', defectosFiltrados.length);
//         } catch (error) {
//             console.error('❌ Error al obtener defectos:', error.message);
//         }

//         const response = {
//             header: {
//                 cliente: operacionData.Cliente || operacionData.Clientes || 'N/A',
//                 numeroPedido: operacionData.NumeroPedido || 'N/A',
//                 pasadas: operacionData.PasadasDestino || '1',
//                 tareaDestino: operacionData.TareaDestino || operacionData.Tarea || 'N/A',
//                 ancho: parseFloat(operacionData.Ancho || operacionData.Operacion_TotalAncho || operacionData.OperacionS_TotalAncho || 0),
//                 destinoLote: operacionData.Destino_Lote || operacionData.SerieLote || 'N/A',
//                 kgsProgramados: kilosProgramados,
//                 kgsSobreOrden: parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0),
//                 kgsCalidad: parseFloat(operacionData.Kilos_Calidad || 0),
//                 atados: parseInt(operacionData.Atados || 0),
//                 rollos: parseInt(operacionData.Rollos || 0),
//                 esSobreorden: realSobreorden === 1
//             },
//             defectos: defectosFiltrados
//         };
        
//         console.log('\n📤 Response final:', JSON.stringify(response, null, 2));
//         res.status(200).json(response);
        
//     } catch (error) {
//         console.error("❌ Error en getDetalleOperacionCalidad:", error);
//         res.status(500).json({ 
//             error: error.message,
//             details: process.env.NODE_ENV === 'development' ? error.stack : undefined
//         });
//     }
// };










// // ============================================================================
// // OBTENER OPERACIONES PENDIENTES DE CALIDAD (GRILLA PRINCIPAL)
// // ============================================================================
// const getOperacionesPendientesCalidad = async (req, res) => {
//     try {
//         const { maquina, verDefectosSobreorden } = req.query;
//         console.log('🔵 Params calidad:', { maquina, verDefectosSobreorden });
        
//         const result = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
//         let operaciones = Array.isArray(result) ? result : (result[0] || []);
        
//         if (maquina && maquina !== 'TODAS') {
//             operaciones = operaciones.filter(op => op.Maquina === maquina);
//         }
        
//         const operacionesFiltradas = [];
//         const sobreordenVal = verDefectosSobreorden === 'true' ? 1 : 0;
        
//         for (const op of operaciones) {
//             let spName = '';
//             let params = [];
            
//             if (op.Maquina === 'PL1' || op.Maquina === 'PL2' || op.Maquina === 'PL3' || op.Maquina === 'EMB') {
//                 spName = 'dbo.SP_TraerCalidadPlanchaT';
//                 params = [op.Operacion_ID, op.ItemPedido_ID || op.Origen_Lote_ID || '', op.Sobrante || 0, sobreordenVal, op.Lote_IDS || op.ID_LotePlancha || ''];
//             } else if (op.Maquina === 'HOR') {
//                 spName = 'dbo.SP_TraerCalidadHorno';
//                 params = [op.Operacion_ID, op.Lote_IDS || '', 0];
//             } else {
//                 spName = 'dbo.SP_TraerCalidad';
//                 params = [op.Operacion_ID, op.Lote_IDS || '', op.Sobrante || 0, sobreordenVal];
//             }
            
//             try {
//                 const placeholders = params.map(() => '?').join(', ');
//                 const spResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
//                 const spData = Array.isArray(spResult) ? spResult : (spResult[0] || []);
                
//                 const operacionConCalidad = spData.find(row => parseInt(row.Dictamen) === 0);
//                 if (operacionConCalidad) {
//                     operacionesFiltradas.push({ ...op, ...operacionConCalidad, Sobreorden: sobreordenVal.toString() });
//                 }
//             } catch (spError) {
//                 console.error(` Error ejecutando ${spName}:`, spError.message);
//             }
//         }
        
//         // ✅ LÓGICA EXACTA DEL VB.NET (Cargo_Grilla_Dato)
//         const operacionesFormateadas = operacionesFiltradas.map(op => {
//             const maquina = op.Maquina;
//             const sobrante = parseInt(op.Sobrante || 0);
//             const esPlancha = (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB');
            
//             // Valores originales del SP
//             let kilosCalidad = parseFloat(op.Kilos_Calidad || 0);
//             let kilosSobreOrden = parseFloat(op.Kilos_Sobreorden || op.Kilos_SobreOrden || 0);
//             let kilosBrutos = parseFloat(op.KilosBrutos || 0);
            
//             // ✅ Regla VB.NET: Si es PL1/PL2/PL3/EMB y Sobrante=0, intercambiar valores
//             if (esPlancha && sobrante === 0) {
//                 kilosCalidad = kilosSobreOrden;  // Kilos_Calidad toma el valor de Kilos_SobreOrden
//                 kilosSobreOrden = 0;             // Kilos_SobreOrden se pone en 0
//             }
            
//             // ✅ Regla VB.NET: Si NO es PL1/PL2/PL3/EMB, KilosBrutos = 0
//             if (!esPlancha) {
//                 kilosBrutos = 0;
//             }
            
//             return {
//                 Maquina: op.Maquina,
//                 Tarea: op.Tarea,
//                 NroBatch: op.NroBatch,
//                 Cuchillas: op.Operacion_Cuchillas,
//                 SerieLote: op.Destino_Lote || op.SerieLote,
//                 NroOperacion: op.Nro_Operacion || op.Nro_Matching || '0',
//                 Kilos_Calidad: kilosCalidad,       // ✅ Valor corregido
//                 Kilos_Sobreorden: kilosSobreOrden, // ✅ Valor corregido
//                 Kilos_Bruto: kilosBrutos,          // ✅ Valor corregido
//                 Tipo: op.Leyenda || (op.Sobrante == 1 ? 'Sobrante' : op.Sobrante == 2 ? 'Scrap' : 'SO'),
//                 Lote_IDS: op.Lote_IDS,
//                 Sobrante: sobrante,
//                 Operacion_ID: op.Operacion_ID,
//                 Codigo_Producto: op.Codigo_Producto
//             };
//         });
        
//         res.status(200).json(operacionesFormateadas);
//     } catch (error) {
//         console.error("❌ Error en getOperacionesPendientesCalidad:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // ============================================================================
// // OBTENER DEFECTOS DISPONIBLES (COMBO)
// // ============================================================================
// const getDefectos = async (req, res) => {
//     const { familia } = req.query;
//     try {
//         const result = await dbRegistracionNET.raw(`EXEC dbo.SP_TraerDefectos @Familia=?`, [familia || '']);
//         const dataArray = Array.isArray(result) ? result : (result[0] || []);
//         res.status(200).json(dataArray);
//     } catch (error) {
//         console.error("❌ Error en getDefectos:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // ============================================================================
// // GUARDAR REGISTRO DE CALIDAD
// // ============================================================================
// const guardarCalidad = async (req, res) => {
//     const { operacionId, loteIds, familia, codigo, gravedad, ubicacion, nota, usuario, sobrante, sobreorden } = req.body;
//     const transaction = await dbRegistracionNET.transaction();
    
//     try {
//         const fechaReg = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
//         const [opInfo] = await transaction.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
//         const maquina = opInfo?.Maquina || 'SL1';
        
//         if (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB') {
//             await transaction.raw(`EXEC dbo.SP_InsertarCalidadPlancha @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?`,
//                 [operacionId, familia, codigo, gravedad, ubicacion, nota, loteIds, sobrante || 0, '', 0, '', sobreorden || 0, loteIds, usuario || 'admin', fechaReg]);
//         } else if (maquina === 'HOR') {
//             await transaction.raw(`EXEC dbo.SP_InsertarCalidadHornos @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Horno=?, @Horneada=?, @KilosHorneada=?, @Usuario=?, @FechaReg=?`,
//                 [operacionId, '', familia, codigo, gravedad, ubicacion, nota, loteIds, loteIds, 0, 0, 0, 0, 0, usuario || 'admin', fechaReg]);
//         } else {
//             await transaction.raw(`EXEC dbo.SP_InsertarCalidad @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Usuario=?, @FechaReg=?`,
//                 [operacionId, '', familia, codigo, gravedad, ubicacion, nota, loteIds, loteIds, sobrante || 0, sobreorden || 0, usuario || 'admin', fechaReg]);
//         }

//         await transaction.commit();
//         res.status(200).json({ success: true, message: "Calidad registrada correctamente" });
//     } catch (error) {
//         await transaction.rollback();
//         console.error("❌ Error en guardarCalidad:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // ============================================================================
// // ACTUALIZAR DICTAMEN (APROBADO/RECHAZADO)
// // ============================================================================
// const actualizarDictamen = async (req, res) => {
//     const { operacionId, loteIds, dictamen, notaCalidad, retornaStock } = req.body;
//     const transaction = await dbRegistracionNET.transaction();
    
//     try {
//         await transaction.raw(`EXEC SP_EditarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @NotaCalidad=?, @Dictamen=?`, [operacionId, loteIds, 0, notaCalidad || '', dictamen]);

//         if (dictamen === 2 && retornaStock) {
//             await transaction.raw(`UPDATE OperacionesCalipso SET RetornaStock = 'M' WHERE Operacion_ID = ?`, [operacionId]);
//         }

//         await transaction.commit();
//         res.status(200).json({ success: true, message: "Dictamen actualizado correctamente" });
//     } catch (error) {
//         await transaction.rollback();
//         console.error("❌ Error en actualizarDictamen:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

// module.exports = {
//     getDetalleOperacionCalidad,      // ✅ NUEVA FUNCIÓN PARA EL MODAL
//     getOperacionesPendientesCalidad,
//     getDefectos,
//     guardarCalidad,
//     actualizarDictamen
// };








































// /controllers/calidadController.js
const { dbRegistracionNET } = require("../config/database");

// ============================================================================
// OBTENER DETALLE DE OPERACIÓN PARA EL MODAL DE CALIDAD (DISCRIMINADO POR MÁQUINA)
// ============================================================================
const getDetalleOperacionCalidad = async (req, res) => {
    const { operacionId } = req.params;
    try {
        console.log('🔵 [Calidad] Obteniendo detalle para Operacion_ID:', operacionId);
        
        const operacionesResult = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
        const operacionesArray = Array.isArray(operacionesResult) ? operacionesResult : (operacionesResult[0] || []);
        const operacionData = operacionesArray.find(op => 
            op.Operacion_ID === operacionId || op.Operacion_ID?.toString() === operacionId
        );
        
        if (!operacionData) {
            return res.status(404).json({ error: "Operación no encontrada" });
        }
        
        const maquina = operacionData.Maquina;
        const loteIdCorrecto = operacionData.Lote_IDS || '';
        const itemPedidoId = operacionData.ItemPedido_ID || '';
        
        console.log('✅ Datos de operación:', { Maquina: maquina, Lote_IDS: loteIdCorrecto, Sobrante: operacionData.Sobrante });
        
        // Detectar tipo de máquina
        let tipoMaquina = 'SLITTER';
        if (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB') {
            tipoMaquina = 'PLANCHAS';
        } else if (maquina === 'HOR') {
            tipoMaquina = 'HORNOS';
        }
        
        console.log('🏭 Tipo de máquina detectado:', tipoMaquina);
        
        let kilosProgramados = 0;
        let defectosFiltrados = [];
        let headerData = {};
        
        // ========================================================================
        // PLANCHAS (PL1, PL2, PL3, EMB)
        // ========================================================================
        if (tipoMaquina === 'PLANCHAS') {
            console.log('📋 Procesando PLANCHAS...');
            
            // Obtener datos de Calipso (Cliente, Ancho, Largo)
            try {
                const calipsoResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesCalipsoPorPedido @Operacion_ID=?, @ID_LotePlancha=?`,
                    [operacionId, loteIdCorrecto]
                );
                const calipsoArray = Array.isArray(calipsoResult) ? calipsoResult : (calipsoResult[0] || []);
                if (calipsoArray.length > 0) {
                    const calipso = calipsoArray[0];
                    headerData.cliente = calipso.ClientePedido || 'N/A';
                    headerData.numeroPedido = calipso.NumeroPedido || 'N/A';
                    headerData.ancho = parseFloat(calipso.Operacion_TotalAncho || 0);
                    headerData.largo = parseFloat(calipso.Largo || 0);
                    headerData.numeroItem = calipso.NumeroItem || 0;
                }
            } catch (error) {
                console.error('⚠️ Error al obtener Calipso Por Pedido:', error.message);
            }
            
            // Obtener KilosProgramados
            try {
                const regResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesRegistradasPlanchaT @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @ID_LotePlancha=?`,
                    [operacionId, itemPedidoId, operacionData.Sobrante || 0, loteIdCorrecto]
                );
                const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
                if (regArray.length > 0) {
                    kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
                }
            } catch (error) {
                console.error('⚠️ Error al obtener registración plancha:', error.message);
            }
            
            // Obtener defectos existentes
            let realSobrante = operacionData.Sobrante || 0;
            let realSobreorden = 0;
            try {
                const calidadCheck = await dbRegistracionNET.raw(
                    `SELECT TOP 1 Sobrante, Sobreorden FROM Calidad WHERE Operacion_ID = ? AND Dictamen = 0`,
                    [operacionId]
                );
                if (calidadCheck && calidadCheck.length > 0) {
                    realSobrante = calidadCheck[0].Sobrante !== null ? parseInt(calidadCheck[0].Sobrante) : 0;
                    realSobreorden = calidadCheck[0].Sobreorden !== null ? parseInt(calidadCheck[0].Sobreorden) : 0;
                }
                
                const params = [operacionId, itemPedidoId, realSobrante, realSobreorden, loteIdCorrecto];
                const placeholders = params.map(() => '?').join(', ');
                const defectosResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerCalidadPlanchaT ${placeholders}`, params
                );
                const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
                
                defectosFiltrados = defectosArray
                    .filter(row => parseInt(row.Dictamen) === 0)
                    .map(row => ({
                        id: row.ID || (Date.now() + Math.random()),
                        defecto: row.Codigo,
                        descripcion: row.Descripcion,
                        gravedad: row.Gravedad,
                        gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
                                     row.Gravedad === '1' ? '[1, Grave]' :
                                     row.Gravedad === '2' ? '[2, Moderado]' :
                                     row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
                        ubicacion: row.Ubicacion,
                        ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
                                      row.Ubicacion === '1' ? '[2, Centro]' :
                                      row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
                        nota: row.Nota || ''
                    }));
            } catch (error) {
                console.error('❌ Error al obtener defectos plancha:', error.message);
            }
            
            headerData.destinoLote = operacionData.Destino_Lote || 'N/A';
            headerData.kgsProgramados = kilosProgramados;
            headerData.kgsSobreOrden = parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0);
            headerData.kgsCalidad = parseFloat(operacionData.Kilos_Calidad || 0);
        }
        
        // ========================================================================
        // HORNOS (HOR)
        // ========================================================================
        else if (tipoMaquina === 'HORNOS') {
            console.log('🔥 Procesando HORNOS...');
            
            // Obtener datos de Calipso (Cliente, Pasadas, Ancho, Tarea Destino)
            try {
                const calipsoResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesCalipso @Operacion_ID=?, @Lote_IDS=?`,
                    [operacionId, loteIdCorrecto]
                );
                const calipsoArray = Array.isArray(calipsoResult) ? calipsoResult : (calipsoResult[0] || []);
                if (calipsoArray.length > 0) {
                    const calipso = calipsoArray[0];
                    headerData.cliente = calipso.Clientes || 'N/A';
                    headerData.numeroPedido = calipso.NumeroPedido || 'N/A';
                    headerData.pasadas = calipso.PasadasDestino || 'N/A';
                    headerData.ancho = parseFloat(calipso.OperacionS_TotalAncho || 0);
                    headerData.tareaDestino = calipso.TareaDestino || 'N/A';
                }
            } catch (error) {
                console.error('⚠️ Error al obtener Calipso Hornos:', error.message);
            }
            
            // Obtener KilosProgramados
            try {
                const regResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesRegistradasHornos @Operacion_ID=?`,
                    [operacionId]
                );
                const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
                if (regArray.length > 0) {
                    kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
                }
            } catch (error) {
                console.error('⚠️ Error al obtener registración hornos:', error.message);
            }
            
            // Obtener defectos existentes
            try {
                const params = [operacionId, loteIdCorrecto, 0];
                const placeholders = params.map(() => '?').join(', ');
                const defectosResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerCalidadHorno ${placeholders}`, params
                );
                const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
                
                defectosFiltrados = defectosArray
                    .filter(row => parseInt(row.Dictamen) === 0)
                    .map(row => ({
                        id: row.ID || (Date.now() + Math.random()),
                        defecto: row.Codigo,
                        descripcion: row.Descripcion,
                        gravedad: row.Gravedad,
                        gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
                                     row.Gravedad === '1' ? '[1, Grave]' :
                                     row.Gravedad === '2' ? '[2, Moderado]' :
                                     row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
                        ubicacion: row.Ubicacion,
                        ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
                                      row.Ubicacion === '1' ? '[2, Centro]' :
                                      row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
                        nota: row.Nota || ''
                    }));
            } catch (error) {
                console.error('❌ Error al obtener defectos hornos:', error.message);
            }
            
            headerData.destinoLote = operacionData.Destino_Lote || 'N/A';
            headerData.kgsProgramados = kilosProgramados;
            headerData.kgsSobreOrden = parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0);
            headerData.kgsCalidad = parseFloat(operacionData.Kilos_Calidad || 0);
        }
        
        // ========================================================================
        // SLITTER (SL1, SL2, SL3, PINT)
        // ========================================================================
        else {
            console.log('✂️ Procesando SLITTER...');
            
            // Obtener datos de Calipso (Cliente, Pasadas, Ancho, Tarea Destino)
            try {
                const calipsoResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesCalipso @Operacion_ID=?, @Lote_IDS=?`,
                    [operacionId, loteIdCorrecto]
                );
                const calipsoArray = Array.isArray(calipsoResult) ? calipsoResult : (calipsoResult[0] || []);
                if (calipsoArray.length > 0) {
                    const calipso = calipsoArray[0];
                    headerData.cliente = calipso.Clientes || 'N/A';
                    headerData.numeroPedido = calipso.NumeroPedido || 'N/A';
                    headerData.pasadas = calipso.PasadasDestino || 'N/A';
                    headerData.ancho = parseFloat(calipso.OperacionS_TotalAncho || 0);
                    headerData.tareaDestino = calipso.TareaDestino || 'N/A';
                }
            } catch (error) {
                console.error('⚠️ Error al obtener Calipso Slitter:', error.message);
            }
            
            // Obtener KilosProgramados
            try {
                const regResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
                    [operacionId, loteIdCorrecto, operacionData.Sobrante || 0]
                );
                const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
                if (regArray.length > 0) {
                    kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
                }
            } catch (error) {
                console.error('⚠️ Error al obtener registración slitter:', error.message);
            }
            
            // Obtener defectos existentes
            let realSobrante = operacionData.Sobrante || 0;
            let realSobreorden = 0;
            try {
                const calidadCheck = await dbRegistracionNET.raw(
                    `SELECT TOP 1 Sobrante, Sobreorden FROM Calidad WHERE Operacion_ID = ? AND Dictamen = 0`,
                    [operacionId]
                );
                if (calidadCheck && calidadCheck.length > 0) {
                    realSobrante = calidadCheck[0].Sobrante !== null ? parseInt(calidadCheck[0].Sobrante) : 0;
                    realSobreorden = calidadCheck[0].Sobreorden !== null ? parseInt(calidadCheck[0].Sobreorden) : 0;
                }
                
                const params = [operacionId, loteIdCorrecto, realSobrante, realSobreorden];
                const placeholders = params.map(() => '?').join(', ');
                const defectosResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerCalidad ${placeholders}`, params
                );
                const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
                
                defectosFiltrados = defectosArray
                    .filter(row => parseInt(row.Dictamen) === 0)
                    .map(row => ({
                        id: row.ID || (Date.now() + Math.random()),
                        defecto: row.Codigo,
                        descripcion: row.Descripcion,
                        gravedad: row.Gravedad,
                        gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
                                     row.Gravedad === '1' ? '[1, Grave]' :
                                     row.Gravedad === '2' ? '[2, Moderado]' :
                                     row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
                        ubicacion: row.Ubicacion,
                        ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
                                      row.Ubicacion === '1' ? '[2, Centro]' :
                                      row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
                        nota: row.Nota || ''
                    }));
            } catch (error) {
                console.error('❌ Error al obtener defectos slitter:', error.message);
            }
            
            headerData.destinoLote = operacionData.Destino_Lote || 'N/A';
            headerData.kgsProgramados = kilosProgramados;
            headerData.kgsSobreOrden = parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0);
            headerData.kgsCalidad = parseFloat(operacionData.Kilos_Calidad || 0);
        }
        
        const response = {
            tipoMaquina: tipoMaquina,
            maquina: maquina,
            header: headerData,
            defectos: defectosFiltrados
        };
        
        console.log('\n📤 Response final:', JSON.stringify(response, null, 2));
        res.status(200).json(response);
    } catch (error) {
        console.error("❌ Error en getDetalleOperacionCalidad:", error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// // ============================================================================
// // OBTENER OPERACIONES PENDIENTES DE CALIDAD (GRILLA PRINCIPAL)
// // ✅ Incluye la columna Planta agregada al SP_TraerOperacionesCalidad (2026-10-21)
// // ============================================================================
// const getOperacionesPendientesCalidad = async (req, res) => {
//     try {
//         const { maquina, verDefectosSobreorden } = req.query;
//         console.log('🔵 Params calidad:', { maquina, verDefectosSobreorden });

//         const result = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
//         let operaciones = Array.isArray(result) ? result : (result[0] || []);

//         if (maquina && maquina !== 'TODAS') {
//             operaciones = operaciones.filter(op => op.Maquina === maquina);
//         }

//         const operacionesFiltradas = [];
//         const sobreordenVal = verDefectosSobreorden === 'true' ? 1 : 0;

//         for (const op of operaciones) {
//             let spName = '';
//             let params = [];

//             if (op.Maquina === 'PL1' || op.Maquina === 'PL2' || op.Maquina === 'PL3' || op.Maquina === 'EMB') {
//                 spName = 'dbo.SP_TraerCalidadPlanchaT';
//                 params = [op.Operacion_ID, op.ItemPedido_ID || op.Origen_Lote_ID || '', op.Sobrante || 0, sobreordenVal, op.Lote_IDS || op.ID_LotePlancha || ''];
//             } else if (op.Maquina === 'HOR') {
//                 spName = 'dbo.SP_TraerCalidadHorno';
//                 params = [op.Operacion_ID, op.Lote_IDS || '', 0];
//             } else {
//                 spName = 'dbo.SP_TraerCalidad';
//                 params = [op.Operacion_ID, op.Lote_IDS || '', op.Sobrante || 0, sobreordenVal];
//             }

//             try {
//                 const placeholders = params.map(() => '?').join(', ');
//                 const spResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
//                 const spData = Array.isArray(spResult) ? spResult : (spResult[0] || []);
//                 const operacionConCalidad = spData.find(row => parseInt(row.Dictamen) === 0);

//                 if (operacionConCalidad) {
//                     // ✅✅ Planta se fija DESPUÉS del spread: los SPs de defectos no la traen
//                     //    y no queremos que un undefined la pise.
//                     operacionesFiltradas.push({
//                         ...op,
//                         ...operacionConCalidad,
//                         Planta: op.Planta || '',
//                         Sobreorden: sobreordenVal.toString()
//                     });
//                 }
//             } catch (spError) {
//                 console.error(`Error ejecutando ${spName}:`, spError.message);
//             }
//         }

//         const operacionesFormateadas = operacionesFiltradas.map(op => {
//             const maquina = op.Maquina;
//             const sobrante = parseInt(op.Sobrante || 0);
//             const esPlancha = (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB');

//             let kilosCalidad = parseFloat(op.Kilos_Calidad || 0);
//             let kilosSobreOrden = parseFloat(op.Kilos_Sobreorden || op.Kilos_SobreOrden || 0);
//             let kilosBrutos = parseFloat(op.KilosBrutos || 0);

//             if (esPlancha && sobrante === 0) {
//                 kilosCalidad = kilosSobreOrden;
//                 kilosSobreOrden = 0;
//             }

//             if (!esPlancha) {
//                 kilosBrutos = 0;
//             }

//             return {
//                 Maquina: op.Maquina,
//                 Tarea: op.Tarea,
//                 NroBatch: op.NroBatch,
//                 Cuchillas: op.Operacion_Cuchillas,
//                 SerieLote: op.Destino_Lote || op.SerieLote,
//                 NroOperacion: op.Nro_Operacion || op.Nro_Matching || '0',
//                 Kilos_Calidad: kilosCalidad,
//                 Kilos_Sobreorden: kilosSobreOrden,
//                 Kilos_Bruto: kilosBrutos,
//                 Tipo: op.Leyenda || (op.Sobrante == 1 ? 'Sobrante' : op.Sobrante == 2 ? 'Scrap' : 'SO'),
//                 Lote_IDS: op.Lote_IDS,
//                 Sobrante: sobrante,
//                 Operacion_ID: op.Operacion_ID,
//                 Codigo_Producto: op.Codigo_Producto,
//                 Planta: op.Planta || ''   // ✅ NUEVO: 'Spegazzini' / 'Valentín Alsina' (SP 2026-10-21)
//             };
//         });

//         console.log(`🏭 Pendientes calidad: ${operacionesFormateadas.length} ops | Planta 1ra: "${operacionesFormateadas[0]?.Planta ?? ''}"`);
//         res.status(200).json(operacionesFormateadas);
//     } catch (error) {
//         console.error("❌ Error en getOperacionesPendientesCalidad:", error);
//         res.status(500).json({ error: error.message });
//     }
// };










// ============================================================================
// OBTENER OPERACIONES PENDIENTES DE CALIDAD (GRILLA PRINCIPAL)
// ✅✅ FIX DEFINITIVO: para PLANCHAS/EMB, NO filtramos por Sobreorden de la fila
//    de SP_TraerOperacionesCalidad. Simplemente ejecutamos SP_TraerCalidadPlanchaT
//    con las claves de la fila y si devuelve Dictamen=0, la incluimos.
//    Esto es exactamente lo que hace el VB (Cargo_Grilla).
// ============================================================================
const getOperacionesPendientesCalidad = async (req, res) => {
    try {
        const { maquina, verDefectosSobreorden } = req.query;
        const sobreordenVal = verDefectosSobreorden === 'true' ? 1 : 0;
        console.log('🔵 Params calidad:', { maquina, verDefectosSobreorden });

        const result = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
        let operaciones = Array.isArray(result) ? result : (result[0] || []);

        if (maquina && maquina !== 'TODAS') {
            operaciones = operaciones.filter(op => op.Maquina === maquina);
        }

        const asRows = (r) => (Array.isArray(r) ? r : (r && Array.isArray(r[0]) ? r[0] : (r ? [r] : [])));
        const esPlanchaMaquina = (m) => (m === 'PL1' || m === 'PL2' || m === 'PL3' || m === 'EMB');
        const operacionesFiltradas = [];

        for (const op of operaciones) {
            // ✅ VB: Cargar_Grilla_Calidad filtra por Sobreorden de la fila
            //    pero el VB usa Dr.GetString("Sobreorden") que puede venir como "0", "1", o NULL.
            //    Para EMB/PLANCHAS, NO filtramos: dejamos que el SP de calidad decida.
            //    Para SLITTER/HORNO sí respetamos el filtro.
            const opSobreorden = String(op.Sobreorden ?? '0').trim();
            if (!esPlanchaMaquina(op.Maquina) && opSobreorden !== String(sobreordenVal)) {
                continue;
            }

            // ================= PLANCHA / EMBALAJE =================
            if (esPlanchaMaquina(op.Maquina)) {
                try {
                    // ✅ VB Cargo_Grilla: usa las claves de la MISMA fila
                    const itemPedidoId = String(op.ItemPedido_ID || '');
                    const loteIds = String(op.Lote_IDS || '');
                    const sobrante = parseInt(op.Sobrante || 0);

                    console.log(`🔎 [EMB] op=${op.Operacion_ID} | Maquina=${op.Maquina} | Item=${itemPedidoId} | Lote_IDS=${loteIds} | Sobrante=${sobrante}`);

                    const spData = asRows(await dbRegistracionNET.raw(
                        `EXEC dbo.SP_TraerCalidadPlanchaT ?,?,?,?,?`,
                        [op.Operacion_ID, itemPedidoId, sobrante, sobreordenVal, loteIds]));

                    console.log(`   📋 SP_TraerCalidadPlanchaT devolvió ${spData.length} filas`);

                    if (spData.length > 0) {
                        const primera = spData[0];
                        const dictamen = parseInt(primera.Dictamen);
                        const codigo = String(primera.Codigo || '').trim();
                        // ✅ VB: Dictamen=0 y (Codigo<>'FDI' o FDI en vista SO)
                        if (dictamen === 0 && (codigo !== 'FDI' || sobreordenVal === 1)) {
                            operacionesFiltradas.push({
                                ...op,
                                ...primera,
                                Planta: op.Planta || '',
                                Sobreorden: String(sobreordenVal)
                            });
                            console.log(`   ✅ INCLUIDA en listado (Dictamen=${dictamen}, Codigo=${codigo})`);
                        } else {
                            console.log(`   ❌ NO incluida (Dictamen=${dictamen}, Codigo=${codigo})`);
                        }
                    } else {
                        console.log(`   ❌ SP no devolvió filas`);
                    }
                } catch (e) {
                    console.error(`Error SP_TraerCalidadPlanchaT op ${op.Operacion_ID}:`, e.message);
                }
                continue;
            }

            // ================= HORNOS / SLITTER =================
            let spName = '';
            let params = [];
            if (op.Maquina === 'HOR') {
                spName = 'dbo.SP_TraerCalidadHorno';
                params = [op.Operacion_ID, String(op.Lote_IDS || ''), 0];
            } else {
                spName = 'dbo.SP_TraerCalidad';
                params = [op.Operacion_ID, String(op.Lote_IDS || ''), parseInt(op.Sobrante || 0), sobreordenVal];
            }

            try {
                const placeholders = params.map(() => '?').join(', ');
                const spResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
                const spData = Array.isArray(spResult) ? spResult : (spResult[0] || []);
                const operacionConCalidad = spData.find(row => parseInt(row.Dictamen) === 0);

                if (operacionConCalidad) {
                    operacionesFiltradas.push({
                        ...op,
                        ...operacionConCalidad,
                        Planta: op.Planta || '',
                        Sobreorden: String(sobreordenVal)
                    });
                }
            } catch (spError) {
                console.error(`Error ejecutando ${spName}:`, spError.message);
            }
        }

        const operacionesFormateadas = operacionesFiltradas.map(op => {
            const sobrante = parseInt(op.Sobrante || 0);
            const esPlancha = esPlanchaMaquina(op.Maquina);

            let kilosCalidad = parseFloat(op.Kilos_Calidad || 0);
            let kilosSobreOrden = parseFloat(op.Kilos_Sobreorden || op.Kilos_Sobreorden || 0);
            let kilosBrutos = parseFloat(op.KilosBrutos || 0);

            if (esPlancha && sobrante === 0) {
                kilosCalidad = kilosSobreOrden;
                kilosSobreOrden = 0;
            }
            if (!esPlancha) kilosBrutos = 0;

            return {
                Maquina: op.Maquina,
                Tarea: op.Tarea,
                NroBatch: op.NroBatch,
                Cuchillas: op.Operacion_Cuchillas,
                SerieLote: op.Destino_Lote || op.SerieLote,
                NroOperacion: op.Nro_Operacion || op.Nro_Matching || '0',
                Kilos_Calidad: kilosCalidad,
                Kilos_Sobreorden: kilosSobreOrden,
                Kilos_Bruto: kilosBrutos,
                Tipo: op.Leyenda || (op.Sobrante == 1 ? 'Sobrante' : op.Sobrante == 2 ? 'Scrap' : 'SO'),
                Lote_IDS: op.Lote_IDS,
                Sobrante: sobrante,
                Operacion_ID: op.Operacion_ID,
                Codigo_Producto: op.Codigo_Producto,
                Planta: op.Planta || ''
            };
        });

        console.log(`🏭 Pendientes calidad: ${operacionesFormateadas.length} ops`);
        res.status(200).json(operacionesFormateadas);
    } catch (error) {
        console.error("❌ Error en getOperacionesPendientesCalidad:", error);
        res.status(500).json({ error: error.message });
    }
};



// ============================================================================
// OBTENER DEFECTOS DISPONIBLES (COMBO)
// ============================================================================
const getDefectos = async (req, res) => {
    const { familia } = req.query;
    try {
        const result = await dbRegistracionNET.raw(`EXEC dbo.SP_TraerDefectos @Familia=?`, [familia || '']);
        const dataArray = Array.isArray(result) ? result : (result[0] || []);
        res.status(200).json(dataArray);
    } catch (error) {
        console.error("❌ Error en getDefectos:", error);
        res.status(500).json({ error: error.message });
    }
};






















// ============================================================================
// ✅✅ INSERT DE DEFECTO PLANCHA COMPATIBLE CON AMBAS VERSIONES DEL SP
//    Detecta (cacheado) si SP_InsertarCalidadPlancha acepta @Serie_Lote y arma
//    el EXEC con 16 o 15 params según el servidor donde estés parado.
//    (Error 201 = falta parámetro | Error 8144 = sobra parámetro → ambos quedan cubiertos)
// ============================================================================
let _paramsSpInsertarCalidadPlancha = null;
const getParamsSpInsertarCalidadPlancha = async () => {
    if (_paramsSpInsertarCalidadPlancha) return _paramsSpInsertarCalidadPlancha;
    try {
        const r = await dbRegistracionNET.raw(
            `SELECT name FROM sys.parameters
             WHERE object_id = OBJECT_ID('dbo.SP_InsertarCalidadPlancha')
             ORDER BY parameter_id`);
        const rows = Array.isArray(r) ? r : (r[0] || []);
        _paramsSpInsertarCalidadPlancha = rows.map(x => String(x.name).replace('@', '').toLowerCase());
        console.log('🧩 [Calidad] Params reales de SP_InsertarCalidadPlancha:', _paramsSpInsertarCalidadPlancha.join(', '));
    } catch (e) {
        console.warn('⚠️ [Calidad] No se pudieron leer params del SP (asumo sin @Serie_Lote):', e.message);
        _paramsSpInsertarCalidadPlancha = [];
    }
    return _paramsSpInsertarCalidadPlancha;
};

const insertarDefectoCalidadPlancha = async (trx, d, ctx) => {
    const params = await getParamsSpInsertarCalidadPlancha();
    const conSerie = params.includes('serie_lote');
    const sqlBase = `EXEC SP_InsertarCalidadPlancha 
         @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, 
         @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, 
         @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?`;
    const values = [
        ctx.operacionId,
        ctx.familia,
        d.codDefecto ?? d.defecto,
        String(d.codGravedad ?? d.gravedad),
        String(d.codUbicacion ?? d.ubicacion),
        d.nota || '',
        ctx.loteIDEntrante,
        ctx.sobrante || 0,
        ctx.itemPedidoId || '',
        ctx.numeroItemInt,
        ctx.numeroPedido || '',
        0,
        ctx.idLotePlancha,
        ctx.usuario || 'pmorrone',
        ctx.fechaReg
    ];
    if (conSerie) {
        await trx.raw(`${sqlBase}, @Serie_Lote=?`, [...values, ctx.serieLote]);
    } else {
        await trx.raw(sqlBase, values);
    }
};



// Guardar defectos de calidad (PLANCHAS / EMBALAJE)
const guardarCalidad = async (req, res) => {
    const { operacionId, itemPedidoId, numeroItem, sobrante, lineaData, defectos, usuario } = req.body;
    const transaction = await dbRegistracionNET.transaction();
    try {
        const fechaReg = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
        const idLotePlancha  = lineaData?.Lote_IDS || lineaData?.ID_LotePlancha || '';
        const loteIDEntrante = lineaData?.Origen_Lote_ID || lineaData?.LoteID || '';
        const numeroItemInt  = parseInt(numeroItem) || 0;
        const numeroPedido   = lineaData?.NumeroPedido || '';
        const familia        = String(lineaData?.CodigoProducto || '').substring(8, 10) || 'HO';
        const serieLote      = String(
            lineaData?.SerieLotePaquete || lineaData?.LotePlanchaDesc || lineaData?.SerieLote || lineaData?.Destino_Lote || ''
        ).substring(0, 11);

        // 0) ✅ PURGA REAL sobre la tabla verdadera (CalidadFinal): pendientes del ITEM.
        //    (El viejo DELETE FROM CalidadPlancha fallaba silencioso: esa tabla no existe.)
        try {
            await transaction.raw(
                `DELETE FROM dbo.CalidadFinal
                 WHERE Operacion_ID = ? AND ItemPedido_ID = ? AND NumeroItem = ? AND Sobrante = ?
                   AND (Dictamen IS NULL OR Dictamen = 0)`,
                [operacionId, itemPedidoId || '', numeroItemInt, sobrante || 0]);
        } catch (e) { console.warn('⚠️ purge CalidadFinal:', e.message); }

        // 1) SP oficial de borrado por lote (paridad VB)
        await transaction.raw(
            "EXEC SP_EliminarCalidadPlancha @Operacion_ID=?, @ItemPedido_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?",
            [operacionId, itemPedidoId || '', numeroItemInt, sobrante || 0, idLotePlancha]);

        // 2) Marco los atados del paquete como "en calidad"
        await transaction.raw(
            "EXEC SP_EditarAtadosRegistradosPlanchaCalidad @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?, @Calidad=?",
            [operacionId, numeroItemInt, sobrante || 0, idLotePlancha, 1]);

        // 3) ✅ Inserto cada defecto con params dinámicos (15 o 16 según el SP del server)
        for (const d of (defectos || [])) {
            await insertarDefectoCalidadPlancha(transaction, d, {
                operacionId, familia, loteIDEntrante, sobrante, itemPedidoId,
                numeroItemInt, numeroPedido, idLotePlancha, usuario, fechaReg, serieLote
            });
        }

        await transaction.commit();
        console.log(`✅ [Calidad] SYNC embalaje item=${itemPedidoId} lote=${idLotePlancha} -> ${(defectos || []).length} defectos`);
        res.json({ success: true, message: 'Defectos guardados correctamente' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error al guardar calidad (Embalaje/Plancha):', error);
        res.status(500).json({ error: error.message });
    }
};





// ============================================================================
// ACTUALIZAR DICTAMEN (APROBADO/RECHAZADO) - LÓGICA COMPLETA C#
// ============================================================================
const actualizarDictamen = async (req, res) => {
    const { operacionId, dictamen, notaCalidad, retornaStock, esSobreorden, usuario, defectos } = req.body;
    const transaction = await dbRegistracionNET.transaction();
    
    try {
        // 1. Obtener datos de la operación
        const opsResult = await transaction.raw("EXEC dbo.SP_TraerOperacionesCalidad");
        const opsArray = Array.isArray(opsResult) ? opsResult : (opsResult[0] || []);
        const op = opsArray.find(o => (o.Operacion_ID || '').toString() === operacionId);
        
        if (!op) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Operación no encontrada' });
        }
        
        const maquina = op.Maquina;
        const sobranteVal = parseInt(op.Sobrante || 0);
        const bSobrante = sobranteVal === 1;
        const bScrap = sobranteVal === 2;
        
        const loteIDS = op.Lote_IDS || '';
        const loteID = op.Lote_ID || '';
        const destinoLote = (op.Destino_Lote || '').trim();
        const itemPedidoID = op.ItemPedido_ID || '';
        const numeroItem = op.Item != null ? parseInt(op.Item) : 0;
        const atados = op.Atados || '';
        const rollos = op.Rollos || '';
        const kilosBrutos = parseFloat(op.KilosBrutos || 0);
        
        // Obtener Kilos (En Planchas con Sobrante=0, los kilos de calidad pasan a sobreorden)
        let dCalidad = parseFloat(op.Kilos_Calidad || 0);
        let dSobreOrden = parseFloat(op.Kilos_Sobreorden || op.Kilos_SobreOrden || 0);
        
        const esPlancha = (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB');
        if (esPlancha && sobranteVal === 0) {
            dCalidad = dSobreOrden;
            dSobreOrden = 0;
        }
        
        const aCalidadSO = esSobreorden ? '1' : '0';
        
        // 2. Ejecutar Lógica por Máquina y Dictamen
        if (esPlancha) {
            if (dictamen === 1) { // APROBADO
                const kSO = dSobreOrden + dCalidad;
                const kC = 0;
                const sobranteSP = bSobrante ? 1 : (bScrap ? 2 : 0);
                
                await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradasPlancha @Operacion_ID=?, @ItemPedido_ID=?, @ID_LotePlancha=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Sobrante=?, @Kilos_Bruto=?, @ACalidadSO=?, @Atados=?, @Rollos=?, @RetornaStock=?`,
                    [operacionId, itemPedidoID, loteIDS, kSO, kC, '1', '2', sobranteSP, kilosBrutos, aCalidadSO, atados, rollos, 'N']);
                await transaction.raw(`EXEC dbo.SP_EditarCalidadFinal @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @NotaCalidad=?, @ID_LotePlancha=?, @Dictamen=?`,
                    [operacionId, itemPedidoID, sobranteSP, notaCalidad || '', loteIDS, 1]);
                await transaction.raw(`EXEC dbo.SP_EditarAtadosRegistradosPlanchaCalidad @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?, @Calidad=?`,
                    [operacionId, numeroItem, sobranteSP, loteIDS, 0]);
            } else { // RECHAZADO
                const kSO = dSobreOrden;
                const kC = dCalidad;
                const retornaStockVal = (retornaStock && dCalidad > 0) ? 'C' : 'N';
                const sobranteSP = bSobrante ? 1 : (bScrap ? 2 : 0);
                
                await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradasPlancha @Operacion_ID=?, @ItemPedido_ID=?, @ID_LotePlancha=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Sobrante=?, @Kilos_Bruto=?, @ACalidadSO=?, @Atados=?, @Rollos=?, @RetornaStock=?`,
                    [operacionId, itemPedidoID, loteIDS, kSO, kC, '1', '3', sobranteSP, kilosBrutos, aCalidadSO, atados, rollos, retornaStockVal]);
                await transaction.raw(`EXEC dbo.SP_EditarCalidadFinal @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @NotaCalidad=?, @ID_LotePlancha=?, @Dictamen=?`,
                    [operacionId, itemPedidoID, sobranteSP, notaCalidad || '', loteIDS, 2]);
                await transaction.raw(`EXEC dbo.SP_EditarAtadosRegistradosPlanchaCalidad @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?, @Calidad=?`,
                    [operacionId, numeroItem, sobranteSP, loteIDS, 1]);
            }
        } 
        else if (maquina === 'HOR') {
            if (dictamen === 1) { // APROBADO
                const kSO = dSobreOrden + dCalidad;
                const kC = 0;
                const retornaStockVal = retornaStock ? 'M' : 'N';
                
                await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradasHornos @Operacion_ID=?, @Destino_Lote=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Lote_IDS=?, @ACalidadSO=?, @RetornaStock=?`,
                    [operacionId, destinoLote, kSO, kC, '1', '2', loteIDS, aCalidadSO, retornaStockVal]);
                await transaction.raw(`EXEC dbo.SP_EditarCalidadHornos @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @NotaCalidad=?, @Dictamen=?`,
                    [operacionId, loteIDS, 0, notaCalidad || '', 1]);
                await transaction.raw(`EXEC dbo.SP_EditarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
                    [operacionId, loteIDS, 0]);
            } else { // RECHAZADO
                const kSO = dSobreOrden;
                const kC = dCalidad;
                const retornaStockVal = (retornaStock && dCalidad > 0) ? 'C' : 'N';
                
                await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradasHornos @Operacion_ID=?, @Destino_Lote=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Lote_IDS=?, @ACalidadSO=?, @RetornaStock=?`,
                    [operacionId, destinoLote, kSO, kC, '1', '3', loteIDS, aCalidadSO, retornaStockVal]);
                await transaction.raw(`EXEC dbo.SP_EditarCalidadHornos @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @NotaCalidad=?, @Dictamen=?`,
                    [operacionId, loteIDS, 0, notaCalidad || '', 2]);
            }
        } 
        else { // SLITTER
            if (dictamen === 1) { // APROBADO
                const kSO = dSobreOrden + dCalidad;
                const kC = 0;
                const loteIdsSP = bSobrante ? loteID : loteIDS;
                const sobranteSP = bSobrante ? 1 : 0;
                const retornaStockVal = retornaStock ? 'M' : 'N';
                
                await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradas @Operacion_ID=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Lote_IDS=?, @Sobrante=?, @RetornaStock=?, @ACalidadSO=?, @Atados=?, @Rollos=?`,
                    [operacionId, kSO, kC, '1', '2', loteIdsSP, sobranteSP, retornaStockVal, aCalidadSO, atados, rollos]);
                await transaction.raw(`EXEC dbo.SP_EditarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @NotaCalidad=?, @Dictamen=?`,
                    [operacionId, loteIdsSP, sobranteSP, notaCalidad || '', 1]);
                
                if (bSobrante) {
                    await transaction.raw(`EXEC dbo.SP_EliminarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`, [operacionId, loteIdsSP, sobranteSP]);
                } else {
                    await transaction.raw(`EXEC dbo.SP_EditarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`, [operacionId, loteIdsSP, sobranteSP]);
                }
            } else { // RECHAZADO
                const kSO = dSobreOrden;
                const kC = dCalidad;
                const retornaStockVal = (retornaStock && dCalidad > 0) ? 'C' : 'N';
                const loteIdsSP = bSobrante ? '' : (bScrap ? '' : loteIDS);
                const sobranteSP = bSobrante ? 1 : (bScrap ? 2 : 0);
                
                if (bSobrante || bScrap) {
                    await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradasSobrante @Operacion_ID=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Lote_IDS=?, @Sobrante=?, @RetornaStock=?, @ACalidadSO=?, @Atados=?, @Rollos=?`,
                        [operacionId, kSO, kC, '1', '3', loteIdsSP, sobranteSP, retornaStockVal, aCalidadSO, atados, rollos]);
                } else {
                    await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradas @Operacion_ID=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Lote_IDS=?, @Sobrante=?, @RetornaStock=?, @ACalidadSO=?, @Atados=?, @Rollos=?`,
                        [operacionId, kSO, kC, '1', '3', loteIDS, 0, retornaStockVal, aCalidadSO, atados, rollos]);
                }
                
                const loteIdsCalidad = bSobrante ? loteID : loteIDS;
                const sobranteCalidad = bSobrante ? 1 : 0;
                await transaction.raw(`EXEC dbo.SP_EditarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @NotaCalidad=?, @Dictamen=?`,
                    [operacionId, loteIdsCalidad, sobranteCalidad, notaCalidad || '', 2]);
            }
        }
        
        // 3. Lógica de Correos (Solo para Rechazados)
        if (dictamen === 2) {
            const tieneFueraDiametro = defectos && defectos.some(d => 
                d.descripcion && d.descripcion.trim().toLowerCase() === 'fuera de diámetro'
            );
            const evento = tieneFueraDiametro ? 'RECHAZOCOMERCIAL' : 'RECHAZOCALIDAD';
            
            try {
                const mailsResult = await transaction.raw(`EXEC dbo.SP_TraerMails @Evento=?`, [evento]);
                const mailsArray = Array.isArray(mailsResult) ? mailsResult : (mailsResult[0] || []);
                
                // 🔔 NOTA: Aquí debes integrar tu librería de envío de correos (Nodemailer, SendGrid, etc.)
                for (const mail of mailsArray) {
                    console.log(`📧 [Email] Evento: ${evento} | Para: ${mail.MailTo} | Asunto: ${mail.Asunto}`);
                    // await enviarEmail(mail.MailTo, mail.Asunto, construirMensaje(...));
                }
            } catch (mailErr) {
                console.error('⚠️ Error obteniendo mails para rechazo:', mailErr.message);
            }
        }
        
        await transaction.commit();
        res.status(200).json({ success: true, message: `Dictamen ${dictamen === 1 ? 'APROBADO' : 'RECHAZADO'} procesado correctamente` });
    } catch (error) {
        await transaction.rollback();
        console.error("❌ Error en actualizarDictamen:", error);
        res.status(500).json({ error: error.message });
    }
};


// ============================================================================
// SINCRONIZAR DEFECTOS EN BD (Agregar/Modificar/Eliminar del modal)
// Replica btnConfirma_Click del soft original: elimina existentes e inserta la lista
// ============================================================================
const sincronizarDefectosCalidad = async (req, res) => {
    const { operacionId, defectos = [], usuario, sobreorden = 0 } = req.body;
    const transaction = await dbRegistracionNET.transaction();
    
    try {
        const fechaReg = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
        
        // 1) Datos de la operación
        const opsResult = await transaction.raw("EXEC dbo.SP_TraerOperacionesCalidad");
        const opsArray = Array.isArray(opsResult) ? opsResult : (opsResult[0] || []);
        const op = opsArray.find(o => (o.Operacion_ID || '').toString() === operacionId);
        
        if (!op) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Operación no encontrada' });
        }
        
        const maquina = op.Maquina;
        const sobrante = parseInt(op.Sobrante || 0);
        const loteIDS = op.Lote_IDS || '';
        const loteID = op.Lote_ID || '';
        const destinoLote = (op.Destino_Lote || '').trim();
        const codigoProducto = (op.Codigo_Producto || '').trim();
        const familia = codigoProducto.length >= 10 ? codigoProducto.substring(8, 10) : '00';
        const esPlancha = (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB');
        const esHorno = (maquina === 'HOR');
        
        // Lote_IDS según sobrante (igual que el original)
        let loteIdsSP = loteIDS;
        if (sobrante === 1) loteIdsSP = loteID;
        else if (sobrante === 2) loteIdsSP = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';
        
        let itemPedidoID = op.ItemPedido_ID || '';
        let numeroItem = op.Item != null ? parseInt(op.Item) : 0;
        let numeroPedido = op.NumeroPedido || '';
        const idLotePlancha = loteIDS;
        
        // Para planchas: obtener NumeroItem y NumeroPedido
        if (esPlancha) {
            try {
                const cpResult = await transaction.raw(
                    `EXEC dbo.SP_TraerOperacionesCalipsoPorPedido @Operacion_ID=?, @ID_LotePlancha=?`,
                    [operacionId, idLotePlancha]
                );
                const cpArray = Array.isArray(cpResult) ? cpResult : (cpResult[0] || []);
                if (cpArray.length > 0) {
                    numeroItem = parseInt(cpArray[0].NumeroItem || numeroItem || 0);
                    numeroPedido = cpArray[0].NumeroPedido || numeroPedido;
                }
            } catch (e) {
                console.error('⚠️ Error SP_TraerOperacionesCalipsoPorPedido:', e.message);
            }
        }
        
        // 2) ELIMINO los registros existentes (como hace btnConfirma_Click)
        if (esPlancha) {
            await transaction.raw(
                `EXEC dbo.SP_EliminarCalidadPlancha @Operacion_ID=?, @ItemPedido_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?`,
                [operacionId, itemPedidoID, numeroItem, sobrante, idLotePlancha]
            );
            // Modifico la etiqueta de atados para enviar a calidad
            await transaction.raw(
                `EXEC dbo.SP_EditarAtadosRegistradosPlanchaCalidad @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?, @Calidad=?`,
                [operacionId, numeroItem, sobrante, idLotePlancha, 1]
            );
        } else if (esHorno) {
            await transaction.raw(
                `EXEC dbo.SP_EliminarCalidadHorno @Operacion_ID=?, @Lote_IDS=?`,
                [operacionId, loteIDS]
            );
        } else {
            await transaction.raw(
                `EXEC dbo.SP_EliminarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
                [operacionId, loteIdsSP, sobrante]
            );
            // Modifico la etiqueta de atados para enviar a calidad
            await transaction.raw(
                `EXEC dbo.SP_EditarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
                [operacionId, loteIDS, sobrante]
            );
        }
        
        // 3) INSERTO cada defecto de la lista (igual que el original)
        for (const d of defectos) {
            if (esPlancha) {
                await transaction.raw(
                    `EXEC dbo.SP_InsertarCalidadPlancha @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?`,
                    [operacionId, familia, d.defecto, d.gravedad, d.ubicacion, d.nota || '', loteID, sobrante, itemPedidoID, numeroItem, numeroPedido, sobreorden || 0, idLotePlancha, usuario || 'admin', fechaReg]
                );
            } else if (esHorno) {
                await transaction.raw(
                    `EXEC dbo.SP_InsertarCalidadHornos @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Horno=?, @Horneada=?, @KilosHorneada=?, @Usuario=?, @FechaReg=?`,
                    [operacionId, destinoLote, familia, d.defecto, d.gravedad, d.ubicacion, d.nota || '', loteIDS, loteID, 0, 0, d.horno || 0, d.horneada || 0, d.kgsHorneada || 0, usuario || 'admin', fechaReg]
                );
            } else {
                await transaction.raw(
                    `EXEC dbo.SP_InsertarCalidad @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Usuario=?, @FechaReg=?`,
                    [operacionId, destinoLote, familia, d.defecto, d.gravedad, d.ubicacion, d.nota || '', loteIdsSP, loteID, sobrante, sobreorden || 0, usuario || 'admin', fechaReg]
                );
            }
        }
        
        await transaction.commit();
        console.log(`✅ [Calidad] Defectos sincronizados para Operacion_ID: ${operacionId} (${defectos.length} defectos)`);
        res.status(200).json({ success: true, message: 'Defectos guardados correctamente' });
    } catch (error) {
        await transaction.rollback();
        console.error("❌ Error en sincronizarDefectosCalidad:", error);
        res.status(500).json({ error: error.message });
    }
};

// ============================================================================
// ELIMINAR UN DEFECTO POR ID (🗑️ del modal)
// ✅ UN SOLO DELETE POR PK SOBRE dbo.CalidadFinal. Sin SPs, sin dictamen,
//    sin descubrimientos: la fila seleccionada muere y no revive.
// ============================================================================
const eliminarDefectoCalidad = async (req, res) => {
    const { defectoId } = req.body;
    if (!defectoId) {
        return res.status(400).json({ error: 'Falta el ID del defecto.' });
    }
    try {
        await dbRegistracionNET.raw(`DELETE FROM dbo.CalidadFinal WHERE ID = ?`, [defectoId]);
        console.log(`🗑️ [Calidad] DELETE FROM dbo.CalidadFinal WHERE ID = ${defectoId} → OK`);
        res.status(200).json({ success: true, message: 'Defecto eliminado de CalidadFinal', id: defectoId });
    } catch (error) {
        console.error('❌ Error en eliminarDefectoCalidad:', error);
        res.status(500).json({ error: error.message });
    }
};


module.exports = {
    getDetalleOperacionCalidad,
    getOperacionesPendientesCalidad,
    getDefectos,
    guardarCalidad,
    actualizarDictamen,
    sincronizarDefectosCalidad,
    eliminarDefectoCalidad
};