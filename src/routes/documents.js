const express = require('express');
const router = express.Router();
const axios = require('axios'); // Make sure axios is installed
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db, admin, storage } = require('../firebase');
const { addHistoryEntry, getUserHistory } = require('../public/js/history');


// Middleware para verificar el Firebase ID Token
async function verificarToken(req, res, next) {
  try {
    const bearer = req.headers.authorization;
    const token = bearer?.startsWith('Bearer ')
      ? bearer.split(' ')[1]
      : req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.usuario = decoded;  // uid, email, customClaims...
    next();
  } catch (err) {
    console.error('Error al verificar ID Token de Firebase:', err);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Aplicar middleware de verificación de token a todas las rutas
router.use(verificarToken);

// Configurar multer para almacenar archivos temporalmente
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // Límite de 10MB
  },
  fileFilter: function (req, file, cb) {
    // Permitir PDF, JPG, JPEG y otros formatos comunes
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se permiten PDF, imágenes y documentos de Office.'));
    }
  }
});

// Ruta para obtener los tipos de documentos
router.get('/types', async (req, res) => {
  try {
    const documentTypesSnapshot = await db.collection('document_types').get();
    const documentTypes = [];
    documentTypesSnapshot.forEach(doc => {
      documentTypes.push({
        id: doc.id,
        ...doc.data()
      });
    });
    res.json(documentTypes);
  } catch (error) {
    console.error('Error al obtener tipos de documento:', error);
    res.status(500).json({ error: 'Error al obtener tipos de documento' });
  }
});

// Ruta para subir un documento
router.post('/upload', upload.single('documentFile'), async (req, res) => {
  try {
    // First, determine originalName, mimeType, fileSize, and if we are in a "fileless" (URL-based) scenario
    let originalName, mimeType, fileSize;
    const isFilelessUpload = req.body.fileUrl && req.body.originalName && req.body.mimeType && req.body.fileSize;

    if (isFilelessUpload) {
        originalName = req.body.originalName;
        mimeType = req.body.mimeType;
        fileSize = parseInt(req.body.fileSize, 10); // Ensure size is an integer
    } else if (req.file) {
        originalName = req.file.originalname;
        mimeType = req.file.mimetype;
        fileSize = req.file.size;
    } else {
        // If neither fileUrl info nor req.file is present, then it's an error.
        return res.status(400).json({ error: 'No se ha subido ningún archivo ni proporcionado una URL de archivo.' });
    }
    
    // Verificar que se hayan enviado todos los datos necesarios
    if (!req.body.documentTypeNameForUpload || !req.body.propertyId) {
      // Eliminar el archivo temporal si existe
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Faltan datos requeridos: documentTypeNameForUpload o propertyId' });
    }
    
    const receivedDocumentTypeName = req.body.documentTypeNameForUpload;

    // Verificar que el predio exista y pertenezca al usuario
    const predioRef = db.collection('predios').doc(req.body.propertyId);
    const predioDoc = await predioRef.get();
    
    if (!predioDoc.exists) {
      // Eliminar el archivo temporal si existe
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'Predio no encontrado' });
    }
    
    const predioData = predioDoc.data();
    
    // Verificar que el predio pertenezca al usuario actual
    if (predioData.id_user !== req.usuario.uid) {
      // Eliminar el archivo temporal si existe
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ error: 'No tienes permiso para subir documentos a este predio' });
    }
    
    // Client has already uploaded the file to: documents/${req.body.propertyId}/${req.body.fileHash}/${req.file.originalname}
    // Client provides the direct download URL as req.body.fileUrl

    // Use client's file hash. The server-calculated one is removed as we don't read file buffer.
    const clientFileHash = req.body.fileHash; 
    if (!clientFileHash && !isFilelessUpload) { // Hash is expected if req.file was processed by client, or if fileless.
                                          // If it's a direct server upload (req.file but not isFilelessUpload), 
                                          // and client didn't send hash, it's an issue.
      // For now, we'll proceed, but this indicates an issue with client data if not purely server-handled upload.
      console.warn("Client-side fileHash not provided in req.body.fileHash. Ensure client sends 'fileHash' for pre-hashed files.");
      // Potentially: if (req.file) fs.unlinkSync(req.file.path);
      // return res.status(400).json({ error: 'Client-side file hash is missing for pre-processed file.' });
    }
    
    // Use the determined originalName for clientStoragePath
    const clientStoragePath = `documents/${req.body.propertyId}/${clientFileHash || 'unknown_hash'}/${originalName}`;

    // Crear el documento en la base de datos
    const documentData = {
      nombre: receivedDocumentTypeName, // Document's own name is the type name
      id_predio: req.body.propertyId,
      id_user: req.usuario.uid, // from token middleware
      tipo_documento: receivedDocumentTypeName, // Store the NAME here
      fecha_subida: req.body.uploadDate ? new Date(req.body.uploadDate) : new Date(), // Use client's uploadDate or current
      fecha_creacion: admin.firestore.FieldValue.serverTimestamp(),
      ruta_archivo: clientStoragePath, 
      url_archivo: isFilelessUpload ? req.body.fileUrl : '', // If not fileless, URL might be generated later or not set
      hash: clientFileHash, // Hash from client (or could be calculated server-side if not fileless and not provided)
      tipo_archivo: mimeType, // Use determined mimeType
      tamano: fileSize,       // Use determined fileSize
      nombre_original: originalName, // Use determined originalName
      estado: 'completo', // Default state
      responsiblePerson: req.body.responsiblePerson || '', // Static field
      documentDescription: req.body.documentDescription || '' // Static field
    };
    
    // Populate additional_data with dynamic fields
    const additional_data = {};
    const knownFields = [
      'documentTypeNameForUpload', 'propertyId', 'documentFile', // Updated documentTypeId to documentTypeNameForUpload
      'responsiblePerson', 'documentDescription', 'fileHash', 
      'userId', 'uploadDate',
      'id_predio', 'tipo_documento' 
    ];
    
    // Add safety check for req.body
    if (req.body && typeof req.body === 'object') {
      for (const key in req.body) {
        if (Object.prototype.hasOwnProperty.call(req.body, key) && !knownFields.includes(key)) {
          if (!documentData.hasOwnProperty(key)) {
            additional_data[key] = req.body[key];
          }
        }
      }
    }
    documentData.additional_data = additional_data;
    
    const docRef = await db.collection('documentos').add(documentData);
    try {
      await addHistoryEntry({
        userId: req.usuario.uid,
        actionType: 'UPLOAD_DOCUMENT',
        entityType: 'document',
        entityId: docRef.id,
        details: {
          fileName: documentData.nombre_original,
          idPredio: documentData.id_predio
        }
      });
    } catch (historyError) {
      console.error('Error adding history entry for upload document:', historyError);
    }
    // Eliminar el archivo temporal si existe (e.g. if it was a fallback scenario)
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(201).json({
      _id: docRef.id,
      ...documentData
    });
  } catch (error) {
    console.error('Error al subir documento:', error);
    
    // Eliminar el archivo temporal si existe y el path is valid
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Error al subir el documento' });
  }
});

