// Exportación de datos a CSV, Excel y Word (UNA / FIEI)

// Escapa caracteres especiales para CSV
function escaparCSV(str) {
  if (str === null || str === undefined) return "";
  var s = String(str);
  if (s.indexOf(",") !== -1 || s.indexOf("\"") !== -1 || s.indexOf("\n") !== -1 || s.indexOf("\r") !== -1) {
    return "\"" + s.replace(/\"/g, "\"\"") + "\"";
  }
  return s;
}

// Escapa caracteres especiales para XML / HTML
function escaparXML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 1. Exportación estándar a CSV con BOM UTF-8
function exportarCSV() {
  if (!datos || !datos.columnas || datos.columnas.length === 0) {
    if (typeof window.mostrarToast === "function") window.mostrarToast("No hay datos para exportar.", "aviso");
    else alert("No hay datos para exportar.");
    return;
  }

  var lineas = [];

  // Encabezados
  var encabezado = [];
  for (var c = 0; c < datos.columnas.length; c++) {
    encabezado.push(escaparCSV(datos.columnas[c].nombre));
  }
  if (datos.asignaciones && datos.asignaciones.length === datos.filas) {
    encabezado.push(escaparCSV("Cluster"));
  }
  lineas.push(encabezado.join(","));

  // Filas
  for (var f = 0; f < datos.filas; f++) {
    var fila = [];
    for (var c2 = 0; c2 < datos.columnas.length; c2++) {
      var v = datos.columnas[c2].valores[f];
      fila.push(escaparCSV(v));
    }
    if (datos.asignaciones && datos.asignaciones.length === datos.filas) {
      fila.push(escaparCSV((datos.asignaciones[f] !== undefined ? datos.asignaciones[f] + 1 : 1)));
    }
    lineas.push(fila.join(","));
  }

  var contenido = "\uFEFF" + lineas.join("\r\n");
  var blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  descargarBlob(blob, "multistats_datos.csv");

  if (typeof window.mostrarToast === "function") {
    window.mostrarToast("Archivo multistats_datos.csv exportado.", "exito");
  }
}

