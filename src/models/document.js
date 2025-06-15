const { db } = require('../firebase');


// Colección de documentos en Firebase
const documentsCollection = db.collection('documents'); // Usaremos 'documents'

// Funciones para manejar documentos en Firebase
const documentModel = {
  // Obtener todos los documentos (podrías necesitar filtros para userId, projectId)
  getAllProcessedDocuments: async (userId, projectId) => {
    try {
      let query = documentsCollection;
      if (userId) {
        query = query.where('userId', '==', userId);
      }
      if (projectId) {
        query = query.where('projectId', '==', projectId);
      }
      const snapshot = await query.orderBy('uploadDate', 'desc').get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error al obtener documentos procesados:', error);
      throw error;
    }
  },

  getProcessedDocumentById: async (documentId) => {
    try {
      const docRef = documentsCollection.doc(documentId);
      const doc = await docRef.get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error al obtener documento por ID:', error);
      throw error;
    }
  },

  // Agregar un nuevo documento (adaptado para el nuevo schema)
  addProcessedDocument: async (documentData) => {
    try {
      const docWithTimestamp = {
        ...documentData,
        uploadDate: new Date(),
        status: 'uploaded', // Estado inicial
      };
      
      const docRef = await documentsCollection.add(docWithTimestamp);
      return {
        id: docRef.id,
        ...docWithTimestamp
      };
    } catch (error) {
      console.error('Error al agregar documento procesado:', error);
      throw error;
    }
  },

  // Actualizar un documento existente (para OCR, ediciones manuales, etc.)
  updateProcessedDocument: async (documentId, dataToUpdate) => {
    try {
      const docRef = documentsCollection.doc(documentId);
      const updateData = {
        ...dataToUpdate,
        // Si 'processedDate' se establece al completar OCR, agrégalo aquí condicionalmente
        // Si 'status' cambia, también se actualiza aquí
      };
      if (dataToUpdate.status === 'processed' && !dataToUpdate.processedDate) {
        updateData.processedDate = new Date();
      }
      
      await docRef.update(updateData);
      const updatedDoc = await docRef.get();
      return {
        id: documentId,
        ...updatedDoc.data()
      };
    } catch (error) {
      console.error('Error al actualizar documento procesado:', error);
      throw error;
    }
  },

  // Eliminar un documento
  deleteProcessedDocument: async (documentId) => {
    try {
      await documentsCollection.doc(documentId).delete();
      // Aquí también deberías eliminar el archivo físico de /uploads
      return { id: documentId, deleted: true };
    } catch (error) {
      console.error('Error al eliminar documento procesado:', error);
      throw error;
    }
  },

  // Obtener tipos de documentos
  getDocumentTypes: () => {
    return documentTypes; // Retorna la lista actualizada
  },

  
};

module.exports = {
  documentModel,
  DOCUMENT_TYPES, // Puede que necesites actualizar esto también
  documentTypes,
  
};