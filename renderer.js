// ==========================================================================
// RENDERER PROCESS - BUSCADOR DE ARCHIVOS ENTREGABLES FINANZAS
// Explorador de Entregas / Apertura Directa PDF / Navbar Limpia
// ==========================================================================

let currentConfig = {
  ubicacionActiva: 'entregables',
  rutaIrec: '\\\\172.40.5.84\\irec',
  rutaSsdirec: '\\\\172.40.5.84\\ssdirec',
  rutaEntregables: '\\\\172.40.5.84\\ssdirec\\ENTREGABLES PROCESADOS FINANZAS',
  limiteResultados: 200,
  profundidadMaxima: 8,
  tiempoLimiteMs: 45000,
  buscarEnRuta: true
};

let currentCarpeta = '';
let currentRutaCompleta = '';
let carpetasList = [];
let ultimosResultados = [];
let searchChips = [];

// ==========================================================================
// MEMORIA RAM CACHÉ (ALMACENAMIENTO RÁPIDO PARA RESPUESTAS INSTANTÁNEAS A 0ms)
// ==========================================================================
const cacheMemoria = {
  carpetasRaiz: new Map(), // ubicacion -> carpetas[]
  subcarpetas: new Map(),  // cacheKey -> subcarpetas[]
  listados: new Map(),     // cacheKey -> resultado
  busquedas: new Map()     // cacheKey -> resultado
};

function obtenerClaseTamanoTexto(texto) {
  if (!texto) return '';
  const len = texto.length;
  if (len > 30) return 'text-xl';
  if (len > 20) return 'text-long';
  return '';
}

// DOM Elements
const foldersSectionTitle = document.getElementById('folders-section-title');
const allFoldersLabel = document.getElementById('all-folders-label');

const searchBoxWrapper = document.getElementById('search-box-wrapper');
const searchSuggestionsDropdown = document.getElementById('search-suggestions-dropdown');
const searchInputBox = document.getElementById('search-input-box');
const chipsList = document.getElementById('chips-list');
const searchInput = document.getElementById('search-input');
const btnExecSearch = document.getElementById('btn-exec-search');
const btnClearSearch = document.getElementById('btn-clear-search');
const selectMaxResults = document.getElementById('select-max-results');
const chkSearchInPath = document.getElementById('chk-search-in-path');
const activeDelName = document.getElementById('active-del-name');

const explorerTree = document.getElementById('explorer-tree');
const treeRootAll = document.getElementById('tree-root-all');
const filterDelegacionInput = document.getElementById('filter-delegacion-input');
const btnRefreshTree = document.getElementById('btn-refresh-tree');

function obtenerBusquedasGuardadas() {
  try {
    const data = localStorage.getItem('busquedas_recientes_irec');
    if (data) return JSON.parse(data);
  } catch (e) {}
  return [
    'ENTREGABLES PROCESADOS FINANZAS',
    '1 ENTREGA REGISTROS',
    'LIBROS Y SELLOS',
    '2004 1788'
  ];
}

function guardarBusquedasRecientes(lista) {
  try {
    localStorage.setItem('busquedas_recientes_irec', JSON.stringify(lista));
  } catch (e) {}
}

let busquedasRecientes = obtenerBusquedasGuardadas();

function eliminarBusquedaReciente(texto) {
  busquedasRecientes = busquedasRecientes.filter(b => b.toLowerCase() !== texto.toLowerCase());
  guardarBusquedasRecientes(busquedasRecientes);
  mostrarSugerencias();
}

function limpiarTodoHistorial() {
  busquedasRecientes = [];
  guardarBusquedasRecientes(busquedasRecientes);
  mostrarSugerencias();
}

function registrarBusquedaReciente(terminos) {
  if (!terminos || terminos.length === 0) return;
  const queryStr = terminos.join(' ').trim();
  if (!queryStr) return;
  busquedasRecientes = busquedasRecientes.filter(b => b.toLowerCase() !== queryStr.toLowerCase());
  busquedasRecientes.unshift(queryStr);
  if (busquedasRecientes.length > 8) {
    busquedasRecientes = busquedasRecientes.slice(0, 8);
  }
  guardarBusquedasRecientes(busquedasRecientes);
}

let sugerenciasActivas = [];
let sugerenciaIndex = -1;

function mostrarSugerencias() {
  if (!searchSuggestionsDropdown) return;
  const query = searchInput.value.trim().toLowerCase();
  sugerenciasActivas = [];
  sugerenciaIndex = -1;

  // ÚNICAMENTE las búsquedas del usuario (filtradas si hay texto escrito)
  sugerenciasActivas = busquedasRecientes
    .filter(b => !query || b.toLowerCase().includes(query))
    .slice(0, 10)
    .map(b => ({ texto: b }));

  if (sugerenciasActivas.length === 0) {
    ocultarSugerencias();
    return;
  }

  renderSugerenciasDropdown(query);
  searchSuggestionsDropdown.classList.remove('hidden');
}

function ocultarSugerencias() {
  if (searchSuggestionsDropdown) {
    searchSuggestionsDropdown.classList.add('hidden');
  }
  sugerenciaIndex = -1;
}

