function toggleIntermediarySection(formType) {
  const section = document.getElementById(`${formType}-intermediary-section`);
  const purchaseModel = document.getElementById(`${formType}-purchase-model`);
  
  if (purchaseModel && section) {
    if (purchaseModel.value === 'Intermediario') {
      section.classList.remove('hidden');
      // Hacer campos de intermediario requeridos
      const intermediaryName = document.getElementById(`${formType}-intermediary-name`);
      const intermediaryRut = document.getElementById(`${formType}-intermediary-rut`);
      
      if (intermediaryName) intermediaryName.setAttribute('required', '');
      if (intermediaryRut) intermediaryRut.setAttribute('required', '');
    } else {
      section.classList.add('hidden');
      // Quitar required de los campos de intermediario
      const intermediaryName = document.getElementById(`${formType}-intermediary-name`);
      const intermediaryRut = document.getElementById(`${formType}-intermediary-rut`);
      
      if (intermediaryName) intermediaryName.removeAttribute('required');
      if (intermediaryRut) intermediaryRut.removeAttribute('required');
    }
  }
}

// Función para manejar los checkboxes de certificación
function setupCertificationCheckboxes() {
  const certCheckboxes = document.querySelectorAll('.certification-checkbox');
  
  certCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const checkboxId = this.id;
      const codeInputId = checkboxId + '-code';
      const codeInput = document.getElementById(codeInputId);
      
      if (codeInput) {
        if (this.checked) {
          codeInput.classList.remove('hidden');
        } else {
          codeInput.classList.add('hidden');
          codeInput.value = '';
        }
      }
      
      // Si se marca "Sin Certificación", desmarcar las otras
      if ((checkboxId === 'edit-cert-none' || checkboxId === 'add-cert-none') && this.checked) {
        const prefix = checkboxId.startsWith('edit') ? 'edit' : 'add';
        const otherCheckboxes = document.querySelectorAll(`#${prefix}-cert-fsc, #${prefix}-cert-pefc`);
        
        otherCheckboxes.forEach(cb => {
          cb.checked = false;
          const otherCodeInput = document.getElementById(cb.id + '-code');
          if (otherCodeInput) {
            otherCodeInput.classList.add('hidden');
            otherCodeInput.value = '';
          }
        });
      }
      
      // Si se marca alguna certificación, desmarcar "Sin Certificación"
      if ((checkboxId === 'edit-cert-fsc' || checkboxId === 'edit-cert-pefc' || 
           checkboxId === 'add-cert-fsc' || checkboxId === 'add-cert-pefc') && this.checked) {
        const prefix = checkboxId.startsWith('edit') ? 'edit' : 'add';
        const noneCheckbox = document.getElementById(`${prefix}-cert-none`);
        if (noneCheckbox) {
          noneCheckbox.checked = false;
        }
      }
    });
  });
}

