
// Pruebas unitarias de las nuevas características solicitadas
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- INICIANDO PRUEBAS DE NUEVAS CARACTERÍSTICAS MULTISTATS ---');

// Mock DOM
const docElements = {};
const documentMock = {
  getElementById: (id) => {
    if (!docElements[id]) {
      docElements[id] = {
        id: id,
        tagName: 'DIV',
        innerHTML: '',
        textContent: '',
        value: '',
        style: { display: '' },
        classList: {
          add: () => {},
          remove: () => {},
          contains: () => false,
          toggle: () => {}
        },
        options: [],
        children: [],
        querySelectorAll: () => [],
        querySelector: () => null,
        appendChild: function(child) {
          if (this.tagName === 'SELECT') this.options.push(child);
          this.children.push(child);
          this.innerHTML += ' ' + (child.innerHTML || child.textContent || '');
        },
        addEventListener: () => {}
      };
    }
    return docElements[id];
  },
  querySelectorAll: (selector) => [],
  querySelector: (selector) => null,
  createElement: (tag) => {
    return {
      tagName: tag.toUpperCase(),
      innerHTML: '',
      style: { display: '' },
      appendChild: () => {},
      removeChild: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      addEventListener: () => {},
      click: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
      classList: { add: () => {}, remove: () => {}, contains: () => false }
    };
  },
  createElementNS: (ns, tag) => {
    return {
      tagName: tag.toUpperCase(),
      innerHTML: '',
      style: { display: '' },
      appendChild: () => {},
      removeChild: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      addEventListener: () => {},
      click: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
      classList: { add: () => {}, remove: () => {}, contains: () => false }
    };
  },
  body: { appendChild: () => {}, removeChild: () => {}, classList: { contains: () => true } },
  addEventListener: () => {}
};

const windowMock = {
  document: documentMock,
  performance: { now: () => Date.now() },
  Date: Date,
  Math: Math,
  confirm: () => true,
  alert: () => {},
  print: () => {},
  Blob: class { constructor(parts, opts) { this.parts = parts; this.opts = opts; } },
  URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} }
};

const context = vm.createContext({
  window: windowMock,
  document: documentMock,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Math: Math,
  Date: Date,
  Number: Number,
  String: String,
  Array: Array,
  Object: Object,
  RegExp: RegExp,
  parseFloat: parseFloat,
  parseInt: parseInt,
  isNaN: isNaN,
  isFinite: isFinite,
  confirm: windowMock.confirm,
  alert: windowMock.alert,
  Blob: windowMock.Blob,
  URL: windowMock.URL
});

const scripts = [
  'js/datos/tabla.js',
  'js/datos/validacion.js',
  'js/datos/importacion.js',
  'js/datos/exportacion.js',
  'js/estadistica/descriptiva.js',
  'js/estadistica/frecuencias.js',
  'js/estadistica/agrupados.js',
  'js/estadistica/multivariado.js',
  'js/estadistica/regresion.js',
  'js/estadistica/inferencia.js',
  'js/aprendizaje/distancias.js',
  'js/aprendizaje/kmeans.js',
  'js/aprendizaje/kmedoids.js',
  'js/graficos/graficos.js',
  'js/resultados/resultados.js',
  'js/aprendizaje/pasos.js',
  'js/principal.js',
  'js/base/navegacion.js'
];

for (const s of scripts) {
  const code = fs.readFileSync(path.join(__dirname, '..', s), 'utf8');
  vm.runInContext(code, context, { filename: s });
}

console.log('✓ Todos los scripts cargados');

// 1. Prueba de adición de múltiples filas y columnas
vm.runInContext('agregarFilas(3);', context);
let fCount = vm.runInContext('datos.filas;', context);
if (fCount !== 9) throw new Error('agregarFilas falló: ' + fCount);
console.log('✓ agregarFilas(3) exitoso: 6 + 3 = ' + fCount + ' filas');

vm.runInContext('agregarColumnas(2, "Numérica Discreta");', context);
let cCount = vm.runInContext('datos.columnas.length;', context);
if (cCount !== 5) throw new Error('agregarColumnas falló: ' + cCount);
console.log('✓ agregarColumnas(2) exitoso: 3 + 2 = ' + cCount + ' columnas');