function renderSugerenciasDropdown(query) {
  if (!searchSuggestionsDropdown) return;
  searchSuggestionsDropdown.innerHTML = '';

  sugerenciasActivas.forEach((item, idx) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'suggestion-item' + (idx === sugerenciaIndex ? ' highlighted' : '');
    itemEl.dataset.index = idx;

    const textoResaltado = query
      ? resaltarTextoGoogle(item.texto, query)
      : escapeHtml(item.texto);

    const iconoSvg = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

    itemEl.innerHTML = `
      <div class="suggestion-item-main">
        <span class="suggestion-icon">${iconoSvg}</span>
        <span class="suggestion-text">${textoResaltado}</span>
      </div>
      <div class="suggestion-actions">
        <button type="button" class="btn-delete-suggestion" title="Eliminar de las búsquedas">&times;</button>
      </div>
    `;

    // Event listener para borrar búsqueda individual
    const btnDel = itemEl.querySelector('.btn-delete-suggestion');
    if (btnDel) {
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        eliminarBusquedaReciente(item.texto);
      });
    }

    itemEl.addEventListener('mouseenter', () => {
      sugerenciaIndex = idx;
      actualizarHighlightSugerencias();
    });

    itemEl.addEventListener('click', (e) => {
      e.stopPropagation();
      seleccionarSugerencia(item.texto);
    });

    searchSuggestionsDropdown.appendChild(itemEl);
  });

  const footer = document.createElement('div');
  footer.className = 'suggestion-footer';
  footer.innerHTML = `
    ${busquedasRecientes.length > 0 ? '<button type="button" class="btn-clear-history-link" id="btn-clear-history">Borrar historial de búsquedas</button>' : '<span>Sin búsquedas</span>'}
    <span>Navega con <kbd>↑</kbd> <kbd>↓</kbd> · <kbd>Enter</kbd></span>
  `;

  const btnClearAll = footer.querySelector('#btn-clear-history');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', (e) => {
      e.stopPropagation();
      limpiarTodoHistorial();
    });
  }

  searchSuggestionsDropdown.appendChild(footer);
}

function resaltarTextoGoogle(texto, query) {
  if (!query) return escapeHtml(texto);
  const idx = texto.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtml(texto);
  const antes = texto.substring(0, idx);
  const coincide = texto.substring(idx, idx + query.length);
  const despues = texto.substring(idx + query.length);
  return `${escapeHtml(antes)}<span class="match-highlight">${escapeHtml(coincide)}</span>${escapeHtml(despues)}`;
}

function actualizarHighlightSugerencias() {
  if (!searchSuggestionsDropdown) return;
  const items = searchSuggestionsDropdown.querySelectorAll('.suggestion-item');
  items.forEach((it, idx) => {
    if (idx === sugerenciaIndex) {
      it.classList.add('highlighted');
      it.scrollIntoView({ block: 'nearest' });
    } else {
      it.classList.remove('highlighted');
    }
  });
}

function seleccionarSugerencia(texto) {
  if (!texto) return;
  const partes = texto.trim().split(/\s+/);
  partes.forEach(p => agregarChip(p));
  searchInput.value = '';
  actualizarBotonLimpiar();
  ocultarSugerencias();
  ejecutarBusqueda();
  searchInput.focus();
}

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
const btnOpenSettings = document.getElementById('btn-open-settings');