// Función para cargar detalles del predio
function loadPropertyDetails(propertyId) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('No se encontró un token de autenticación. Por favor, inicie sesión nuevamente.');
    window.location.href = '/';
    return;
  }
  
  // Mostrar secciones de detalles
  document.getElementById('property-details').classList.remove('hidden');
  document.getElementById('property-documents').classList.remove('hidden');
  
  // Mostrar mensaje de carga
  document.getElementById('property-info').innerHTML = '<p class="text-gray-500 text-center py-4">Cargando detalles del predio...</p>';
  
  fetch(`/api/predios/${propertyId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Error al cargar los detalles del predio');
    }
    return response.json();
  })
  .then(property => {
    // Rellenar información del predio
    const propertyInfo = document.getElementById('property-info');
    propertyInfo.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-gray-500">ID del Predio</p>
          <p class="font-medium">${property.idPredio || 'No especificado'}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500">Nombre del Predio</p>
          <p class="font-medium">${property.nombre}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500">Rol</p>
          <p class="font-medium">${property.rol || 'No especificado'}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500">Modelo de Compra</p>
          <p class="font-medium">${property.modeloCompra || 'Propietario'}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500">RUT Propietario</p>
          <p class="font-medium">${property.rutPropietario || 'No especificado'}</p>
        </div>
      </div>
    `;
    
    // Actualizar los botones con el ID del predio
    const editBtn = document.getElementById('edit-property-btn');
    if (editBtn) {
      editBtn.dataset.propertyId = propertyId;
    }
    
    const deleteBtn = document.getElementById('delete-property-btn');
    if (deleteBtn) {
      deleteBtn.dataset.propertyId = propertyId;
    }
    
    // Cargar documentos del predio
    try {
      loadPropertyDocuments(propertyId);
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      const documentList = document.getElementById('document-list');
      if (documentList) {
        documentList.innerHTML = '<p class="text-red-500 text-center py-4">Error al cargar los documentos</p>';
      }
    }
  })
  .catch(error => {
    console.error('Error:', error);
    document.getElementById('property-info').innerHTML = '<p class="text-red-500 text-center py-4">Error al cargar los detalles del predio</p>';
  });
}

// Función para cargar la lista de predios
function loadProperties() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('No se encontró un token de autenticación. Por favor, inicie sesión nuevamente.');
    window.location.href = '/';
    return;
  }
  
  // Mostrar mensaje de carga
  const propertyList = document.getElementById('property-list');
  if (propertyList) {
    propertyList.innerHTML = '<p class="text-gray-500 text-center py-4">Cargando predios...</p>';
  }
  
  fetch('/api/predios', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Error al cargar los predios');
    }
    return response.json();
  })
  .then(properties => {
    if (propertyList) {
      if (properties.length === 0) {
        propertyList.innerHTML = '<p class="text-gray-500 text-center py-4">No hay predios registrados</p>';
      } else {
        propertyList.innerHTML = '';
        properties.forEach(property => {
          const propertyItem = document.createElement('div');
          propertyItem.className = 'border-b last:border-b-0 py-3 px-4 hover:bg-gray-50 cursor-pointer';
          propertyItem.dataset.propertyId = property._id;
          propertyItem.innerHTML = `
            <h4 class="font-medium text-gray-800">${property.nombre}</h4>
            <p class="text-sm text-gray-500">ID: ${property.idPredio || 'No especificado'}</p>
            <p class="text-sm text-gray-500">Rol: ${property.rol || 'No especificado'}</p>
          `;
          
          // Añadir evento para mostrar detalles al hacer clic
          propertyItem.addEventListener('click', function() {
            const propertyId = this.dataset.propertyId;
            loadPropertyDetails(propertyId);
          });
          
          propertyList.appendChild(propertyItem);
        });
      }
    }
  })
  .catch(error => {
    console.error('Error:', error);
    if (propertyList) {
      propertyList.innerHTML = '<p class="text-red-500 text-center py-4">Error al cargar los predios</p>';
    }
  });
}

