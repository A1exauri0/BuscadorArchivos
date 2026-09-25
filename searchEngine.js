const fs = require('fs');
const path = require('path');

const RUTAS_DEFAULT = {
  irec: '\\\\172.40.5.84\\irec',
  ssdirec: '\\\\172.40.5.84\\ssdirec'
};

const DELEGACIONES_OFICIALES = [
  'Acala',
  'Arriaga',
  'Bochil',
  'Catazajá',
  'Chiapa de Corzo',
  'Cintalapa',
  'Comitán',
  'Huixtla',
  'Motozintla',
  'Ocosingo',
  'Palenque',
  'Pichucalco',
  'Pijijiapan',
  'San Cristóbal',
  'Tapachula',
  'Tonala',
  'Tuxtla Gutierrez',
  'Villaflores',
  'Yajalón'
];

// Memoria caché para resultados frecuentes
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

async function verificarRuta(ruta) {
  try {
    await fs.promises.access(ruta, fs.constants.R_OK);
    return {
      existe: true,
      mensaje: 'Conectado al servidor',
      ruta
    };
  } catch (err) {
    return {
      existe: false,
      mensaje: `No se puede acceder a la ruta: ${err.message}`,
      ruta
    };
  }
}

async function verificarServidores(rutas = {}) {
  const rIrec = rutas.rutaIrec || RUTAS_DEFAULT.irec;
  const rSsdirec = rutas.rutaSsdirec || RUTAS_DEFAULT.ssdirec;

  const [resIrec, resSsdirec] = await Promise.all([
    esDirectorioValido(rIrec),
    esDirectorioValido(rSsdirec)
  ]);

  let msg = '';
  if (resIrec && resSsdirec) {
    msg = 'Servidores IREC & SSDIREC Conectados';
  } else if (resIrec) {
    msg = 'Servidor IREC Conectado (SSDIREC no disponible)';
  } else if (resSsdirec) {
    msg = 'Servidor SSDIREC Conectado (IREC no disponible)';
  } else {
    msg = 'Sin conexión a los servidores de red';
  }

  return {
    irec: resIrec,
    ssdirec: resSsdirec,
    rutas: { irec: rIrec, ssdirec: rSsdirec },
    mensaje: msg
  };
}