// Ruta para buscar documentos por filtros
router.get('/buscar', async (req, res) => {
  try {
    const { tipo_documento, id_predio } = req.query;
    
    let query = db.collection('documentos')
      .where('id_user', '==', req.usuario.uid);
    
    if (tipo_documento) {
      query = query.where('tipo_documento', '==', tipo_documento); // Removed parseInt
    }
    
    if (id_predio) {
      query = query.where('id_predio', '==', id_predio);
    }
    
    const snapshot = await query.get();
    const documentos = [];
    
    snapshot.forEach(doc => {
      documentos.push({
        _id: doc.id,
        ...doc.data()
      });
    });
    
    // Ordenar por fecha de subida (más recientes primero)
    documentos.sort((a, b) => {
      const dateA = a.fecha_subida ? a.fecha_subida.toDate() : new Date(0);
      const dateB = b.fecha_subida ? b.fecha_subida.toDate() : new Date(0);
      return dateB - dateA;
    });
    
    res.json(documentos);
  } catch (error) {
    console.error('Error al buscar documentos:', error);
    res.status(500).json({ error: 'Error al buscar documentos' });
  }
});

// Ruta para obtener documentos compartidos con el usuario actual
router.get('/shared-with-me', async (req, res) => {
  try {
    const snapshot = await db.collection('documentos')
      .where('sharedWith', 'array-contains', req.usuario.uid)
      .get();

    const documentos = [];
    snapshot.forEach(doc => {
      documentos.push({ _id: doc.id, ...doc.data() });
    });

    // Ordenar por fecha de subida
    documentos.sort((a, b) => {
      const dateA = a.fecha_subida ? a.fecha_subida.toDate() : new Date(0);
      const dateB = b.fecha_subida ? b.fecha_subida.toDate() : new Date(0);
      return dateB - dateA;
    });

    res.json(documentos);
  } catch (error) {
    console.error('Error al obtener documentos compartidos:', error);
    res.status(500).json({ error: 'Error al obtener documentos compartidos' });
  }
});