// Inicializar eventos cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // Cargar lista de predios
  loadProperties();
  
  // Configurar botón de añadir predio
  const addPropertyBtn = document.getElementById('add-property-btn');
  if (addPropertyBtn) {
    addPropertyBtn.addEventListener('click', function() {
      showAddPropertyModal();
    });
  }
  
  // Configurar botones para cerrar modales
  const closeAddModalBtn = document.getElementById('close-add-modal');
  if (closeAddModalBtn) {
    closeAddModalBtn.addEventListener('click', closeAddPropertyModal);
  }
  
  const closeEditModalBtn = document.getElementById('close-edit-modal');
  if (closeEditModalBtn) {
    closeEditModalBtn.addEventListener('click', closeEditPropertyModal);
  }
  
  // Configurar botones para cancelar en modales
  const cancelAddPropertyBtn = document.getElementById('cancel-add-property');
  if (cancelAddPropertyBtn) {
    cancelAddPropertyBtn.addEventListener('click', closeAddPropertyModal);
  }
  
  const cancelEditPropertyBtn = document.getElementById('cancel-edit-property');
  if (cancelEditPropertyBtn) {
    cancelEditPropertyBtn.addEventListener('click', closeEditPropertyModal);
  }
  
  // Configurar el formulario para añadir predio
  const addPropertyForm = document.getElementById('add-property-form');
  if (addPropertyForm) {
    addPropertyForm.addEventListener('submit', function(e) {
      e.preventDefault();
      saveProperty(this);
    });
  }
  
  // Configurar el formulario para editar predio
  const editPropertyForm = document.getElementById('edit-property-form');
  if (editPropertyForm) {
    editPropertyForm.addEventListener('submit', function(e) {
      e.preventDefault();
      updateProperty(this);
    });
  }
  
  // Configurar botones de editar y eliminar predio
  const editPropertyBtn = document.getElementById('edit-property-btn');
  if (editPropertyBtn) {
    editPropertyBtn.addEventListener('click', function() {
      const propertyId = this.dataset.propertyId;
      if (propertyId) {
        editProperty(propertyId);
      } else {
        alert('No se ha seleccionado un predio para editar');
      }
    });
  }
  
  const deletePropertyBtn = document.getElementById('delete-property-btn');
  if (deletePropertyBtn) {
    deletePropertyBtn.addEventListener('click', function() {
      const propertyId = this.dataset.propertyId;
      if (propertyId) {
        if (confirm('¿Está seguro de que desea eliminar este predio?')) {
          deleteProperty(propertyId);
        }
      } else {
        alert('No se ha seleccionado un predio para eliminar');
      }
    });
  }
  
  // Configurar cambios en el modelo de compra para el formulario de añadir
  const addPurchaseModel = document.getElementById('add-purchase-model');
  if (addPurchaseModel) {
    addPurchaseModel.addEventListener('change', function() {
      toggleIntermediarySection('add');
    });
  }
  
  // Configurar cambios en el modelo de compra para el formulario de editar
  const editPurchaseModel = document.getElementById('edit-purchase-model');
  if (editPurchaseModel) {
    editPurchaseModel.addEventListener('change', function() {
      toggleIntermediarySection('edit');
    });
  }
  
  // Configurar checkboxes de certificación
  setupCertificationCheckboxes();
  
  // Inicializar estado de sección de intermediario
  toggleIntermediarySection('add');
  toggleIntermediarySection('edit');
});

// Función para mostrar el modal de añadir predio
function showAddPropertyModal() {
  const modal = document.getElementById('add-property-modal');
  if (modal) {
    modal.classList.remove('hidden');
    
    // Limpiar el formulario
    const form = document.getElementById('add-property-form');
    if (form) {
      form.reset();
    }
    // Activar por defecto la opción de predio activo
    const addActive = document.getElementById('add-property-active');
    if (addActive) addActive.checked = true;

    // Reiniciar estado de sección de intermediario
    toggleIntermediarySection('add');
  } else {
    console.error('No se encontró el modal de añadir predio');
  }
}

// Función para cerrar el modal de añadir predio
function closeAddPropertyModal() {
  const modal = document.getElementById('add-property-modal');
  if (modal) {
    modal.classList.add('hidden');
  } else {
    console.error('No se encontró el modal de añadir predio');
  }
}

// Función para cerrar el modal de editar predio
function closeEditPropertyModal() {
  const modal = document.getElementById('edit-property-modal');
  if (modal) {
    modal.classList.add('hidden');
  } else {
    console.error('No se encontró el modal de editar predio');
  }
}

