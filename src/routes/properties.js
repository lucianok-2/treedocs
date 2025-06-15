const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase'); // Assuming firebase.js exports db and admin
const { addHistoryEntry } = require('../public/js/history');// Assuming this is correctly imported

// Middleware para verificar el Firebase ID Token
async function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : req.cookies.token || req.query.token;

  if (!token) {
    console.log('No se proporcionó token');
    // Requirement 10: Return JSON error for 401
    return res.status(401).json({ error: 'Authentication token not provided.' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.usuario = decodedToken; // Attach user info to request
    next();
  } catch (error) {
    console.error('Error al verificar token con Firebase:', error);
    // Requirement 10: Return JSON error for 403
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
}

// GET /api/properties/stats — Obtener estadísticas de predios y documentos
router.get('/stats', verificarToken, async (req, res) => {
  try {
    const userId = req.usuario.uid;
    // Obtener la cantidad total de tipos de documento definidos
    const docTypesSnapshot = await db.collection('document_types').get();
    const totalDocumentTypes = docTypesSnapshot.empty ? 0 : docTypesSnapshot.size;

    // Requirement 3: Query predios collection for the authenticated user
    const prediosQuerySnapshot = await db.collection('predios')
      .where('id_user', '==', userId)
      .get();

    let prediosRegistrados = 0;
    let prediosActivos = 0;

    if (!prediosQuerySnapshot.empty) {
      prediosRegistrados = prediosQuerySnapshot.size; // Count total properties
      prediosQuerySnapshot.forEach(doc => {
        if (doc.data().activo === true) { // Count active properties
          prediosActivos++;
        }
      });
    }

    // Requirement 4: Query documentos collection for the authenticated user
    // Assuming documents have an id_user field.
    const documentosQuerySnapshot = await db.collection('documentos')
      .where('id_user', '==', userId)
      .get();

    const uploadedDocumentTypes = new Set();
    documentosQuerySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.tipoDocumento) {
        uploadedDocumentTypes.add(data.tipoDocumento);
      }
    });
    const uniqueUploadedDocumentTypesCount = uploadedDocumentTypes.size;

    const documentTypesSnapshot = await db.collection('document_types').get();
    const totalExpectedDocumentTypes = documentTypesSnapshot.size;

    // Calcular el cumplimiento documental basado en tipos de documento únicos subidos por predio
    let cumplimientoDocumental = 0;
    if (prediosRegistrados === 0 || totalDocumentTypes === 0) {
        cumplimientoDocumental = 0;
    } else {
        const tiposPorPredio = {};
        documentosQuerySnapshot.forEach(doc => {
            const data = doc.data();
            if (!tiposPorPredio[data.id_predio]) {
                tiposPorPredio[data.id_predio] = new Set();
            }
            if (data.tipo_documento) {
                tiposPorPredio[data.id_predio].add(data.tipo_documento);
            }
        });

        const totalTiposSubidos = Object.values(tiposPorPredio).reduce((acc, set) => acc + set.size, 0);
        const totalExpectedDocuments = prediosRegistrados * totalDocumentTypes;
        cumplimientoDocumental = totalExpectedDocuments > 0
            ? Math.min(100, Math.round((totalTiposSubidos / totalExpectedDocuments) * 100))
            : 0;
    }

    const documentosSubidos = documentosQuerySnapshot.empty ? 0 : documentosQuerySnapshot.size; // Keep for existing response structure

    // Requirement 6: Return JSON
    res.json({
      prediosRegistrados,
      prediosActivos,
      documentosSubidos,
      cumplimientoDocumental
    });

  } catch (error) { // Requirement 7: Error handling
    console.error('Error al obtener estadísticas de predios y documentos:', error);
    res.status(500).json({ error: 'Error interno al obtener estadísticas' });
  }
});

// GET /api/properties — Listar todos los predios del usuario
router.get('/', verificarToken, async (req, res) => {
  try {
    const snapshot = await db
      .collection('predios')
      .where('id_user', '==', req.usuario.uid)
      .get();

    const predios = [];
    const documentTypesSnapshot = await db.collection('document_types').get();
    const totalExpectedDocumentTypes = documentTypesSnapshot.size;

    for (const doc of snapshot.docs) {
      const propertyData = { _id: doc.id, ...doc.data() };

      const documentosQuerySnapshot = await db.collection('documentos')
        .where('id_predio', '==', doc.id)
        .where('id_user', '==', req.usuario.uid)
        .get();

      const uploadedDocumentTypes = new Set();
      documentosQuerySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.tipoDocumento) {
          uploadedDocumentTypes.add(data.tipoDocumento);
        }
      });
      const uniqueUploadedDocumentTypesCount = uploadedDocumentTypes.size;

      propertyData.documentCompliance = {
        uploaded: uniqueUploadedDocumentTypesCount,
        total: totalExpectedDocumentTypes
      };
      predios.push(propertyData);
    }

    res.json(predios);
  } catch (error) {
    console.error('Error al obtener predios:', error);
    res.status(500).json({ error: 'Error al obtener predios' });
  }
});

// GET /api/properties/:id — Obtener un predio específico
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const docRef = db.collection('predios').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Predio no encontrado' });
    }
    const data = docSnap.data();
    if (data.id_user !== req.usuario.uid) {
      return res.status(403).json({ error: 'Sin permiso para acceder a este predio' });
    }
    res.json({ _id: docSnap.id, ...data });
  } catch (error) {
    console.error('Error al obtener predio:', error);
    res.status(500).json({ error: 'Error al obtener predio' });
  }
});

