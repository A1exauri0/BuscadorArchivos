const { app, BrowserWindow, ipcMain, shell, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const searchEngine = require('./searchEngine');

let mainWindow = null;

const DEFAULT_CONFIG = {
  ubicacionActiva: 'entregables',
  limiteResultados: 200,
  profundidadMaxima: 8,
  tiempoLimiteMs: 45000,
  buscarEnRuta: true,
  extensiones: ['pdf']
};

function getRutasPath() {
  return path.join(__dirname, 'rutas.json');
}

function cargarRutas() {
  try {
    const rutasPath = getRutasPath();
    if (fs.existsSync(rutasPath)) {
      const data = fs.readFileSync(rutasPath, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error cargando rutas.json:', err);
  }
  return [
    {
      id: 'entregables',
      nombre: 'Entregables',
      titulo: 'Entregables Finanzas',
      descripcion: 'Subcarpeta con las entregas de finanzas (ENTREGA 1, ENTREGA 2, etc.)',
      ruta: '\\\\172.40.5.84\\ssdirec\\ENTREGABLES PROCESADOS FINANZAS',
      icono: 'box'
    },
    {
      id: 'czur',
      nombre: 'CZUR',
      titulo: 'Respaldo RPP CZUR',
      descripcion: 'Respaldo RPP 17-09-2026 CZUR (PC 01 a PC 06)',
      ruta: '\\\\172.40.5.84\\ssdirec\\RESPALDO 17-09-2026\\RESPALDO RPP 17-09-2026\\CZUR',
      icono: 'camera'
    },
    {
      id: 'irec',
      nombre: 'irec',
      titulo: 'Servidor Principal (irec)',
      descripcion: 'Carpeta compartida principal con Respaldo_Original, Libros y Notarías',
      ruta: '\\\\172.40.5.84\\irec',
      icono: 'folder'
    },
    {
      id: 'ssdirec',
      nombre: 'ssdirec',
      titulo: 'Servidor Rápido (ssdirec)',
      descripcion: 'Unidad de almacenamiento rápida ssdirec',
      ruta: '\\\\172.40.5.84\\ssdirec',
      icono: 'server'
    }
  ];
}

function guardarRutas(nuevasRutas) {
  try {
    const rutasPath = getRutasPath();
    fs.writeFileSync(rutasPath, JSON.stringify(nuevasRutas, null, 2), 'utf8');
    return { success: true, rutas: nuevasRutas };
  } catch (err) {
    console.error('Error guardando rutas.json:', err);
    return { success: false, error: err.message };
  }
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config_buscador.json');
}

function cargarConfig() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(data);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (err) {
    console.error('Error cargando configuración:', err);
  }
  return { ...DEFAULT_CONFIG };
}

function guardarConfig(nuevaConfig) {
  try {
    const configPath = getConfigPath();
    const finalConfig = { ...cargarConfig(), ...nuevaConfig };
    fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2), 'utf8');
    return { success: true, config: finalConfig };
  } catch (err) {
    console.error('Error guardando configuración:', err);
    return { success: false, error: err.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 850,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#f8fafc',
    title: 'Buscador de Expedientes - ENTREGABLES PROCESADOS FINANZAS',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.removeMenu();

  // Habilitar atajos F12 y Ctrl+Shift+I para abrir la consola de desarrollador
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('obtener-rutas', () => {
  return cargarRutas();
});

ipcMain.handle('guardar-rutas', (event, nuevasRutas) => {
  const res = guardarRutas(nuevasRutas);
  searchEngine.limpiarMemoria();
  return res;
});

ipcMain.handle('buscar-archivos', async (event, options) => {
  try {
    const cfg = cargarConfig();
    const rutas = cargarRutas();
    return await searchEngine.buscarArchivos({
      rutas,
      ubicacion: options?.ubicacion || cfg.ubicacionActiva || 'entregables',
      ...options
    });
  } catch (err) {
    return {
      total: 0,
      limiteAlcanzado: false,
      tiempoAlcanzado: false,
      palabras: [],
      error: err.message,
      archivos: []
    };
  }
});

ipcMain.handle('listar-archivos-iniciales', async (event, options) => {
  try {
    const cfg = cargarConfig();
    const rutas = cargarRutas();
    return await searchEngine.listarArchivosIniciales({
      rutas,
      ubicacion: options?.ubicacion || cfg.ubicacionActiva || 'entregables',
      ...options
    });
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      archivos: [],
      total: 0
    };
  }
});

ipcMain.handle('obtener-carpetas', async (event, options) => {
  const cfg = cargarConfig();
  const rutas = cargarRutas();
  return await searchEngine.obtenerCarpetas({
    rutas,
    ubicacion: options?.ubicacion || cfg.ubicacionActiva || 'entregables',
    ...options
  });
});

ipcMain.handle('verificar-servidores', async (event, rutasPersonalizadas) => {
  const rutas = Array.isArray(rutasPersonalizadas) && rutasPersonalizadas.length > 0
    ? rutasPersonalizadas
    : cargarRutas();
  return await searchEngine.verificarServidores(rutas);
});

ipcMain.handle('obtener-delegaciones', async (event, rutaBase) => {
  const rutas = cargarRutas();
  const defaultRuta = (rutas.find(r => r.id === 'entregables') || rutas[0] || {}).ruta || '';
  return await searchEngine.obtenerDelegaciones(rutaBase || defaultRuta);
});

ipcMain.handle('obtener-subcarpetas', async (event, args) => {
  const rutas = cargarRutas();
  const defaultRuta = (rutas.find(r => r.id === 'entregables') || rutas[0] || {}).ruta || '';
  const rutaBase = (args && args.rutaBase) || defaultRuta;
  return await searchEngine.obtenerSubcarpetas(args ? { ...args, rutaBase } : { rutaBase });
});

ipcMain.handle('verificar-ruta', async (event, ruta) => {
  const rutas = cargarRutas();
  const defaultRuta = (rutas.find(r => r.id === 'entregables') || rutas[0] || {}).ruta || '';
  return await searchEngine.verificarRuta(ruta || defaultRuta);
});

ipcMain.handle('abrir-archivo', async (event, rutaCompleta) => {
  try {
    const error = await shell.openPath(rutaCompleta);
    if (error) {
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('abrir-en-carpeta', async (event, rutaCompleta) => {
  try {
    shell.showItemInFolder(rutaCompleta);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('copiar-portapapeles', (event, texto) => {
  try {
    clipboard.writeText(texto);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('obtener-config', () => {
  return cargarConfig();
});

ipcMain.handle('guardar-config', (event, config) => {
  return guardarConfig(config);
});

ipcMain.handle('limpiar-memoria', () => {
  return searchEngine.limpiarMemoria();
});

ipcMain.handle('seleccionar-carpeta', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Seleccionar Carpeta Base de Archivos'
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('minimizar-ventana', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('maximizar-ventana', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('toggle-devtools', () => {
  if (mainWindow) mainWindow.webContents.toggleDevTools();
  return true;
});

ipcMain.handle('cerrar-ventana', () => {
  if (mainWindow) mainWindow.close();
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});