// Ruta para compartir un documento con otro usuario
router.post('/:id/share', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId requerido' });
    }

    const docRef = db.collection('documentos').doc(req.params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const documentData = docSnap.data();

    // Verificar que el documento pertenezca al usuario
    if (documentData.id_user !== req.usuario.uid) {
      return res.status(403).json({ error: 'No tienes permiso para compartir este documento' });
    }

    await docRef.update({
      sharedWith: admin.firestore.FieldValue.arrayUnion(userId)
    });

    res.json({ message: 'Documento compartido correctamente' });
  } catch (error) {
    console.error('Error al compartir documento:', error);
    res.status(500).json({ error: 'Error al compartir el documento' });
  }
});

// Ruta para obtener un documento específico
router.get('/:id', async (req, res) => {
  try {
    const docRef = db.collection('documentos').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    const documentData = doc.data();
    
    // Verificar que el documento pertenezca al usuario
    if (documentData.id_user !== req.usuario.uid) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a este documento' });
    }
    
    // Si no tiene URL, generarla
    if (!documentData.url_archivo && documentData.ruta_archivo) {
      try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(documentData.ruta_archivo);
        
        const [downloadURL] = await file.getSignedUrl({
          action: 'read',
          expires: '03-09-2491'
        });
        
        // Actualizar el documento con la URL
        await docRef.update({ url_archivo: downloadURL });
        documentData.url_archivo = downloadURL;
      } catch (urlError) {
        console.error('Error al generar URL:', urlError);
      }
    }
    
    res.json({
      _id: doc.id,
      ...documentData
    });
  } catch (error) {
    console.error('Error al obtener documento:', error);
    res.status(500).json({ error: 'Error al obtener el documento' });
  }
});

// Ruta para descargar un documento
router.get('/:id/download', async (req, res) => {
  try {
    const docRef = db.collection('documentos').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    const documentData = doc.data();
    
    // Verificar que el documento pertenezca al usuario
    if (documentData.id_user !== req.usuario.uid) {
      return res.status(403).json({ error: 'No tienes permiso para descargar este documento' });
    }
    
    if (!documentData.ruta_archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    // Obtener el archivo desde Firebase Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(documentData.ruta_archivo);
    
    // Verificar que el archivo existe
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Archivo no encontrado en el almacenamiento' });
    }
    
    // Configurar headers para descarga
    res.setHeader('Content-Disposition', `attachment; filename="${documentData.nombre_original || 'documento'}"`);
    res.setHeader('Content-Type', documentData.tipo_archivo || 'application/octet-stream');
    
    // Stream del archivo
    const stream = file.createReadStream();
    stream.pipe(res);
    
    stream.on('error', (error) => {
      console.error('Error al descargar archivo:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error al descargar el archivo' });
      }
    });
    
  } catch (error) {
    console.error('Error al descargar documento:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al descargar el documento' });
    }
  }
});

// Ruta para eliminar un documento
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('documentos').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    const documentData = doc.data();
    
    // Verificar que el documento pertenezca al usuario
    if (documentData.id_user !== req.usuario.uid) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este documento' });
    }
    
    // Eliminar archivo de Firebase Storage
    if (documentData.ruta_archivo) {
      try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(documentData.ruta_archivo);
        await file.delete();
      } catch (storageError) {
        console.error('Error al eliminar archivo de storage:', storageError);
        // Continuar con la eliminación del documento aunque falle el storage
      }
    }
    
    // Eliminar documento de Firestore
    await docRef.delete();
    
    try {
      await addHistoryEntry({
        userId: req.usuario.uid,
        actionType: 'DELETE_DOCUMENT',
        entityType: 'document',
        entityId: req.params.id,
        details: {
          fileName: documentData.nombre_original,
          idPredio: documentData.id_predio
        }
      });
    } catch (historyError) {
      console.error('Error adding history entry for delete document:', historyError);
    }
    res.json({ message: 'Documento eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    res.status(500).json({ error: 'Error al eliminar el documento' });
  }
});