// Función para editar un predio
function editProperty(propertyId) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('No se encontró un token de autenticación. Por favor, inicie sesión nuevamente.');
    window.location.href = '/';
    return;
  }
  
  // Obtener los detalles del predio para llenar el formulario
  fetch(`/api/predios/${propertyId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Error al cargar los detalles del predio');
    }
    return response.json();
  })
  .then(property => {
    // Mostrar el modal de editar predio
    const modal = document.getElementById('edit-property-modal');
    if (modal) {
      // Llenar el formulario con los datos del predio
      document.getElementById('edit-property-name').value = property.nombre || '';
      document.getElementById('edit-property-rol').value = property.rol || '';
      document.getElementById('edit-purchase-model').value = property.modeloCompra || 'Propietario';
      document.getElementById('edit-owner-rut').value = property.rutPropietario || '';
      document.getElementById('edit-owner-name').value = property.nombrePropietario || '';
      
      // Estado activo del predio
      const activeChk = document.getElementById('edit-property-active');
      if (activeChk) activeChk.checked = property.is_active !== false;
      // Si tiene intermediario, llenar esos campos también
      if (property.modeloCompra === 'Intermediario' && property.intermediario) {
        document.getElementById('edit-intermediary-name').value = property.intermediario.nombre || '';
        document.getElementById('edit-intermediary-rut').value = property.intermediario.rut || '';
      }
      
      // Actualizar la visibilidad de la sección de intermediario
      toggleIntermediarySection('edit');
      
      // Guardar el ID del predio en el formulario
      const form = document.getElementById('edit-property-form');
      if (form) {
        form.dataset.propertyId = propertyId;
      }
      
      // Mostrar el modal
      modal.classList.remove('hidden');
    } else {
      alert('No se encontró el modal de editar predio');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Error al cargar los detalles del predio para editar');
  });
}

// Función para eliminar un predio
function deleteProperty(propertyId) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('No se encontró un token de autenticación. Por favor, inicie sesión nuevamente.');
    window.location.href = '/';
    return;
  }
  
  fetch(`/api/predios/${propertyId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Error al eliminar el predio');
    }
    return response.json();
  })
  .then(data => {
    alert('Predio eliminado correctamente');
    
    // Ocultar las secciones de detalles
    document.getElementById('property-details').classList.add('hidden');
    document.getElementById('property-documents').classList.add('hidden');
    
    // Recargar la lista de predios
    loadProperties();
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Error al eliminar el predio');
  });
}

// Función para cargar los documentos de un predio
function loadPropertyDocuments(propertyId) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('No se encontró un token de autenticación. Por favor, inicie sesión nuevamente.');
    window.location.href = '/';
    return;
  }
  
  const documentList = document.getElementById('document-list');
  if (documentList) {
    documentList.innerHTML = '<p class="text-gray-500 text-center py-4">Cargando documentos...</p>';
    
    // Realizar la petición para obtener los documentos del predio
    fetch(`/api/predios/${propertyId}/documentos`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al cargar los documentos');
      }
      return response.json();
    })
    .then(data => {
      if (data.length === 0) {
        documentList.innerHTML = '<p class="text-gray-500 text-center py-4">No hay documentos disponibles</p>';
      } else {
        documentList.innerHTML = '';
        data.forEach(document => {
          const documentItem = document.createElement('div');
          documentItem.className = 'mb-4 p-4 border rounded-lg';
          documentItem.innerHTML = `
            <div class="flex justify-between items-center">
              <div>
                <div class="font-medium">${document.nombre || 'Nombre no disponible'}</div>
                <div class="text-sm text-gray-600">${document.fecha_subida ? new Date(document.fecha_subida).toLocaleDateString() : 'Fecha no disponible'}</div>
              </div>
              <div>
                <a href="${document.url_archivo || '#'}" target="_blank" class="text-blue-600 hover:text-blue-800 mr-2 ${!document.url_archivo ? 'hidden' : ''}">Ver</a>
                <button class="text-red-600 hover:text-red-800 delete-document" data-id="${document._id}">Eliminar</button>
              </div>
            </div>
          `;
          documentList.appendChild(documentItem);
        });
        
        // Agregar event listeners a los botones de eliminar
        const deleteButtons = documentList.querySelectorAll('.delete-document');
        deleteButtons.forEach(button => {
          button.addEventListener('click', function() {
            const documentId = this.getAttribute('data-id');
            if (confirm('¿Está seguro de que desea eliminar este documento?')) {
              deleteDocument(propertyId, documentId);
            }
          });
        });
      }
    })
    .catch(error => {
      console.error('Error:', error);
      documentList.innerHTML = '<p class="text-red-500 text-center py-4">Error al cargar los documentos</p>';
    });
  }
}

