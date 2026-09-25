const fs = require('fs');
const path = require('path');

const RUTAS_DEFAULT = {
  rutaIrec: '\\\\172.40.5.84\\irec',
  rutaSsdirec: '\\\\172.40.5.84\\ssdirec',
  rutaEntregables: '\\\\172.40.5.84\\ssdirec\\ENTREGABLES PROCESADOS FINANZAS'
};

// Memoria caché para resultados frecuentes y navegación instantánea
const catalogoMemoria = new Map();

function normalizarCadena(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatearTamano(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatearFecha(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const pad = n => (n < 10 ? '0' + n : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function esDirectorioValido(dir) {
  if (!dir) return false;
  try {
    const stat = await fs.promises.stat(dir);
    return stat.isDirectory();
  } catch (err) {
    return false;
  }
}

function determinarAlmacenamiento(rutaCompleta) {
  const lc = (rutaCompleta || '').toLowerCase();
  if (lc.includes('entregables procesados finanzas') || lc.includes('entregables')) return 'entregables';
  if (lc.includes('ssdirec')) return 'ssdirec';
  if (lc.includes('irec')) return 'irec';
  return 'general';
}

function extraerCarpetaODelegacion(rutaCompleta, rutaBase) {
  const lc = (rutaCompleta || '').toLowerCase();
  const matchRespaldo = rutaCompleta.match(/Respaldo_Original[\\/]([^\\/]+)/i);
  if (matchRespaldo) return matchRespaldo[1];

  const matchEntregable = rutaCompleta.match(/ENTREGABLES?[^\\/]*FINANZAS[\\/]([^\\/]+(?:[\\/][^\\/]+)?)/i);
  if (matchEntregable) return matchEntregable[1].replace(/[\\/]/g, ' \\ ');

  if (rutaBase && rutaBase !== 'todas') {
    try {
      const rel = path.relative(rutaBase, rutaCompleta);
      const dir = path.dirname(rel);
      if (dir && dir !== '.') return dir.split(/[\\/]/).join(' \\ ');
    } catch (e) {}
  }

  try {
    const dir = path.dirname(rutaCompleta);
    return path.basename(dir);
  } catch (e) {}

  return 'Raíz';
}

async function verificarRuta(ruta) {
  const rutaChequeo = ruta || RUTAS_DEFAULT.rutaEntregables;
  try {
    await fs.promises.access(rutaChequeo, fs.constants.R_OK);
    return {
      existe: true,
      conectado: true,
      mensaje: `Conectado a ${path.basename(rutaChequeo)}`,
      ruta: rutaChequeo
    };
  } catch (err) {
    return {
      existe: false,
      conectado: false,
      mensaje: `No se puede acceder a la ruta: ${err.message}`,
      ruta: rutaChequeo
    };
  }
}

async function verificarServidores(rutas = {}) {
  const rutaIrec = rutas.rutaIrec || RUTAS_DEFAULT.rutaIrec;
  const rutaSsdirec = rutas.rutaSsdirec || RUTAS_DEFAULT.rutaSsdirec;
  const rutaEntregables = rutas.rutaEntregables || RUTAS_DEFAULT.rutaEntregables;

  const [okIrec, okSsd, okEntregables] = await Promise.all([
    esDirectorioValido(rutaIrec),
    esDirectorioValido(rutaSsdirec),
    esDirectorioValido(rutaEntregables)
  ]);

  const conectados = [];
  if (okIrec) conectados.push('irec');
  if (okSsd) conectados.push('ssdirec');
  if (okEntregables) conectados.push('entregables');

  const conectado = conectados.length > 0;
  const todoConectado = okIrec && okSsd && okEntregables;

  let mensaje = '';
  if (todoConectado) {
    mensaje = 'Todas las ubicaciones conectadas (irec, ssdirec, entregables)';
  } else if (conectado) {
    mensaje = `Conectado a: ${conectados.join(', ')}`;
  } else {
    mensaje = 'Sin conexión a los servidores de red';
  }

  return {
    conectado,
    todoConectado,
    irec: okIrec,
    ssdirec: okSsd,
    entregables: okEntregables,
    rutas: { rutaIrec, rutaSsdirec, rutaEntregables },
    mensaje
  };
}

/**
 * Obtener carpetas principales para el árbol del explorador
 */
async function obtenerCarpetas(options = {}) {
  const ubicacion = options.ubicacion || options.almacenamiento || 'entregables';
  const rutaIrec = options.rutaIrec || RUTAS_DEFAULT.rutaIrec;
  const rutaSsdirec = options.rutaSsdirec || RUTAS_DEFAULT.rutaSsdirec;
  const rutaEntregables = options.rutaEntregables || RUTAS_DEFAULT.rutaEntregables;

  if (ubicacion === 'todas') {
    const carpetasRaices = [
      {
        nombre: 'irec',
        subruta: '',
        rutaCompleta: rutaIrec,
        ubicacion: 'irec',
        tipo: 'directorio',
        esRaizUbicacion: true
      },
      {
        nombre: 'ssdirec',
        subruta: '',
        rutaCompleta: rutaSsdirec,
        ubicacion: 'ssdirec',
        tipo: 'directorio',
        esRaizUbicacion: true
      },
      {
        nombre: 'ENTREGABLES PROCESADOS FINANZAS',
        subruta: '',
        rutaCompleta: rutaEntregables,
        ubicacion: 'entregables',
        tipo: 'directorio',
        esRaizUbicacion: true
      }
    ];
    return {
      conectado: true,
      carpetas: carpetasRaices,
      rutaBase: 'todas',
      ubicacion: 'todas'
    };
  }

  let rutaBase = options.rutaBase;
  if (!rutaBase) {
    if (ubicacion === 'irec') rutaBase = rutaIrec;
    else if (ubicacion === 'ssdirec') rutaBase = rutaSsdirec;
    else rutaBase = rutaEntregables;
  }

  const cacheKey = `carpetas_raiz:::${ubicacion}:::${rutaBase}`;
  if (!options.forzarRed && catalogoMemoria.has(cacheKey)) {
    return catalogoMemoria.get(cacheKey);
  }

  const conectado = await esDirectorioValido(rutaBase);
  if (!conectado) {
    return {
      conectado: false,
      carpetas: [],
      rutaBase,
      ubicacion,
      error: `No se puede acceder a la ruta: ${rutaBase}`
    };
  }

  try {
    const entries = await fs.promises.readdir(rutaBase, { withFileTypes: true });
    let dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'lost+found')
      .map(e => ({
        nombre: e.name,
        tipo: 'directorio',
        subruta: e.name,
        rutaCompleta: path.join(rutaBase, e.name),
        ubicacion
      }));

    if (ubicacion === 'irec') {
      const priorizar = name => {
        if (/^respaldo_original$/i.test(name)) return 0;
        if (/^libros$/i.test(name)) return 1;
        if (/^notarias$/i.test(name)) return 2;
        return 10;
      };
      dirs.sort((a, b) => priorizar(a.nombre) - priorizar(b.nombre) || a.nombre.localeCompare(b.nombre));
    } else {
      dirs.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));
    }

    const res = {
      conectado: true,
      carpetas: dirs,
      rutaBase,
      ubicacion
    };
    catalogoMemoria.set(cacheKey, res);
    return res;
  } catch (err) {
    return {
      conectado: false,
      carpetas: [],
      rutaBase,
      ubicacion,
      error: err.message
    };
  }
}

async function obtenerDelegaciones(rutaBase = RUTAS_DEFAULT.rutaEntregables) {
  const res = await obtenerCarpetas({ rutaBase });
  return {
    conectado: res.conectado,
    delegaciones: res.carpetas || [],
    todas: (res.carpetas || []).map(c => c.nombre)
  };
}

/**
 * Obtener subcarpetas para expandir nodos en el árbol del explorador
 */
async function obtenerSubcarpetas(params, delegacion, subrutaArg) {
  let rutaBase = RUTAS_DEFAULT.rutaEntregables;
  let subruta = '';
  let rutaCompleta = '';

  if (typeof params === 'object' && params !== null) {
    rutaBase = params.rutaBase || RUTAS_DEFAULT.rutaEntregables;
    subruta = params.subruta || '';
    rutaCompleta = params.rutaCompleta || '';
  } else if (typeof params === 'string') {
    rutaBase = params;
    subruta = subrutaArg || delegacion || '';
  }

  const cacheKey = `subcarpetas:::${rutaBase}:::${subruta}:::${rutaCompleta}`;
  if (catalogoMemoria.has(cacheKey)) {
    return catalogoMemoria.get(cacheKey);
  }

  let dir = '';
  if (rutaCompleta && (await esDirectorioValido(rutaCompleta))) {
    dir = rutaCompleta;
  } else if (subruta) {
    dir = path.join(rutaBase, subruta);
  } else {
    dir = rutaBase;
  }

  try {
    if (!(await esDirectorioValido(dir))) return [];

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const subs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'lost+found')
      .map(e => {
        const full = path.join(dir, e.name);
        return {
          nombre: e.name,
          rutaCompleta: full,
          subruta: rutaBase && rutaBase !== 'todas' ? path.relative(rutaBase, full) : e.name
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));

    catalogoMemoria.set(cacheKey, subs);
    return subs;
  } catch (err) {
    return [];
  }
}

function coincideConPalabras(nombreArchivo, rutaCompleta, palabras, buscarEnRuta) {
  if (!palabras || palabras.length === 0) return true;
  const target = (buscarEnRuta ? rutaCompleta : nombreArchivo).toLowerCase();
  for (const p of palabras) {
    if (!target.includes(p)) return false;
  }
  return true;
}

/**
 * Listar archivos iniciales (para vista inicial o al seleccionar una carpeta)
 */
async function listarArchivosIniciales(options = {}) {
  const ubicacion = options.ubicacion || options.almacenamiento || 'entregables';
  const rutaIrec = options.rutaIrec || RUTAS_DEFAULT.rutaIrec;
  const rutaSsdirec = options.rutaSsdirec || RUTAS_DEFAULT.rutaSsdirec;
  const rutaEntregables = options.rutaEntregables || RUTAS_DEFAULT.rutaEntregables;

  let rutaBase = options.rutaBase;
  if (!rutaBase) {
    if (ubicacion === 'irec') rutaBase = rutaIrec;
    else if (ubicacion === 'ssdirec') rutaBase = rutaSsdirec;
    else rutaBase = rutaEntregables;
  }

  const carpeta = options.carpeta || options.delegacion || '';
  const limite = parseInt(options.limite, 10) || 100;
  const cacheKey = `listadoInicial:::${ubicacion}:::${rutaBase}:::${carpeta}:::${options.rutaCompleta || ''}:::${limite}`;

  if (!options.forzarRed && catalogoMemoria.has(cacheKey)) {
    return { ...catalogoMemoria.get(cacheKey), desdeCache: true };
  }

  const inicio = Date.now();
  const encontrados = [];

  let dirObjetivo = rutaBase;
  if (options.rutaCompleta && (await esDirectorioValido(options.rutaCompleta))) {
    dirObjetivo = options.rutaCompleta;
  } else if (carpeta) {
    const testPath = path.join(rutaBase, carpeta);
    if (await esDirectorioValido(testPath)) {
      dirObjetivo = testPath;
    }
  }

  async function escanearRapido(dir, maxArchivos, nivel = 0) {
    if (nivel > 10 || !(await esDirectorioValido(dir)) || encontrados.length >= maxArchivos) return;

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      const subdirs = [];

      for (const e of entries) {
        if (encontrados.length >= maxArchivos) break;
        if (e.name.startsWith('.')) continue;

        if (e.isFile() && /\.pdf$/i.test(e.name)) {
          const full = path.join(dir, e.name);
          encontrados.push({
            nombre: e.name,
            rutaCompleta: full,
            rutaRelativa: rutaBase && rutaBase !== 'todas' ? path.relative(rutaBase, full) : e.name,
            almacenamiento: determinarAlmacenamiento(full),
            delegacion: extraerCarpetaODelegacion(full, rutaBase)
          });
        } else if (e.isDirectory() && e.name !== 'lost+found') {
          subdirs.push(path.join(dir, e.name));
        }
      }

      subdirs.sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true, sensitivity: 'base' }));

      for (const sub of subdirs) {
        if (encontrados.length >= maxArchivos) break;
        await escanearRapido(sub, maxArchivos, nivel + 1);
      }
    } catch (e) {}
  }

  if (ubicacion === 'todas' && !options.rutaCompleta && !carpeta) {
    await escanearRapido(rutaEntregables, Math.floor(limite / 2));
    if (encontrados.length < limite) {
      await escanearRapido(rutaIrec, limite);
    }
  } else {
    await escanearRapido(dirObjetivo, limite);
  }

  const muestra = encontrados.slice(0, limite);
  const archivosConMetadatos = await Promise.all(
    muestra.map(async (item) => {
      let stat = { size: 0, mtime: null };
      try {
        stat = await fs.promises.stat(item.rutaCompleta);
      } catch (e) {}

      return {
        ...item,
        tamanoBytes: stat.size,
        tamanoFormateado: formatearTamano(stat.size),
        fechaModificacion: formatearFecha(stat.mtime),
        mtimeMs: stat.mtime ? stat.mtime.getTime() : 0
      };
    })
  );

  const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

  const resListado = {
    ok: true,
    archivos: archivosConMetadatos,
    total: archivosConMetadatos.length,
    carpeta: carpeta || (ubicacion === 'todas' ? 'Todas las ubicaciones' : `Todo ${ubicacion}`),
    duracionSegundos: parseFloat(duracion),
    mensaje: `Se listaron ${archivosConMetadatos.length} archivos`
  };

  catalogoMemoria.set(cacheKey, resListado);
  return resListado;
}

