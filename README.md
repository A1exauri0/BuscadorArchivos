# Buscador de Expedientes y Archivos - IREC (Electron Desktop App)

Aplicación de escritorio moderna, ultrarrápida y con interfaz oscura de alta fidelidad, diseñada para buscar, filtrar y previsualizar archivos PDF en el servidor de red local (`\\172.40.5.84\irec\Respaldo_Original`).

---

## 🚀 Características Principales

- **Búsqueda Multi-Palabra en Tiempo Real**: Localiza archivos que contengan cualquier conjunto de palabras o números (ej: `2004 1788 lote`), sin importar el orden ni caracteres separadores (`_`, `-`, espacios).
- **Selector Inteligente de Delegaciones**: Detección automática y menú lateral de las delegaciones físicas (Tuxtla Gutiérrez, Chiapa de Corzo, San Cristóbal, Comitán, Tapachula, Cintalapa, etc.) con búsqueda instantánea y conteo de delegaciones.
- **Rendimiento Ultrarrápido sobre SMB/Red**: Escaneo nativo Node.js optimizado con `fs.promises.readdir` en memoria sin sobrecargar la red con llamadas recursivas de `stat()`. Priorización de subcarpetas clave (`LIBROS Y SELLOS`, `LoteLibrosss`, etc.).
- **Modos de Coincidencia Flexibles**:
  - `Todas las palabras (AND)`: Requiere que todas las palabras buscadas estén presentes.
  - `Cualquiera (OR)`: Encuentra archivos con al menos una coincidencia.
  - Opción de incluir nombres de subcarpetas en la coincidencia.
- **Acciones Rápidas con un Clic**:
  - **Abrir**: Inicia el archivo con el lector PDF predeterminado del sistema operativo (Acrobat, Edge, etc.).
  - **Mostrar en Carpeta**: Revela y resalta el archivo directamente en el Explorador de Windows.
  - **Copiar Ruta UNC**: Copia la dirección completa de red al portapapeles con notificación toast.
  - **Vista Previa Integrada**: Modal con visor interactivo del PDF y detalles de metadatos.
- **Exportación de Resultados**: Generación y descarga instantánea de reportes en formato **CSV / Excel** con soporte UTF-8 BOM.
- **Panel de Configuración Dinámico**: Permite cambiar la ruta base UNC, el nivel de profundidad de carpetas y el tiempo de espera (timeout) sin necesidad de reiniciar la app.

---

## 🛠️ Tecnologías Utilizadas

- **Electron** (v44+)
- **Node.js** (v22+)
- **HTML5 & CSS3 Vanilla** (Tema oscuro moderno, efectos glassmorphism, responsive, diseño nativo de escritorio)
- **Node.js File System & Path APIs** para escaneo nativo

---

## 📦 Estructura del Proyecto

```text
c:\laragon\www\BuscadorArchivos\
├── .gitignore              # Ignora node_modules y archivos temporales
├── package.json            # Configuración de dependencias y scripts
├── main.js                 # Proceso principal de Electron (Ventanas, IPC, diálogo nativo)
├── preload.js              # Puente seguro de contexto (contextBridge) entre Main y Renderer
├── searchEngine.js         # Motor optimizado de búsqueda y escaneo en red SMB
├── index.html              # Estructura de la interfaz de escritorio
├── styles.css              # Sistema de estilos oscuro premium
├── renderer.js             # Lógica del cliente, eventos, atajos de teclado y CSV
└── README.md               # Documentación y guía de uso
```

---

## 💻 Instrucciones para Ejecutar en Laragon / Windows

### 1. Abrir una terminal en el directorio del proyecto
```powershell
cd c:\laragon\www\BuscadorArchivos
```

### 2. Asegurar que Node.js esté en el PATH (si usas Laragon)
```powershell
$env:PATH = "C:\laragon\bin\nodejs\node-v22;$env:PATH"
```

### 3. Iniciar la aplicación
```powershell
npm start
```

*(La ventana de la aplicación se abrirá inmediatamente)*.

---

## ⌨️ Atajos de Teclado

- <kbd>Enter</kbd>: Ejecutar búsqueda inmediatamente.
- <kbd>Ctrl</kbd> + <kbd>F</kbd>: Enfocar la barra de búsqueda y seleccionar el texto.
- <kbd>Esc</kbd>: Limpiar la búsqueda o cerrar modales activos.

---

## 📤 Instrucciones para Subir los Cambios a GitHub

Para guardar y subir todo este trabajo a tu repositorio de GitHub (`https://github.com/A1exauri0/BuscadorArchivos.git`), ejecuta los siguientes comandos en tu terminal de PowerShell:

```powershell
# 1. Posicionarte en la carpeta de la aplicación
cd c:\laragon\www\BuscadorArchivos

# 2. Agregar todos los archivos al control de versiones
git add .

# 3. Crear el commit descriptivo
git commit -m "feat: implementacion completa de buscador de archivos en electron con interfaz oscura premium y escaneo optimizado"

# 4. Subir los cambios a la rama principal (main)
git push origin main
```

---

*Desarrollado para el Instituto Registral y Catastral (IREC).*
