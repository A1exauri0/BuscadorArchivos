const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  buscarArchivos: (options) => ipcRenderer.invoke('buscar-archivos', options),
  obtenerDelegaciones: (rutaBase) => ipcRenderer.invoke('obtener-delegaciones', rutaBase),
  obtenerSubcarpetas: (rutaBase, delegacion) => ipcRenderer.invoke('obtener-subcarpetas', { rutaBase, delegacion }),
  verificarRuta: (ruta) => ipcRenderer.invoke('verificar-ruta', ruta),
  abrirArchivo: (rutaCompleta) => ipcRenderer.invoke('abrir-archivo', rutaCompleta),
  abrirEnCarpeta: (rutaCompleta) => ipcRenderer.invoke('abrir-en-carpeta', rutaCompleta),
  copiarPortapapeles: (texto) => ipcRenderer.invoke('copiar-portapapeles', texto),
  obtenerConfig: () => ipcRenderer.invoke('obtener-config'),
  guardarConfig: (config) => ipcRenderer.invoke('guardar-config', config),
  seleccionarCarpeta: () => ipcRenderer.invoke('seleccionar-carpeta'),
  minimizarVentana: () => ipcRenderer.invoke('minimizar-ventana'),
  maximizarVentana: () => ipcRenderer.invoke('maximizar-ventana'),
  cerrarVentana: () => ipcRenderer.invoke('cerrar-ventana')
});