const modalSettings = document.getElementById('modal-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const cfgRutaIrec = document.getElementById('cfg-ruta-irec');
const cfgRutaSsdirec = document.getElementById('cfg-ruta-ssdirec');
const cfgRutaEntregables = document.getElementById('cfg-ruta-entregables');
const btnBrowseIrec = document.getElementById('btn-browse-irec');
const btnBrowseSsdirec = document.getElementById('btn-browse-ssdirec');
const btnBrowseEntregables = document.getElementById('btn-browse-entregables');
const cfgTimeout = document.getElementById('cfg-timeout');
const btnSaveSettings = document.getElementById('btn-save-settings');

const toastContainer = document.getElementById('toast-container');

function getRutaBaseActual() {
  const ubi = currentConfig.ubicacionActiva || 'entregables';
  if (ubi === 'irec') return currentConfig.rutaIrec;
  if (ubi === 'ssdirec') return currentConfig.rutaSsdirec;
  if (ubi === 'entregables') return currentConfig.rutaEntregables;
  return 'todas';
}

function actualizarTabsAlmacenamiento(activo) {
  document.querySelectorAll('.storage-tab').forEach(tab => {
    if (tab.dataset.storage === activo) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

function actualizarLabelsUI() {
  const ubi = currentConfig.ubicacionActiva || 'entregables';
  if (allFoldersLabel) {
    if (ubi === 'todas') allFoldersLabel.textContent = 'Todas las ubicaciones';
    else if (ubi === 'entregables') allFoldersLabel.textContent = 'Todas las entregas';
    else if (ubi === 'irec') allFoldersLabel.textContent = 'Todo irec';
    else if (ubi === 'ssdirec') allFoldersLabel.textContent = 'Todo ssdirec';
  }
  if (activeDelName) {
    if (ubi === 'todas') activeDelName.textContent = 'Todas las ubicaciones';
    else if (ubi === 'entregables') activeDelName.textContent = 'Todas las entregas y carpetas';
    else if (ubi === 'irec') activeDelName.textContent = 'Todo irec';
    else if (ubi === 'ssdirec') activeDelName.textContent = 'Todo ssdirec';
  }
}

function actualizarRutaSidebar() {
  if (!sidebarCurrentPath) return;
  const ubi = currentConfig.ubicacionActiva || 'entregables';
  let ruta = '';
  if (ubi === 'irec') ruta = currentConfig.rutaIrec;
  else if (ubi === 'ssdirec') ruta = currentConfig.rutaSsdirec;
  else if (ubi === 'entregables') ruta = currentConfig.rutaEntregables;
  else ruta = 'Todas las ubicaciones (irec, ssdirec, entregables)';

  sidebarCurrentPath.textContent = ruta;
  sidebarCurrentPath.title = ruta;
}

async function cambiarAlmacenamiento(nuevaUbicacion) {
  if (currentConfig.ubicacionActiva === nuevaUbicacion) return;

  currentConfig.ubicacionActiva = nuevaUbicacion;
  currentCarpeta = '';
  currentRutaCompleta = '';

  actualizarTabsAlmacenamiento(nuevaUbicacion);
  actualizarRutaSidebar();
  actualizarLabelsUI();

  const labels = {
    'irec': 'irec',
    'ssdirec': 'ssdirec',
    'entregables': 'Entregables Finanzas',
    'todas': 'Todas las ubicaciones'
  };
  showToast(`Ubicación: ${labels[nuevaUbicacion] || nuevaUbicacion}`, 'info');

  await cargarCarpetas(false);

  const terminos = obtenerTerminosBusqueda();
  if (terminos.length > 0) {
    ejecutarBusqueda();
  } else {
    cargarListadoInicial();
  }
}

async function inicializarApp() {
  setupEventListeners();
  initTableColumnResizers();
  await cargarConfiguracionInicial();
  await verificarEstadoRed();
  await cargarCarpetas();
  await cargarListadoInicial();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarApp);
} else {
  inicializarApp();
}

async function cargarConfiguracionInicial() {
  try {
    const cfg = await window.electronAPI.obtenerConfig();
    if (cfg) {
      currentConfig = { ...currentConfig, ...cfg };
    }

    actualizarTabsAlmacenamiento(currentConfig.ubicacionActiva || 'entregables');
    actualizarRutaSidebar();
    actualizarLabelsUI();

    if (cfgRutaIrec) cfgRutaIrec.value = currentConfig.rutaIrec || '\\\\172.40.5.84\\irec';
    if (cfgRutaSsdirec) cfgRutaSsdirec.value = currentConfig.rutaSsdirec || '\\\\172.40.5.84\\ssdirec';
    if (cfgRutaEntregables) cfgRutaEntregables.value = currentConfig.rutaEntregables || '\\\\172.40.5.84\\ssdirec\\ENTREGABLES PROCESADOS FINANZAS';
    if (cfgTimeout) cfgTimeout.value = currentConfig.tiempoLimiteMs || 45000;
    if (selectMaxResults) selectMaxResults.value = currentConfig.limiteResultados || 200;
  } catch (err) {
    console.error('Error al cargar config:', err);
  }
}

async function verificarEstadoRed() {
  connectionStatus.className = 'status-pill checking';
  statusText.textContent = 'Verificando servidores...';

  try {
    const res = await window.electronAPI.verificarServidores({
      rutaIrec: currentConfig.rutaIrec,
      rutaSsdirec: currentConfig.rutaSsdirec,
      rutaEntregables: currentConfig.rutaEntregables
    });

    if (res && res.todoConectado) {
      connectionStatus.className = 'status-pill online';
      statusText.textContent = 'Servidores conectados';
      return true;
    } else if (res && res.conectado) {
      connectionStatus.className = 'status-pill online';
      statusText.textContent = res.mensaje || 'Servidores accesibles';
      return true;
    } else {
      connectionStatus.className = 'status-pill offline';
      statusText.textContent = 'Sin conexión a red';
      showToast('No se puede acceder a las rutas de red configuradas', 'error');
      return false;
    }
  } catch (err) {
    connectionStatus.className = 'status-pill offline';
    statusText.textContent = 'Error de conexión';
    return false;
  }
}

// ==========================================================================
// EXPLORADOR DE ARCHIVOS EN SIDEBAR (TREE VIEW CON SCROLL Y CACHÉ EN MEMORIA)
// ==========================================================================
async function cargarCarpetas(forzarRed = false) {
  const ubi = currentConfig.ubicacionActiva || 'entregables';
  try {
    if (!forzarRed && cacheMemoria.carpetasRaiz.has(ubi)) {
      carpetasList = cacheMemoria.carpetasRaiz.get(ubi);
      renderizarArbolCarpetas(carpetasList);
      return;
    }

    explorerTree.innerHTML = '<div style="padding: 12px; font-size: 12px; color: #94a3b8;">Cargando carpetas...</div>';

    const res = await window.electronAPI.obtenerCarpetas({
      ubicacion: ubi,
      rutaIrec: currentConfig.rutaIrec,
      rutaSsdirec: currentConfig.rutaSsdirec,
      rutaEntregables: currentConfig.rutaEntregables,
      forzarRed
    });

    if (res && res.carpetas) {
      carpetasList = res.carpetas;
      cacheMemoria.carpetasRaiz.set(ubi, carpetasList);
      renderizarArbolCarpetas(carpetasList);
    } else {
      explorerTree.innerHTML = '<div style="padding: 12px; font-size: 12px; color: #e53e3e;">No se pudieron leer las carpetas.</div>';
    }
  } catch (err) {
    console.error('Error obteniendo carpetas:', err);
    explorerTree.innerHTML = '<div style="padding: 12px; font-size: 12px; color: #e53e3e;">Error al acceder a la red.</div>';
  }
}

function renderizarArbolCarpetas(carpetas) {
  explorerTree.innerHTML = '';

  carpetas.forEach(c => {
    const nombre = typeof c === 'string' ? c : c.nombre;
    const subruta = (c && c.subruta) ? c.subruta : nombre;
    const rutaCompleta = (c && c.rutaCompleta) ? c.rutaCompleta : '';
    if (!nombre) return;

    const nodeGroup = document.createElement('div');
    nodeGroup.className = 'tree-node-group';

    const itemDiv = document.createElement('div');
    itemDiv.className = 'tree-item' + (currentCarpeta === subruta ? ' active' : '');
    itemDiv.dataset.subruta = subruta;
    itemDiv.dataset.rutaCompleta = rutaCompleta;
    itemDiv.dataset.nombre = nombre;

    const sizeClass = obtenerClaseTamanoTexto(nombre);

    itemDiv.innerHTML = `
      <span class="tree-toggle" title="Expandir/Colapsar">\u25B8</span>
      <span class="tree-folder-emoji">\u{1F4C1}</span>
      <span class="tree-label ${sizeClass}" title="${escapeHtml(nombre)}">${escapeHtml(nombre)}</span>
    `;

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children hidden';

    const toggleBtn = itemDiv.querySelector('.tree-toggle');
    const folderEmoji = itemDiv.querySelector('.tree-folder-emoji');

    toggleBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isOpen = toggleBtn.classList.contains('open');

      if (isOpen) {
        toggleBtn.classList.remove('open');
        toggleBtn.textContent = '\u25B8';
        if (folderEmoji) folderEmoji.textContent = '\u{1F4C1}';
        childrenContainer.classList.add('hidden');
      } else {
        toggleBtn.classList.add('open');
        toggleBtn.textContent = '\u25BE';
        if (folderEmoji) folderEmoji.textContent = '\u{1F4C2}';
        childrenContainer.classList.remove('hidden');

        if (!childrenContainer.dataset.loaded) {
          const rutaBase = currentConfig.rutaBase;
          const cacheKey = `${rutaBase}:::${subruta || rutaCompleta}`;

          if (cacheMemoria.subcarpetas.has(cacheKey)) {
            const subs = cacheMemoria.subcarpetas.get(cacheKey);
            childrenContainer.innerHTML = '';
            childrenContainer.dataset.loaded = 'true';
            if (subs && subs.length > 0) {
              subs.forEach(sub => renderSubnodo(sub, childrenContainer, rutaBase));
            } else {
              toggleBtn.style.visibility = 'hidden';
              childrenContainer.remove();
            }
          } else {
            childrenContainer.innerHTML = '<div style="padding: 4px 8px; font-size: 11px; color: #94a3b8;">Cargando...</div>';
            try {
              const subs = await window.electronAPI.obtenerSubcarpetas({
                rutaBase,
                subruta,
                rutaCompleta
              });

              cacheMemoria.subcarpetas.set(cacheKey, subs || []);
              childrenContainer.innerHTML = '';
              childrenContainer.dataset.loaded = 'true';

              if (subs && subs.length > 0) {
                subs.forEach(sub => renderSubnodo(sub, childrenContainer, rutaBase));
              } else {
                toggleBtn.style.visibility = 'hidden';
                childrenContainer.remove();
              }
            } catch (err) {
              childrenContainer.innerHTML = '<div style="padding: 4px 8px; font-size: 11px; color: #e53e3e;">Sin acceso</div>';
            }
          }
        }
      }
    });

    itemDiv.addEventListener('click', () => {
      seleccionarCarpeta(subruta, rutaCompleta, nombre, itemDiv);
    });

    nodeGroup.appendChild(itemDiv);
    nodeGroup.appendChild(childrenContainer);
    explorerTree.appendChild(nodeGroup);
  });
}

function renderSubnodo(sub, parentContainer, rutaBase) {
  const subGroup = document.createElement('div');
  subGroup.className = 'tree-node-group';

  const subItem = document.createElement('div');
  subItem.className = 'tree-item' + (currentCarpeta === sub.subruta ? ' active' : '');
  subItem.dataset.subruta = sub.subruta;
  subItem.dataset.rutaCompleta = sub.rutaCompleta;
  subItem.dataset.nombre = sub.nombre;

  const sizeClass = obtenerClaseTamanoTexto(sub.nombre);

  subItem.innerHTML = `
    <span class="tree-toggle" title="Expandir/Colapsar">\u25B8</span>
    <span class="tree-folder-emoji">\u{1F4C1}</span>
    <span class="tree-label ${sizeClass}" title="${escapeHtml(sub.nombre)}">${escapeHtml(sub.nombre)}</span>
  `;

  const subChildren = document.createElement('div');
  subChildren.className = 'tree-children hidden';

  const subToggle = subItem.querySelector('.tree-toggle');
  const subEmoji = subItem.querySelector('.tree-folder-emoji');

  subToggle.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOpen = subToggle.classList.contains('open');
    if (isOpen) {
      subToggle.classList.remove('open');
      subToggle.textContent = '\u25B8';
      if (subEmoji) subEmoji.textContent = '\u{1F4C1}';
      subChildren.classList.add('hidden');
    } else {
      subToggle.classList.add('open');
      subToggle.textContent = '\u25BE';
      if (subEmoji) subEmoji.textContent = '\u{1F4C2}';
      subChildren.classList.remove('hidden');

      if (!subChildren.dataset.loaded) {
        const cacheKey = `${rutaBase}:::${sub.subruta || sub.rutaCompleta}`;

        if (cacheMemoria.subcarpetas.has(cacheKey)) {
          const deepSubs = cacheMemoria.subcarpetas.get(cacheKey);
          subChildren.innerHTML = '';
          subChildren.dataset.loaded = 'true';
          if (deepSubs && deepSubs.length > 0) {
            deepSubs.forEach(ds => renderSubnodo(ds, subChildren, rutaBase));
          } else {
            subToggle.style.visibility = 'hidden';
            subChildren.remove();
          }
        } else {
          subChildren.innerHTML = '<div style="padding: 4px 8px; font-size: 11px; color: #94a3b8;">Cargando...</div>';
          try {
            const deepSubs = await window.electronAPI.obtenerSubcarpetas({
              rutaBase,
              subruta: sub.subruta,
              rutaCompleta: sub.rutaCompleta
            });

            cacheMemoria.subcarpetas.set(cacheKey, deepSubs || []);
            subChildren.innerHTML = '';
            subChildren.dataset.loaded = 'true';

            if (deepSubs && deepSubs.length > 0) {
              deepSubs.forEach(ds => renderSubnodo(ds, subChildren, rutaBase));
            } else {
              subToggle.style.visibility = 'hidden';
              subChildren.remove();
            }
          } catch (err) {
            subChildren.innerHTML = '<div style="padding: 4px 8px; font-size: 11px; color: #e53e3e;">Sin acceso</div>';
          }
        }
      }
    }
  });

  subItem.addEventListener('click', () => {
    seleccionarCarpeta(sub.subruta, sub.rutaCompleta, sub.nombre, subItem);
  });

  subGroup.appendChild(subItem);
  subGroup.appendChild(subChildren);
  parentContainer.appendChild(subGroup);
}