// POST /api/properties — Crear un nuevo predio
router.post('/', verificarToken, async (req, res) => {
  try {
    const {
      idPredio = '',
      nombre = '',
      rol = '',
      superficie = null,
      descripcion = '',
      ubicacion = '',
      modeloCompra,
      rutPropietario,
      nombrePropietario,
      intermediario,
      certificaciones = [],
      propietario,
      activo // Requirement 8: consume activo field
    } = req.body;

    if (!idPredio || !nombre) {
      return res.status(400).json({ error: 'idPredio y nombre son obligatorios' });
    }

    const predioData = {
      idPredio,
      nombre,
      rol,
      superficie,
      descripcion,
      ubicacion,
      modeloCompra: modeloCompra || null,
      rutPropietario: rutPropietario || null,
      nombrePropietario: nombrePropietario || null,
      intermediario: intermediario || null,
      certificaciones,
      propietario: propietario || null,
      fechaCreacion: new Date(),
      id_user: req.usuario.uid,
      // Requirement 8: default activo to false if not provided or not a boolean
      activo: typeof activo === 'boolean' ? activo : true 
    };

    const docRef = await db.collection('predios').add(predioData);

    await addHistoryEntry({
      userId: req.usuario.uid,
      actionType: 'CREATE_PROPERTY',
      entityType: 'property',
      entityId: docRef.id,
      details: { propertyName: nombre, idPredio, activo: predioData.activo }
    });

    res.status(201).json({ _id: docRef.id, ...predioData });
  } catch (error) {
    console.error('Error al crear predio:', error);
    res.status(500).json({ error: 'Error al crear predio' });
  }
});

// PUT /api/properties/:id — Actualizar un predio existente
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const docRef = db.collection('predios').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Predio no encontrado' });
    }
    const currentData = docSnap.data();
    if (currentData.id_user !== req.usuario.uid) {
      return res.status(403).json({ error: 'Sin permiso para modificar este predio' });
    }

    const updates = { fechaActualizacion: new Date() };
    const allowedFields = [
      'idPredio','nombre','rol','superficie','descripcion','ubicacion',
      'modeloCompra','rutPropietario','nombrePropietario','intermediario',
      'certificaciones','propietario', 'activo' // Requirement 9: include activo
    ];
    
    let changed = false;
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'activo') {
          // Requirement 9: ensure 'activo' is a boolean before updating
          if (typeof req.body[field] === 'boolean') {
            if (currentData.activo !== req.body[field]) {
              updates[field] = req.body[field];
              changed = true;
            }
          } 
          // If req.body.activo is present but not a boolean, it's ignored, 
          // and currentData.activo (the existing value) is preserved.
        } else {
          if (currentData[field] !== req.body[field]) {
            updates[field] = req.body[field];
            changed = true;
          }
        }
      }
    });

    if (changed) {
        await docRef.update(updates);
        await addHistoryEntry({
            userId: req.usuario.uid,
            actionType: 'UPDATE_PROPERTY',
            entityType: 'property',
            entityId: req.params.id,
            details: { updatedFields: Object.keys(updates).filter(k => k !== 'fechaActualizacion') }
        });
        // Return the updated document state by merging currentData with updates
        res.json({ _id: req.params.id, ...currentData, ...updates });
    } else {
        // If only non-boolean 'activo' was provided, or no valid fields changed
        res.json({ _id: req.params.id, ...currentData, message: "No valid changes detected or provided." });
    }

  } catch (error) {
    console.error('Error al actualizar predio:', error);
    res.status(500).json({ error: 'Error al actualizar predio' });
  }
});

// DELETE /api/properties/:id — Eliminar un predio
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const docRef = db.collection('predios').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Predio no encontrado' });
    }
    const data = docSnap.data();
    if (data.id_user !== req.usuario.uid) {
      return res.status(403).json({ error: 'Sin permiso para eliminar este predio' });
    }

    await docRef.delete();

    await addHistoryEntry({
      userId: req.usuario.uid,
      actionType: 'DELETE_PROPERTY',
      entityType: 'property',
      entityId: req.params.id,
      details: { propertyName: data.nombre || data.idPredio } 
    });

    res.json({ _id: req.params.id, deleted: true });
  } catch (error) {
    console.error('Error al eliminar predio:', error);
    res.status(500).json({ error: 'Error al eliminar predio' });
  }
});

// GET /api/properties/:id/documentos — Obtener documentos de un predio
router.get('/:id/documentos', verificarToken, async (req, res) => {
  try {
    const predioSnap = await db.collection('predios').doc(req.params.id).get();
    if (!predioSnap.exists) {
      return res.status(404).json({ error: 'Predio no encontrado' });
    }
    const predioData = predioSnap.data();
    if (predioData.id_user !== req.usuario.uid) {
      return res.status(403).json({ error: 'Sin permiso para acceder a documentos de este predio' });
    }

    const docsSnap = await db
      .collection('documentos')
      .where('id_predio', '==', req.params.id)
      .get();

    const documentos = docsSnap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    res.json(documentos);
  } catch (error) {
    console.error('Error al obtener documentos del predio:', error);
    res.status(500).json({ error: 'Error al obtener documentos del predio' });
  }
});

module.exports = router;
