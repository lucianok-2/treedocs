// Objeto para almacenar las funciones de ayuda para modales
window.modalHelpers = {
  // Modal para añadir propiedad
  showAddPropertyModal: function() {
    const modal = document.getElementById('add-property-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  },
  
  closeAddPropertyModal: function() {
    const modal = document.getElementById('add-property-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  },
  
  // Modal para editar propiedad
  showEditPropertyModal: function(propertyId) {
    const modal = document.getElementById('edit-property-modal');
    if (modal) {
      modal.classList.remove('hidden');
      // Guardar el ID de la propiedad para usarlo al guardar
      modal.dataset.propertyId = propertyId;
    }
  },
  
  closeEditPropertyModal: function() {
    const modal = document.getElementById('edit-property-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  },
  
  // Modal para subir documentos
  openUploadModal: function(typeId, typeName, propertyId) {
    const modal = document.getElementById('upload-modal');
    if (modal) {
      document.getElementById('modal-title').textContent = `Subir Documento: ${typeName}`;
      document.getElementById('document-type-id').value = typeId;
      // Store the document type name in a new hidden input or update if exists
      let typeNameElement = document.getElementById('document-type-name');
      if (!typeNameElement) {
        
        console.error('Hidden input with ID "document-type-name" not found. Please add it to the upload modal HTML.');
        
      }
      
      if (document.getElementById('document-type-name')) {
          document.getElementById('document-type-name').value = typeName;
      } // else, it's handled by the console error above.
      
      document.getElementById('property-id').value = propertyId;
      
      // Limpiar el formulario
      const form = document.getElementById('upload-form');
      if (form) {
        form.reset();
      }
      
      const selectedFileText = document.getElementById('selected-file');
      if (selectedFileText) {
        selectedFileText.classList.add('hidden');
        selectedFileText.textContent = '';
      }
      
      modal.classList.remove('hidden');
    }
  },
  
  closeUploadModal: function() {
    const modal = document.getElementById('upload-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }
};

// Función para alternar la sección de intermediario
function toggleIntermediarySection() {
  const purchaseModel = document.getElementById('purchase-model');
  const intermediarySection = document.getElementById('intermediary-section');
  
  if (purchaseModel && intermediarySection) {
    if (purchaseModel.value === 'Intermediario') {
      intermediarySection.classList.remove('hidden');
    } else {
      intermediarySection.classList.add('hidden');
    }
  }
}

// Función para mostrar el modal de añadir propiedad
function showAddPropertyModal() {
  if (window.modalHelpers) {
    window.modalHelpers.showAddPropertyModal();
  }
}

// Función para mostrar un modal
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

// Función para ocultar un modal
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// Función para cerrar modales cuando se hace clic fuera de ellos
document.addEventListener('click', function(event) {
  const modals = document.querySelectorAll('.fixed.inset-0.bg-gray-900.bg-opacity-50');
  modals.forEach(modal => {
    if (event.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  });
});

// Modal para carga masiva
window.modalHelpers.showBulkUploadModal = function() {
  const modal = document.getElementById('bulk-upload-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.modalHelpers.closeBulkUploadModal = function() {
  const modal = document.getElementById('bulk-upload-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');

    // Limpiar el input de archivos
    const bulkFileInput = document.getElementById('bulk-file-input');
    if (bulkFileInput) {
      bulkFileInput.value = ''; // Clear the selected file
    }

    // Limpiar y ocultar el feedback
    const bulkUploadFeedback = document.getElementById('bulk-upload-feedback');
    if (bulkUploadFeedback) {
      bulkUploadFeedback.classList.add('hidden');
      bulkUploadFeedback.textContent = '';
    }

    // Re-habilitar el botón de procesar
    const processBulkFilesButton = document.getElementById('process-bulk-files-button');
    if (processBulkFilesButton) {
      processBulkFilesButton.disabled = false;
    }
  }
};

// Agregar los event listeners para el modal de carga masiva
document.addEventListener('DOMContentLoaded', function() {
  const bulkUploadButton = document.getElementById('bulk-upload-button');
  const closeBulkUploadModal = document.getElementById('close-bulk-upload-modal');
  const cancelBulkUpload = document.getElementById('cancel-bulk-upload');

  if (bulkUploadButton) {
    bulkUploadButton.addEventListener('click', function() {
      window.modalHelpers.showBulkUploadModal();
    });
  }

  if (closeBulkUploadModal) {
    closeBulkUploadModal.addEventListener('click', function() {
      window.modalHelpers.closeBulkUploadModal();
    });
  }

  if (cancelBulkUpload) {
    cancelBulkUpload.addEventListener('click', function() {
      window.modalHelpers.closeBulkUploadModal();
    });
  }

  // Cerrar modal al hacer clic fuera
  const bulkUploadModal = document.getElementById('bulk-upload-modal');
  if (bulkUploadModal) {
    bulkUploadModal.addEventListener('click', function(event) {
      if (event.target === this) {
        window.modalHelpers.closeBulkUploadModal();
      }
    });
  }
});