// Función para eliminar un documento
function deleteDocument(propertyId, documentId) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('No se encontró un token de autenticación. Por favor, inicie sesión nuevamente.');
    window.location.href = '/';
    return;
  }
  
  fetch(`/api/predios/${propertyId}/documentos/${documentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Error al eliminar el documento');
    }
    return response.json();
  })
  .then(data => {
    alert('Documento eliminado correctamente');
    loadPropertyDocuments(propertyId);
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Error al eliminar el documento');
  });
}

function updateProperty(form) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('No se encontró un token de autenticación. Por favor, inicie sesión nuevamente.');
    window.location.href = '/';
    return;
  }
  
  console.log('Actualizando predio...');
  
  // Obtener el ID del predio a actualizar
  const propertyId = form.dataset.propertyId;
  if (!propertyId) {
    alert('No se encontró el ID del predio a actualizar');
    return;
  }
  
  console.log('ID del predio a actualizar:', propertyId);
  
  // Crear objeto con los datos del formulario
  const formData = new FormData(form);
  
  // Obtener todos los campos del formulario con los nombres correctos
  const nombre = document.getElementById('edit-property-name').value;
  const rol = document.getElementById('edit-property-rol').value;
  const modeloCompra = document.getElementById('edit-purchase-model').value;
  const rutPropietario = document.getElementById('edit-owner-rut').value;
  const nombrePropietario = document.getElementById('edit-owner-name').value;
  const ubicacion = formData.get('ubicacion') || '';
  
  // Obtener información de certificaciones
  const certificaciones = [];
  if (document.getElementById('edit-cert-fsc').checked) {
    const codigo = document.getElementById('edit-cert-fsc-code').value || '';
    certificaciones.push({
      tipo: 'FSC',
      codigo: codigo,
      activo: true
    });
  }
  if (document.getElementById('edit-cert-pefc').checked) {
    const codigo = document.getElementById('edit-cert-pefc-code').value || '';
    certificaciones.push({
      tipo: 'PEFC',
      codigo: codigo,
      activo: true
    });
  }
  if (document.getElementById('edit-cert-none').checked) {
    certificaciones.push({
      tipo: 'NINGUNA',
      codigo: '',
      activo: true
    });
  }
  
  // Crear objeto con los datos principales del predio
  const propertyData = {
    nombre: nombre,
    rol: rol,
    modeloCompra: modeloCompra,
    rutPropietario: rutPropietario,
    nombrePropietario: nombrePropietario,
    ubicacion: ubicacion,
    certificaciones: certificaciones,
    is_active: document.getElementById('edit-property-active').checked
  };
  
  // Si el modelo de compra es Intermediario, añadir esos datos
  if (modeloCompra === 'Intermediario') {
    const nombreIntermediario = document.getElementById('edit-intermediary-name').value;
    const rutIntermediario = document.getElementById('edit-intermediary-rut').value;
    
    propertyData.intermediario = {
      nombre: nombreIntermediario,
      rut: rutIntermediario
    };
  }
  
  console.log('Datos actualizados del predio:', propertyData);
  
  // Enviar datos al servidor
  fetch(`/api/predios/${propertyId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(propertyData)
  })
  .then(response => {
    console.log('Respuesta del servidor:', response);
    if (!response.ok) {
      return response.text().then(text => {
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || 'Error al actualizar el predio');
        } catch (e) {
          throw new Error(`Error al actualizar el predio: ${response.status} ${response.statusText}. Detalles: ${text}`);
        }
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('Predio actualizado:', data);
    alert('Predio actualizado correctamente');
    // Cerrar el modal de edición
    const modal = document.getElementById('edit-property-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    // Recargar los detalles del predio
    loadPropertyDetails(propertyId);
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Error al actualizar el predio: ' + error.message);
  });
}

function saveProperty(form) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('No se encontró un token de autenticación. Por favor, inicie sesión nuevamente.');
    window.location.href = '/';
    return;
  }
  
  console.log('Guardando predio...');
  
  // Generar un ID de predio único
  const fechaActual = new Date();
  const año = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
  const dia = String(fechaActual.getDate()).padStart(2, '0');
  const hora = String(fechaActual.getHours()).padStart(2, '0');
  const minutos = String(fechaActual.getMinutes()).padStart(2, '0');
  const segundos = String(fechaActual.getSeconds()).padStart(2, '0');
  
  // Formato: PRED-AAAAMMDD-HHMMSS
  const idPredio = `PRED-${año}${mes}${dia}-${hora}${minutos}${segundos}`;
  console.log('ID de predio generado:', idPredio);
  
  // Obtener valores directamente por ID (no por FormData)
  const nombre = document.getElementById('add-property-name').value;
  const rol = document.getElementById('add-property-rol').value;
  const modeloCompra = document.getElementById('add-purchase-model').value;
  const rutPropietario = document.getElementById('add-owner-rut').value;
  const nombrePropietario = document.getElementById('add-owner-name').value;
  
  // Obtener información de certificaciones
  const certificaciones = [];
  if (document.getElementById('add-cert-fsc').checked) {
    const codigo = document.getElementById('add-cert-fsc-code').value || '';
    certificaciones.push({
      tipo: 'FSC',
      codigo: codigo,
      activo: true
    });
  }
  if (document.getElementById('add-cert-pefc').checked) {
    const codigo = document.getElementById('add-cert-pefc-code').value || '';
    certificaciones.push({
      tipo: 'PEFC',
      codigo: codigo,
      activo: true
    });
  }
  if (document.getElementById('add-cert-none').checked) {
    certificaciones.push({
      tipo: 'NINGUNA',
      codigo: '',
      activo: true
    });
  }
  
  // Crear objeto con los datos principales del predio
  const propertyData = {
    idPredio: idPredio,
    nombre: nombre,
    rol: rol,
    modeloCompra: modeloCompra,
    rutPropietario: rutPropietario,
    nombrePropietario: nombrePropietario,
    certificaciones: certificaciones,
    fechaCreacion: new Date().toISOString(),
    is_active: document.getElementById('add-property-active').checked
  };
  
  // Si el modelo de compra es Intermediario, añadir esos datos
  if (modeloCompra === 'Intermediario') {
    const nombreIntermediario = document.getElementById('add-intermediary-name').value;
    const rutIntermediario = document.getElementById('add-intermediary-rut').value;
    
    propertyData.intermediario = {
      nombre: nombreIntermediario,
      rut: rutIntermediario
    };
  }
  
  console.log('Datos del predio a guardar:', propertyData);
  
  // Enviar datos al servidor
  fetch('/api/predios', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(propertyData)
  })
  .then(response => {
    console.log('Respuesta del servidor:', response);
    if (!response.ok) {
      return response.text().then(text => {
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || 'Error al guardar el predio');
        } catch (e) {
          throw new Error(`Error al guardar el predio: ${response.status} ${response.statusText}. Detalles: ${text}`);
        }
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('Predio guardado:', data);
    alert('Predio guardado correctamente');
    closeAddPropertyModal();
    loadProperties();
  })
  .catch(error => {
    console.error('Error:', error);
    alert(`Error al guardar el predio: ${error.message}`);
  });
}