async function obtenerCarpetas(options = {}) {
  const almacenamiento = options.almacenamiento || 'irec';
  const rutaIrec = options.rutaIrec || RUTAS_DEFAULT.irec;
  const rutaSsdirec = options.rutaSsdirec || RUTAS_DEFAULT.ssdirec;
  const cacheKey = `carpetas:::${almacenamiento}:::${rutaIrec}:::${rutaSsdirec}`;

  if (!options.forzarRed && catalogoMemoria.has(cacheKey)) {
    return catalogoMemoria.get(cacheKey);
  }

  if (almacenamiento === 'ssdirec') {
    const conectado = await esDirectorioValido(rutaSsdirec);
    if (!conectado) return { conectado: false, carpetas: [], almacenamiento };

    try {
      const entries = await fs.promises.readdir(rutaSsdirec, { withFileTypes: true });
      const dirs = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'lost+found')
        .map(e => ({
          nombre: e.name,
          tipo: 'directorio',
          subruta: e.name,
          rutaCompleta: path.join(rutaSsdirec, e.name),
          almacenamiento: 'ssdirec'
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));

      const resSsd = {
        conectado: true,
        carpetas: dirs,
        almacenamiento: 'ssdirec',
        rutaBase: rutaSsdirec
      };
      catalogoMemoria.set(cacheKey, resSsd);
      return resSsd;
    } catch (err) {
      return { conectado: false, carpetas: [], error: err.message, almacenamiento };
    }
  }

  // irec o ambos
  const conectado = await esDirectorioValido(rutaIrec);
  if (!conectado) return { conectado: false, carpetas: [], almacenamiento: 'irec' };

  try {
    const entries = await fs.promises.readdir(rutaIrec, { withFileTypes: true });
    const dirsTop = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'lost+found')
      .map(e => e.name);

    const rutaRespaldo = path.join(rutaIrec, 'Respaldo_Original');
    let delegaciones = [];

    if (await esDirectorioValido(rutaRespaldo)) {
      const delEntries = await fs.promises.readdir(rutaRespaldo, { withFileTypes: true });
      delegaciones = delEntries
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'lost+found')
        .map(e => ({
          nombre: e.name,
          tipo: 'delegacion',
          subruta: path.join('Respaldo_Original', e.name),
          rutaCompleta: path.join(rutaRespaldo, e.name),
          almacenamiento: 'irec'
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));
    }

    const otrasCarpetas = dirsTop
      .filter(d => d !== 'Respaldo_Original')
      .map(d => ({
        nombre: d,
        tipo: 'directorio',
        subruta: d,
        rutaCompleta: path.join(rutaIrec, d),
        almacenamiento: 'irec'
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));

    const resIrec = {
      conectado: true,
      delegaciones: delegaciones.length > 0 ? delegaciones : DELEGACIONES_OFICIALES.map(d => ({ nombre: d, tipo: 'delegacion', almacenamiento: 'irec' })),
      otrasCarpetas,
      carpetas: [...delegaciones, ...otrasCarpetas],
      almacenamiento: 'irec',
      rutaBase: rutaIrec
    };
    catalogoMemoria.set(cacheKey, resIrec);
    return resIrec;
  } catch (err) {
    return {
      conectado: false,
      delegaciones: DELEGACIONES_OFICIALES.map(d => ({ nombre: d, tipo: 'delegacion', almacenamiento: 'irec' })),
      carpetas: [],
      error: err.message,
      almacenamiento: 'irec'
    };
  }
}

async function obtenerDelegaciones(rutaBase = RUTAS_DEFAULT.irec) {
  const res = await obtenerCarpetas({ almacenamiento: 'irec', rutaIrec: rutaBase });
  return {
    conectado: res.conectado,
    delegaciones: res.delegaciones || [],
    otrasCarpetas: (res.otrasCarpetas || []).map(c => c.nombre),
    todas: (res.carpetas || []).map(c => c.nombre)
  };
}

async function obtenerSubcarpetas(rutaBase, delegacion, subruta, rutaCompleta) {
  const cacheKey = `subcarpetas:::${rutaBase}:::${delegacion || ''}:::${subruta || ''}:::${rutaCompleta || ''}`;
  if (catalogoMemoria.has(cacheKey)) {
    return catalogoMemoria.get(cacheKey);
  }

  let dir = '';
  if (rutaCompleta && (await esDirectorioValido(rutaCompleta))) {
    dir = rutaCompleta;
  } else if (subruta) {
    dir = path.join(rutaBase, subruta);
    if (!(await esDirectorioValido(dir))) {
      const dirRespaldo = path.join(rutaBase, 'Respaldo_Original', subruta);
      if (await esDirectorioValido(dirRespaldo)) {
        dir = dirRespaldo;
      }
    }
  } else if (delegacion && delegacion !== 'todas' && delegacion !== '') {
    dir = path.join(rutaBase, delegacion);
    if (!(await esDirectorioValido(dir))) {
      const dirRespaldo = path.join(rutaBase, 'Respaldo_Original', delegacion);
      if (await esDirectorioValido(dirRespaldo)) {
        dir = dirRespaldo;
      }
    }
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
          subruta: path.relative(rutaBase, full)
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));

    catalogoMemoria.set(cacheKey, subs);
    return subs;
  } catch (err) {
    return [];
  }
}

function extraerDelegacionDeRuta(rutaCompleta, fallback) {
  const match = rutaCompleta.match(/Respaldo_Original[\\/]([^\\/]+)/i);
  if (match) return match[1];
  const matchEntregable = rutaCompleta.match(/ENTREGABLES?[^\\/]*[\\/][^\\/]*[\\/]([^\\/]+)/i);
  if (matchEntregable) return matchEntregable[1];
  return fallback || '';
}

