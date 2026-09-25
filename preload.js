const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  buscarArchivos: (options) => ipcRenderer.invoke('buscar-archivos', options),
  listarArchivosIniciales: (options) => ipcRenderer.invoke('listar-archivos-iniciales', options),
  obtenerCarpetas: (options) => ipcRenderer.invoke('obtener-carpetas', options),
  verificarServidores: (rutas) => ipcRenderer.invoke('verificar-servidores', rutas),
  obtenerDelegaciones: (rutaBase) => ipcRenderer.invoke('obtener-delegaciones', rutaBase),
  obtenerSubcarpetas: (params, delegacion, subruta) => {
    if (typeof params === 'string') {
      return ipcRenderer.invoke('obtener-subcarpetas', { rutaBase: params, delegacion, subruta });
    }
    return ipcRenderer.invoke('obtener-subcarpetas', params);
  },
  verificarRuta: (ruta) => ipcRenderer.invoke('verificar-ruta', ruta),
  abrirArchivo: (rutaCompleta) => ipcRenderer.invoke('abrir-archivo', rutaCompleta),
  abrirEnCarpeta: (rutaCompleta) => ipcRenderer.invoke('abrir-en-carpeta', rutaCompleta),
  copiarPortapapeles: (texto) => ipcRenderer.invoke('copiar-portapapeles', texto),
  obtenerConfig: () => ipcRenderer.invoke('obtener-config'),
  guardarConfig: (config) => ipcRenderer.invoke('guardar-config', config),
  seleccionarCarpeta: () => ipcRenderer.invoke('seleccionar-carpeta'),
  minimizarVentana: () => ipcRenderer.invoke('minimizar-ventana'),
  maximizarVentana: () => ipcRenderer.invoke('maximizar-ventana'),
  cerrarVentana: () => ipcRenderer.invoke('cerrar-ventana'),
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  limpiarMemoria: () => ipcRenderer.invoke('limpiar-memoria')
});
