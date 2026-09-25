const { app, BrowserWindow, ipcMain, shell, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const searchEngine = require('./searchEngine');

let mainWindow = null;

const DEFAULT_CONFIG = {
  servidorActivo: 'irec',
  rutaIrec: '\\\\172.40.5.84\\irec',
  rutaSsdirec: '\\\\172.40.5.84\\ssdirec',
  rutaBase: '\\\\172.40.5.84\\irec',
  limiteResultados: 200,
  profundidadMaxima: 6,
  tiempoLimiteMs: 45000,
  buscarEnRuta: true,
  extensiones: ['pdf']
};

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config_buscador.json');
}

function cargarConfig() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
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
    title: 'Buscador de Expedientes y Archivos - IREC',
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
ipcMain.handle('buscar-archivos', async (event, options) => {
  try {
    return await searchEngine.buscarArchivos(options);
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
    return await searchEngine.listarArchivosIniciales(options);
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
  return await searchEngine.obtenerCarpetas(options);
});

ipcMain.handle('verificar-servidores', async (event, rutas) => {
  return await searchEngine.verificarServidores(rutas);
});

ipcMain.handle('obtener-delegaciones', async (event, rutaBase) => {
  return await searchEngine.obtenerDelegaciones(rutaBase);
});

ipcMain.handle('obtener-subcarpetas', async (event, args) => {
  const { rutaBase, delegacion, subruta, rutaCompleta } = args || {};
  return await searchEngine.obtenerSubcarpetas(rutaBase, delegacion, subruta, rutaCompleta);
});

ipcMain.handle('verificar-ruta', async (event, ruta) => {
  return await searchEngine.verificarRuta(ruta);
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