function coincideConPalabras(nombreArchivo, rutaCompleta, palabras, buscarEnRuta) {
  if (!palabras || palabras.length === 0) return true;
  const target = (buscarEnRuta ? rutaCompleta : nombreArchivo).toLowerCase();
  for (const p of palabras) {
    if (!target.includes(p)) return false;
  }
  return true;
}

async function indexarDirectorioEnMemoria(dirRaiz, claveCache, etiquetaAlmacenamiento) {
  if (!dirRaiz || !(await esDirectorioValido(dirRaiz))) return [];
  if (catalogoMemoria.has(claveCache) && catalogoMemoria.get(claveCache).length > 0) {
    return catalogoMemoria.get(claveCache);
  }

  const coleccion = [];

  async function escanear(directorio, profundidad = 0) {
    if (profundidad > 6) return;
    let entries;
    try {
      entries = await fs.promises.readdir(directorio, { withFileTypes: true });
    } catch (e) {
      return;
    }

    const subdirs = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      if (entry.isFile()) {
        if (/\.pdf$/i.test(entry.name)) {
          const rutaCompleta = path.join(directorio, entry.name);
          coleccion.push({
            nombre: entry.name,
            rutaCompleta,
            rutaRelativa: path.relative(dirRaiz, rutaCompleta),
            almacenamiento: etiquetaAlmacenamiento,
            delegacion: extraerDelegacionDeRuta(rutaCompleta, path.basename(dirRaiz))
          });
        }
      } else if (entry.isDirectory()) {
        subdirs.push(path.join(directorio, entry.name));
      }
    }

    subdirs.sort((a, b) => {
      const aP = /(libros|sellos|lote|entregable|registro)/i.test(path.basename(a)) ? 0 : 1;
      const bP = /(libros|sellos|lote|entregable|registro)/i.test(path.basename(b)) ? 0 : 1;
      return aP - bP;
    });

    for (const sub of subdirs) {
      await escanear(sub, profundidad + 1);
    }
  }

  await escanear(dirRaiz);
  catalogoMemoria.set(claveCache, coleccion);
  return coleccion;
}