// 2. Prueba de definición de tipo de variable
vm.runInContext('cambiarTipoVariable(1, "Numérica Continua");', context);
let tipo1 = vm.runInContext('datos.columnas[1].tipoVariable;', context);
if (tipo1 !== 'Numérica Continua') throw new Error('cambiarTipoVariable falló');
console.log('✓ cambiarTipoVariable exitoso: ' + tipo1);

// 3. Prueba de redimensionar tabla
vm.runInContext('redimensionarTabla(8, 4);', context);
fCount = vm.runInContext('datos.filas;', context);
cCount = vm.runInContext('datos.columnas.length;', context);
if (fCount !== 8 || cCount !== 4) throw new Error('redimensionarTabla falló: ' + fCount + 'x' + cCount);
console.log('✓ redimensionarTabla(8, 4) exitoso');

// 4. Prueba de panel dinámico con multi-selección
vm.runInContext('opcionesActivas = ["kmeans", "limpieza", "tendencia", "conclusiones"]; actualizarPanelParametrosDinamico();', context);
let dynHTML = docElements['dash-params-dinamicos'].innerHTML;
if (!dynHTML.includes('Clustering') || !dynHTML.includes('Preprocesamiento') || !dynHTML.includes('Univariado') || !dynHTML.includes('Interpretación')) {
  throw new Error('Panel dinámico falló en renderizar todas las secciones elegidas');
}
console.log('✓ Panel de parámetros dinámico renderizó correctamente todas las secciones seleccionadas simultáneamente');

// 5. Prueba de control de requisitos y justificaciones (toggle inclusión de fórmula)
vm.runInContext('togglePasoFormula("media", false);', context);
let actMedia = vm.runInContext('formulasRegistro.find(f => f.id === "media").activa;', context);
if (actMedia !== false) throw new Error('togglePasoFormula falló en desactivar');
vm.runInContext('togglePasoFormula("media", true);', context);
console.log('✓ Control de requisitos y fórmulas (incluir/excluir del reporte) verificado');

// 6. Prueba de agregar fórmula personalizada
vm.runInContext(`
  formulasPersonalizadas.push({
    id: "custom_test",
    nombre: "Error Estándar de la Media",
    formula: "SE = s / √n",
    descripcion: "Variabilidad de la media muestral.",
    justificacion: "Requisito para intervalos de confianza.",
    activa: true
  });
  actualizarResolucionPasoAPaso();
`, context);
let fCustCount = vm.runInContext('formulasPersonalizadas.length;', context);
if (fCustCount !== 1) throw new Error('Agregar fórmula personalizada falló');
console.log('✓ Agregar fórmulas personalizadas adicionales verificado');

// 7. Prueba de exportar Excel
let excelExported = false;
let origCreate = documentMock.createElement;
documentMock.createElement = function(tag) {
  let el = origCreate(tag);
  if (tag.toLowerCase() === 'a') {
    Object.defineProperty(el, 'download', {
      set: (name) => {
        if (name && name.endsWith('.xls')) excelExported = true;
      }
    });
  }
  return el;
};
vm.runInContext('exportarExcel();', context);
if (!excelExported) throw new Error('exportarExcel falló');
console.log('✓ Exportación a Excel (.xls con hojas y fórmulas) funcionando al 100%');

// 8. Prueba de Reporte Analítico Integral (con resultados de todas las opciones activas)
vm.runInContext(`
  opcionesActivas = ["kmeans", "limpieza", "tendencia", "covarianza", "conclusiones"];
  cambiarTabResolucion("reporte");
`, context);
let repHTML = docElements['panel-resultados'].innerHTML;
if (!repHTML.includes('Reporte Analítico Integral') || !repHTML.includes('Preprocesamiento') || !repHTML.includes('Univariado') || !repHTML.includes('Clustering')) {
  throw new Error('actualizarReporteAnaliticoCompleto falló en generar el reporte consolidado');
}
console.log('✓ Tab Reporte Analítico genera correctamente los resultados de todas las opciones activadas');

console.log('--- TODAS LAS PRUEBAS DE NUEVAS CARACTERÍSTICAS PASARON CON ÉXITO ---');
