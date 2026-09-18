const fs = require('fs');
const path = require('path');

const DELEGACIONES_OFICIALES = [
  'Tuxtla Gutierrez', 'Chiapa de Corzo', 'San Cristobal', 'Comitan',
  'Tapachula', 'Cintalapa', 'Copainala', 'Acapetahua', 'Bochil',
  'Catazaja', 'Huixtla', 'Motozintla', 'Ocosingo', 'Pichucalco',
  'Salto de Agua', 'Tonala', 'Venustiano Carranza', 'Villaflores', 'Yajalon'
];

function normalizarCadena(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatearTamano(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' B';
}

function formatearFecha(date) {
  if (!date) return '-';
  const d = new Date(date);
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function verificarRuta(ruta) {
  try {
    const stat = await fs.promises.stat(ruta);
    return stat.isDirectory();
  } catch (err) {
    return false;
  }
}

async function obtenerDelegaciones(rutaBase = '\\\\172.40.5.84\\irec\\Respaldo_Original') {
  const conectado = await verificarRuta(rutaBase);
  if (!conectado) {
    return {
      conectado: false,
      delegaciones: DELEGACIONES_OFICIALES.map(d => ({ nombre: d })),
      otrasCarpetas: [],
      todas: DELEGACIONES_OFICIALES
    };
  }

  try {
    const entries = await fs.promises.readdir(rutaBase, { withFileTypes: true });
    const fisicas = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const mapaOficiales = new Set(DELEGACIONES_OFICIALES.map(d => normalizarCadena(d)));
    const delegaciones = [];
    const otrasCarpetas = [];

    for (const folder of fisicas) {
      const norm = normalizarCadena(folder);
      if (mapaOficiales.has(norm)) {
        delegaciones.push({ nombre: folder });
      } else {
        otrasCarpetas.push(folder);
      }
    }

    const listaFinal = delegaciones.length > 0 ? delegaciones : fisicas.map(f => ({ nombre: f }));

    return {
      conectado: true,
      delegaciones: listaFinal,
      otrasCarpetas,
      todas: fisicas
    };
  } catch (err) {
    return {
      conectado: false,
      delegaciones: DELEGACIONES_OFICIALES.map(d => ({ nombre: d })),
      otrasCarpetas: [],
      todas: [],
      error: err.message
    };
  }
}

async function obtenerSubcarpetas(rutaBase, delegacion) {
  if (!delegacion || delegacion === 'todas' || delegacion === '') {
    return [];
  }

  const dir = path.join(rutaBase, path.basename(delegacion));
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  } catch (err) {
    return [];
  }
}

function coincideConPalabras(nombreArchivo, rutaCompleta, palabras, modo, buscarEnRuta) {
  if (!palabras || palabras.length === 0) return true;

  const target = (buscarEnRuta ? rutaCompleta : nombreArchivo).toLowerCase();

  if (modo === 'alguna' || modo === 'cualquiera') {
    for (const p of palabras) {
      if (target.includes(p)) return true;
    }
    return false;
  }

  // AND (todas las palabras deben coincidir)
  for (const p of palabras) {
    if (!target.includes(p)) return false;
  }
  return true;
}

async function escanearRecursivo(directorio, palabras, modo, buscarEnRuta, limite, rutaBase, encontrados, inicio, maxSegundos, state, nivel = 0) {
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
    if (entry.name === '.' || entry.name === '..') continue;

    if (entry.isFile()) {
      if (/\.pdf$/i.test(entry.name)) {
        const rutaCompleta = path.join(directorio, entry.name);
        if (coincideConPalabras(entry.name, rutaCompleta, palabras, modo, buscarEnRuta)) {
          let stat = { size: 0, mtime: null };
          try {
            stat = await fs.promises.stat(rutaCompleta);
          } catch (e) {}

          const rutaRelativa = path.relative(rutaBase, rutaCompleta);
          const partes = rutaRelativa.split(path.sep);
          const delegacionPrincipal = partes.length > 1 ? partes[0] : 'Raíz';

          encontrados.push({
            nombre: entry.name,
            rutaCompleta: rutaCompleta,
            rutaRelativa: rutaRelativa,
            delegacion: delegacionPrincipal,
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
      if (!entry.name.startsWith('.') && entry.name !== 'lost+found') {
        subdirectorios.push(path.join(directorio, entry.name));
      }
    }
  }

  if (state.limiteAlcanzado || state.tiempoAlcanzado) return;

  // Priorizar subcarpetas de LIBROS, SELLOS y LOTES
  if (subdirectorios.length > 1) {
    subdirectorios.sort((a, b) => {
      const aP = /(libros|sellos|lote)/i.test(path.basename(a)) ? 0 : 1;
      const bP = /(libros|sellos|lote)/i.test(path.basename(b)) ? 0 : 1;
      return aP - bP;
    });
  }

  for (const subdir of subdirectorios) {
    await escanearRecursivo(subdir, palabras, modo, buscarEnRuta, limite, rutaBase, encontrados, inicio, maxSegundos, state, nivel + 1);
    if (state.limiteAlcanzado || state.tiempoAlcanzado) break;
  }
}

async function buscarArchivos(options = {}) {
  const rutaBase = options.rutaBase || '\\\\172.40.5.84\\irec\\Respaldo_Original';
  const queryRaw = options.query || options.palabras || '';
  const delegacionRaw = options.delegacion || options.carpeta || '';
  const subcarpeta = options.subcarpeta || '';
  const modo = options.modo || options.modoCoincidencia || 'todas';
  const buscarEnRuta = options.buscarEnRuta !== undefined ? options.buscarEnRuta : true;
  const limite = parseInt(options.limite || options.limiteResultados, 10) || 200;
  const maxSegundos = options.tiempoLimiteMs ? (options.tiempoLimiteMs / 1000) : 45.0;

  const inicio = Date.now();

  const conectado = await verificarRuta(rutaBase);
  if (!conectado) {
    return {
      ok: false,
      mensaje: `No se puede acceder a la ruta de red: ${rutaBase}. Verifica la conexión con el servidor.`,
      archivos: [],
      total: 0,
      duracionSegundos: 0,
      palabras: []
    };
  }

  let palabras = [];
  if (Array.isArray(queryRaw)) {
    palabras = queryRaw.map(p => p.toString().trim().toLowerCase()).filter(Boolean);
  } else if (typeof queryRaw === 'string' && queryRaw.trim()) {
    palabras = queryRaw.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
  }

  let carpetaFiltro = delegacionRaw && delegacionRaw !== 'todas' ? delegacionRaw.trim() : '';

  if (palabras.length === 0 && !carpetaFiltro) {
    return {
      ok: false,
      mensaje: 'Introduce al menos una palabra clave o selecciona una delegación específica.',
      archivos: [],
      total: 0,
      duracionSegundos: 0,
      palabras: []
    };
  }

  // Auto-detección inteligente de delegación si el usuario la escribió en el buscador
  if (!carpetaFiltro && palabras.length > 0) {
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

  const encontrados = [];
  const state = { limiteAlcanzado: false, tiempoAlcanzado: false };
  let ubicacionConsultada = 'Todas las delegaciones';

  if (carpetaFiltro) {
    const carpetaSegura = path.basename(carpetaFiltro);
    let dirInicio = path.join(rutaBase, carpetaSegura);
    ubicacionConsultada = carpetaSegura;

    if (subcarpeta && subcarpeta !== 'todas') {
      const subcarpetaSegura = path.basename(subcarpeta);
      dirInicio = path.join(dirInicio, subcarpetaSegura);
      ubicacionConsultada += ' / ' + subcarpetaSegura;
    }

    if (!(await verificarRuta(dirInicio))) {
      return {
        ok: false,
        mensaje: `La carpeta '${ubicacionConsultada}' no existe en el almacenamiento.`,
        archivos: [],
        total: 0,
        duracionSegundos: 0,
        palabras
      };
    }

    await escanearRecursivo(dirInicio, palabras, modo, buscarEnRuta, limite, rutaBase, encontrados, inicio, maxSegundos, state);
  } else {
    const clasif = await obtenerDelegaciones(rutaBase);
    const carpetasAEscanear = [...clasif.delegaciones.map(d => d.nombre), ...clasif.otrasCarpetas];

    for (const folder of carpetasAEscanear) {
      if (['_Discos originales', 'Entregables NO TOCAR SI LO TOCAS MUERES', 'NOTARIAS RENOMBRAR NO TOCAR'].includes(folder)) {
        continue;
      }
      const dir = path.join(rutaBase, folder);
      if (!(await verificarRuta(dir))) continue;

      await escanearRecursivo(dir, palabras, modo, buscarEnRuta, limite, rutaBase, encontrados, inicio, maxSegundos, state);
      if (state.limiteAlcanzado || state.tiempoAlcanzado) break;
    }
  }

  const duracionSegundos = ((Date.now() - inicio) / 1000).toFixed(2);

  return {
    ok: true,
    total: encontrados.length,
    duracionSegundos: parseFloat(duracionSegundos),
    ubicacionConsultada,
    limiteAlcanzado: state.limiteAlcanzado,
    tiempoAlcanzado: state.tiempoAlcanzado,
    palabras,
    carpetaDetectada: carpetaFiltro,
    archivos: encontrados
  };
}

module.exports = {
  verificarRuta,
  obtenerDelegaciones,
  obtenerSubcarpetas,
  buscarArchivos,
  formatearTamano,
  formatearFecha
};