// 2. Exportación a Excel nativo (Spreadsheet XML 2003 compatible con Excel, LibreOffice y Sheets)
function exportarExcel() {
  if (!datos || !datos.columnas || datos.columnas.length === 0) {
    if (typeof window.mostrarToast === "function") window.mostrarToast("No hay datos para exportar a Excel.", "aviso");
    else alert("No hay datos para exportar a Excel.");
    return;
  }

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\r\n' +
    '<?mso-application progid="Excel.Sheet"?>\r\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\r\n' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office"\r\n' +
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"\r\n' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\r\n' +
    ' xmlns:html="http://www.w3.org/TR/REC-html40">\r\n' +
    '<Styles>\r\n' +
    ' <Style ss:ID="Default" ss:Name="Normal">\r\n' +
    '  <Alignment ss:Vertical="Center"/>\r\n' +
    '  <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#132E2B"/>\r\n' +
    ' </Style>\r\n' +
    ' <Style ss:ID="Header">\r\n' +
    '  <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\r\n' +
    '  <Borders>\r\n' +
    '   <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#004540"/>\r\n' +
    '  </Borders>\r\n' +
    '  <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>\r\n' +
    '  <Interior ss:Color="#005953" ss:Pattern="Solid"/>\r\n' +
    ' </Style>\r\n' +
    ' <Style ss:ID="SubHeader">\r\n' +
    '  <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>\r\n' +
    '  <Font ss:FontName="Calibri" ss:Size="12" ss:Color="#005953" ss:Bold="1"/>\r\n' +
    '  <Interior ss:Color="#E6F7F5" ss:Pattern="Solid"/>\r\n' +
    ' </Style>\r\n' +
    ' <Style ss:ID="FilaPar">\r\n' +
    '  <Interior ss:Color="#F9FDFC" ss:Pattern="Solid"/>\r\n' +
    ' </Style>\r\n' +
    ' <Style ss:ID="Num">\r\n' +
    '  <Alignment ss:Horizontal="Right"/>\r\n' +
    '  <NumberFormat ss:Format="#,##0.00"/>\r\n' +
    ' </Style>\r\n' +
    ' <Style ss:ID="NumPar">\r\n' +
    '  <Alignment ss:Horizontal="Right"/>\r\n' +
    '  <Interior ss:Color="#F9FDFC" ss:Pattern="Solid"/>\r\n' +
    '  <NumberFormat ss:Format="#,##0.00"/>\r\n' +
    ' </Style>\r\n' +
    ' <Style ss:ID="ClusterPill">\r\n' +
    '  <Alignment ss:Horizontal="Center"/>\r\n' +
    '  <Font ss:Bold="1" ss:Color="#005953"/>\r\n' +
    '  <Interior ss:Color="#CCFBF1" ss:Pattern="Solid"/>\r\n' +
    ' </Style>\r\n' +
    '</Styles>\r\n';

  // --- HOJA 1: DATOS ---
  xml += '<Worksheet ss:Name="Datos">\r\n<Table>\r\n';
  xml += '<Row ss:StyleID="Header">\r\n';
  xml += ' <Cell><Data ss:Type="String">#</Data></Cell>\r\n';
  for (var c = 0; c < datos.columnas.length; c++) {
    xml += ' <Cell><Data ss:Type="String">' + escaparXML(datos.columnas[c].nombre) + ' (' + (datos.columnas[c].tipoVariable || datos.columnas[c].tipo) + ')</Data></Cell>\r\n';
  }
  var hayClusters = datos.asignaciones && datos.asignaciones.length === datos.filas;
  if (hayClusters) {
    xml += ' <Cell><Data ss:Type="String">Clúster</Data></Cell>\r\n';
  }
  xml += '</Row>\r\n';

  for (var f = 0; f < datos.filas; f++) {
    var estiloFila = (f % 2 === 1) ? ' ss:StyleID="FilaPar"' : '';
    xml += '<Row' + estiloFila + '>\r\n';
    xml += ' <Cell><Data ss:Type="Number">' + (f + 1) + '</Data></Cell>\r\n';
    for (var c2 = 0; c2 < datos.columnas.length; c2++) {
      var val = datos.columnas[c2].valores[f];
      if (val === null || val === undefined || val === '') {
        xml += ' <Cell><Data ss:Type="String"></Data></Cell>\r\n';
      } else if (typeof val === 'number') {
        var stNum = (f % 2 === 1) ? ' ss:StyleID="NumPar"' : ' ss:StyleID="Num"';
        xml += ' <Cell' + stNum + '><Data ss:Type="Number">' + val + '</Data></Cell>\r\n';
      } else {
        xml += ' <Cell><Data ss:Type="String">' + escaparXML(val) + '</Data></Cell>\r\n';
      }
    }
    if (hayClusters) {
      var clNum = (datos.asignaciones[f] !== undefined ? datos.asignaciones[f] + 1 : 1);
      xml += ' <Cell ss:StyleID="ClusterPill"><Data ss:Type="Number">' + clNum + '</Data></Cell>\r\n';
    }
    xml += '</Row>\r\n';
  }
  xml += '</Table>\r\n</Worksheet>\r\n';

  // --- HOJA 2: FÓRMULAS Y REQUISITOS ---
  xml += '<Worksheet ss:Name="Fórmulas y Requisitos">\r\n<Table>\r\n';
  xml += '<Row ss:StyleID="Header">\r\n';
  xml += ' <Cell><Data ss:Type="String">Paso</Data></Cell>\r\n';
  xml += ' <Cell><Data ss:Type="String">Nombre del requisito / fórmula</Data></Cell>\r\n';
  xml += ' <Cell><Data ss:Type="String">Expresión matemática</Data></Cell>\r\n';
  xml += ' <Cell><Data ss:Type="String">Justificación técnica</Data></Cell>\r\n';
  xml += ' <Cell><Data ss:Type="String">Estado en reporte</Data></Cell>\r\n';
  xml += '</Row>\r\n';

  if (typeof obtenerListaFormulasActivas === "function") {
    var formulas = obtenerListaFormulasActivas();
    for (var i = 0; i < formulas.length; i++) {
      var item = formulas[i];
      xml += '<Row>\r\n';
      xml += ' <Cell><Data ss:Type="Number">' + (i + 1) + '</Data></Cell>\r\n';
      xml += ' <Cell><Data ss:Type="String">' + escaparXML(item.nombre) + '</Data></Cell>\r\n';
      xml += ' <Cell><Data ss:Type="String">' + escaparXML(item.formula) + '</Data></Cell>\r\n';
      xml += ' <Cell><Data ss:Type="String">' + escaparXML(item.justificacion || item.descripcion) + '</Data></Cell>\r\n';
      xml += ' <Cell><Data ss:Type="String">' + (item.activa ? "INCLUIDA" : "EXCLUIDA") + '</Data></Cell>\r\n';
      xml += '</Row>\r\n';
    }
  }

  xml += '</Table>\r\n</Worksheet>\r\n';
  xml += '</Workbook>';

  var blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  descargarBlob(blob, "multistats_analisis_completo.xls");

  if (typeof window.mostrarToast === "function") {
    window.mostrarToast("Libro Excel (.xls) exportado con éxito.", "exito");
  }
}

// 3. Exportación a Word con estilo institucional UNA / FIEI
function exportarWord() {
  if (typeof exportarResolucionWord === "function") {
    exportarResolucionWord();
  } else {
    exportarCSV();
  }
}

// Función auxiliar para descargar blob en navegador
function descargarBlob(blob, nombreArchivo) {
  var urlApi = window.URL || URL;
  var url = urlApi.createObjectURL(blob);
  var enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  urlApi.revokeObjectURL(url);
}