// Listar archivos iniciales
async function listarArchivosIniciales(options = {}) {
  const almacenamiento = options.almacenamiento || 'irec';
  const rutaIrec = options.rutaIrec || RUTAS_DEFAULT.irec;
  const rutaSsdirec = options.rutaSsdirec || RUTAS_DEFAULT.ssdirec;
  const carpeta = options.carpeta || options.delegacion || (almacenamiento === 'irec' ? 'Tuxtla Gutierrez' : '');
  const limite = parseInt(options.limite, 10) || 100;
  const cacheKey = `listadoInicial:::${almacenamiento}:::${carpeta}:::${options.rutaCompleta || ''}:::${limite}`;

  if (!options.forzarRed && catalogoMemoria.has(cacheKey)) {
    return { ...catalogoMemoria.get(cacheKey), desdeCache: true };
  }

  const inicio = Date.now();
  const encontrados = [];

  async function escanearRapido(dirBase, etiquetaAlm, maxArchivos) {
    if (!(await esDirectorioValido(dirBase))) return;
    try {
      const entries = await fs.promises.readdir(dirBase, { withFileTypes: true });
      const subdirs = [];

      for (const e of entries) {
        if (encontrados.length >= maxArchivos) break;
        if (e.isFile() && /\.pdf$/i.test(e.name)) {
          const full = path.join(dirBase, e.name);
          encontrados.push({
            nombre: e.name,
            rutaCompleta: full,
            rutaRelativa: full.replace(/^[\\/]+[^\\]+[\\/]+[^\\]+[\\/]?/, ''),
            almacenamiento: etiquetaAlm,
            delegacion: extraerDelegacionDeRuta(full, carpeta || path.basename(dirBase))
          });
        } else if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'lost+found') {
          subdirs.push(path.join(dirBase, e.name));
        }
      }

      // Priorizar subcarpetas con contenido frecuente
      subdirs.sort((a, b) => {
        const p = n => {
          if (/tuxtla/i.test(n)) return 0;
          if (/registro/i.test(n)) return 1;
          if (/finanza/i.test(n)) return 2;
          if (/08_2/i.test(n)) return 3;
          if (/tapachula/i.test(n)) return 4;
          if (/(libros|sellos|lote|entregable)/i.test(n)) return 5;
          return 10;
        };
        return p(path.basename(a)) - p(path.basename(b));
      });

      for (const sub of subdirs) {
        if (encontrados.length >= maxArchivos) break;
        await escanearRapido(sub, etiquetaAlm, maxArchivos);
      }
    } catch (e) {}
  }

  if (options.rutaCompleta && (await esDirectorioValido(options.rutaCompleta))) {
    await escanearRapido(options.rutaCompleta, almacenamiento === 'ssdirec' ? 'ssdirec' : 'irec', limite);
  } else {
    if (almacenamiento === 'irec' || almacenamiento === 'ambos') {
      let dirBuscar = path.join(rutaIrec, 'Respaldo_Original', carpeta || 'Tuxtla Gutierrez');
      if (!(await esDirectorioValido(dirBuscar))) {
        dirBuscar = path.join(rutaIrec, carpeta || '');
      }
      if (await esDirectorioValido(dirBuscar)) {
        await escanearRapido(dirBuscar, 'irec', limite);
        setImmediate(() => {
          indexarDirectorioEnMemoria(dirBuscar, `irec_${carpeta}`, 'irec').catch(() => {});
        });
      }
    }

    if (almacenamiento === 'ssdirec' || (almacenamiento === 'ambos' && encontrados.length < limite)) {
      let dirSsd = rutaSsdirec;
      if (carpeta) {
        const dirEsp = path.join(rutaSsdirec, carpeta);
        if (await esDirectorioValido(dirEsp)) {
          dirSsd = dirEsp;
        } else {
          const dirBase = path.join(rutaSsdirec, path.basename(carpeta));
          if (await esDirectorioValido(dirBase)) dirSsd = dirBase;
        }
      }
      await escanearRapido(dirSsd, 'ssdirec', limite);
      setImmediate(() => {
        indexarDirectorioEnMemoria(dirSsd, `ssdirec_${carpeta}`, 'ssdirec').catch(() => {});
      });
    }
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
    almacenamiento,
    carpeta: carpeta || 'Raíz',
    duracionSegundos: parseFloat(duracion),
    mensaje: `Se listaron ${archivosConMetadatos.length} archivos de ${almacenamiento}`
  };
  catalogoMemoria.set(cacheKey, resListado);
  return resListado;
}