function seleccionarCarpeta(subruta, rutaCompleta, nombre, elementoClick = null) {
  currentCarpeta = subruta || '';
  currentRutaCompleta = rutaCompleta || '';

  // Actualizar estado de selección visible (.active) en todo el árbol
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));

  if (elementoClick) {
    elementoClick.classList.add('active');
  } else if (!currentCarpeta && treeRootAll) {
    treeRootAll.classList.add('active');
  } else {
    const items = document.querySelectorAll('.tree-item');
    for (const el of items) {
      if (
        (currentCarpeta && el.dataset.subruta === currentCarpeta) ||
        (currentRutaCompleta && el.dataset.rutaCompleta === currentRutaCompleta)
      ) {
        el.classList.add('active');
        break;
      }
    }
  }

  if (activeDelName) {
    activeDelName.textContent = nombre ? nombre : 'Todas las entregas y carpetas';
  }

  const terminos = obtenerTerminosBusqueda();
  if (terminos.length > 0) {
    ejecutarBusqueda();
  } else {
    cargarListadoInicial();
  }
}

// ==========================================================================
// GESTIÓN DE BADGES / CHIPS DE PALABRAS
// ==========================================================================
function renderChips() {
  chipsList.innerHTML = '';
  searchChips.forEach((chip, index) => {
    const el = document.createElement('span');
    el.className = 'search-badge-chip';
    el.innerHTML = `
      <span class="badge-chip-text">${escapeHtml(chip)}</span>
      <button type="button" class="badge-chip-remove" title="Eliminar etiqueta" data-index="${index}">&times;</button>
    `;

    el.querySelector('.badge-chip-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      eliminarChip(index);
    });

    chipsList.appendChild(el);
  });
}