/**
 * Búsqueda de archivos recursiva y multi-palabra con soporte para las 4 ubicaciones
 */
async function buscarArchivos(options = {}) {
  const ubicacion = options.ubicacion || options.almacenamiento || 'entregables';
  const rutaIrec = options.rutaIrec || RUTAS_DEFAULT.rutaIrec;
  const rutaSsdirec = options.rutaSsdirec || RUTAS_DEFAULT.rutaSsdirec;
  const rutaEntregables = options.rutaEntregables || RUTAS_DEFAULT.rutaEntregables;

  let rutaBase = options.rutaBase;
  if (!rutaBase) {
    if (ubicacion === 'irec') rutaBase = rutaIrec;
    else if (ubicacion === 'ssdirec') rutaBase = rutaSsdirec;
    else rutaBase = rutaEntregables;
  }

  const queryRaw = options.query || options.palabras || '';
  const carpetaRaw = options.carpeta || options.delegacion || '';
  const buscarEnRuta = options.buscarEnRuta !== undefined ? options.buscarEnRuta : true;
  const limite = parseInt(options.limite || options.limiteResultados, 10) || 200;
  const maxSegundos = options.tiempoLimiteMs ? (options.tiempoLimiteMs / 1000) : 45.0;

  const inicio = Date.now();

  let palabras = [];
  if (Array.isArray(queryRaw)) {
    palabras = queryRaw.map(p => p.toString().trim().toLowerCase()).filter(Boolean);
  } else if (typeof queryRaw === 'string' && queryRaw.trim()) {
    palabras = queryRaw.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
  }

  let carpetaFiltro = carpetaRaw && carpetaRaw !== 'todas' ? carpetaRaw.trim() : '';

  // Si no hay palabras ni carpeta y no hay rutaCompleta, listar iniciales
  if (palabras.length === 0 && !carpetaFiltro && !options.rutaCompleta) {
    return await listarArchivosIniciales({
      ubicacion,
      rutaIrec,
      rutaSsdirec,
      rutaEntregables,
      rutaBase,
      limite
    });
  }

  // Lista de directorios a escanear
  const raicesEscaneo = [];

  if (options.rutaCompleta && (await esDirectorioValido(options.rutaCompleta))) {
    raicesEscaneo.push(options.rutaCompleta);
  } else if (ubicacion === 'todas') {
    if (carpetaFiltro) {
      const candEnt = path.join(rutaEntregables, carpetaFiltro);
      const candIrec = path.join(rutaIrec, carpetaFiltro);
      const candSsd = path.join(rutaSsdirec, carpetaFiltro);
      if (await esDirectorioValido(candEnt)) raicesEscaneo.push(candEnt);
      if (await esDirectorioValido(candIrec)) raicesEscaneo.push(candIrec);
      if (await esDirectorioValido(candSsd)) raicesEscaneo.push(candSsd);
      if (raicesEscaneo.length === 0) {
        if (await esDirectorioValido(rutaEntregables)) raicesEscaneo.push(rutaEntregables);
        if (await esDirectorioValido(rutaIrec)) raicesEscaneo.push(rutaIrec);
      }
    } else {
      if (await esDirectorioValido(rutaEntregables)) raicesEscaneo.push(rutaEntregables);
      if (await esDirectorioValido(rutaIrec)) raicesEscaneo.push(rutaIrec);
      if (await esDirectorioValido(rutaSsdirec)) raicesEscaneo.push(rutaSsdirec);
    }
  } else {
    let raizTarget = rutaBase;
    if (carpetaFiltro) {
      const candidate = path.join(raizTarget, carpetaFiltro);
      if (await esDirectorioValido(candidate)) {
        raizTarget = candidate;
      } else if (ubicacion === 'irec') {
        const candRespaldo = path.join(rutaIrec, 'Respaldo_Original', carpetaFiltro);
        if (await esDirectorioValido(candRespaldo)) raizTarget = candRespaldo;
      }
    }
    if (await esDirectorioValido(raizTarget)) {
      raicesEscaneo.push(raizTarget);
    }
  }

  const claveCache = `busqueda:::${ubicacion}:::${raicesEscaneo.join(';')}:::${palabras.sort().join('|')}:::${limite}:::${buscarEnRuta}`;
  if (!options.forzarRed && catalogoMemoria.has(claveCache) && catalogoMemoria.get(claveCache).length > 0) {
    const memoria = catalogoMemoria.get(claveCache);
    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);
    return {
      ok: true,
      total: memoria.length,
      duracionSegundos: parseFloat(duracion),
      origen: 'memoria_instantanea',
      ubicacionConsultada: carpetaFiltro || ubicacion,
      limiteAlcanzado: memoria.length >= limite,
      tiempoAlcanzado: false,
      palabras,
      carpetaDetectada: carpetaFiltro,
      archivos: memoria
    };
  }

  const encontrados = [];
  const rutasVistas = new Set();
  const state = { limiteAlcanzado: false, tiempoAlcanzado: false };

  async function escanearRecursivo(directorio, nivel = 0) {
    if (nivel > 12 || state.limiteAlcanzado || state.tiempoAlcanzado) return;

    if (encontrados.length >= limite) {
      state.limiteAlcanzado = true;
      return;
    }

    if ((Date.now() - inicio) / 1000 >= maxSegundos) {
      state.tiempoAlcanzado = true;
      return;
    }

    let entries;
    try {
      entries = await fs.promises.readdir(directorio, { withFileTypes: true });
    } catch (err) {
      return;
    }

    const subdirectorios = [];

    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..' || entry.name.startsWith('.')) continue;

      if (entry.isFile()) {
        if (/\.pdf$/i.test(entry.name)) {
          const rutaCompleta = path.join(directorio, entry.name);
          const lcRuta = rutaCompleta.toLowerCase();
          if (rutasVistas.has(lcRuta)) continue;
          rutasVistas.add(lcRuta);

          if (coincideConPalabras(entry.name, rutaCompleta, palabras, buscarEnRuta)) {
            let stat = { size: 0, mtime: null };
            try {
              stat = await fs.promises.stat(rutaCompleta);
            } catch (e) {}

            encontrados.push({
              nombre: entry.name,
              rutaCompleta: rutaCompleta,
              rutaRelativa: rutaBase && rutaBase !== 'todas' ? path.relative(rutaBase, rutaCompleta) : entry.name,
              almacenamiento: determinarAlmacenamiento(rutaCompleta),
              delegacion: extraerCarpetaODelegacion(rutaCompleta, rutaBase),
              tamanoBytes: stat.size,
              tamanoFormateado: formatearTamano(stat.size),
              fechaModificacion: formatearFecha(stat.mtime),
              mtimeMs: stat.mtime ? stat.mtime.getTime() : 0
            });

            if (encontrados.length >= limite) {
              state.limiteAlcanzado = true;
              return;
            }
          }
        }
      } else if (entry.isDirectory()) {
        if (entry.name !== 'lost+found' && entry.name !== '.Trash-1000') {
          subdirectorios.push(path.join(directorio, entry.name));
        }
      }
    }

    if (state.limiteAlcanzado || state.tiempoAlcanzado) return;

    if (subdirectorios.length > 1 && palabras.length > 0) {
      subdirectorios.sort((a, b) => {
        const aName = path.basename(a).toLowerCase();
        const bName = path.basename(b).toLowerCase();
        const aMatches = palabras.some(p => aName.includes(p));
        const bMatches = palabras.some(p => bName.includes(p));
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    for (const subdir of subdirectorios) {
      await escanearRecursivo(subdir, nivel + 1);
      if (state.limiteAlcanzado || state.tiempoAlcanzado) break;
    }
  }

  for (const dir of raicesEscaneo) {
    if (state.limiteAlcanzado || state.tiempoAlcanzado) break;
    await escanearRecursivo(dir);
  }

  const duracionSegundos = ((Date.now() - inicio) / 1000).toFixed(2);

  if (encontrados.length > 0) {
    catalogoMemoria.set(claveCache, encontrados);
  }

  return {
    ok: true,
    total: encontrados.length,
    duracionSegundos: parseFloat(duracionSegundos),
    origen: 'escaneo_red',
    ubicacionConsultada: carpetaFiltro || ubicacion,
    limiteAlcanzado: state.limiteAlcanzado,
    tiempoAlcanzado: state.tiempoAlcanzado,
    palabras,
    carpetaDetectada: carpetaFiltro,
    archivos: encontrados
  };
}

function limpiarMemoria() {
  catalogoMemoria.clear();
  return { success: true };
}

module.exports = {
  RUTAS_DEFAULT,
  verificarRuta,
  verificarServidores,
  obtenerCarpetas,
  obtenerDelegaciones,
  obtenerSubcarpetas,
  listarArchivosIniciales,
  buscarArchivos,
  determinarAlmacenamiento,
  extraerCarpetaODelegacion,
  formatearTamano,
  formatearFecha,
  limpiarMemoria
};
