// Estas funciones son solo un esqueleto y deberán ser implementadas
// con la lógica real para cargar datos desde Firebase/Firestore

// Variable global para almacenar el predio actual
let currentPropertyId = null;
let currentDocumentId = null;
// Función para abrir el modal del predio
async function openProperty(propertyId) {
    currentPropertyId = propertyId;
    // Mostrar el modal
    document.getElementById('propertyModal').classList.remove('hidden');
    document.body.classList.add('overflow-hidden');

    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No se encontró el token.'); // Updated error message
        document.getElementById('modalPropertyTitle').textContent = 'Error de autenticación';
        // Considera mostrar un mensaje más amigable al usuario o redirigir al login
        return;
    }

    try {
        // Cargar datos del predio seleccionado
        const response = await fetch(`/api/predios/${propertyId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        // Actualizar la UI con los datos del predio
        document.getElementById('modalPropertyTitle').textContent = data.nombre || 'Predio sin nombre';
        document.getElementById('modalPropertyAddress').textContent = data.ubicacion || 'Sin dirección';
        document.getElementById('modalPropertyRut').textContent = data.rutPropietario || 'Sin RUT';
        
        // Cargar los documentos del predio
        await loadPropertyDocuments(propertyId);

    } catch (error) {
        console.error('Error al cargar los datos del predio:', error);
        document.getElementById('modalPropertyTitle').textContent = 'Error al cargar el predio';
        // Aquí podrías limpiar otras partes del modal o mostrar un mensaje de error específico
    }
}

// Función para cargar los documentos de un predio
async function loadPropertyDocuments(propertyId) {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No se encontró el token para cargar documentos.'); // Updated error message
        const documentsList = document.getElementById('documents-list');
        if (documentsList) {
            documentsList.innerHTML = '<div class="p-4 text-center text-red-500">Error de autenticación al cargar documentos.</div>';
        }
        return;
    }

    try {
        // Cargar los documentos desde Firestore a través de la API
        const response = await fetch(`/api/predios/${propertyId}/documentos`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} al obtener documentos`);
        }
        const documents = await response.json();
        const documentsList = document.getElementById('documents-list');
            if (!documentsList) { // Asegurarse de que el elemento exista
                console.error('Elemento #documents-list no encontrado.');
                return;
            }
            documentsList.innerHTML = ''; // Limpiar antes de agregar nuevos elementos

            // Fetch document types
            const typesResponse = await fetch('/api/admin/document-types', { // Changed URL path
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!typesResponse.ok) {
                throw new Error(`Error HTTP: ${typesResponse.status} al obtener tipos de documento`);
            }
            const fetchedDocumentTypes = await typesResponse.json();

            // Crear un mapa de documentos existentes por tipo (doc.tipo_documento is expected to be the type name)
            const existingDocsByType = {};
            documents.forEach(doc => {
                if (doc.tipo_documento !== undefined) { // doc.tipo_documento should be the name
                    if (!existingDocsByType[doc.tipo_documento]) {
                        existingDocsByType[doc.tipo_documento] = [];
                    }
                    existingDocsByType[doc.tipo_documento].push(doc);
                }
            });
            
            // Mostrar todos los tipos de documentos dinámicamente
            fetchedDocumentTypes.forEach(type => {
                // Use type.name as the primary identifier for logic
                if (!type.name) { // Check if type.name is valid
                    console.warn('Tipo de documento omitido por nombre indefinido:', type);
                    return;
                }

                const existingDocs = existingDocsByType[type.name] || []; // Use type.name for lookup
                const estado = existingDocs.length > 0 ? 'completo' : 'faltante';
                const docCount = existingDocs.length;
                
                const docElement = document.createElement('div');
                docElement.className = `p-4 hover:bg-blue-50 cursor-pointer border-l-4 border-${getStatusColor(estado)}`;
                docElement.setAttribute('data-document-type', type.name); // Use type.name
                docElement.setAttribute('data-property-id', propertyId);
                
                // Agregar evento click para mostrar documentos del tipo
                docElement.onclick = () => showDocumentsByType(type.name, type.name, propertyId); // Pass type.name as the first argument
                
                docElement.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-medium text-gray-800">${type.name}</h4>
                            <p class="text-sm text-gray-500">${docCount > 0 ? `${docCount} documento(s)` : 'Sin documentos'}</p>
                        </div>
                        <span class="bg-${getStatusBgColor(estado)} text-${getStatusTextColor(estado)} text-xs px-2 py-1 rounded-full">
                            ${getStatusLabel(estado)} ${docCount > 0 ? `(${docCount})` : ''}
                        </span>
                    </div>
                    <div class="flex items-center mt-2 text-sm text-gray-500">
                        <i class="fas fa-file-alt mr-2"></i>
                        <span>${docCount > 0 ? 'Hacer clic para ver documentos' : 'No hay documentos de este tipo'}</span>
                    </div>
                `;
                
                documentsList.appendChild(docElement);
            });

    } catch (error) {
        console.error('Error al cargar los documentos o tipos de documento:', error);
        const documentsList = document.getElementById('documents-list');
        if (documentsList) {
            documentsList.innerHTML = `<div class="p-4 text-center text-red-500">Error al cargar la información de documentos: ${error.message}. Por favor, intenta de nuevo.</div>`;
        }
    }
}

// Nueva función para mostrar documentos por tipo
async function showDocumentsByType(documentTypeNameString, documentTypeNameForModal, propertyId) { // Renamed params for clarity
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No se encontró el token.'); // Updated error message
        alert('Error de autenticación. Por favor, inicie sesión de nuevo.');
        return;
    }

    // Crear parámetros de consulta para filtrar por tipo (name), predio y usuario
    const params = new URLSearchParams({
        tipo_documento: documentTypeNameString, // Use the name for the API query
        id_predio: propertyId
    });
    
    try {
        const response = await fetch(`/api/documentos/buscar?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const documents = await response.json();
        // Mostrar modal o panel con la lista de documentos
        showDocumentsListModal(documents, documentTypeNameForModal); // Use the original type name for modal display

    } catch (error) {
        console.error('Error al cargar documentos por tipo:', error);
        alert('Error al cargar los documentos. Por favor, intenta de nuevo.');
    }
}

// Función para mostrar modal con lista de documentos
function showDocumentsListModal(documents, documentTypeName) {
    // Crear o mostrar modal para lista de documentos
    let documentsModal = document.getElementById('documentsListModal');
    
    if (!documentsModal) {
        // Crear el modal si no existe
        documentsModal = document.createElement('div');
        documentsModal.id = 'documentsListModal';
        documentsModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
        
        documentsModal.innerHTML = `
            <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                <div class="p-6 border-b border-gray-200">
                    <div class="flex justify-between items-center">
                        <h2 id="documentsModalTitle" class="text-2xl font-bold text-gray-800"></h2>
                        <button onclick="closeDocumentsListModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6 overflow-y-auto max-h-[70vh]">
                    <div id="documentsListContent" class="space-y-4">
                        <!-- Aquí se cargarán los documentos -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(documentsModal);
    }
    
    // Actualizar título
    document.getElementById('documentsModalTitle').textContent = `Documentos: ${documentTypeName}`;
    
    // Mostrar documentos
    const documentsListContent = document.getElementById('documentsListContent');
    documentsListContent.innerHTML = '';
    
    if (documents.length === 0) {
        documentsListContent.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-file-alt text-gray-400 text-4xl mb-4"></i>
                <p class="text-gray-500">No hay documentos de este tipo</p>
            </div>
        `;
    } else {
        documents.forEach((doc, index) => { // Added index for clarity if needed, not strictly used here
            const docElement = document.createElement('div');
            docElement.className = 'bg-gray-50 rounded-lg p-4 hover:bg-gray-100 cursor-pointer transition-colors';
            // Pass the actual 'doc' object. Ensure 'doc' is in scope and correctly refers to the iterated document.
            docElement.onclick = () => viewDocument(doc); 
            
            docElement.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="flex-shrink-0">
                            <i class="fas ${getFileIcon(doc.tipo_archivo)} text-2xl text-blue-500"></i>
                        </div>
                        <div>
                            <h3 class="font-medium text-gray-800">${doc.nombre || 'Documento sin nombre'}</h3>
                            <p class="text-sm text-gray-500">
                                ${doc.fecha_subida ? `Subido el ${formatDate(doc.fecha_subida)}` : 'Fecha no disponible'} • ${doc.tamano ? formatFileSize(doc.tamano) : 'Tamaño no disponible'}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="text-blue-500 hover:text-blue-700 p-2">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="text-green-500 hover:text-green-700 p-2">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            `;
            
            // Add event listeners to buttons separately to pass the 'doc' object correctly
            const downloadButton = docElement.querySelector('.fa-download').parentElement;
            downloadButton.onclick = (event) => {
                event.stopPropagation();
                downloadDocument(doc._id); // Assuming doc._id is the correct identifier
            };

            const viewButton = docElement.querySelector('.fa-eye').parentElement;
            viewButton.onclick = (event) => {
                event.stopPropagation();
                viewDocument(doc); // Pass the full doc object
            };
            
            documentsListContent.appendChild(docElement);
        });
    }
    
    // Mostrar modal
    documentsModal.classList.remove('hidden');
}

// Función para cerrar modal de lista de documentos
function closeDocumentsListModal() {
    const documentsModal = document.getElementById('documentsListModal');
    if (documentsModal) {
        documentsModal.classList.add('hidden');
    }
}

// Función para ver un documento específico
function viewDocument(doc) {
    currentDocumentId = document._id || document.id;
    // Cerrar modal de lista
    closeDocumentsListModal();
    
    // Populate document details
    const detailsContainer = document.getElementById('documentDetails');
    if (!detailsContainer) {
        console.error('CRITICAL: Element with ID "documentDetails" not found. This container is required to display document information.');
        // Attempt to show the iframe anyway, but details will be missing.
        const iframe = document.getElementById('documentIframe');
        if (iframe) {
            iframe.src = doc.url_archivo || (firebase.app().options.storageBucket ? `https://firebasestorage.googleapis.com/v0/b/${firebase.app().options.storageBucket}/o/${encodeURIComponent(doc.ruta_archivo)}?alt=media` : 'about:blank');
        }
        document.getElementById('documentPreviewContent').classList.remove('hidden');
        document.getElementById('preview-placeholder').classList.add('hidden');
        return;
    }

    detailsContainer.innerHTML = ''; // Clear previous content

    // Helper function to append detail elements
    const appendDetail = (label, value, isUrl = false) => {
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'mb-3'; // Added margin-bottom for spacing

        const labelP = document.createElement('p');
        labelP.className = 'text-sm text-gray-500';
        labelP.textContent = label;
        wrapperDiv.appendChild(labelP);

        const valueP = document.createElement('p');
        valueP.className = 'font-medium text-gray-800';

        if (isUrl && typeof value === 'string' && value.startsWith('http')) {
            const link = document.createElement('a');
            link.href = value;
            link.target = '_blank';
            link.textContent = 'Ver Archivo'; // Or use a more descriptive text, or the URL itself
            link.className = 'text-blue-600 hover:text-blue-700 underline';
            valueP.appendChild(link);
        } else {
            valueP.textContent = value || '-';
        }
        wrapperDiv.appendChild(valueP);
        detailsContainer.appendChild(wrapperDiv);
    };

    // Append Standard/Core Fields
    appendDetail('Nombre del Archivo', doc.nombre_original || doc.nombre || '-');
    appendDetail('Categoría del Documento', doc.tipo_documento || '-');
    appendDetail('Fecha de Subida', doc.fecha_subida ? formatDate(doc.fecha_subida) : '-');
    appendDetail('Estado', doc.estado || '-');
    if(doc.rut_asociado) appendDetail('RUT Asociado', doc.rut_asociado);
    if(doc.responsiblePerson || doc.usuario_responsable) appendDetail('Responsable', doc.responsiblePerson || doc.usuario_responsable);
    if(doc.documentDescription || doc.descripcion) appendDetail('Notas', doc.documentDescription || doc.descripcion);


    // Append Dynamic Fields from doc.additional_data
    if (doc.additional_data && typeof doc.additional_data === 'object' && Object.keys(doc.additional_data).length > 0) {
        const separator = document.createElement('hr');
        separator.className = 'my-4'; // Add some margin for visual separation
        detailsContainer.appendChild(separator);

        const additionalDataHeader = document.createElement('p');
        additionalDataHeader.className = 'text-md font-semibold text-gray-700 mb-2';
        additionalDataHeader.textContent = 'Información Adicional';
        detailsContainer.appendChild(additionalDataHeader);

        Object.entries(doc.additional_data).forEach(([key, value]) => {
            const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const isValueUrl = typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
            appendDetail(formattedKey, value, isValueUrl);
        });
    }

    // Mostrar el documento en el visor principal (iframe part)
    // Usar la URL directa del archivo si está disponible
    let fileUrl;
    if (doc.url_archivo) {
        fileUrl = doc.url_archivo;
    } else {
        // Construir URL correctamente usando el bucket de Firebase
        const bucketName = firebase.app().options.storageBucket;
        const encodedPath = encodeURIComponent(doc.ruta_archivo);
        fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;
    }
    
    const iframe = document.getElementById('documentIframe');
    iframe.src = fileUrl;
    document.getElementById('documentPreviewContent').classList.remove('hidden');
    document.getElementById('preview-placeholder').classList.add('hidden');
}

// Función para descargar documento
async function downloadDocument(documentId) {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No se encontró el token.'); // Updated error message
        alert('Error de autenticación. Por favor, inicie sesión de nuevo.');
        return;
    }

    try {
        const response = await fetch(`/api/documentos/${documentId}/download`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Intentar obtener más información del error si está en formato JSON
            let errorBody = null;
            try {
                errorBody = await response.json();
            } catch (e) {
                // No es JSON o hubo otro error
            }
            console.error('Error en la respuesta del servidor:', response.status, errorBody);
            throw new Error(errorBody?.message || `Error HTTP: ${response.status}`);
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `documento_${documentId}`; // Default filename
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
            if (filenameMatch && filenameMatch.length > 1) {
                filename = filenameMatch[1];
            }
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Error al descargar el documento:', error);
        alert(`Error al descargar el documento: ${error.message}`);
    }
}
// Función para compartir el documento actualmente seleccionado
function shareCurrentDocument() {
    if (!currentDocumentId) return;
    const userId = prompt('Ingrese el ID del usuario para compartir:');
    if (!userId) return;
    fetch(`/api/documentos/${currentDocumentId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    })
        .then(response => {
            if (response.ok) {
                alert('Documento compartido');
            } else {
                alert('Error al compartir documento');
            }
        })
        .catch(err => {
            console.error('Error al compartir:', err);
            alert('Error al compartir documento');
        });
}
// Función para obtener icono según tipo de archivo
function getFileIcon(mimeType) {
    if (!mimeType) return 'fa-file';
    
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('image')) return 'fa-file-image';
    if (mimeType.includes('word')) return 'fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fa-file-excel';
    
    return 'fa-file';
}

// Función para formatear tamaño de archivo
function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Función para mostrar un documento específico (función original mantenida para compatibilidad)
async function showDocument(documentId) {
    currentDocumentId = documentId;
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No se encontró el token.'); // Updated error message
        // Actualizar UI para reflejar el error de autenticación
        document.getElementById('docType').textContent = 'Error de autenticación';
        const iframe = document.getElementById('documentIframe');
        iframe.src = 'about:blank'; // Limpiar iframe
        document.getElementById('documentPreviewContent').classList.remove('hidden');
        document.getElementById('preview-placeholder').classList.add('hidden'); // O mostrar un placeholder de error
        alert('Error de autenticación. Por favor, inicie sesión de nuevo.');
        return;
    }

    try {
        const response = await fetch(`/api/documentos/${documentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const documentData = await response.json(); // Renombrado para evitar conflicto con 'document' global
        
        document.getElementById('docType').textContent = documentData.nombre_tipo_documento || documentData.nombre;
        
        // Mostrar el documento desde Firebase Storage
        const iframe = document.getElementById('documentIframe');
        iframe.src = documentData.url_archivo; // Asumiendo que la API devuelve la URL directa
        document.getElementById('documentPreviewContent').classList.remove('hidden');
        document.getElementById('preview-placeholder').classList.add('hidden');

    } catch (error) {
        console.error('Error al mostrar el documento:', error);
        document.getElementById('docType').textContent = 'Error al cargar documento';
        const iframe = document.getElementById('documentIframe');
        iframe.src = 'about:blank';
        // Considera mostrar un mensaje de error más específico en la UI
        alert('Error al cargar el documento. Por favor, intenta de nuevo.');
    }
}

// Función para cerrar el modal
function closePropertyModal() {
    document.getElementById('propertyModal').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    currentPropertyId = null;
}

// Funciones auxiliares para formatear datos
function getStatusColor(status) {
    if (!status) return 'gray-400';
    
    switch(status.toLowerCase()) {
        case 'aprobado':
        case 'completo': return 'green-600';
        case 'en revisión':
        case 'pendiente': return 'yellow-400';
        case 'rechazado':
        case 'faltante': return 'red-400';
        default: return 'gray-400';
    }
}

function getStatusBgColor(status) {
    if (!status) return 'gray-100';
    
    switch(status.toLowerCase()) {
        case 'aprobado':
        case 'completo': return 'green-100';
        case 'en revisión':
        case 'pendiente': return 'yellow-100';
        case 'rechazado':
        case 'faltante': return 'red-100';
        default: return 'gray-100';
    }
}

function getStatusTextColor(status) {
    if (!status) return 'gray-800';
    
    switch(status.toLowerCase()) {
        case 'aprobado':
        case 'completo': return 'green-800';
        case 'en revisión':
        case 'pendiente': return 'yellow-800';
        case 'rechazado':
        case 'faltante': return 'red-800';
        default: return 'gray-800';
    }
}

function getStatusLabel(status) {
    if (!status) return 'Faltante';
    
    switch(status.toLowerCase()) {
        case 'aprobado':
        case 'completo': return 'Completo';
        case 'en revisión':
        case 'pendiente': return 'Pendiente';
        case 'rechazado':
        case 'faltante': return 'Faltante';
        default: return status;
    }
}

function formatDate(dateString) {
    if (!dateString) {
        return '-'; // Or 'Fecha no disponible'
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) { // Check for invalid date
        return '-'; // Or 'Fecha no disponible'
    }
    return date.toLocaleDateString('es-ES');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Cerrar modal al hacer clic fuera del contenido
    const propertyModal = document.getElementById('propertyModal');
    if (propertyModal) {
        propertyModal.addEventListener('click', function(e) {
            if(e.target === this) {
                closePropertyModal();
            }
        });
    }
    
    // Cerrar modal de documentos al hacer clic fuera
    document.addEventListener('click', function(e) {
        const documentsModal = document.getElementById('documentsListModal');
        if (documentsModal && e.target === documentsModal) {
            closeDocumentsListModal();
        }
    });
    
    // Cerrar con tecla ESC
    document.addEventListener('keydown', function(e) {
        if(e.key === 'Escape') {
            closePropertyModal();
            closeDocumentsListModal();
        }
    });
    
    // Cargar los predios desde Firestore
    loadProperties();
    
    // Configurar eventos para filtros y ordenamiento
    const filterStatus = document.getElementById('filter-status');
    const sortBy = document.getElementById('sort-by');
    const shareBtn = document.getElementById('share-document');

    if (filterStatus) {
        filterStatus.addEventListener('change', function() {
            loadProperties();
        });
    }
    
    if (sortBy) {
        sortBy.addEventListener('change', function() {
            loadProperties();
        });
    }
    if (shareBtn) {
        shareBtn.addEventListener('click', function(e) {
            e.preventDefault();
            shareCurrentDocument();
        });
    }
});

// Función para cargar los predios
async function loadProperties() {
    const token = localStorage.getItem('token');
    const propertiesGrid = document.getElementById('properties-grid');

    if (!token) {
        console.error('No se encontró el token.'); // Updated error message
        if (propertiesGrid) {
            propertiesGrid.innerHTML = `
                <div class="col-span-full text-center py-10">
                    <p class="text-red-500 text-lg">Error de autenticación. No se pueden cargar los predios.</p>
                    <p class="text-gray-500 text-sm">Por favor, inicie sesión de nuevo.</p>
                </div>
            `;
        }
        // Actualizar contadores a 0 o un mensaje indicativo
        const propertiesCountEl = document.getElementById('properties-count');
        const totalPropertiesEl = document.getElementById('total-properties');
        if (propertiesCountEl) propertiesCountEl.textContent = '0';
        if (totalPropertiesEl) totalPropertiesEl.textContent = '0';
        return;
    }

    const filterStatus = document.getElementById('filter-status')?.value || 'all';
    const sortBy = document.getElementById('sort-by')?.value || 'name-asc';
    
    try {
        // Obtener tipos de documento y predios en paralelo
        const [typesRes, propsRes] = await Promise.all([
            fetch('/api/documentos/types', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/predios', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!propsRes.ok) {
            throw new Error(`Error HTTP: ${propsRes.status}`);
        }
        if (!typesRes.ok) {
            throw new Error(`Error HTTP: ${typesRes.status} al obtener tipos de documento`);
        }

        const [properties, documentTypes] = await Promise.all([propsRes.json(), typesRes.json()]);
        const totalTypes = Array.isArray(documentTypes) ? documentTypes.length : 0;

        // Obtener documentos por predio para calcular progreso
        const propertiesWithCounts = await Promise.all(properties.map(async property => {
            try {
                const docsRes = await fetch(`/api/predios/${property._id}/documentos`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                let docs = [];
                if (docsRes.ok) {
                    docs = await docsRes.json();
                }
                const uniqueTypes = new Set(Array.isArray(docs) ? docs.map(d => d.tipo_documento) : []);
                const completed = uniqueTypes.size;
                property.completedDocs = completed;
                property.totalDocs = totalTypes;
                property.pendingDocs = Math.max(totalTypes - completed, 0);
                property.missingDocs = Math.max(totalTypes - completed, 0);
                property.hasPendingDocs = property.pendingDocs > 0 && completed > 0;
                property.hasCompleteDocs = completed > 0;
                property.hasMissingDocs = property.missingDocs > 0;
            } catch (err) {
                console.error('Error al obtener documentos del predio:', err);
                property.completedDocs = 0;
                property.totalDocs = totalTypes;
                property.pendingDocs = totalTypes;
                property.missingDocs = totalTypes;
                property.hasPendingDocs = false;
                property.hasCompleteDocs = false;
                property.hasMissingDocs = totalTypes > 0;
            }
            return property;
        }));

        // Filtrar predios según el estado seleccionado
        let filteredProperties = propertiesWithCounts;
        if (filterStatus !== 'all') {
            filteredProperties = propertiesWithCounts.filter(property => {
                // Implementar lógica de filtrado según tus necesidades
                if (filterStatus === 'pending') {
                    return property.hasPendingDocs;
                } else if (filterStatus === 'complete') {
                    return property.hasCompleteDocs && !property.hasPendingDocs && !property.hasMissingDocs;
                }
                return true; // Default case if filterStatus is not recognized beyond 'all', 'pending', 'complete'
            });
        }
        
        // Ordenar predios
        filteredProperties.sort((a, b) => {
            const nameA = a.name || a.nombre || ''; // Robust access to name
            const nameB = b.name || b.nombre || ''; // Robust access to name
            const dateA = a.createdAt || a.fecha_creacion || a.fecha_subida || 0; // Robust access to date
            const dateB = b.createdAt || b.fecha_creacion || b.fecha_subida || 0; // Robust access to date

            if (sortBy === 'name-asc') {
                return nameA.localeCompare(nameB);
            } else if (sortBy === 'name-desc') {
                return nameB.localeCompare(nameA);
            } else if (sortBy === 'date-desc') {
                return new Date(dateB) - new Date(dateA);
            }
            return 0;
        });
        
        // Actualizar contadores
        const propertiesCount = document.getElementById('properties-count');
        const totalProperties = document.getElementById('total-properties');
        if (propertiesCount) propertiesCount.textContent = filteredProperties.length;
        if (totalProperties) totalProperties.textContent = properties.length;
        
        // Renderizar los predios
        renderProperties(filteredProperties);

    } catch (error) {
        console.error('Error al cargar los predios:', error);
        if (propertiesGrid) {
            propertiesGrid.innerHTML = `
                <div class="col-span-full text-center py-10">
                    <p class="text-red-500 text-lg">Error al cargar los predios: ${error.message}.</p>
                    <p class="text-gray-500 text-sm">Por favor, intenta de nuevo más tarde.</p>
                </div>
            `;
        }
         // Actualizar contadores a 0 o un mensaje indicativo en caso de error
        const propertiesCountEl = document.getElementById('properties-count');
        const totalPropertiesEl = document.getElementById('total-properties');
        if (propertiesCountEl) propertiesCountEl.textContent = '0';
        if (totalPropertiesEl) totalPropertiesEl.textContent = '0';
    }
}

// Función para renderizar los predios en la UI
function renderProperties(properties) {
    const propertiesGrid = document.getElementById('properties-grid');
    if (!propertiesGrid) return;
    
    if (properties.length === 0) {
        propertiesGrid.innerHTML = `
            <div class="col-span-full text-center py-10">
                <p class="text-gray-500 text-lg">No se encontraron predios que coincidan con los criterios de búsqueda.</p>
            </div>
        `;
        return;
    }
    
    // Limpiar el grid
    propertiesGrid.innerHTML = '';
    
    // Crear una tarjeta para cada predio
    properties.forEach(property => {
        // Calcular estado y colores
        const statusColor = getPropertyStatusColor(property);
        const completedDocs = property.completedDocs || 0;
        const totalDocs = property.totalDocs || 0;
        const pendingDocs = property.pendingDocs || 0;
        const missingDocs = property.missingDocs || 0;
        
        const propertyCard = document.createElement('div');
        propertyCard.className = 'document-card bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer';
        propertyCard.setAttribute('data-property-id', property._id);
        propertyCard.onclick = () => openProperty(property._id);
        
        propertyCard.innerHTML = `
            <div class="relative">
                <img src="${property.imageUrl || '/images/5077814.png'}" alt="${property.nombre || 'Sin nombre'}" class="w-full h-48 object-cover">
                <div class="absolute top-2 right-2 bg-${statusColor} text-white px-2 py-1 rounded-full text-xs font-bold">${getPropertyStatus(property)}</div>
            </div>
            <div class="p-6">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-bold text-gray-800">${property.nombre || 'Sin nombre'}</h3>
                    <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">${property.rutPropietario || 'Sin RUT'}</span>
                </div>
                <p class="text-gray-600 mb-4">${property.ubicacion || 'Sin dirección'}</p>
                
                <div class="flex justify-between items-center">
                    <div>
                        <span class="text-sm text-gray-500">Documentos:</span>
                        <span class="ml-2 font-medium">${completedDocs}/${totalDocs}</span>
                    </div>
                    <div class="flex space-x-1">
                        ${completedDocs > 0 ? `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">${completedDocs} Completos</span>` : ''}
                        ${missingDocs > 0 ? `<span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">${missingDocs} Faltantes</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        
        propertiesGrid.appendChild(propertyCard);
    });
}

// Función para determinar el estado general del predio
function getPropertyStatus(property) {
    if (property.status) return property.status;
    
    const completedDocs = property.completedDocs || 0;
    const totalDocs = property.totalDocs || 0;
    const pendingDocs = property.pendingDocs || 0;
    const missingDocs = property.missingDocs || 0;
    
    if (completedDocs === totalDocs && totalDocs > 0) {
        return 'Completo';
    } else if (pendingDocs > 0) {
        return 'En Proceso';
    } else if (missingDocs > 0) {
        return 'Incompleto';
    } else {
        return 'Sin Documentos';
    }
}

// Función para determinar el color del estado del predio
function getPropertyStatusColor(property) {
    const status = getPropertyStatus(property);
    
    switch(status.toLowerCase()) {
        case 'completo': return 'green-500';
        case 'en proceso': return 'yellow-500';
        case 'incompleto': return 'red-500';
        default: return 'gray-500';
    }
}