// Búsqueda ultrarrápida combinada
async function buscarArchivos(options = {}) {
  const almacenamiento = options.almacenamiento || 'irec';
  const rutaIrec = options.rutaIrec || options.rutaBase || RUTAS_DEFAULT.irec;
  const rutaSsdirec = options.rutaSsdirec || RUTAS_DEFAULT.ssdirec;
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

  // Si no hay palabras ni carpeta, listar iniciales
  if (palabras.length === 0 && !carpetaFiltro && !options.rutaCompleta) {
    return await listarArchivosIniciales({ almacenamiento, rutaIrec, rutaSsdirec, limite });
  }

  // Auto-detección de delegación
  if (!carpetaFiltro && palabras.length > 0 && almacenamiento !== 'ssdirec' && !options.rutaCompleta) {
    for (const del of DELEGACIONES_OFICIALES) {
      const delNorm = normalizarCadena(del);
      const partesDel = delNorm.split(' ');

      for (let i = 0; i < palabras.length; i++) {
        const pNorm = normalizarCadena(palabras[i]);
        if (pNorm === delNorm || (pNorm.length >= 4 && partesDel.includes(pNorm) && !['de', 'del', 'san', 'los', 'las'].includes(pNorm))) {
          carpetaFiltro = del;
          palabras.splice(i, 1);
          break;
        }
      }
      if (carpetaFiltro) break;
    }
  }

  // Comprobar memoria primero si aplica
  const claveCache = `${almacenamiento}_${carpetaFiltro}`;
  if (!options.rutaCompleta && catalogoMemoria.has(claveCache) && catalogoMemoria.get(claveCache).length > 0) {
    const memoria = catalogoMemoria.get(claveCache);
    const coincidencias = [];

    for (const item of memoria) {
      if (coincideConPalabras(item.nombre, item.rutaCompleta, palabras, buscarEnRuta)) {
        coincidencias.push(item);
        if (coincidencias.length >= limite) break;
      }
    }

    const enriquecidos = await Promise.all(
      coincidencias.map(async (item) => {
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
    return {
      ok: true,
      total: enriquecidos.length,
      duracionSegundos: parseFloat(duracion),
      origen: 'memoria_instantanea',
      ubicacionConsultada: carpetaFiltro || almacenamiento,
      limiteAlcanzado: enriquecidos.length >= limite,
      tiempoAlcanzado: false,
      palabras,
      carpetaDetectada: carpetaFiltro,
      archivos: enriquecidos
    };
  }

  // Escaneo físico en red
  const encontrados = [];
  const state = { limiteAlcanzado: false, tiempoAlcanzado: false };
  const rutasEscaneo = [];

  if (options.rutaCompleta && (await esDirectorioValido(options.rutaCompleta))) {
    rutasEscaneo.push({
      dir: options.rutaCompleta,
      etiqueta: almacenamiento === 'ssdirec' ? 'ssdirec' : 'irec',
      delegacion: path.basename(options.rutaCompleta)
    });
  } else {
    if (almacenamiento === 'irec' || almacenamiento === 'ambos') {
      if (carpetaFiltro) {
        const dirRespaldo = path.join(rutaIrec, 'Respaldo_Original', carpetaFiltro);
        const dirIrec = path.join(rutaIrec, carpetaFiltro);
        if (await esDirectorioValido(dirRespaldo)) {
          rutasEscaneo.push({ dir: dirRespaldo, etiqueta: 'irec', delegacion: path.basename(carpetaFiltro) });
        } else if (await esDirectorioValido(dirIrec)) {
          rutasEscaneo.push({ dir: dirIrec, etiqueta: 'irec', delegacion: path.basename(carpetaFiltro) });
        } else {
          const bRespaldo = path.join(rutaIrec, 'Respaldo_Original', path.basename(carpetaFiltro));
          if (await esDirectorioValido(bRespaldo)) {
            rutasEscaneo.push({ dir: bRespaldo, etiqueta: 'irec', delegacion: path.basename(carpetaFiltro) });
          }
        }
      } else {
        const topIrec = await fs.promises.readdir(rutaIrec, { withFileTypes: true }).catch(() => []);
        const dirs = topIrec.filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name);
        dirs.sort((a, b) => {
          const getPriority = name => {
            if (/^respaldo_original$/i.test(name)) return 0;
            if (/^libros$/i.test(name)) return 1;
            if (/^notarias$/i.test(name)) return 2;
            return 10;
          };
          return getPriority(a) - getPriority(b);
        });
        dirs.forEach(d => {
          rutasEscaneo.push({ dir: path.join(rutaIrec, d), etiqueta: 'irec', delegacion: d });
        });
      }
    }

    if (almacenamiento === 'ssdirec' || almacenamiento === 'ambos') {
      if (carpetaFiltro && almacenamiento === 'ssdirec') {
        const dirSsd = path.join(rutaSsdirec, carpetaFiltro);
        if (await esDirectorioValido(dirSsd)) {
          rutasEscaneo.push({ dir: dirSsd, etiqueta: 'ssdirec', delegacion: path.basename(carpetaFiltro) });
        } else {
          const dirBasename = path.join(rutaSsdirec, path.basename(carpetaFiltro));
          if (await esDirectorioValido(dirBasename)) {
            rutasEscaneo.push({ dir: dirBasename, etiqueta: 'ssdirec', delegacion: path.basename(carpetaFiltro) });
          }
        }
      } else {
        rutasEscaneo.push({ dir: rutaSsdirec, etiqueta: 'ssdirec', delegacion: 'ssdirec' });
      }
    }
  }

  for (const itemEscaneo of rutasEscaneo) {
    if (state.limiteAlcanzado || state.tiempoAlcanzado) break;
    await escanearDirectorioRecursivo(itemEscaneo.dir, itemEscaneo.etiqueta, itemEscaneo.delegacion, palabras, buscarEnRuta, limite, encontrados, inicio, maxSegundos, state);
  }

  const duracionSegundos = ((Date.now() - inicio) / 1000).toFixed(2);

  return {
    ok: true,
    total: encontrados.length,
    duracionSegundos: parseFloat(duracionSegundos),
    origen: 'escaneo_red',
    ubicacionConsultada: carpetaFiltro || almacenamiento,
    limiteAlcanzado: state.limiteAlcanzado,
    tiempoAlcanzado: state.tiempoAlcanzado,
    palabras,
    carpetaDetectada: carpetaFiltro,
    archivos: encontrados
  };
}

async function escanearDirectorioRecursivo(directorio, etiquetaAlmacenamiento, delegacionDefault, palabras, buscarEnRuta, limite, encontrados, inicio, maxSegundos, state, nivel = 0) {
  if (nivel > 15 || state.limiteAlcanzado || state.tiempoAlcanzado) return;

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
        if (coincideConPalabras(entry.name, rutaCompleta, palabras, buscarEnRuta)) {
          let stat = { size: 0, mtime: null };
          try {
            stat = await fs.promises.stat(rutaCompleta);
          } catch (e) {}

          encontrados.push({
            nombre: entry.name,
            rutaCompleta: rutaCompleta,
            rutaRelativa: rutaCompleta.replace(/^[\\/]+[^\\]+[\\/]+[^\\]+[\\/]?/, ''),
            almacenamiento: etiquetaAlmacenamiento,
            delegacion: extraerDelegacionDeRuta(rutaCompleta, delegacionDefault || path.basename(directorio)),
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

  if (subdirectorios.length > 1) {
    const priorizar = name => {
      if (/tuxtla/i.test(name)) return 0;
      if (/registro/i.test(name)) return 1;
      if (/finanza/i.test(name)) return 2;
      if (/08_2/i.test(name)) return 3;
      if (/tapachula/i.test(name)) return 4;
      if (/san crist/i.test(name)) return 5;
      if (/comitan/i.test(name)) return 6;
      if (/chiapa/i.test(name)) return 7;
      if (/(libros|sellos|lote|entregable)/i.test(name)) return 8;
      return 15;
    };
    subdirectorios.sort((a, b) => priorizar(path.basename(a)) - priorizar(path.basename(b)));
  }

  for (const subdir of subdirectorios) {
    await escanearDirectorioRecursivo(subdir, etiquetaAlmacenamiento, delegacionDefault, palabras, buscarEnRuta, limite, encontrados, inicio, maxSegundos, state, nivel + 1);
    if (state.limiteAlcanzado || state.tiempoAlcanzado) break;
  }
}

function limpiarMemoria() {
  catalogoMemoria.clear();
  return { success: true };
}

module.exports = {
  RUTAS_DEFAULT,
  DELEGACIONES_OFICIALES,
  verificarRuta,
  verificarServidores,
  obtenerCarpetas,
  obtenerDelegaciones,
  obtenerSubcarpetas,
  listarArchivosIniciales,
  buscarArchivos,
  formatearTamano,
  formatearFecha,
  limpiarMemoria
};
