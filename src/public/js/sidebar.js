// Función para manejar la barra lateral
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const showSidebarBtn = document.getElementById('show-sidebar-btn');
  const mainContent = document.querySelector('.ml-64');
  
  if (!sidebar || !toggleSidebarBtn || !showSidebarBtn || !mainContent) {
    console.error('No se encontraron los elementos necesarios para la barra lateral');
    return;
  }
  
  // Función para verificar el tamaño de la pantalla
  function checkScreenSize() {
    if (window.innerWidth < 1024) { // lg breakpoint en Tailwind
      sidebar.classList.add('-translate-x-full');
      mainContent.classList.remove('ml-64');
      mainContent.classList.add('ml-0');
      showSidebarBtn.classList.remove('hidden');
    } else {
      sidebar.classList.remove('-translate-x-full');
      mainContent.classList.add('ml-64');
      mainContent.classList.remove('ml-0');
      showSidebarBtn.classList.add('hidden');
    }
  }
  
  // Verificar al cargar la página
  checkScreenSize();
  
  // Verificar cuando cambia el tamaño de la ventana
  window.addEventListener('resize', checkScreenSize);
  
  // Alternar la barra lateral
  toggleSidebarBtn.addEventListener('click', function() {
    sidebar.classList.add('-translate-x-full');
    showSidebarBtn.classList.remove('hidden');
  });
  
  // Mostrar la barra lateral
  showSidebarBtn.addEventListener('click', function() {
    sidebar.classList.remove('-translate-x-full');
    showSidebarBtn.classList.add('hidden');
  });
  
  // Configurar enlaces con token
  const uploadLink = document.getElementById('upload-link');
  if (uploadLink) {
    uploadLink.addEventListener('click', function(e) {
      e.preventDefault();
      const token = localStorage.getItem('token');
      if (token) {
        window.location.href = `/upload`;
      } else {
        alert('No se encontró un token de autenticación. Por favor, inicie sesión nuevamente.');
        window.location.href = '/';
      }
    });
  }
  
  // Cerrar sesión
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      // Eliminar token
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      // Redireccionar al login
      window.location.href = '/';
    });
  }
}

// Función para expandir/colapsar carpetas
function toggleFolder(folderId) {
  const folderContent = document.getElementById(`${folderId}-content`);
  const folderIcon = document.getElementById(`${folderId}-icon`);
  
  if (folderContent.classList.contains('hidden')) {
    folderContent.classList.remove('hidden');
    folderIcon.setAttribute('d', 'M19 9l-7 7-7-7');
  } else {
    folderContent.classList.add('hidden');
    folderIcon.setAttribute('d', 'M9 5l7 7-7 7');
  }
}

// Configurar la barra lateral cuando se carga el documento
document.addEventListener('DOMContentLoaded', function() {
  setupSidebar();
});