function agregarChip(palabra) {
  const limpia = palabra.trim().replace(/^[,;\s]+|[,;\s]+$/g, '');
  if (!limpia) return;
  if (!searchChips.includes(limpia)) {
    searchChips.push(limpia);
    renderChips();
    actualizarBotonLimpiar();
  }
}

function eliminarChip(index) {
  searchChips.splice(index, 1);
  renderChips();
  actualizarBotonLimpiar();
  ejecutarBusqueda();
}

function obtenerTerminosBusqueda() {
  const terminos = [...searchChips];
  const entradaActual = searchInput.value.trim();
  if (entradaActual) {
    const partes = entradaActual.split(/\s+/);
    partes.forEach(p => {
      const limpia = p.replace(/^[,;\s]+|[,;\s]+$/g, '');
      if (limpia && !terminos.includes(limpia)) {
        terminos.push(limpia);
      }
    });
  }
  return terminos;
}

function actualizarBotonLimpiar() {
  if (searchChips.length > 0 || searchInput.value.trim().length > 0) {
    btnClearSearch.style.display = 'flex';
  } else {
    btnClearSearch.style.display = 'none';
  }
}

function limpiarBusqueda() {
  searchChips = [];
  searchInput.value = '';
  renderChips();
  actualizarBotonLimpiar();
  cargarListadoInicial();
  searchInput.focus();
}
// ==========================================================================
// CARGA INICIAL DE ARCHIVOS (CON MEMORIA RAM CACHÉ)
// ==========================================================================
async function cargarListadoInicial(forzarRed = false) {
  const ubi = currentConfig.ubicacionActiva || 'entregables';
  const limite = parseInt(selectMaxResults.value, 10) || 200;
  const cacheKey = `listado:::${ubi}:::${currentCarpeta}:::${currentRutaCompleta}:::${limite}`;

  // Si ya se consultó antes, responder de inmediato en 0ms desde memoria RAM
  if (!forzarRed && cacheMemoria.listados.has(cacheKey)) {
    const cached = cacheMemoria.listados.get(cacheKey);
    renderResultados({ ...cached, duracionSegundos: 0, desdeCache: true });
    return;
  }

  stateInitial.style.display = 'none';
  stateNoResults.style.display = 'none';
  resultsTableContainer.style.display = 'none';
  resultsKpiBar.style.display = 'none';
  stateLoading.style.display = 'flex';

  const titleEl = document.getElementById('loading-title');
  const detailsEl = document.getElementById('loading-details');
  const ubiNames = {
    'irec': 'irec',
    'ssdirec': 'ssdirec',
    'entregables': 'ENTREGABLES FINANZAS',
    'todas': 'todas las ubicaciones'
  };
  const ubiText = `en ${ubiNames[ubi] || ubi}`;
  const carpetaText = currentCarpeta ? `en ${currentCarpeta}` : ubiText;
  titleEl.textContent = `Listando archivos ${carpetaText}...`;
  detailsEl.textContent = 'Obteniendo expedientes PDF...';

  try {
    const res = await window.electronAPI.listarArchivosIniciales({
      ubicacion: ubi,
      rutaIrec: currentConfig.rutaIrec,
      rutaSsdirec: currentConfig.rutaSsdirec,
      rutaEntregables: currentConfig.rutaEntregables,
      rutaBase: getRutaBaseActual(),
      carpeta: currentCarpeta,
      rutaCompleta: currentRutaCompleta,
      limite: limite
    });

    if (res && res.archivos) {
      cacheMemoria.listados.set(cacheKey, res);
    }
    renderResultados(res);
  } catch (err) {
    console.error('Error al listar archivos iniciales:', err);
    mostrarErrorBusqueda(err.message);
  }
}

