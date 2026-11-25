// Estructura de datos común y renderizado de la tabla editable
// Fuente de verdad para todos los módulos de MultiStats

var datos = {
  columnas: [
    { nombre: "Estudiante", tipo: "categorica", tipoVariable: "Categórica Nominal", valores: ["A", "B", "C", "D", "E", "F"] },
    { nombre: "Horas de estudio", tipo: "numerica", tipoVariable: "Numérica Continua", valores: [1, 3, 5, 7, 9, 11] },
    { nombre: "Nota promedio", tipo: "numerica", tipoVariable: "Numérica Continua", valores: [9, 11, 13, 16, 18, 20] }
  ],
  filas: 6,
  asignaciones: [0, 0, 0, 1, 1, 1],
  seleccion: [],
  resultados: null
};

// Convierte índice a letra estilo Excel: 0 → A, 25 → Z, 26 → AA
function letraColumna(indice) {
  var letra = "";
  indice++;
  while (indice > 0) {
    var resto = (indice - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    indice = Math.floor((indice - 1) / 26);
  }
  return letra;
}

// Escapa texto para HTML seguro
function escaparHTML(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Icono eliminar
var TABLA_ICONO_ELIMINAR = "<svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'><path d='M7 7l10 10M17 7L7 17'/></svg>";

// Renderizado de la tabla de datos
function dibujarTabla() {
  var contenedor = document.getElementById("contenedor-tabla");
  if (!contenedor) return;

  if (datos.columnas.length === 0 || datos.filas === 0) {
    contenedor.innerHTML =
      "<div class='tabla-vacio'>" +
      "<p class='tabla-vacio-titulo'>Aún no hay datos en la hoja</p>" +
      "<p class='tabla-vacio-texto'>Importa un archivo CSV o Excel, o agrega filas y columnas personalizadas.</p>" +
      "<div style='display:flex; gap:8px; justify-content:center;'>" +
      "<button type='button' class='dash-btn-outline' onclick=\"document.getElementById('input-archivo').click()\">📥 Importar archivo</button>" +
      "<button type='button' class='dash-btn-outline' onclick=\"abrirModalAgregarDimensiones()\">➕ Definir filas y columnas</button>" +
      "</div>" +
      "</div>";
    return;
  }

  var hayClusters = datos.asignaciones && datos.asignaciones.length === datos.filas;

  var html = "<div class='dash-tabla-contenedor'><table class='dash-tabla-data'>";

  // Fila 1: Letras estilo Excel
  html += "<thead><tr class='tabla-letras'><th></th>";
  for (var l = 0; l < datos.columnas.length; l++) {
    html += "<th>" + letraColumna(l) + "</th>";
  }
  if (hayClusters) html += "<th></th>";
  html += "<th></th></tr>";

  // Fila 2: Nombres de columnas y tipo de variable editable
  html += "<tr class='tabla-nombres'>";
  html += "<th style='width: 38px; text-align: center;'>#</th>";
  for (var c = 0; c < datos.columnas.length; c++) {
    var col = datos.columnas[c];
    var nombre = escaparHTML(col.nombre);
    var tipoVar = col.tipoVariable || (col.tipo === "numerica" ? "Numérica Continua" : "Categórica Nominal");
    var badgeTexto = (tipoVar.indexOf("Continua") !== -1) ? "Continua" :
                     (tipoVar.indexOf("Discreta") !== -1 ? "Discreta" :
                     (tipoVar.indexOf("Ordinal") !== -1 ? "Ordinal" : "Nominal"));

    html += "<th><div style='display: flex; flex-direction: column; gap: 3px;'>";
    html += "<div style='display: flex; align-items: center; justify-content: space-between; gap: 4px;'>";
    html += "<input type='text' value='" + nombre + "' title='Editar nombre de columna' ";
    html += "style='color: #ffffff; font-weight: 600; background: transparent; border: none; font-size: 12px; width: 100%; cursor: text;' ";
    html += "onchange='cambiarNombreColumna(" + c + ", this.value)'>";
    html += "<button type='button' onclick='eliminarColumna(" + c + ")' title='Eliminar columna' ";
    html += "style='background: transparent; border: none; color: #a7f3d0; cursor: pointer; padding: 0 2px; font-size: 13px;'>×</button>";
    html += "</div>";

    // Selector / Badge de Tipo de Variable
    html += "<div style='display:flex; align-items:center; justify-content:space-between;'>";
    html += "<button type='button' onclick='abrirModalTipoVariable(" + c + ")' class='dash-col-tipo-badge' title='Definir qué tipo de variable desea (Continua, Discreta, Nominal, Ordinal)'>";
    html += badgeTexto + " ▾";
    html += "</button>";
    html += "</div>";

    html += "</div></th>";
  }

  if (hayClusters) {
    html += "<th style='width: 80px; text-align: center;'>Clúster</th>";
  }

  html += "<th style='width: 32px; text-align: center;'></th>";
  html += "</tr></thead>";

  // Filas del cuerpo de datos
  html += "<tbody>";
  for (var f = 0; f < datos.filas; f++) {
    html += "<tr>";
    html += "<td style='text-align: center; font-weight: 600; color: #6f928d;'>" + (f + 1) + "</td>";

    for (var c2 = 0; c2 < datos.columnas.length; c2++) {
      var valor = datos.columnas[c2].valores[f];
      var esNumero = typeof valor === "number";
      if (valor === undefined || valor === null) valor = "";
      html += "<td style='" + (esNumero ? "text-align: right;" : "") + "'>";
      html += "<input type='text' value='" + escaparHTML(valor) + "' ";
      html += "style='text-align: " + (esNumero ? "right" : "left") + ";' ";
      html += "aria-label='Fila " + (f + 1) + ", " + escaparHTML(datos.columnas[c2].nombre) + "' ";
      html += "onchange='cambiarCelda(" + f + "," + c2 + ", this.value)'>";
      html += "</td>";
    }

    if (hayClusters) {
      var numCluster = (datos.asignaciones[f] !== undefined && datos.asignaciones[f] !== null) ? (datos.asignaciones[f] + 1) : 1;
      html += "<td style='text-align: center;'>";
      html += "<span class='dash-cluster-pill dash-cluster-pill--" + numCluster + "'>" + numCluster + "</span>";
      html += "</td>";
    }

    html += "<td style='text-align: center;'>";
    html += "<button type='button' onclick='eliminarFila(" + f + ")' title='Eliminar fila' ";
    html += "style='background: transparent; border: none; color: #6f928d; cursor: pointer; font-size: 13px;'>×</button>";
    html += "</td>";
    html += "</tr>";
  }
  html += "</tbody></table></div>";

  contenedor.innerHTML = html;
}

// Notifica cambios en los datos a los demás módulos
function notificarCambioDatos() {
  if (typeof actualizarTiposColumnas === "function") actualizarTiposColumnas();
  if (typeof actualizarSelectoresVariables === "function") actualizarSelectoresVariables();
  if (typeof actualizarResolucionPasoAPaso === "function") actualizarResolucionPasoAPaso();
  if (typeof actualizarBarraEstado === "function" && typeof seccionVisible === "function") {
    actualizarBarraEstado(seccionVisible());
  }
}

// Cambia valor de celda
function cambiarCelda(fila, columna, valor) {
  if (valor === "" || valor === null || valor === undefined) {
    datos.columnas[columna].valores[fila] = null;
  } else {
    var num = Number(valor);
    if (!isNaN(num) && String(valor).trim() !== "") {
      datos.columnas[columna].valores[fila] = num;
    } else {
      datos.columnas[columna].valores[fila] = valor;
    }
  }
  notificarCambioDatos();
}

// Cambia nombre de columna
function cambiarNombreColumna(columna, nombre) {
  datos.columnas[columna].nombre = nombre;
  notificarCambioDatos();
}

// Permite al usuario definir el tipo de variable (Continua, Discreta, Nominal, Ordinal)
function cambiarTipoVariable(columna, tipoElegido) {
  if (!datos.columnas[columna]) return;
  var col = datos.columnas[columna];
  col.tipoVariable = tipoElegido;

  if (tipoElegido === "Numérica Continua" || tipoElegido === "Numérica Discreta") {
    col.tipo = "numerica";
    // Convertir valores a números si es posible
    for (var f = 0; f < col.valores.length; f++) {
      var num = Number(col.valores[f]);
      if (!isNaN(num) && col.valores[f] !== "" && col.valores[f] !== null) {
        col.valores[f] = num;
      }
    }
  } else {
    col.tipo = "categorica";
  }

  dibujarTabla();
  notificarCambioDatos();

  if (typeof window.mostrarToast === "function") {
    window.mostrarToast("Variable '" + col.nombre + "' definida como " + tipoElegido + ".", "info");
  }
}

// Agrega 1 fila
function agregarFila() {
  agregarFilas(1);
}

// Agrega N filas determinadas por el usuario
function agregarFilas(cantidad) {
  var n = Number(cantidad) || 1;
  if (n <= 0) return;
  for (var i = 0; i < n; i++) {
    for (var c = 0; c < datos.columnas.length; c++) {
      datos.columnas[c].valores.push(null);
    }
    datos.filas++;
    if (datos.asignaciones) datos.asignaciones.push(0);
  }
  dibujarTabla();
  notificarCambioDatos();
  if (typeof window.mostrarToast === "function") {
    window.mostrarToast(n + (n === 1 ? " fila agregada." : " filas agregadas."), "exito");
  }
}

// Agrega 1 columna
function agregarColumna() {
  agregarColumnas(1);
}

// Agrega M columnas determinadas por el usuario
function agregarColumnas(cantidad, tipoDefault) {
  var m = Number(cantidad) || 1;
  if (m <= 0) return;
  var tipoVar = tipoDefault || "Numérica Continua";
  var tipoBase = (tipoVar.indexOf("Numérica") !== -1) ? "numerica" : "categorica";

  for (var i = 0; i < m; i++) {
    var nuevoNombre = "Var" + (datos.columnas.length + 1);
    var nuevaColumna = {
      nombre: nuevoNombre,
      tipo: tipoBase,
      tipoVariable: tipoVar,
      valores: []
    };
    for (var f = 0; f < datos.filas; f++) {
      nuevaColumna.valores.push(null);
    }
    datos.columnas.push(nuevaColumna);
  }
  dibujarTabla();
  notificarCambioDatos();
  if (typeof window.mostrarToast === "function") {
    window.mostrarToast(m + (m === 1 ? " columna agregada." : " columnas agregadas."), "exito");
  }
}

// Redimensiona la tabla al número exacto de filas y columnas que el usuario determine
function redimensionarTabla(filasDeseadas, colsDeseadas) {
  var nFilas = Math.max(1, Number(filasDeseadas) || 1);
  var nCols = Math.max(1, Number(colsDeseadas) || 1);

  // Ajustar columnas
  while (datos.columnas.length < nCols) {
    var num = datos.columnas.length + 1;
    datos.columnas.push({
      nombre: "Var" + num,
      tipo: "numerica",
      tipoVariable: "Numérica Continua",
      valores: []
    });
  }
  if (datos.columnas.length > nCols) {
    datos.columnas.splice(nCols);
  }

  // Ajustar valores de filas por columna
  for (var c = 0; c < datos.columnas.length; c++) {
    while (datos.columnas[c].valores.length < nFilas) {
      datos.columnas[c].valores.push(null);
    }
    if (datos.columnas[c].valores.length > nFilas) {
      datos.columnas[c].valores.splice(nFilas);
    }
  }

  datos.filas = nFilas;
  datos.asignaciones = new Array(nFilas).fill(0);

  dibujarTabla();
  notificarCambioDatos();

  if (typeof window.mostrarToast === "function") {
    window.mostrarToast("Tabla redimensionada a " + nFilas + " filas y " + nCols + " columnas.", "exito");
  }
}

// Elimina fila
function eliminarFila(fila) {
  if (!confirm("¿Eliminar la fila " + (fila + 1) + "?")) return;
  for (var c = 0; c < datos.columnas.length; c++) {
    datos.columnas[c].valores.splice(fila, 1);
  }
  if (datos.asignaciones) datos.asignaciones.splice(fila, 1);
  datos.filas--;
  dibujarTabla();
  notificarCambioDatos();
}

// Elimina columna
function eliminarColumna(columna) {
  if (!confirm("¿Eliminar la columna '" + datos.columnas[columna].nombre + "'?")) return;
  datos.columnas.splice(columna, 1);
  dibujarTabla();
  notificarCambioDatos();
}

// Reemplaza todos los datos
function reemplazarDatos(nuevasColumnas) {
  datos.columnas = nuevasColumnas;
  datos.filas = 0;
  if (nuevasColumnas.length > 0) {
    datos.filas = nuevasColumnas[0].valores.length;
  }
  datos.asignaciones = null;
  datos.seleccion = [];
  datos.resultados = null;
  dibujarTabla();
  notificarCambioDatos();
}

// Ventana modal / diálogo para que el usuario determine cuántas filas y columnas desea agregar
function abrirModalAgregarDimensiones() {
  var idModal = "dash-modal-dimensiones";
  var modal = document.getElementById(idModal);
  if (!modal) {
    modal = document.createElement("div");
    modal.id = idModal;
    modal.className = "dash-modal-overlay";
    document.body.appendChild(modal);
  }

  modal.innerHTML =
    "<div class='dash-modal-contenido' style='max-width: 440px;'>" +
      "<div class='dash-modal-header'>" +
        "<h3 class='dash-modal-titulo'>📐 Dimensiones de la Tabla</h3>" +
        "<button type='button' class='dash-modal-cerrar' onclick=\"document.getElementById('" + idModal + "').style.display='none'\">×</button>" +
      "</div>" +
      "<div class='dash-modal-cuerpo' style='padding: 16px; display: flex; flex-direction: column; gap: 14px;'>" +
        "<p style='margin:0; font-size:12.5px; color:#4a6b66;'>Determina cuántas filas y columnas deseas agregar o redimensiona la hoja:</p>" +
        "<div style='display: grid; grid-template-columns: 1fr 1fr; gap: 12px;'>" +
          "<div class='dash-campo'>" +
            "<label class='dash-campo-label' for='modal-dim-filas'>Filas a agregar:</label>" +
            "<input type='number' id='modal-dim-filas' class='dash-input-num' value='5' min='1' max='500'>" +
          "</div>" +
          "<div class='dash-campo'>" +
            "<label class='dash-campo-label' for='modal-dim-cols'>Columnas a agregar:</label>" +
            "<input type='number' id='modal-dim-cols' class='dash-input-num' value='1' min='1' max='50'>" +
          "</div>" +
        "</div>" +
        "<div style='display:flex; gap:8px;'>" +
          "<button type='button' class='dash-btn-outline' style='flex:1;' onclick='ejecutarAgregarDimensiones()'>➕ Agregar a existentes</button>" +
          "<button type='button' class='dash-btn-outline' style='flex:1; border-color:#00a896; color:#005953;' onclick='ejecutarRedimensionarExacto()'>🔄 Redimensionar total</button>" +
        "</div>" +
      "</div>" +
    "</div>";

  modal.style.display = "flex";
}

function ejecutarAgregarDimensiones() {
  var f = Number(document.getElementById("modal-dim-filas").value) || 0;
  var c = Number(document.getElementById("modal-dim-cols").value) || 0;
  if (f > 0) agregarFilas(f);
  if (c > 0) agregarColumnas(c);
  document.getElementById("dash-modal-dimensiones").style.display = "none";
}

function ejecutarRedimensionarExacto() {
  var f = Number(document.getElementById("modal-dim-filas").value) || 6;
  var c = Number(document.getElementById("modal-dim-cols").value) || 3;
  redimensionarTabla(f, c);
  document.getElementById("dash-modal-dimensiones").style.display = "none";
}

// Ventana modal para que el usuario pueda definir qué tipo de variable desea
function abrirModalTipoVariable(colIndex) {
  var col = datos.columnas[colIndex];
  if (!col) return;

  var idModal = "dash-modal-tipo-var";
  var modal = document.getElementById(idModal);
  if (!modal) {
    modal = document.createElement("div");
    modal.id = idModal;
    modal.className = "dash-modal-overlay";
    document.body.appendChild(modal);
  }

  var tipoActual = col.tipoVariable || (col.tipo === "numerica" ? "Numérica Continua" : "Categórica Nominal");

  modal.innerHTML =
    "<div class='dash-modal-contenido' style='max-width: 440px;'>" +
      "<div class='dash-modal-header'>" +
        "<h3 class='dash-modal-titulo'>⚙️ Definir Tipo de Variable: " + escaparHTML(col.nombre) + "</h3>" +
        "<button type='button' class='dash-modal-cerrar' onclick=\"document.getElementById('" + idModal + "').style.display='none'\">×</button>" +
      "</div>" +
      "<div class='dash-modal-cuerpo' style='padding: 16px; display: flex; flex-direction: column; gap: 14px;'>" +
        "<p style='margin:0; font-size:12.5px; color:#4a6b66;'>Selecciona la naturaleza de la variable según los requisitos de tu investigación estadística:</p>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Tipo de variable deseado:</label>" +
          "<select id='modal-select-tipo-var' class='dash-select'>" +
            "<option value='Numérica Continua'" + (tipoActual === "Numérica Continua" ? " selected" : "") + ">📊 Numérica Continua (ej. Notas, Horas, Medidas reales)</option>" +
            "<option value='Numérica Discreta'" + (tipoActual === "Numérica Discreta" ? " selected" : "") + ">🔢 Numérica Discreta (ej. Conteos, Años cumplidos, Frecuencias)</option>" +
            "<option value='Categórica Nominal'" + (tipoActual === "Categórica Nominal" ? " selected" : "") + ">🏷️ Categórica Nominal (ej. Nombres, Códigos, Ciudad)</option>" +
            "<option value='Categórica Ordinal'" + (tipoActual === "Categórica Ordinal" ? " selected" : "") + ">📈 Categórica Ordinal (ej. Nivel Socioeconómico, Grados)</option>" +
          "</select>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Nombre de la variable:</label>" +
          "<input type='text' id='modal-input-nombre-var' class='dash-input-num' value='" + escaparHTML(col.nombre) + "'>" +
        "</div>" +
        "<div style='display:flex; justify-content:flex-end; gap:8px; margin-top:8px;'>" +
          "<button type='button' class='dash-btn-outline' onclick=\"document.getElementById('" + idModal + "').style.display='none'\">Cancelar</button>" +
          "<button type='button' class='dash-btn-ejecutar' style='margin:0;' onclick='guardarTipoVariableModal(" + colIndex + ")'>Guardar tipo</button>" +
        "</div>" +
      "</div>" +
    "</div>";

  modal.style.display = "flex";
}

function guardarTipoVariableModal(colIndex) {
  var selTipo = document.getElementById("modal-select-tipo-var").value;
  var inpNombre = document.getElementById("modal-input-nombre-var").value.trim();

  if (inpNombre) {
    cambiarNombreColumna(colIndex, inpNombre);
  }
  cambiarTipoVariable(colIndex, selTipo);

  document.getElementById("dash-modal-tipo-var").style.display = "none";
}
