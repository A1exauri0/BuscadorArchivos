// ==========================================================================
// RENDERER PROCESS - BUSCADOR DE ARCHIVOS IREC
// ==========================================================================

let currentConfig = {
  rutaBase: '\\\\172.40.5.84\\irec\\Respaldo_Original',
  limiteResultados: 200,
  modoCoincidencia: 'todas',
  profundidadMaxima: 6,
  tiempoLimiteMs: 45000,
  buscarEnRuta: true
};

let currentDelegacion = '';
let delegacionesList = [];
let ultimosResultados = [];
let activePreviewFile = null;

// DOM Elements
const searchInput = document.getElementById('search-input');
const btnExecSearch = document.getElementById('btn-exec-search');
const btnClearSearch = document.getElementById('btn-clear-search');
const selectMaxResults = document.getElementById('select-max-results');
const checkSearchInPath = document.getElementById('check-search-in-path');
const matchModeBtns = document.querySelectorAll('#match-mode-group .toggle-btn');
const activeDelName = document.getElementById('active-del-name');

const delegacionesUl = document.getElementById('delegaciones-list');
const filterDelegacionInput = document.getElementById('filter-delegacion-input');
const delegacionesCount = document.getElementById('delegaciones-count');

const stateInitial = document.getElementById('state-initial');
const stateLoading = document.getElementById('state-loading');
const stateNoResults = document.getElementById('state-no-results');
const resultsTableContainer = document.getElementById('results-table-container');
const resultsTbody = document.getElementById('results-tbody');
const noResultsDesc = document.getElementById('no-results-desc');

const resultsKpiBar = document.getElementById('results-kpi-bar');
const kpiTotal = document.getElementById('kpi-total');
const kpiDuration = document.getElementById('kpi-duration');
const kpiWarnings = document.getElementById('kpi-warnings');
const matchedWordsBadges = document.getElementById('matched-words-badges');

const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');
const sidebarCurrentPath = document.getElementById('sidebar-current-path');
const btnQuickVerify = document.getElementById('btn-quick-verify');

const btnExportCsv = document.getElementById('btn-export-csv');
const btnOpenSettings = document.getElementById('btn-open-settings');

// Modales
const modalPreview = document.getElementById('modal-preview');
const btnClosePreview = document.getElementById('btn-close-preview');
const previewFilename = document.getElementById('preview-filename');
const previewDelegacion = document.getElementById('preview-delegacion');
const previewSize = document.getElementById('preview-size');
const previewDate = document.getElementById('preview-date');
const previewUncInput = document.getElementById('preview-unc-input');
const previewIframe = document.getElementById('preview-iframe');
const btnCopyPreviewUnc = document.getElementById('btn-copy-preview-unc');
const btnOpenOsModal = document.getElementById('btn-open-os-modal');
const btnOpenFolderModal = document.getElementById('btn-open-folder-modal');

const modalSettings = document.getElementById('modal-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const cfgRutaBase = document.getElementById('cfg-ruta-base');
const cfgProfundidad = document.getElementById('cfg-profundidad');
const cfgTimeout = document.getElementById('cfg-timeout');
const btnBrowseFolder = document.getElementById('btn-browse-folder');
const btnTestConnection = document.getElementById('btn-test-connection');
const btnSaveSettings = document.getElementById('btn-save-settings');

const toastContainer = document.getElementById('toast-container');

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await cargarConfiguracionInicial();
  await cargarDelegaciones();
  verificarEstadoRed();
});

async function cargarConfiguracionInicial() {
  try {
    const cfg = await window.electronAPI.obtenerConfig();
    if (cfg) {
      currentConfig = { ...currentConfig, ...cfg };
    }
    sidebarCurrentPath.textContent = currentConfig.rutaBase;
    sidebarCurrentPath.title = currentConfig.rutaBase;
    cfgRutaBase.value = currentConfig.rutaBase;
    cfgProfundidad.value = currentConfig.profundidadMaxima || 6;
    cfgTimeout.value = Math.round((currentConfig.tiempoLimiteMs || 45000) / 1000);
    selectMaxResults.value = currentConfig.limiteResultados || 200;
  } catch (err) {
    console.error('Error al cargar config:', err);
  }
}