// ==========================================================================
// EJECUCIÓN DE BÚSQUEDA (CON MEMORIA RAM CACHÉ)
// ==========================================================================
async function ejecutarBusqueda(esSilencioso = false, forzarRed = false) {
  const terminos = obtenerTerminosBusqueda();

  if (terminos.length === 0) {
    cargarListadoInicial(forzarRed);
    return;
  }

  registrarBusquedaReciente(terminos);

  const ubi = currentConfig.ubicacionActiva || 'entregables';
  const limite = parseInt(selectMaxResults.value, 10) || 200;
  const buscarEnRuta = chkSearchInPath ? chkSearchInPath.checked : true;
  const terminosClave = [...terminos].sort().join('|');
  const cacheKey = `busqueda:::${ubi}:::${currentCarpeta}:::${currentRutaCompleta}:::${terminosClave}:::${limite}:::${buscarEnRuta}`;

  // Si esta búsqueda ya se hizo en esta carpeta, responder instantáneamente
  if (!forzarRed && cacheMemoria.busquedas.has(cacheKey)) {
    const cached = cacheMemoria.busquedas.get(cacheKey);
    renderResultados({ ...cached, duracionSegundos: 0, desdeCache: true });
    return;
  }

  if (!esSilencioso) {
    mostrarEstadoCargando();
  }

  const options = {
    ubicacion: ubi,
    rutaIrec: currentConfig.rutaIrec,
    rutaSsdirec: currentConfig.rutaSsdirec,
    rutaEntregables: currentConfig.rutaEntregables,
    rutaBase: getRutaBaseActual(),
    palabras: terminos,
    carpeta: currentCarpeta,
    rutaCompleta: currentRutaCompleta,
    limiteResultados: limite,
    profundidadMaxima: currentConfig.profundidadMaxima || 8,
    tiempoLimiteMs: currentConfig.tiempoLimiteMs || 45000,
    buscarEnRuta: buscarEnRuta,
    extensiones: ['pdf']
  };

  try {
    const res = await window.electronAPI.buscarArchivos(options);
    if (res && res.archivos) {
      cacheMemoria.busquedas.set(cacheKey, res);
    }
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

  const titleEl = document.getElementById('loading-title');
  const detailsEl = document.getElementById('loading-details');
  const ubi = currentConfig.ubicacionActiva || 'entregables';
  const ubiNames = {
    'irec': 'irec',
    'ssdirec': 'ssdirec',
    'entregables': 'ENTREGABLES FINANZAS',
    'todas': 'todas las ubicaciones'
  };
  const ubiText = `en ${ubiNames[ubi] || ubi}`;
  const carpetaText = currentCarpeta ? `en ${currentCarpeta}` : ubiText;
  titleEl.textContent = `Buscando expedientes ${carpetaText}...`;
  detailsEl.textContent = 'Comparando términos en milisegundos...';
}

function renderResultados(res) {
  stateLoading.style.display = 'none';

  if (!res || !res.archivos || res.archivos.length === 0) {
    stateInitial.style.display = 'none';
    resultsTableContainer.style.display = 'none';
    resultsKpiBar.style.display = 'none';
    stateNoResults.style.display = 'flex';

    const etiquetasStr = (res.palabras || []).join(', ');
    if (currentCarpeta) {
      noResultsDesc.textContent = `No se encontraron coincidencias para [${etiquetasStr}] en "${currentCarpeta}".`;
    } else {
      noResultsDesc.textContent = 'No se encontraron archivos que coincidan con las etiquetas indicadas.';
    }
    ultimosResultados = [];
    return;
  }

  ultimosResultados = res.archivos;

  // Render KPIs
  kpiTotal.textContent = res.archivos.length;
  if (res.desdeCache) {
    kpiDuration.textContent = '0.00s (en memoria)';
  } else {
    kpiDuration.textContent = (res.duracionSegundos || 0) + 's';
  }

  if (res.limiteAlcanzado) {
    kpiWarnings.style.display = 'inline-block';
    kpiWarnings.textContent = `(Límite de ${res.archivos.length} alcanzado)`;
  } else if (res.tiempoAlcanzado) {
    kpiWarnings.style.display = 'inline-block';
    kpiWarnings.textContent = '(Tiempo límite alcanzado)';
  } else {
    kpiWarnings.style.display = 'none';
  }

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

  resultsTbody.innerHTML = '';
  const palabrasABuscar = res.palabras || [];

  res.archivos.forEach(item => {
    const tr = document.createElement('tr');
    tr.title = 'Haz doble clic para abrir el archivo directamente';

    const nombreResaltado = resaltarPalabras(item.nombre, palabrasABuscar);

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
        ${item.almacenamiento ? `<span class="badge-location ${escapeHtml(item.almacenamiento)}">${escapeHtml(item.almacenamiento)}</span>` : ''}
        <span class="del-tag">${escapeHtml(item.delegacion || 'General')}</span>
      </td>
      <td class="col-path" title="${escapeHtml(item.rutaCompleta)}">
        ${escapeHtml(item.rutaCompleta)}
      </td>
      <td class="col-actions">
        <div class="action-btn-group">
          <button class="btn-act btn-action-open" title="Abrir con lector PDF predeterminado">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            <span>Abrir</span>
          </button>
          <button class="btn-act btn-action-folder" title="Mostrar en el Explorador de Windows">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Carpeta</span>
          </button>
          <button class="btn-act btn-action-copy" title="Copiar ruta de red UNC">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copiar</span>
          </button>
        </div>
      </td>
    `;

    // Doble clic en cualquier parte de la fila: Abre el PDF directamente
    tr.addEventListener('dblclick', async () => {
      await abrirPdfDirecto(item);
    });

    const btnOpen = tr.querySelector('.btn-action-open');
    const btnFolder = tr.querySelector('.btn-action-folder');
    const btnCopy = tr.querySelector('.btn-action-copy');

    btnOpen.addEventListener('click', async (e) => {
      e.stopPropagation();
      await abrirPdfDirecto(item);
    });

    btnFolder.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.electronAPI.abrirEnCarpeta(item.rutaCompleta);
      showToast('Ubicación abierta en Explorador', 'info');
    });

    btnCopy.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.electronAPI.copiarPortapapeles(item.rutaCompleta);
      showToast('Ruta UNC copiada al portapapeles', 'success');
    });

    resultsTbody.appendChild(tr);
  });

  resultsTableContainer.style.display = 'block';
  stateInitial.style.display = 'none';
  stateNoResults.style.display = 'none';
}

async function abrirPdfDirecto(item) {
  showToast('Abriendo ' + item.nombre + ' en lector PDF...', 'success');
  try {
    const resp = await window.electronAPI.abrirArchivo(item.rutaCompleta);
    if (resp && !resp.success) {
      showToast('Error al abrir: ' + (resp.error || 'fallo'), 'error');
    }
  } catch (err) {
    showToast('Error al abrir archivo: ' + err.message, 'error');
  }
}

function mostrarErrorBusqueda(mensaje) {
  stateLoading.style.display = 'none';
  stateNoResults.style.display = 'flex';
  noResultsDesc.textContent = `Error al buscar: ${mensaje}`;
}

// ==========================================================================
// REDIMENSIONAMIENTO DE COLUMNAS DE LA TABLA
// ==========================================================================
function initTableColumnResizers() {
  const table = document.getElementById('results-table');
  const wrapper = document.getElementById('results-table-container');
  if (!table || !wrapper) return;

  const STORAGE_KEY = 'irec_table_col_widths_v4';

  // Anchos predeterminados en px:
  // Columnas actuales: Icono, Nombre del Archivo, Carpeta / Delegación, Ubicación Completa, Acciones (Abrir, Carpeta, Copiar)
  const defaultWidths = {
    'icon': 42,
    'name': 250,
    'del': 140,
    'path': 340,
    'actions': 230
  };

  const minWidths = {
    'icon': 40,
    'name': 120,
    'del': 80,
    'path': 120,
    'actions': 215
  };

  let savedWidths = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) savedWidths = JSON.parse(raw);
  } catch (e) {
    console.warn('No se pudieron recuperar anchos de columnas:', e);
  }

  const ths = Array.from(table.querySelectorAll('thead th'));

  function updateTableWidth() {
    let totalCols = 0;
    ths.forEach(th => {
      const col = th.dataset.col;
      const w = parseInt(th.style.width, 10) || defaultWidths[col] || 100;
      totalCols += w;
    });
    table.style.width = `${totalCols}px`;
    table.style.minWidth = '100%';
  }

  // Aplicar anchos iniciales guardados o predeterminados
  ths.forEach(th => {
    const col = th.dataset.col;
    if (!col) return;
    const initialW = savedWidths[col] || defaultWidths[col];
    if (initialW) {
      th.style.width = `${initialW}px`;
    }
    if (minWidths[col]) {
      th.style.minWidth = `${minWidths[col]}px`;
    }
  });

  updateTableWidth();

  // Configurar cada controlador de arrastre (resizer)
  ths.forEach(th => {
    const resizer = th.querySelector('.col-resizer');
    if (!resizer) return;

    const col = th.dataset.col;

    // Doble clic: restablecer la columna a su tamaño predeterminado
    resizer.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const defW = defaultWidths[col];
      if (defW) {
        th.style.width = `${defW}px`;
        delete savedWidths[col];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(savedWidths));
        } catch (_) {}
        updateTableWidth();
        showToast(`Columna restaurada al ancho predeterminado`, 'info');
      }
    });

    resizer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.pageX;
      const rect = th.getBoundingClientRect();
      const startWidth = rect.width || parseInt(th.style.width, 10) || defaultWidths[col] || 100;
      const minW = minWidths[col] || 60;

      resizer.classList.add('is-resizing');
      document.body.classList.add('is-resizing-columns');

      function onPointerMove(moveEvt) {
        const deltaX = moveEvt.pageX - startX;
        const newWidth = Math.max(minW, Math.round(startWidth + deltaX));
        th.style.width = `${newWidth}px`;
        savedWidths[col] = newWidth;
        updateTableWidth();
      }

      function onPointerUp() {
        resizer.classList.remove('is-resizing');
        document.body.classList.remove('is-resizing-columns');
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(savedWidths));
        } catch (err) {
          console.warn('Error al guardar anchos:', err);
        }
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  });
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function setupEventListeners() {
  document.querySelectorAll('.storage-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      cambiarAlmacenamiento(tab.dataset.storage);
    });
  });

  if (treeRootAll) {
    treeRootAll.addEventListener('click', () => {
      seleccionarCarpeta('', '', '', treeRootAll);
    });
  }

  if (btnRefreshTree) {
    btnRefreshTree.addEventListener('click', () => {
      const ubi = currentConfig.ubicacionActiva || 'entregables';
      cacheMemoria.carpetasRaiz.delete(ubi);
      cacheMemoria.subcarpetas.clear();
      cacheMemoria.listados.clear();
      cacheMemoria.busquedas.clear();
      cargarCarpetas(true);
      const terminos = obtenerTerminosBusqueda();
      if (terminos.length > 0) {
        ejecutarBusqueda(false, true);
      } else {
        cargarListadoInicial(true);
      }
      showToast('Memoria RAM actualizada con la red', 'info');
    });
  }

  searchInput.addEventListener('focus', () => {
    mostrarSugerencias();
  });

  searchInput.addEventListener('click', () => {
    mostrarSugerencias();
  });

  document.addEventListener('pointerdown', (e) => {
    if (searchBoxWrapper && !searchBoxWrapper.contains(e.target)) {
      ocultarSugerencias();
    }
  });

  document.addEventListener('click', (e) => {
    if (searchBoxWrapper && !searchBoxWrapper.contains(e.target)) {
      ocultarSugerencias();
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!searchSuggestionsDropdown || searchSuggestionsDropdown.classList.contains('hidden')) {
        mostrarSugerencias();
      } else if (sugerenciasActivas.length > 0) {
        sugerenciaIndex = (sugerenciaIndex + 1) % sugerenciasActivas.length;
        actualizarHighlightSugerencias();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (sugerenciasActivas.length > 0) {
        sugerenciaIndex = (sugerenciaIndex - 1 + sugerenciasActivas.length) % sugerenciasActivas.length;
        actualizarHighlightSugerencias();
      }
      return;
    }

    if (e.key === 'Escape') {
      if (searchSuggestionsDropdown && !searchSuggestionsDropdown.classList.contains('hidden')) {
        e.preventDefault();
        ocultarSugerencias();
        return;
      }
      limpiarBusqueda();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (sugerenciaIndex >= 0 && sugerenciaIndex < sugerenciasActivas.length && searchSuggestionsDropdown && !searchSuggestionsDropdown.classList.contains('hidden')) {
        seleccionarSugerencia(sugerenciasActivas[sugerenciaIndex].texto);
        return;
      }
      const val = searchInput.value.trim();
      if (val) {
        const partes = val.split(/\s+/);
        partes.forEach(p => agregarChip(p));
        searchInput.value = '';
      }
      ocultarSugerencias();
      ejecutarBusqueda();
      return;
    }

    if (e.key === 'Backspace' && searchInput.value === '' && searchChips.length > 0) {
      e.preventDefault();
      searchChips.pop();
      renderChips();
      actualizarBotonLimpiar();
    }
  });

  searchInput.addEventListener('input', () => {
    actualizarBotonLimpiar();
    mostrarSugerencias();
  });

  btnExecSearch.addEventListener('click', () => {
    const texto = searchInput.value.trim();
    if (texto) {
      const partes = texto.split(/\s+/);
      partes.forEach(p => agregarChip(p));
      searchInput.value = '';
    }
    ocultarSugerencias();
    ejecutarBusqueda();
  });

  btnClearSearch.addEventListener('click', limpiarBusqueda);

  if (filterDelegacionInput) {
    filterDelegacionInput.addEventListener('input', () => {
      const q = filterDelegacionInput.value.toLowerCase().trim();
      const filtradas = carpetasList.filter(c => {
        const nombre = typeof c === 'string' ? c : c.nombre;
        return nombre.toLowerCase().includes(q);
      });
      renderizarArbolCarpetas(filtradas);
    });
  }



  document.querySelectorAll('.ex-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      searchChips = [];
      const partes = btn.dataset.example.split(/\s+/);
      partes.forEach(p => agregarChip(p));
      ejecutarBusqueda();
      searchInput.focus();
    });
  });

  selectMaxResults.addEventListener('change', () => {
    currentConfig.limiteResultados = parseInt(selectMaxResults.value, 10);
    ejecutarBusqueda();
  });

  if (chkSearchInPath) {
    chkSearchInPath.addEventListener('change', () => {
      ejecutarBusqueda();
    });
  }

  btnQuickVerify.addEventListener('click', async () => {
    const ok = await verificarEstadoRed();
    if (ok) {
      showToast('Conexión con servidores verificada', 'success');
      cargarListadoInicial();
    }
  });

  btnOpenSettings.addEventListener('click', () => {
    modalSettings.style.display = 'flex';
  });
  btnCloseSettings.addEventListener('click', () => {
    modalSettings.style.display = 'none';
  });
  modalSettings.addEventListener('click', (e) => {
    if (e.target === modalSettings) modalSettings.style.display = 'none';
  });

  if (btnBrowseIrec) {
    btnBrowseIrec.addEventListener('click', async () => {
      const seleccion = await window.electronAPI.seleccionarCarpeta();
      if (seleccion && cfgRutaIrec) cfgRutaIrec.value = seleccion;
    });
  }

  if (btnBrowseSsdirec) {
    btnBrowseSsdirec.addEventListener('click', async () => {
      const seleccion = await window.electronAPI.seleccionarCarpeta();
      if (seleccion && cfgRutaSsdirec) cfgRutaSsdirec.value = seleccion;
    });
  }

  if (btnBrowseEntregables) {
    btnBrowseEntregables.addEventListener('click', async () => {
      const seleccion = await window.electronAPI.seleccionarCarpeta();
      if (seleccion && cfgRutaEntregables) cfgRutaEntregables.value = seleccion;
    });
  }

  const btnToggleDevTools = document.getElementById('btn-toggle-devtools');
  if (btnToggleDevTools) {
    btnToggleDevTools.addEventListener('click', () => {
      window.electronAPI.toggleDevTools();
    });
  }

  btnSaveSettings.addEventListener('click', async () => {
    const nuevaRutaIrec = cfgRutaIrec ? cfgRutaIrec.value.trim() : currentConfig.rutaIrec;
    const nuevaRutaSsdirec = cfgRutaSsdirec ? cfgRutaSsdirec.value.trim() : currentConfig.rutaSsdirec;
    const nuevaRutaEntregables = cfgRutaEntregables ? cfgRutaEntregables.value.trim() : currentConfig.rutaEntregables;
    const nuevoTimeout = parseInt(cfgTimeout.value, 10) || 45000;

    currentConfig.rutaIrec = nuevaRutaIrec;
    currentConfig.rutaSsdirec = nuevaRutaSsdirec;
    currentConfig.rutaEntregables = nuevaRutaEntregables;
    currentConfig.tiempoLimiteMs = nuevoTimeout;

    await window.electronAPI.guardarConfig({
      ubicacionActiva: currentConfig.ubicacionActiva,
      rutaIrec: nuevaRutaIrec,
      rutaSsdirec: nuevaRutaSsdirec,
      rutaEntregables: nuevaRutaEntregables,
      tiempoLimiteMs: nuevoTimeout
    });

    modalSettings.style.display = 'none';
    showToast('Ajustes de servidores guardados', 'success');

    actualizarRutaSidebar();
    await verificarEstadoRed();
    cacheMemoria.carpetasRaiz.clear();
    cacheMemoria.subcarpetas.clear();
    cacheMemoria.listados.clear();
    cacheMemoria.busquedas.clear();
    await cargarCarpetas(true);
    cargarListadoInicial(true);
  });
}

function resaltarPalabras(texto, palabras) {
  if (!palabras || palabras.length === 0 || !texto) return escapeHtml(texto);

  let resultado = escapeHtml(texto);
  palabras.forEach(palabra => {
    if (!palabra || palabra.length < 1) return;
    const regex = new RegExp(`(${escapeRegExp(palabra)})`, 'gi');
    resultado = resultado.replace(regex, '<mark>$1</mark>');
  });

  return resultado;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function showToast(mensaje, tipo = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;

  let icono = 'ℹ️';
  if (tipo === 'success') icono = '✅';
  if (tipo === 'error') icono = '❌';

  toast.innerHTML = `
    <span class="toast-icon">${icono}</span>
    <span class="toast-message">${escapeHtml(mensaje)}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fadeout');
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, 300);
  }, 3200);
}
