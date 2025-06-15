document.addEventListener('DOMContentLoaded', function () {
  let currentFieldsToCollect = []; 
  let allFetchedDocumentTypes = []; 
  let allFetchedProperties = []; // To store properties for preview

  const propertySelect = document.getElementById('property-select');
  console.log('Property Select Element:', propertySelect); 

  // Main page elements for two-step UI
  const nextBtn = document.getElementById('next-btn');
  const propertyPreview = document.getElementById('property-preview');
  const previewId = document.getElementById('preview-id');
  const previewName = document.getElementById('preview-name');
  const previewAddress = document.getElementById('preview-address');
  const previewOwner = document.getElementById('preview-owner');
  const bulkUploadButton = document.getElementById('bulk-upload-button');


  // Modal and its form elements
  const uploadModal = document.getElementById('upload-modal');
  const closeModalBtn = document.getElementById('close-modal'); // The 'X' button on the modal
  const cancelModalUploadBtn = document.getElementById('cancel-modal-upload'); // The "Cancelar" button in modal footer
  const uploadForm = document.getElementById('upload-form'); // The form tag inside the modal
  
  const modalPropertyName = document.getElementById('modal-property-name');
  const documentTypeSelect = document.getElementById('document-type-select'); // Now inside modal
  const dynamicDocumentFieldsContainer = document.getElementById('dynamic-document-fields-container'); // Now inside modal
  
  // Static fields within the modal form
  const documentResponsibleInput = document.getElementById('document-responsible');
  const documentDescriptionInput = document.getElementById('document-description');
  
  // Dropzone elements (already correctly referenced by ID, assumed to be in modal)
  const fileInput = document.getElementById('file-input');
  const browseFilesBtn = document.getElementById('browse-files');
  const dropzone = document.getElementById('dropzone');
  const selectedFileText = document.getElementById('selected-file'); // Actually the div for file name display
  const removeFileBtn = document.getElementById('remove-file'); // The 'x' button for a selected file

  // Hidden input fields (now inside modal form)
  const propertyIdHiddenInput = document.getElementById('property-id');
  const documentTypeIdHiddenInput = document.getElementById('document-type-id');
  const documentTypeNameHiddenInput = document.getElementById('document-type-name');

  // Buttons inside modal form
  const submitUploadBtn = document.getElementById('submit-upload'); 
  const processAiBtn = document.getElementById('process-ai-btn'); 
  const ocrLoadingIndicator = document.getElementById('ocr-loading-indicator');

  // const documentSection = document.getElementById('document-section'); // This element is removed/obsolete in new UI
  // const mainFormFields = document.getElementById('main-form-fields'); // This container is obsolete, fields are directly in modal

  const token = localStorage.getItem('token');

  if (!token) {
    alert('No se encontró un token de autenticación. Por favor, inicie sesión nuevamente.');
    window.location.href = '/';
    return;
  }

  // Cargar la lista de predios
  console.log('Before fetching predios...'); // Added console log
  fetch('/api/predios', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(response => {
      console.log('Raw response object from /api/predios:', response); // Added console log
      if (!response.ok) {
        throw new Error('Error al cargar los predios');
      }
      return response.json();
    })
    .then(properties => {
      console.log('Parsed properties data:', properties); 
      allFetchedProperties = properties; // Store for later use in preview
      propertySelect.innerHTML = '<option value="">Seleccione un predio...</option>';

      if (properties.length === 0) {
        console.log('No properties found (properties.length === 0).');
        const option = document.createElement('option');
        option.disabled = true;
        option.textContent = 'No hay predios disponibles';
        propertySelect.appendChild(option);
        alert('No hay predios registrados. Por favor, cree un predio primero.');
      } else {
        properties.forEach(property => {
          console.log('Processing property for dropdown:', property); 
          const option = document.createElement('option');
          option.value = property._id;
          option.textContent = property.nombre; // Assuming 'nombre' exists
          propertySelect.appendChild(option);
        });
      }
    })
    .catch(error => {
      console.error('Error fetching or processing predios:', error); 
      alert('Error al cargar los predios');
    });

  // Event listener for property selection (Main Page Logic)
  propertySelect.addEventListener('change', function () {
    const selectedPropertyId = this.value;
    const selectedProperty = allFetchedProperties.find(p => p._id === selectedPropertyId);

    if (selectedProperty) {
      // Populate and show preview
      if (previewId) previewId.textContent = selectedProperty._id;
      if (previewName) previewName.textContent = selectedProperty.nombre || '--';
      if (previewAddress) previewAddress.textContent = selectedProperty.direccion || '--'; // Assuming 'direccion' exists
      if (previewOwner) previewOwner.textContent = selectedProperty.propietarioNombreCompleto || '--'; // Assuming 'propietarioNombreCompleto' exists
      
      if (propertyPreview) {
        propertyPreview.classList.remove('hidden');
      } else {
        console.error('propertyPreview element not found');
      }
      
      if (nextBtn) {
        nextBtn.disabled = false;
      } else {
        console.error('nextBtn element not found');
      }

      if (bulkUploadButton) {
        bulkUploadButton.classList.remove('hidden');
      } else {
        console.error('bulkUploadButton element not found');
      }

      // Set the hidden property ID field within the modal's form
      if (propertyIdHiddenInput) {
        propertyIdHiddenInput.value = selectedPropertyId;
      } else {
        console.error('Hidden input with ID "property-id" (inside modal) not found.');
      }
    } else {
      // No property selected or found
      if (propertyPreview) {
        propertyPreview.classList.add('hidden');
      } else {
        console.error('propertyPreview element not found for hiding');
      }

      if (nextBtn) {
        nextBtn.disabled = true;
      } else {
        console.error('nextBtn element not found for disabling');
      }

      if (bulkUploadButton) {
        bulkUploadButton.classList.add('hidden');
      } else {
        console.error('bulkUploadButton element not found for hiding');
      }
      
      if (propertyIdHiddenInput) {
        propertyIdHiddenInput.value = ''; // Clear hidden property ID
      }
    }
  });

  // Event listener for "Continuar" button
  if (nextBtn) {
    nextBtn.addEventListener('click', async function() {
      const selectedPropertyId = propertySelect.value;
      if (!selectedPropertyId) {
        alert('Por favor, seleccione un predio primero.');
        return;
      }
      const selectedProperty = allFetchedProperties.find(p => p._id === selectedPropertyId);
      if (!selectedProperty) {
        alert('Predio seleccionado no encontrado. Por favor, recargue la página.');
        return;
      }

      if (modalPropertyName) modalPropertyName.textContent = selectedProperty.nombre || '--';
      
      // Reset and prepare modal form elements
      if (uploadForm) uploadForm.reset(); // Resets all form fields including file input
      if (selectedFileText) selectedFileText.classList.add('hidden'); // Hide file name display
      if (documentTypeSelect) documentTypeSelect.innerHTML = '<option value="">Cargando tipos...</option>';
      if (dynamicDocumentFieldsContainer) {
        dynamicDocumentFieldsContainer.innerHTML = '';
        dynamicDocumentFieldsContainer.classList.add('hidden');
      }
      // Hide specific form sections if necessary (though form.reset() might cover text inputs)
      if (documentResponsibleInput) documentResponsibleInput.value = '';
      if (documentDescriptionInput) documentDescriptionInput.value = '';


      // Fetch document types for the modal's dropdown
      try {
        console.log('Fetching document types for modal...');
        const response = await fetch('/api/admin/document-types', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`Error al cargar tipos de documento: ${response.statusText}`);
        
        allFetchedDocumentTypes = await response.json();
        console.log('Fetched document types for modal:', allFetchedDocumentTypes);

        if (documentTypeSelect) {
            documentTypeSelect.innerHTML = '<option value="">Seleccione un tipo de documento...</option>';
            if (!allFetchedDocumentTypes || allFetchedDocumentTypes.length === 0) {
                const option = document.createElement('option');
                option.disabled = true;
                option.textContent = 'No hay tipos de documentos definidos';
                documentTypeSelect.appendChild(option);
            } else {
                allFetchedDocumentTypes.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.id;
                    option.textContent = type.name;
                    option.dataset.fieldsToCollect = JSON.stringify(type.fieldsToCollect || []);
                    option.dataset.typeName = type.name;
                    documentTypeSelect.appendChild(option);
                });
            }
        }
      } catch (error) {
        console.error('Error fetching document types for modal:', error);
        if (documentTypeSelect) documentTypeSelect.innerHTML = '<option value="">Error al cargar tipos</option>';
        allFetchedDocumentTypes = [];
      }

      if (uploadModal) uploadModal.classList.remove('hidden'); // Show the modal
    });
  }

  // Event listener for document type selection (Inside Modal)
  if (documentTypeSelect) {
    documentTypeSelect.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      const documentTypeId = this.value;

      // Clear previous dynamic fields
      if (dynamicDocumentFieldsContainer) {
        dynamicDocumentFieldsContainer.innerHTML = '';
        dynamicDocumentFieldsContainer.classList.add('hidden');
      }
      // Reset static fields visibility or content if needed, though they are part of the form now.
      // Example: if (documentResponsibleInput) documentResponsibleInput.parentElement.parentElement.classList.add('hidden');


      if (documentTypeId) {
        const fieldsToCollect = JSON.parse(selectedOption.dataset.fieldsToCollect || '[]');
        const typeName = selectedOption.dataset.typeName;
        currentFieldsToCollect = fieldsToCollect; 

        if (documentTypeIdHiddenInput) documentTypeIdHiddenInput.value = documentTypeId;
        if (documentTypeNameHiddenInput) documentTypeNameHiddenInput.value = typeName;

        // Generate dynamic fields
        if (fieldsToCollect && fieldsToCollect.length > 0) {
          const heading = document.createElement('h4'); // Add heading back if removed by innerHTML=''
          heading.className = 'text-md font-semibold text-gray-700 mb-2';
          heading.textContent = 'Campos Específicos del Documento:';
          dynamicDocumentFieldsContainer.appendChild(heading);

          fieldsToCollect.forEach(fieldName => {
            if (fieldName.toLowerCase() === 'responsable' || fieldName.toLowerCase() === 'descripción') return;

            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'mb-4'; // Each field in its own div

            const label = document.createElement('label');
            const fieldId = `dynamic-field-${fieldName.replace(/\s+/g, '-').toLowerCase()}`;
            label.htmlFor = fieldId;
            label.textContent = fieldName;
            label.className = 'block text-gray-700 font-medium mb-2 required-field'; // Assuming all dynamic are required

            const input = document.createElement('input');
            input.type = 'text';
            input.id = fieldId;
            input.name = fieldId;
            input.className = 'w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500';
            input.placeholder = `Ingrese ${fieldName}`;
            input.required = true;

            fieldDiv.appendChild(label);
            fieldDiv.appendChild(input);
            dynamicDocumentFieldsContainer.appendChild(fieldDiv);
          });
           if (dynamicDocumentFieldsContainer) dynamicDocumentFieldsContainer.classList.remove('hidden');
        }
         // Show static fields like Responsible, Description, Dropzone which are always part of the modal form
        // These are not hidden/shown by this logic anymore, but are part of the modal's form structure.
      } else {
        // No document type selected
        currentFieldsToCollect = [];
        if (documentTypeIdHiddenInput) documentTypeIdHiddenInput.value = '';
        if (documentTypeNameHiddenInput) documentTypeNameHiddenInput.value = '';
      }
    });
  }
  
  // Modal Close and Cancel Logic
  function resetAndHideModal() {
    if (uploadModal) uploadModal.classList.add('hidden');
    if (uploadForm) uploadForm.reset();
    if (selectedFileText) selectedFileText.classList.add('hidden');
    if (fileInput) fileInput.value = ''; // Clear file input specifically
    if (dynamicDocumentFieldsContainer) {
        dynamicDocumentFieldsContainer.innerHTML = '';
        dynamicDocumentFieldsContainer.classList.add('hidden');
    }
    if (documentTypeSelect) documentTypeSelect.value = ''; // Reset dropdown
    if (processAiBtn) processAiBtn.classList.add('hidden');
    if (ocrLoadingIndicator) ocrLoadingIndicator.classList.add('hidden');
    // Clear hidden fields related to document type
    if (documentTypeIdHiddenInput) documentTypeIdHiddenInput.value = '';
    if (documentTypeNameHiddenInput) documentTypeNameHiddenInput.value = '';
    // Property ID hidden input should retain its value as the property selection on main page is still active.
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', resetAndHideModal);
  if (cancelModalUploadBtn) cancelModalUploadBtn.addEventListener('click', resetAndHideModal);

  const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // Get Base64 part
        reader.onerror = error => reject(error);
    });
  }

  if (processAiBtn) { // AI button is now within the modal
    processAiBtn.addEventListener('click', async function() {
        if (!fileInput || fileInput.files.length === 0 || fileInput.files[0].type !== 'application/pdf') {
            alert('Por favor, seleccione un archivo PDF primero.');
            return;
        }

        const file = fileInput.files[0];
        const originalButtonText = this.textContent;
        this.disabled = true;
        this.textContent = 'Procesando con IA...';
        if (ocrLoadingIndicator) ocrLoadingIndicator.classList.remove('hidden');

        try {
            if (!window.geminiConfig || !window.geminiConfig.apiKey || !window.geminiConfig.prompt) {
                alert('La configuración de Gemini (API Key o Prompt) no está disponible. Verifique la configuración.');
                console.error('Gemini config missing or incomplete:', window.geminiConfig);
                return;
            }
            const { apiKey, prompt } = window.geminiConfig;

            const base64Data = await fileToBase64(file);

            const requestBody = {
                contents: [{
                    parts: [
                        { text: prompt }, // Use the prompt from gemini-config.js
                        { inline_data: { mime_type: 'application/pdf', data: base64Data } }
                    ]
                }]
            };

            const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error from Gemini API:', errorData);
                throw new Error(`Error en la API de Gemini: ${response.statusText} - ${JSON.stringify(errorData)}`);
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0].text) {
                const extractedTextFromGemini = result.candidates[0].content.parts[0].text;
                console.log("Texto extraído por Gemini (para auto-relleno):", extractedTextFromGemini);

                // Call classifyDocumentText to identify document type and auto-select dropdown
                // This function also logs to console and triggers 'change' on dropdown.
                await classifyDocumentText(extractedTextFromGemini); 
                alert("Extracción de texto con IA y clasificación solicitada. Revise la consola para ver el resultado de la clasificación. Auto-relleno de campos en proceso...");

                // --- START: New logic for auto-filling dynamic fields ---
                if (currentFieldsToCollect && currentFieldsToCollect.length > 0 && extractedTextFromGemini) {
                    console.log("Campos a recolectar para auto-relleno:", currentFieldsToCollect);

                    // Construct the prompt for the second Gemini call (information extraction)
                    // Ensure field names are sent as a simple list/string for the prompt.
                    const fieldNamesString = currentFieldsToCollect.join(', '); 
                    const informationExtractionPrompt = `Dado el siguiente texto de un documento:
---
${extractedTextFromGemini}
---
Y dada la siguiente lista de nombres de campos que necesito extraer:
${fieldNamesString}

Por favor, extrae la información para cada campo del texto del documento y proporciónala como un objeto JSON. Las claves en el objeto JSON deben ser los nombres de los campos exactamente como se proporcionaron en la lista, y los valores deben ser la información extraída del texto. 
Si no puedes encontrar la información para un campo específico, usa un string vacío ("") o null como valor para ese campo en el JSON.
Asegúrate de que la respuesta sea únicamente el objeto JSON.`;

                    console.log("Prompt para extracción de información específica:", informationExtractionPrompt);

                    try {
                        if (!window.geminiConfig || !window.geminiConfig.apiKey) {
                            alert('La API Key de Gemini no está disponible para la extracción de campos. Verifique la configuración.');
                            console.error('Gemini API Key missing for field extraction.');
                            // Return or throw error to stop further execution in this block
                            return; 
                        }
                        const apiKey = window.geminiConfig.apiKey;

                        const extractionRequestBody = {
                            contents: [{
                                parts: [{ text: informationExtractionPrompt }]
                            }],
                            // Optional: Add generationConfig for better control over JSON output, if needed
                            // generationConfig: {
                            //   "response_mime_type": "application/json", // Request JSON output directly
                            // }
                        };
                        
                        // Note: As of some Gemini API versions, direct JSON output mode might require specific model versions (e.g., gemini-1.5-pro/flash with a beta flag)
                        // If direct JSON output isn't working reliably, we'll parse it from the text part.
                        // For now, we assume the text part will contain a valid JSON string.

                        console.log("Enviando solicitud a Gemini para extracción de campos específicos...");
                        const extractionResponse = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(extractionRequestBody)
                        });

                        if (!extractionResponse.ok) {
                            const errorData = await extractionResponse.json();
                            console.error('Error from Gemini API during field extraction:', errorData);
                            throw new Error(`Error en la API de Gemini para extracción de campos: ${extractionResponse.statusText} - ${JSON.stringify(errorData)}`);
                        }

                        const extractionResult = await extractionResponse.json();
                        console.log("Respuesta de Gemini para extracción de campos:", extractionResult);

                        if (extractionResult.candidates && extractionResult.candidates[0].content && extractionResult.candidates[0].content.parts && extractionResult.candidates[0].content.parts[0].text) {
                            const extractedFieldsText = extractionResult.candidates[0].content.parts[0].text;
                            console.log("Texto de campos extraídos por Gemini:", extractedFieldsText);

                            let fieldDataJson = null;
                            try {
                                // Attempt to parse the string as JSON. Gemini might return it wrapped in backticks or with "json" prefix.
                                const cleanedJsonString = extractedFieldsText.replace(/^```json\s*|```$/g, '').trim();
                                fieldDataJson = JSON.parse(cleanedJsonString);
                            } catch (parseError) {
                                console.error("Error al parsear JSON de campos extraídos:", parseError, "Texto recibido:", extractedFieldsText);
                                alert("Se recibió información de los campos, pero no se pudo procesar (error de formato JSON). Revise la consola.");
                            }

                            if (fieldDataJson) {
                                console.log("JSON de campos extraídos parseado:", fieldDataJson);
                                currentFieldsToCollect.forEach(fieldName => {
                                    const inputId = `dynamic-field-${fieldName.replace(/\s+/g, '-').toLowerCase()}`;
                                    const inputElement = document.getElementById(inputId);
                                    if (inputElement) {
                                        const extractedValue = fieldDataJson[fieldName];
                                        if (extractedValue !== undefined && extractedValue !== null) {
                                            inputElement.value = extractedValue;
                                            console.log(`Campo "${fieldName}" (ID: ${inputId}) auto-completado con valor: "${extractedValue}"`);
                                        } else {
                                            console.log(`No se encontró valor para el campo "${fieldName}" en la respuesta de Gemini, o el valor era nulo/indefinido.`);
                                        }
                                    } else {
                                        console.warn(`No se encontró el elemento de input con ID "${inputId}" para el campo "${fieldName}".`);
                                    }
                                });
                                alert("Campos del formulario han sido auto-completados con la información extraída.");
                            }
                        } else {
                            console.warn("Respuesta inesperada de Gemini para extracción de campos o datos no encontrados.");
                            alert("No se pudo extraer información específica para los campos del formulario desde el texto del documento.");
                        }

                    } catch (extractionError) {
                        console.error('Error durante la extracción de campos específicos con Gemini:', extractionError);
                        alert(`Ocurrió un error durante el auto-completado de campos: ${extractionError.message}. Por favor, revise la consola.`);
                    }
                } else {
                    if (!extractedTextFromGemini) {
                        console.log("No hay texto extraído disponible para el auto-relleno de campos.");
                    } else if (!currentFieldsToCollect || currentFieldsToCollect.length === 0) {
                        console.log("No hay campos específicos definidos para este tipo de documento ('currentFieldsToCollect' está vacío o no definido). No se intentará auto-relleno.");
                        // Optionally inform the user if no fields are defined for auto-fill for this doc type
                        // alert("Este tipo de documento no tiene campos predefinidos para auto-completar.");
                    }
                }
                // --- END: New logic for auto-filling dynamic fields ---

            } else {
                console.log("Respuesta inesperada de Gemini (primera llamada) o texto no encontrado:", result);
                alert("La extracción de texto inicial con IA pudo haber fallado o el formato de respuesta es inesperado. Revise la consola.");
            }

        } catch (error) {
            console.error('Error durante el procesamiento con Gemini IA:', error);
            alert(`Ocurrió un error durante el procesamiento con IA: ${error.message}. Por favor, revise la consola para más detalles.`);
        } finally {
            this.disabled = false;
            this.textContent = originalButtonText; // Restore original button text
            if (ocrLoadingIndicator) ocrLoadingIndicator.classList.add('hidden');
        }
    });
  }

  // `openUploadModal` is no longer used to populate the main form. 
  // It might be repurposed for bulk upload or other modal interactions.
  // For now, its original functionality for single uploads is integrated into the 
  // `documentTypeSelect` change listener.

  // File input and dropzone logic (elements are inside the modal)
  if (browseFilesBtn) {
    browseFilesBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      const fileDisplayContainer = document.getElementById('selected-file'); // The div that contains file-name span and remove button
      const fileNameSpan = document.getElementById('file-name');
      
      if (this.files.length > 0) {
        if (fileNameSpan) fileNameSpan.textContent = this.files[0].name;
        if (fileDisplayContainer) fileDisplayContainer.classList.remove('hidden');
        if (this.files[0].type === 'application/pdf' && processAiBtn) {
          processAiBtn.classList.remove('hidden');
        } else if (processAiBtn) {
          processAiBtn.classList.add('hidden');
        }
      } else {
        if (fileDisplayContainer) fileDisplayContainer.classList.add('hidden');
        if (processAiBtn) processAiBtn.classList.add('hidden');
      }
    });
  }
  
  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', () => {
        if (fileInput) fileInput.value = ''; // Clear the file input
        const fileDisplayContainer = document.getElementById('selected-file');
        if (fileDisplayContainer) fileDisplayContainer.classList.add('hidden');
        if (processAiBtn) processAiBtn.classList.add('hidden');
    });
  }


  if (dropzone) {
    dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      dropzone.classList.add('border-blue-500');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('border-blue-500'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('border-blue-500');
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        // Trigger change event on fileInput to update display
        const event = new Event('change');
        fileInput.dispatchEvent(event);
      }
    });
  }

  // Form Submission Logic (operates on elements within the modal)
  if (uploadForm) {
    uploadForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const formData = new FormData();

      // Validate required fields (now using specific element vars)
      if (!propertyIdHiddenInput || !propertyIdHiddenInput.value) { // Property ID from hidden input
        alert('ID del predio no encontrado. Por favor, seleccione un predio nuevamente.');
        return;
      }
      if (!documentTypeSelect || !documentTypeSelect.value) {
        alert('Por favor, seleccione un tipo de documento.');
        return;
      }
      if (!documentResponsibleInput || !documentResponsibleInput.value.trim()) {
        alert('El campo Responsable es requerido.');
        documentResponsibleInput.focus();
        return;
      }
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert('Por favor, seleccione un archivo.');
        return;
      }
      if (!documentTypeIdHiddenInput || !documentTypeIdHiddenInput.value) {
         alert('Error: ID del tipo de documento no capturado. Intente seleccionar el tipo de nuevo.');
         return;
      }
       if (!documentTypeNameHiddenInput || !documentTypeNameHiddenInput.value) {
         alert('Error: Nombre del tipo de documento no capturado. Intente seleccionar el tipo de nuevo.');
         return;
      }
      
      // Dynamic field validation
      let allDynamicFieldsValid = true;
      if (dynamicDocumentFieldsContainer) {
          const dynamicInputs = dynamicDocumentFieldsContainer.querySelectorAll('input[required], textarea[required], select[required]');
          dynamicInputs.forEach(input => {
              if (!input.value.trim()) {
                  allDynamicFieldsValid = false;
                  input.focus();
              }
          });
      }
      if (!allDynamicFieldsValid) {
          alert('Por favor, complete todos los campos dinámicos requeridos.');
          return;
      }
      
      const file = fileInput.files[0];

      // Calculate file hash
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Crear FormData con todos los metadatos
      // formData.append('documentTypeId', typeIdElement.value); // Removed as per subtask
      formData.append('documentTypeId', documentTypeIdHiddenInput.value);
      formData.append('documentTypeNameForUpload', documentTypeNameHiddenInput.value);
      formData.append('propertyId', propertyIdHiddenInput.value);
      formData.append('documentFile', file);
      formData.append('responsiblePerson', documentResponsibleInput.value.trim());
      
      if (documentDescriptionInput && documentDescriptionInput.value.trim()) {
        formData.append('documentDescription', documentDescriptionInput.value.trim());
      }
      formData.append('fileHash', hashHex);
      
      const user = JSON.parse(localStorage.getItem('user'));
      formData.append('userId', user?.uid || 'unknown');
      formData.append('uploadDate', new Date().toISOString());

      // Collect data from dynamic fields
      if (dynamicDocumentFieldsContainer) {
        const dynamicInputs = dynamicDocumentFieldsContainer.querySelectorAll('input, textarea, select');
        dynamicInputs.forEach(input => {
          if (input.name && input.value.trim()) {
            formData.append(input.name, input.value.trim());
          } else if (input.name && input.required && !input.value.trim()) {
            console.warn(`Dynamic required field ${input.name} is empty.`);
            // Potentially add to an error list here if not relying on browser validation alone
          }
        });
      }
      
      // Disable submit button
      if (submitUploadBtn) {
        submitUploadBtn.disabled = true;
        submitUploadBtn.textContent = 'Subiendo...';
      }

      try {
        // Subir a Firebase Storage
        // La configuración ya está disponible en window.firebaseConfig
        const app = firebase.initializeApp(window.firebaseConfig);
        const storage = firebase.storage();
        // Usa el método ref() en lugar de bucket()
        const storageRef = storage.ref();
        const fileRef = storageRef.child(`documents/${propertyIdHiddenInput.value}/${hashHex}/${file.name}`);
        
        // Y luego usa put() para subir el archivo
        const uploadTask = fileRef.put(file);
        
        uploadTask.on('state_changed', 
          (snapshot) => {
            // Mostrar progreso
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload is ${progress}% done`);
            if (submitUploadBtn) {
              submitUploadBtn.textContent = `Subiendo... ${Math.round(progress)}%`;
            }
          },
          (error) => {
            console.error('Error de subida:', error);
            alert(`Error al subir el archivo: ${error.message}`);
          },
          async () => {
            // Subida completada
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
            // Agregar URL al FormData
            formData.append('fileUrl', downloadURL);

            // Append additional file details
            formData.append('originalName', file.name);
            formData.append('mimeType', file.type);
            formData.append('fileSize', file.size);

            // Remove the file binary if Firebase upload was successful
            formData.delete('documentFile');

            // Enviar metadatos al servidor
            const response = await fetch('/api/documentos/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            });

            if (!response.ok) throw new Error('Error al subir el documento');

            const data = await response.json();
            alert('Documento subido correctamente');
            if (uploadModal) uploadModal.classList.add('hidden');
            if (processAiBtn) {
              processAiBtn.classList.add('hidden');
            }

            // Recargar los documentos (if loadExistingDocuments is adapted or re-enabled)
            // if (propertySelect.value) {
            //   loadExistingDocuments(propertySelect.value); 
            // }
            
            alert('Documento subido correctamente!');
            resetAndHideModal(); // Use the new helper function
            // Note: nextBtn on main page remains enabled if user wants to upload another for same property.
            // If propertySelect itself needs reset, that would be extra logic outside this submission.
          }
        );
      } catch (error) {
        console.error('Error during document submission process:', error);
        alert('Error al subir el documento: ' + error.message);
      } finally {
        if (submitUploadBtn) {
          submitUploadBtn.disabled = false;
          submitUploadBtn.textContent = 'Subir Documento';
        }
      }
    });
  }
});

/**
 * Sends text to the backend for classification and logs the result to the console.
 * @param {string} textToClassify The text to be classified.
 */
async function classifyDocumentText(textToClassify) {
    if (!textToClassify || textToClassify.trim() === "") {
        console.error("classifyDocumentText: No text provided for classification.");
        // Optionally, provide user feedback here (e.g., alert, update UI element)
        return;
    }

    console.log("Sending text for classification:", textToClassify);

    try {
        const response = await fetch('/api/documentos/classify-document', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: textToClassify }),
        });

        const result = await response.json();

        if (response.ok) {
            console.log("✅ Document Classification Result:");
            console.log("✅ Document Classification Result:");
            console.log("   Predicted Type:", result.prediction);
            console.log("   Confidence:", result.confidence !== undefined ? result.confidence.toFixed(4) : 'N/A');

            // New logic to auto-select the dropdown:
            const predictedTypeName = result.prediction; // e.g., "PLANO DEL PREDIO"
            const documentTypeDropdown = document.getElementById('document-type-select');

            if (predictedTypeName && documentTypeDropdown) {
                let foundAndSelected = false;
                for (let i = 0; i < documentTypeDropdown.options.length; i++) {
                    const option = documentTypeDropdown.options[i];
                    // Compare option text content (what user sees) or a data attribute if more reliable
                    // Assuming option.textContent is what matches the prediction string.
                    // Normalize whitespace and case for a more robust match, if necessary.
                    if (option.textContent.trim().toLowerCase() === predictedTypeName.trim().toLowerCase()) {
                        documentTypeDropdown.value = option.value; // Set the value of the select element
                        foundAndSelected = true;
                        break;
                    }
                }

                if (foundAndSelected) {
                    console.log(`   Auto-selected "${predictedTypeName}" in the dropdown.`);
                    // Dispatch a 'change' event to trigger any listeners (e.g., for dynamic fields)
                    const changeEvent = new Event('change', { bubbles: true });
                    documentTypeDropdown.dispatchEvent(changeEvent);
                } else {
                    console.warn(`   Predicted type "${predictedTypeName}" not found in the dropdown options.`);
                }
            } else {
                if (!predictedTypeName) console.warn("   No prediction available to auto-select dropdown.");
                if (!documentTypeDropdown) console.error("   Could not find 'document-type-select' dropdown element.");
            }
        } else {
            console.error("❌ Error in classification response:", result.error || `HTTP Error ${response.status}`);
            if (result.details) {
                console.error("   Details:", result.details);
            }
        }
    } catch (error) {
        console.error("❌ Exception during classification request:", error);
        // This typically catches network errors or issues with the request itself
    }
}