async function verificarEstadoRed() {
  connectionStatus.className = 'status-pill checking';
  statusText.textContent = 'Verificando red...';

  try {
    const res = await window.electronAPI.verificarRuta(currentConfig.rutaBase);
    if (res.existe) {
      connectionStatus.className = 'status-pill online';
      statusText.textContent = 'Servidor IREC Activo';
    } else {
      connectionStatus.className = 'status-pill offline';
      statusText.textContent = 'Ruta no accesible';
      showToast('No se puede acceder a ' + currentConfig.rutaBase, 'error');
    }
  } catch (err) {
    connectionStatus.className = 'status-pill offline';
    statusText.textContent = 'Error de conexión';
  }
}

async function cargarDelegaciones() {
  try {
    const res = await window.electronAPI.obtenerDelegaciones(currentConfig.rutaBase);
    if (res && res.delegaciones) {
      delegacionesList = res.delegaciones;
      delegacionesCount.textContent = delegacionesList.length;
      renderDelegacionesList(delegacionesList);
    }
  } catch (err) {
    console.error('Error obteniendo delegaciones:', err);
  }
}

function renderDelegacionesList(delegaciones) {
  // Limpiar lista excepto el primero ("Todas las delegaciones")
  const items = delegacionesUl.querySelectorAll('li:not(:first-child)');
  items.forEach(el => el.remove());

  delegaciones.forEach(del => {
    const li = document.createElement('li');
    li.className = 'delegacion-item' + (currentDelegacion === del.nombre ? ' active' : '');
    li.dataset.delegacion = del.nombre;

    li.innerHTML = `
      <span class="del-bullet"></span>
      <span class="del-name" title="${escapeHtml(del.nombre)}">${escapeHtml(del.nombre)}</span>
    `;

    li.addEventListener('click', () => {
      seleccionarDelegacion(del.nombre);
    });

    delegacionesUl.appendChild(li);
  });
}