// Ruta para obtener documentos de un predio específico
router.get('/predio/:predioId', async (req, res) => {
  try {
    const { predioId } = req.params;
    
    // Verificar que el predio pertenezca al usuario
    const predioRef = db.collection('predios').doc(predioId);
    const predioDoc = await predioRef.get();
    
    if (!predioDoc.exists) {
      return res.status(404).json({ error: 'Predio no encontrado' });
    }
    
    const predioData = predioDoc.data();
    if (predioData.id_user !== req.usuario.uid) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a los documentos de este predio' });
    }
    
    // Obtener documentos del predio
    const snapshot = await db.collection('documentos')
      .where('id_predio', '==', predioId)
      .where('id_user', '==', req.usuario.uid)
      .get();
    
    const documentos = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      documentos.push({
        _id: doc.id,
        ...data,
        fecha_subida: data.fecha_subida ? data.fecha_subida.toDate() : null,
        fecha_creacion: data.fecha_creacion ? data.fecha_creacion.toDate() : null
      });
    });
    
    // Ordenar por fecha de subida (más recientes primero)
    documentos.sort((a, b) => {
      const dateA = a.fecha_subida || new Date(0);
      const dateB = b.fecha_subida || new Date(0);
      return dateB - dateA;
    });
    
    res.json(documentos);
  } catch (error) {
    console.error('Error al obtener documentos del predio:', error);
    res.status(500).json({ error: 'Error al obtener los documentos del predio' });
  }
});

// Ruta para actualizar un documento
router.put('/:id', async (req, res) => {
  try {
    const { nombre, estado } = req.body;
    const docRef = db.collection('documentos').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    const documentData = doc.data();
    
    // Verificar que el documento pertenezca al usuario
    if (documentData.id_user !== req.usuario.uid) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este documento' });
    }
    
    const updateData = {
      fecha_modificacion: new Date()
    };
    
    if (nombre) updateData.nombre = nombre;
    if (estado) updateData.estado = estado;
    
    await docRef.update(updateData);
    
    res.json({ message: 'Documento actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar documento:', error);
    res.status(500).json({ error: 'Error al actualizar el documento' });
  }
});

/**
 * @swagger
 * /classify-document:
 *   post:
 *     summary: Classifies the provided text using the Python ML service.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *                 description: The text content to classify.
 *                 example: "Este es el contenido de un contrato de trabajo."
 *     responses:
 *       200:
 *         description: Classification successful. Returns the prediction from the ML model.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 prediction:
 *                   type: string
 *                 confidence:
 *                   type: number
 *                 all_probabilities:
 *                   type: array
 *                   items:
 *                     type: array
 *       400:
 *         description: Bad request (e.g., missing 'text' field).
 *       500:
 *         description: Internal server error or error communicating with the classification service.
 */
router.post('/classify-document', async (req, res) => {
    console.log(`[${new Date().toISOString()}] Received request for /api/documentos/classify-document`);
    const { text } = req.body;

    if (!text) {
        console.warn(`[${new Date().toISOString()}] Bad request to /api/documentos/classify-document: Text field is missing`);
        return res.status(400).json({ error: 'Text field is required' });
    }

    try {
        const flaskServiceUrl = 'http://localhost:5000/classify';
        console.log(`[${new Date().toISOString()}] Forwarding request to Flask service at ${flaskServiceUrl}`);
        const response = await axios.post(flaskServiceUrl, { text });

        console.log(`[${new Date().toISOString()}] Successfully received response from Flask service for /api/documentos/classify-document`);
        res.status(response.status).json(response.data);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in /api/documentos/classify-document: ${error.message}`);
        if (error.response) {
            console.error(`[${new Date().toISOString()}] Flask service response error: Status ${error.response.status}`, error.response.data);
            res.status(error.response.status).json({ 
                error: 'Error from classification service', 
                details: error.response.data 
            });
        } else if (error.request) {
            console.error(`[${new Date().toISOString()}] No response from Flask service. Ensure it is running at http://localhost:5000/classify.`);
            res.status(503).json({ error: 'Classification service unavailable. No response.' }); // 503 Service Unavailable
        } else {
            console.error(`[${new Date().toISOString()}] Axios request setup error:`, error.message);
            res.status(500).json({ error: 'Internal server error setting up request to classification service' });
        }
    }
});

module.exports = router;