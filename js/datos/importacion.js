// Importación de archivos CSV, Excel (.xlsx, .xls, .xml) y pegado desde Excel

function avisarDatos(mensaje, tipo) {
  if (typeof window.mostrarToast === "function") window.mostrarToast(mensaje, tipo);
  else console.info(mensaje);
}

function resumenHoja() {
  return datos.filas + (datos.filas === 1 ? " fila" : " filas") + ", " +
    datos.columnas.length + (datos.columnas.length === 1 ? " columna" : " columnas");
}

function refrescarSelectores() {
  if (typeof actualizarTiposColumnas === "function") actualizarTiposColumnas();
  if (typeof actualizarSelectoresVariables === "function") actualizarSelectoresVariables();
  if (typeof actualizarBarraEstado === "function" && typeof seccionVisible === "function") {
    actualizarBarraEstado(seccionVisible());
  }
}

// Punto de entrada universal de importación de archivos (CSV, TXT, XLS, XLSX, XML)
function importarArchivo(archivo) {
  if (!archivo) return;
  var nombre = archivo.name.toLowerCase();

  if (nombre.endsWith(".xlsx")) {
    importarXLSX(archivo);
  } else if (nombre.endsWith(".xls") || nombre.endsWith(".xml")) {
    importarXLS(archivo);
  } else {
    // Por defecto CSV / TSV / TXT
    importarCSV(archivo);
  }
}

// 1. Importación CSV estándar
function importarCSV(archivo) {
  var lector = new FileReader();
  lector.onload = function (evento) {
    var texto = evento.target.result;
    procesarCSV(texto);
  };
  lector.onerror = function () {
    avisarDatos("No se pudo leer el archivo CSV.", "error");
  };
  lector.readAsText(archivo, "UTF-8");
}

// 2. Importación de Excel XML (.xls / .xml)
function importarXLS(archivo) {
  var lector = new FileReader();
  lector.onload = function (evento) {
    var contenido = evento.target.result;
    if (contenido.indexOf("<Workbook") !== -1 || contenido.indexOf("<table") !== -1) {
      procesarExcelXML(contenido);
    } else {
      // Podría ser un CSV con extensión .xls
      procesarCSV(contenido);
    }
  };
  lector.onerror = function () {
    avisarDatos("Error al leer el archivo Excel.", "error");
  };
  lector.readAsText(archivo, "UTF-8");
}

// Parser de Excel XML / HTML Spreadsheet
function procesarExcelXML(xmlTexto) {
  try {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xmlTexto, "text/xml");
    var filasXML = doc.getElementsByTagName("Row");

    if (!filasXML || filasXML.length === 0) {
      // Intentar como HTML table
      var docHTML = parser.parseFromString(xmlTexto, "text/html");
      var trs = docHTML.getElementsByTagName("tr");
      if (trs && trs.length > 0) {
        var matriz = [];
        for (var t = 0; t < trs.length; t++) {
          var celdas = trs[t].querySelectorAll("td, th");
          var filaArr = [];
          for (var c = 0; c < celdas.length; c++) filaArr.push(celdas[c].textContent.trim());
          matriz.push(filaArr);
        }
        cargarMatrizEnDatos(matriz);
        return;
      }
      avisarDatos("Formato de Excel no reconocido.", "error");
      return;
    }

    var matrizDatos = [];
    for (var r = 0; r < filasXML.length; r++) {
      var celdasXML = filasXML[r].getElementsByTagName("Cell");
      var fila = [];
      for (var c2 = 0; c2 < celdasXML.length; c2++) {
        var dataNode = celdasXML[c2].getElementsByTagName("Data")[0];
        fila.push(dataNode ? dataNode.textContent.trim() : "");
      }
      matrizDatos.push(fila);
    }

    cargarMatrizEnDatos(matrizDatos);
  } catch (err) {
    console.error("Error al procesar Excel XML:", err);
    avisarDatos("No se pudo interpretar el archivo Excel.", "error");
  }
}