function seleccionarDelegacion(nombre) {
  currentDelegacion = nombre || '';
  
  // Actualizar clases activas en sidebar
  const items = delegacionesUl.querySelectorAll('.delegacion-item');
  items.forEach(el => {
    if (el.dataset.delegacion === currentDelegacion) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Actualizar pill en el toolbar
  activeDelName.textContent = currentDelegacion ? currentDelegacion : 'Todas las Delegaciones';

  // Si hay búsqueda previa y texto, re-ejecutar automáticamente
  if (searchInput.value.trim().length > 0 && ultimosResultados.length > 0) {
    ejecutarBusqueda();
  }
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function setupEventListeners() {
  // Búsqueda
  btnExecSearch.addEventListener('click', ejecutarBusqueda);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      ejecutarBusqueda();
    } else if (e.key === 'Escape') {
      limpiarBusqueda();
    }
  });

  searchInput.addEventListener('input', () => {
    btnClearSearch.style.display = searchInput.value.trim().length > 0 ? 'flex' : 'none';
  });

  btnClearSearch.addEventListener('click', limpiarBusqueda);

  // Filtro de delegaciones en sidebar
  filterDelegacionInput.addEventListener('input', () => {
    const q = filterDelegacionInput.value.toLowerCase().trim();
    const filtradas = delegacionesList.filter(d => d.nombre.toLowerCase().includes(q));
    renderDelegacionesList(filtradas);
  });

  // Click en "Todas las delegaciones"
  const allDelItem = delegacionesUl.querySelector('.delegacion-item.all, .delegacion-item:first-child');
  if (allDelItem) {
    allDelItem.addEventListener('click', () => seleccionarDelegacion(''));
  }

  // Tags rápidos en sidebar
  document.querySelectorAll('.quick-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.query;
      const current = searchInput.value.trim();
      if (current) {
        if (!current.includes(tag)) {
          searchInput.value = `${current} ${tag}`;
        }
      } else {
        searchInput.value = tag;
      }
      btnClearSearch.style.display = 'flex';
      ejecutarBusqueda();
    });
  });

  // Chips de ejemplo en el estado inicial
  document.querySelectorAll('.ex-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      searchInput.value = btn.dataset.example;
      btnClearSearch.style.display = 'flex';
      ejecutarBusqueda();
    });
  });

  // Modos de coincidencia (AND / OR)
  matchModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      matchModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentConfig.modoCoincidencia = btn.dataset.mode;
      if (searchInput.value.trim().length > 0 && ultimosResultados.length > 0) {
        ejecutarBusqueda();
      }
    });
  });

  // Exportar CSV
  btnExportCsv.addEventListener('click', exportarResultadosCSV);

  // Botón verificar red rápido
  btnQuickVerify.addEventListener('click', verificarEstadoRed);

  // Modales
  btnOpenSettings.addEventListener('click', () => {
    modalSettings.style.display = 'flex';
  });
  btnCloseSettings.addEventListener('click', () => {
    modalSettings.style.display = 'none';
  });
  btnClosePreview.addEventListener('click', cerrarModalPreview);

  modalPreview.addEventListener('click', (e) => {
    if (e.target === modalPreview) cerrarModalPreview();
  });
  modalSettings.addEventListener('click', (e) => {
    if (e.target === modalSettings) modalSettings.style.display = 'none';
  });

  // Acciones en modal preview
  btnCopyPreviewUnc.addEventListener('click', () => {
    if (previewUncInput.value) {
      window.electronAPI.copiarPortapapeles(previewUncInput.value);
      showToast('Ruta copiada al portapapeles', 'success');
    }
  });

  btnOpenOsModal.addEventListener('click', async () => {
    if (activePreviewFile) {
      const res = await window.electronAPI.abrirArchivo(activePreviewFile.rutaCompleta);
      if (res.success) {
        showToast('Abriendo archivo con el visor predeterminado...', 'success');
      } else {
        showToast('Error al abrir: ' + (res.error || 'no disponible'), 'error');
      }
    }
  });

  btnOpenFolderModal.addEventListener('click', async () => {
    if (activePreviewFile) {
      await window.electronAPI.abrirEnCarpeta(activePreviewFile.rutaCompleta);
      showToast('Mostrando en el Explorador de Windows', 'info');
    }
  });

  // Examinar carpeta en ajustes
  btnBrowseFolder.addEventListener('click', async () => {
    const selected = await window.electronAPI.seleccionarCarpeta();
    if (selected) {
      cfgRutaBase.value = selected;
    }
  });

  // Probar conexión en ajustes
  btnTestConnection.addEventListener('click', async () => {
    const ruta = cfgRutaBase.value.trim();
    if (!ruta) return;
    btnTestConnection.textContent = 'Comprobando...';
    btnTestConnection.disabled = true;

    try {
      const res = await window.electronAPI.verificarRuta(ruta);
      if (res.existe) {
        showToast('¡Conexión exitosa! Directorio accesible.', 'success');
      } else {
        showToast('Error: No se puede acceder a la ruta indicada.', 'error');
      }
    } catch (err) {
      showToast('Fallo de red: ' + err.message, 'error');
    } finally {
      btnTestConnection.textContent = 'Probar Conexión';
      btnTestConnection.disabled = false;
    }
  });

  // Guardar ajustes
  btnSaveSettings.addEventListener('click', async () => {
    const nuevaRuta = cfgRutaBase.value.trim();
    const nuevaProf = parseInt(cfgProfundidad.value, 10) || 6;
    const nuevoTimeout = (parseInt(cfgTimeout.value, 10) || 45) * 1000;

    const nuevaConfig = {
      rutaBase: nuevaRuta,
      profundidadMaxima: nuevaProf,
      tiempoLimiteMs: nuevoTimeout
    };

    const res = await window.electronAPI.guardarConfig(nuevaConfig);
    if (res.success) {
      currentConfig = { ...currentConfig, ...res.config };
      sidebarCurrentPath.textContent = currentConfig.rutaBase;
      sidebarCurrentPath.title = currentConfig.rutaBase;
      modalSettings.style.display = 'none';
      showToast('Configuración guardada con éxito', 'success');
      verificarEstadoRed();
      cargarDelegaciones();
    } else {
      showToast('Error al guardar: ' + res.error, 'error');
    }
  });

  // Atajos globales de teclado
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalPreview.style.display === 'flex') {
        cerrarModalPreview();
      } else if (modalSettings.style.display === 'flex') {
        modalSettings.style.display = 'none';
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

function limpiarBusqueda() {
  searchInput.value = '';
  btnClearSearch.style.display = 'none';
  stateInitial.style.display = 'flex';
  stateLoading.style.display = 'none';
  stateNoResults.style.display = 'none';
  resultsTableContainer.style.display = 'none';
  resultsKpiBar.style.display = 'none';
  btnExportCsv.disabled = true;
  ultimosResultados = [];
  searchInput.focus();
}

// ==========================================================================
// EJECUCIÓN DE BÚSQUEDA
// ==========================================================================
async function ejecutarBusqueda() {
  const query = searchInput.value.trim();
  if (!query) {
    limpiarBusqueda();
    return;
  }

  // Obtener modo de coincidencia activo
  let modo = 'todas';
  matchModeBtns.forEach(btn => {
    if (btn.classList.contains('active')) modo = btn.dataset.mode;
  });

  const limite = parseInt(selectMaxResults.value, 10) || 200;
  const buscarEnRuta = checkSearchInPath.checked;

  // Cambiar vista a cargando
  mostrarEstadoCargando();

  const options = {
    rutaBase: currentConfig.rutaBase,
    palabras: query,
    delegacion: currentDelegacion,
    modoCoincidencia: modo,
    limiteResultados: limite,
    profundidadMaxima: currentConfig.profundidadMaxima || 6,
    tiempoLimiteMs: currentConfig.tiempoLimiteMs || 45000,
    buscarEnRuta: buscarEnRuta,
    extensiones: ['pdf']
  };

  try {
    const res = await window.electronAPI.buscarArchivos(options);
    renderResultados(res);
  } catch (err) {
    console.error('Error ejecutando búsqueda:', err);
    mostrarErrorBusqueda(err.message);
  }
}

function mostrarEstadoCargando() {
  stateInitial.style.display = 'none';
  stateNoResults.style.display = 'none';
  resultsTableContainer.style.display = 'none';
  resultsKpiBar.style.display = 'none';
  stateLoading.style.display = 'flex';
  btnExportCsv.disabled = true;

  const titleEl = document.getElementById('loading-title');
  const delText = currentDelegacion ? `en ${currentDelegacion}` : 'en todas las delegaciones';
  titleEl.textContent = `Buscando expedientes ${delText}...`;
}

function renderResultados(res) {
  stateLoading.style.display = 'none';

  if (!res || !res.archivos || res.archivos.length === 0) {
    stateInitial.style.display = 'none';
    resultsTableContainer.style.display = 'none';
    resultsKpiBar.style.display = 'none';
    stateNoResults.style.display = 'flex';

    if (currentDelegacion) {
      noResultsDesc.textContent = `No se encontraron coincidencias para "${res.palabras.join(' ')}" en la delegación "${currentDelegacion}".`;
    } else {
      noResultsDesc.textContent = `No se encontraron archivos que coincidan con las palabras clave ingresadas.`;
    }
    ultimosResultados = [];
    btnExportCsv.disabled = true;
    return;
  }

  ultimosResultados = res.archivos;
  btnExportCsv.disabled = false;

  // Render KPIs
  kpiTotal.textContent = res.total;
  kpiDuration.textContent = `${res.duracionSegundos}s`;

  // Advertencias de límite / timeout
  kpiWarnings.style.display = 'none';
  kpiWarnings.innerHTML = '';
  if (res.limiteAlcanzado) {
    kpiWarnings.style.display = 'inline-block';
    kpiWarnings.textContent = `Límite de ${selectMaxResults.value} alcanzado`;
  } else if (res.tiempoAlcanzado) {
    kpiWarnings.style.display = 'inline-block';
    kpiWarnings.textContent = 'Tiempo límite alcanzado';
  }

  // Badges de palabras buscadas
  matchedWordsBadges.innerHTML = '';
  if (res.palabras && res.palabras.length > 0) {
    res.palabras.forEach(w => {
      const chip = document.createElement('span');
      chip.className = 'word-chip';
      chip.textContent = w;
      matchedWordsBadges.appendChild(chip);
    });
  }

  resultsKpiBar.style.display = 'flex';

  // Llenar tabla
  resultsTbody.innerHTML = '';
  const palabrasABuscar = res.palabras || [];

  res.archivos.forEach(item => {
    const tr = document.createElement('tr');

    // Nombre con resaltado
    const nombreResaltado = resaltarPalabras(item.nombre, palabrasABuscar);

    // Subcarpeta sin el nombre del archivo
    const rutaRelativa = item.rutaRelativa || '';
    const partes = rutaRelativa.split(/[\\/]/);
    partes.pop(); // Quitar nombre de archivo
    const carpetaTexto = partes.join(' > ') || '-';

    tr.innerHTML = `
      <td class="col-icon">
        <div class="pdf-icon-badge">PDF</div>
      </td>
      <td class="col-name">
        <div class="file-name-container">
          <span class="file-title" title="${escapeHtml(item.nombre)}">${nombreResaltado}</span>
        </div>
      </td>
      <td class="col-del">
        <span class="del-tag">${escapeHtml(item.delegacion || 'General')}</span>
      </td>
      <td class="col-path" title="${escapeHtml(item.rutaCompleta)}">
        ${escapeHtml(carpetaTexto)}
      </td>
      <td class="col-size">${escapeHtml(item.tamanoFormateado || '-')}</td>
      <td class="col-date">${escapeHtml(item.fechaModificacion || '-')}</td>
      <td class="col-actions">
        <div class="action-btn-group">
          <button class="btn-act primary btn-action-open" title="Abrir con lector predeterminado">
            Abrir
          </button>
          <button class="btn-act icon-only btn-action-folder" title="Mostrar en el Explorador">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
          <button class="btn-act icon-only btn-action-copy" title="Copiar ruta de red UNC">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="btn-act icon-only btn-action-preview" title="Vista previa rápida">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>
      </td>
    `;

    // Eventos de botones
    const btnOpen = tr.querySelector('.btn-action-open');
    const btnFolder = tr.querySelector('.btn-action-folder');
    const btnCopy = tr.querySelector('.btn-action-copy');
    const btnPrev = tr.querySelector('.btn-action-preview');

    btnOpen.addEventListener('click', async () => {
      const resp = await window.electronAPI.abrirArchivo(item.rutaCompleta);
      if (resp.success) {
        showToast('Abriendo ' + item.nombre, 'success');
      } else {
        showToast('Error al abrir: ' + (resp.error || 'fallo'), 'error');
      }
    });

    btnFolder.addEventListener('click', async () => {
      await window.electronAPI.abrirEnCarpeta(item.rutaCompleta);
      showToast('Ubicación abierta en Explorador', 'info');
    });

    btnCopy.addEventListener('click', async () => {
      await window.electronAPI.copiarPortapapeles(item.rutaCompleta);
      showToast('Ruta UNC copiada', 'success');
    });

    btnPrev.addEventListener('click', () => {
      abrirModalPreview(item);
    });

    resultsTbody.appendChild(tr);
  });

  resultsTableContainer.style.display = 'block';
}

function mostrarErrorBusqueda(mensaje) {
  stateLoading.style.display = 'none';
  stateInitial.style.display = 'none';
  resultsTableContainer.style.display = 'none';
  resultsKpiBar.style.display = 'none';
  stateNoResults.style.display = 'flex';
  noResultsDesc.textContent = `Ocurrió un error durante la búsqueda: ${mensaje}`;
  showToast(`Error: ${mensaje}`, 'error');
}

// ==========================================================================
// VISTA PREVIA MODAL
// ==========================================================================
function abrirModalPreview(item) {
  activePreviewFile = item;
  previewFilename.textContent = item.nombre;
  previewDelegacion.textContent = item.delegacion || 'General';
  previewSize.textContent = item.tamanoFormateado || '-';
  previewDate.textContent = item.fechaModificacion || '-';
  previewUncInput.value = item.rutaCompleta;

  // Cargar PDF en iframe (Electron maneja file:// URLs en entornos seguros)
  const fileUrl = 'file:///' + item.rutaCompleta.replace(/\\/g, '/');
  previewIframe.src = fileUrl;

  modalPreview.style.display = 'flex';
}

function cerrarModalPreview() {
  modalPreview.style.display = 'none';
  previewIframe.src = '';
  activePreviewFile = null;
}

// ==========================================================================
// EXPORTACIÓN A CSV
// ==========================================================================
function exportarResultadosCSV() {
  if (!ultimosResultados || ultimosResultados.length === 0) {
    showToast('No hay resultados para exportar', 'error');
    return;
  }

  const cabeceras = ['Nombre', 'Delegacion', 'Ruta Completa', 'Ruta Relativa', 'Tamaño', 'Fecha Modificacion'];
  const filas = ultimosResultados.map(item => [
    `"${(item.nombre || '').replace(/"/g, '""')}"`,
    `"${(item.delegacion || '').replace(/"/g, '""')}"`,
    `"${(item.rutaCompleta || '').replace(/"/g, '""')}"`,
    `"${(item.rutaRelativa || '').replace(/"/g, '""')}"`,
    `"${item.tamanoFormateado || ''}"`,
    `"${item.fechaModificacion || ''}"`
  ]);

  const csvContent = '\uFEFF' + [cabeceras.join(','), ...filas.map(f => f.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.setAttribute('download', `Expedientes_IREC_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Resultados exportados a CSV con éxito', 'success');
}

// ==========================================================================
// UTILIDADES
// ==========================================================================
function showToast(mensaje, tipo = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resaltarPalabras(texto, palabras) {
  if (!texto) return '';
  if (!palabras || palabras.length === 0) return escapeHtml(texto);

  // Escapar HTML base
  let safe = escapeHtml(texto);

  palabras.forEach(w => {
    if (!w || w.length < 2) return;
    const regex = new RegExp(`(${escapeRegex(w)})`, 'gi');
    safe = safe.replace(regex, '<mark class="hl">$1</mark>');
  });

  return safe;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