// 3. Importación nativa de archivos .xlsx (ZIP + XML) en JavaScript moderno
async function importarXLSX(archivo) {
  try {
    var buffer = await archivo.arrayBuffer();
    var bytes = new Uint8Array(buffer);

    // Verificamos firma de ZIP (PK\x03\x04)
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4B || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
      avisarDatos("El archivo no tiene formato válido de Excel (.xlsx).", "error");
      return;
    }

    var archivosZip = await extraerArchivosZip(bytes);
    if (!archivosZip["xl/worksheets/sheet1.xml"]) {
      avisarDatos("No se encontró la hoja principal en el archivo .xlsx.", "error");
      return;
    }

    // Extraemos sharedStrings si existen
    var sharedStrings = [];
    if (archivosZip["xl/sharedStrings.xml"]) {
      var ssXml = new TextDecoder().decode(archivosZip["xl/sharedStrings.xml"]);
      var parserSS = new DOMParser();
      var docSS = parserSS.parseFromString(ssXml, "application/xml");
      var sis = docSS.getElementsByTagName("si");
      for (var s = 0; s < sis.length; s++) {
        var t = sis[s].getElementsByTagName("t")[0];
        sharedStrings.push(t ? t.textContent : "");
      }
    }

    // Extraemos sheet1.xml
    var sheetXml = new TextDecoder().decode(archivosZip["xl/worksheets/sheet1.xml"]);
    var parserSheet = new DOMParser();
    var docSheet = parserSheet.parseFromString(sheetXml, "application/xml");
    var filasXML = docSheet.getElementsByTagName("row");

    var matriz = [];
    for (var r = 0; r < filasXML.length; r++) {
      var celdas = filasXML[r].getElementsByTagName("c");
      var fila = [];
      for (var c = 0; c < celdas.length; c++) {
        var celda = celdas[c];
        var tipo = celda.getAttribute("t");
        var valElem = celda.getElementsByTagName("v")[0];
        var valor = valElem ? valElem.textContent : "";

        if (tipo === "s" && sharedStrings.length > 0) {
          var idxSS = Number(valor);
          valor = sharedStrings[idxSS] !== undefined ? sharedStrings[idxSS] : valor;
        }
        fila.push(valor);
      }
      matriz.push(fila);
    }

    if (matriz.length > 0) {
      cargarMatrizEnDatos(matriz);
    } else {
      avisarDatos("La hoja de Excel está vacía.", "aviso");
    }
  } catch (e) {
    console.warn("Fallo descompresión nativa XLSX, solicitando guardado como CSV o pegar con Ctrl+V:", e);
    avisarDatos("No se pudo descomprimir el archivo XLSX directamente. Puedes guardarlo como CSV o copiar y pegar (Ctrl+V).", "aviso");
  }
}

// Extractor ligero de archivos ZIP en memoria usando DecompressionStream nativo
async function extraerArchivosZip(bytes) {
  var archivos = {};
  var offset = 0;
  var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset + 30 <= bytes.length) {
    var signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) break; // Fin de archivos locales

    var method = view.getUint16(offset + 8, true);
    var compressedSize = view.getUint32(offset + 18, true);
    var uncompressedSize = view.getUint32(offset + 22, true);
    var nameLen = view.getUint16(offset + 26, true);
    var extraLen = view.getUint16(offset + 28, true);

    var nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
    var nombreArchivo = new TextDecoder().decode(nameBytes);
    var dataStart = offset + 30 + nameLen + extraLen;
    var dataEnd = dataStart + compressedSize;

    if (dataEnd <= bytes.length) {
      var sliceData = bytes.subarray(dataStart, dataEnd);
      if (method === 0) {
        // Almacenado sin comprimir
        archivos[nombreArchivo] = sliceData;
      } else if (method === 8 && typeof DecompressionStream !== "undefined") {
        // Deflate comprimido
        try {
          var ds = new DecompressionStream("deflate-raw");
          var writer = ds.writable.getWriter();
          writer.write(sliceData);
          writer.close();
          var chunks = [];
          var reader = ds.readable.getReader();
          while (true) {
            var res = await reader.read();
            if (res.done) break;
            chunks.push(res.value);
          }
          var totalLen = chunks.reduce(function(acc, c) { return acc + c.length; }, 0);
          var uncompressed = new Uint8Array(totalLen);
          var p = 0;
          for (var k = 0; k < chunks.length; k++) {
            uncompressed.set(chunks[k], p);
            p += chunks[k].length;
          }
          archivos[nombreArchivo] = uncompressed;
        } catch (errDec) {
          // Si falla deflate-raw
        }
      }
    }
    offset = dataEnd;
  }
  return archivos;
}

// Carga una matriz 2D (de CSV, Excel o Pegado) directamente en la estructura de datos
function cargarMatrizEnDatos(matriz) {
  if (!matriz || matriz.length === 0) return;

  // Filtrar filas completamente vacías
  var filasValidas = [];
  for (var i = 0; i < matriz.length; i++) {
    var fila = matriz[i];
    var tieneContenido = false;
    for (var c = 0; c < fila.length; c++) {
      if (fila[c] !== null && fila[c] !== undefined && String(fila[c]).trim() !== "") {
        tieneContenido = true;
        break;
      }
    }
    if (tieneContenido) filasValidas.push(fila);
  }

  if (filasValidas.length === 0) {
    avisarDatos("El conjunto de datos no contiene observaciones válidas.", "error");
    return;
  }

  // Detectar encabezado en la primera fila
  var primera = filasValidas[0];
  var esEncabezado = false;
  var numerosEnPrimera = 0;
  for (var j = 0; j < primera.length; j++) {
    var num = Number(primera[j]);
    if (!isNaN(num) && String(primera[j]).trim() !== "") numerosEnPrimera++;
  }
  if (numerosEnPrimera < primera.length && filasValidas.length > 1) {
    esEncabezado = true;
  }

  var nombresColumnas = [];
  var inicioDatos = 0;

  if (esEncabezado) {
    nombresColumnas = primera.map(function(s) { return String(s).trim(); });
    inicioDatos = 1;
  } else {
    for (var k = 0; k < primera.length; k++) {
      nombresColumnas.push("C" + (k + 1));
    }
  }

  var maxCols = nombresColumnas.length;
  for (var m = inicioDatos; m < filasValidas.length; m++) {
    if (filasValidas[m].length > maxCols) maxCols = filasValidas[m].length;
  }
  while (nombresColumnas.length < maxCols) {
    nombresColumnas.push("C" + (nombresColumnas.length + 1));
  }

  var nuevasColumnas = [];
  for (var colIdx = 0; colIdx < maxCols; colIdx++) {
    nuevasColumnas.push({
      nombre: nombresColumnas[colIdx] || ("C" + (colIdx + 1)),
      tipo: "numerica",
      tipoVariable: "Numérica Continua",
      valores: []
    });
  }

  for (var f = inicioDatos; f < filasValidas.length; f++) {
    for (var c2 = 0; c2 < maxCols; c2++) {
      var celda = filasValidas[f][c2];
      if (celda === undefined || celda === null || String(celda).trim() === "") {
        nuevasColumnas[c2].valores.push(null);
      } else {
        var strVal = String(celda).trim();
        var numVal = Number(strVal);
        if (!isNaN(numVal) && strVal !== "") {
          nuevasColumnas[c2].valores.push(numVal);
        } else {
          nuevasColumnas[c2].valores.push(strVal);
        }
      }
    }
  }

  reemplazarDatos(nuevasColumnas);
  actualizarTiposColumnas();
  refrescarSelectores();
  avisarDatos("Datos importados con éxito (" + resumenHoja() + ")", "exito");
}

// Procesa texto CSV
function procesarCSV(texto) {
  var delimitador = ",";
  var primeraLinea = texto.split(/\r?\n/)[0];
  if (primeraLinea.indexOf(";") !== -1 && primeraLinea.indexOf(",") === -1) {
    delimitador = ";";
  } else if (primeraLinea.indexOf("\t") !== -1) {
    delimitador = "\t";
  }

  var lineas = texto.split(/\r?\n/);
  var filas = [];
  for (var i = 0; i < lineas.length; i++) {
    var linea = lineas[i].trim();
    if (linea === "") continue;
    filas.push(linea.split(delimitador));
  }
  cargarMatrizEnDatos(filas);
}

// Pegado desde el portapapeles (Excel, Sheets o tablas)
function pegarDesdeTexto(texto) {
  var lineas = texto.split(/\r?\n/);
  var filas = [];
  for (var i = 0; i < lineas.length; i++) {
    var linea = lineas[i];
    if (linea.trim() === "") continue;
    filas.push(linea.split("\t"));
  }
  cargarMatrizEnDatos(filas);
}
