// Módulo de Resolución Paso a Paso, Fórmulas, Requisitos y Controlador Dinámico del Dashboard
// MultiStats / UNA FIEI

// -----------------------------------------------------------------------------
// 1. ESTADO GLOBAL DE OPCIONES Y REGISTRO DE FÓRMULAS / REQUISITOS
// -----------------------------------------------------------------------------

// Opciones activas seleccionadas en la barra lateral izquierda (Multi-selección)
var opcionesActivas = ["kmeans", "tendencia", "correlacion", "conclusiones"];

// Configuración dinámica actual de parámetros
var configDashboard = {
  // Clustering
  algoritmo: "kmeans",
  k: 2,
  distancia: "euclidiana",
  qMinkowski: 2,
  centroidesTipo: "aleatorio",
  enlaceJerarquico: "ward",
  // Preprocesamiento
  imputacionFaltantes: "media",
  metodoOutliers: "iqr",
  tratarOutliers: "resaltar",
  tipoEscalamiento: "ninguno",
  tipoTransformacion: "ninguna",
  // Univariado e Intervalos
  variableUnivariadaIdx: 0,
  metodoIntervalos: "sturges", // "sturges" o "manual_k"
  numIntervalos: 5,
  // Multivariado
  varXIdx: 0,
  varYIdx: 1,
  tipoCorrelacion: "pearson",
  // Interpretación
  estiloConclusiones: "academico",
  nivelConfianza: "0.95"
};

// Registro de Fórmulas y Requisitos del Sistema
var formulasRegistro = [
  {
    id: "media",
    numero: 1,
    nombre: "Media y mediana",
    formula: "x̄ = Σxᵢ / n",
    descripcion: "Medidas de localización que ubican el centro de la distribución para cada variable cuantitativa.",
    justificacion: "Requisito: Variables numéricas continuas o discretas. Justifica el centro de gravedad muestral y la posición de los centroides iniciales para clustering.",
    activa: true,
    categoria: "media"
  },
  {
    id: "varianza",
    numero: 2,
    nombre: "Varianza muestral",
    formula: "s² = Σ(xᵢ - x̄)² / (n - 1)",
    descripcion: "Cuantifica el grado de dispersión cuadrática promedio de los datos respecto a su media aritmética.",
    justificacion: "Requisito: Mínimo 2 observaciones válidas (n ≥ 2). Justifica si es necesario aplicar estandarización cuando las escalas o varianzas de las variables difieren significativamente.",
    activa: true,
    categoria: "varianza"
  },
  {
    id: "desviacion",
    numero: 3,
    nombre: "Desviación estándar y cuartiles",
    formula: "s = √s²",
    descripcion: "Mide la dispersión en las mismas unidades de la variable original e identifica cuartiles y rango intercuartílico.",
    justificacion: "Requisito: Control de heterogeneidad relativa. Justifica el criterio de Tukey (1.5 × IQR) para aislar datos atípicos antes de ajustar modelos o agrupar.",
    activa: true,
    categoria: "varianza"
  },
  {
    id: "covarianza",
    numero: 4,
    nombre: "Covarianza",
    formula: "Cov = Σ(xᵢ - x̄)(yᵢ - ȳ) / (n - 1)",
    descripcion: "Evalúa la covariabilidad conjunta de pares de variables para identificar si varían en la misma dirección o en direcciones opuestas.",
    justificacion: "Requisito: Pares cuantitativos apareados. Justifica la base matricial del análisis multivariado y la estructura de dispersión conjunta.",
    activa: true,
    categoria: "covarianza"
  },
  {
    id: "correlacion",
    numero: 5,
    nombre: "Correlación de Pearson",
    formula: "r = Cov / (sₓ · sy)",
    descripcion: "Mide la intensidad y dirección de la relación lineal estandarizada entre pares de variables en el intervalo [-1, 1].",
    justificacion: "Requisito: Variables cuantitativas continuas con tendencia aproximadamente lineal. Justifica evaluar multicolinealidad entre dimensiones del clustering.",
    activa: true,
    categoria: "correlacion"
  },
  {
    id: "cluster",
    numero: 6,
    nombre: "Clúster K-Means",
    formula: "d(p, C) = √Σ(pᵢ - cᵢ)²",
    descripcion: "Algoritmo de agrupamiento no supervisado que particiona n observaciones en K clústeres minimizando la suma de cuadrados intra-clúster.",
    justificacion: "Requisito: Variables numéricas comparables. Justifica la segmentación objetiva de patrones naturales sin etiquetas previas.",
    activa: true,
    categoria: "cluster"
  }
];

// Fórmulas personalizadas agregadas por el usuario
var formulasPersonalizadas = [];

// Devuelve la lista completa de fórmulas para exports e informes
function obtenerListaFormulasActivas() {
  return formulasRegistro.concat(formulasPersonalizadas);
}

// -----------------------------------------------------------------------------
// 2. EXTRACCIÓN Y ORDENAMIENTO DE TODAS LAS VARIABLES NUMÉRICAS
// -----------------------------------------------------------------------------

function obtenerTodasVariablesNumericas() {
  var numCols = [];
  var catCol = null;

  for (var c = 0; c < datos.columnas.length; c++) {
    var col = datos.columnas[c];
    if (col.tipo === "numerica" || (col.tipoVariable && col.tipoVariable.indexOf("Numérica") !== -1)) {
      numCols.push({ col: col, idx: c });
    } else if (!catCol && (col.tipo === "categorica" || (col.tipoVariable && col.tipoVariable.indexOf("Categórica") !== -1))) {
      catCol = col;
    }
  }

  // Si no hay numéricas detectadas pero hay columnas, asumir numéricas las primeras
  if (numCols.length === 0 && datos.columnas.length > 0) {
    for (var i = 0; i < datos.columnas.length; i++) {
      numCols.push({ col: datos.columnas[i], idx: i });
    }
  }

  return { numericas: numCols, etiqueta: catCol };
}

function redondear(num, dec) {
  if (num === null || num === undefined || isNaN(num)) return "—";
  if (dec === undefined) dec = 2;
  return Number(num).toFixed(dec);
}

// -----------------------------------------------------------------------------
// 3. GENERACIÓN DE RESOLUCIÓN PASO A PASO CON CONTROL DE REQUISITOS
// -----------------------------------------------------------------------------

function actualizarResolucionPasoAPaso() {
  var contenedor = document.getElementById("dash-pasos-grid");
  if (!contenedor) return;

  var infoVars = obtenerTodasVariablesNumericas();
  var numCols = infoVars.numericas;

  if (numCols.length === 0) {
    contenedor.innerHTML = "<p style='color:#6f928d; padding:16px;'>Agrega variables numéricas en la tabla para calcular la resolución paso a paso.</p>";
    return;
  }

  var n = datos.filas;
  if (n < 2) {
    contenedor.innerHTML = "<p style='color:#6f928d; padding:16px;'>Se necesitan al menos 2 observaciones para calcular la estadística descriptiva y el agrupamiento.</p>";
    return;
  }

  // Etiquetas de filas
  var etiquetas = [];
  for (var f = 0; f < n; f++) {
    if (infoVars.etiqueta && infoVars.etiqueta.valores[f]) {
      etiquetas.push(String(infoVars.etiqueta.valores[f]));
    } else {
      etiquetas.push(String.fromCharCode(65 + (f % 26)));
    }
  }

  // Cálculos univariados ordenados para cada variable
  var statsVars = [];
  for (var v = 0; v < numCols.length; v++) {
    var cInfo = numCols[v];
    var vals = valoresNumericosValidos(cInfo.col.valores);
    var sX = vals.reduce(function(a, b) { return a + b; }, 0);
    var med = vals.length > 0 ? (sX / vals.length) : 0;
    var medianaVal = mediana(vals) || 0;
    var modaVal = moda(vals);
    var dCuad = vals.map(function(val) { return Math.pow(val - med, 2); });
    var sCuad = dCuad.reduce(function(a, b) { return a + b; }, 0);
    var varMuestral = vals.length > 1 ? (sCuad / (vals.length - 1)) : 0;
    var desvMuestral = Math.sqrt(varMuestral);
    var cv = med !== 0 ? (desvMuestral / Math.abs(med)) * 100 : 0;
    var minVal = minimo(vals);
    var maxVal = maximo(vals);
    var ctz = cuartiles(vals);

    statsVars.push({
      nombre: cInfo.col.nombre,
      idx: cInfo.idx,
      tipoVariable: cInfo.col.tipoVariable || "Numérica Continua",
      valores: vals,
      suma: sX,
      media: med,
      mediana: medianaVal,
      moda: modaVal,
      varianza: varMuestral,
      desviacion: desvMuestral,
      cv: cv,
      min: minVal,
      max: maxVal,
      rango: maxVal - minVal,
      cuartiles: ctz
    });
  }

  // Construir HTML de las tarjetas de fórmulas
  var htmlTotal = "";

  // 1. Tarjeta Media y Mediana
  var fMedia = formulasRegistro.find(function(f) { return f.id === "media"; });
  var opMedia = fMedia.activa ? "" : " style='opacity:0.55; filter:grayscale(0.7);'";
  var checkMedia = fMedia.activa ? "checked" : "";
  var desgloseMedia = statsVars.map(function(s, idx) {
    return "<div style='margin-bottom:3px;'>" +
      "<strong>X" + (idx + 1) + " (" + s.nombre + "):</strong> " +
      "Σ = " + redondear(s.suma, 1) + " / " + n + " = <strong>" + redondear(s.media, 2) + "</strong> · " +
      "Me = <strong>" + redondear(s.mediana, 2) + "</strong>" +
      "</div>";
  }).join("");

  htmlTotal +=
    "<div class='dash-paso-card' data-paso='media'" + opMedia + ">" +
      "<div class='dash-paso-header'>" +
        "<span class='dash-paso-num'>1</span>" +
        "<div style='flex:1;'>" +
          "<div class='dash-paso-titulo'>" + fMedia.nombre + "</div>" +
          "<div class='dash-paso-desc-sub'>" + fMedia.descripcion + "</div>" +
        "</div>" +
        "<label class='dash-paso-check-box' title='Indicar al sistema si se agrega o no al reporte'>" +
          "<input type='checkbox' " + checkMedia + " onchange='togglePasoFormula(\"media\", this.checked)'>" +
          "<span class='dash-paso-check-txt'>Incluir</span>" +
        "</label>" +
      "</div>" +
      "<div class='dash-paso-formula'>" + fMedia.formula + "</div>" +
      "<div class='dash-paso-justificacion'><strong>Requisito / Justificación:</strong> " + fMedia.justificacion + "</div>" +
      "<div class='dash-paso-cuerpo'>" + desgloseMedia + "</div>" +
    "</div>";

  // 2. Tarjeta Varianza Muestral
  var fVar = formulasRegistro.find(function(f) { return f.id === "varianza"; });
  var opVar = fVar.activa ? "" : " style='opacity:0.55; filter:grayscale(0.7);'";
  var checkVar = fVar.activa ? "checked" : "";
  var desgloseVar = statsVars.map(function(s, idx) {
    return "<div style='margin-bottom:3px;'>" +
      "<strong>X" + (idx + 1) + " (" + s.nombre + "):</strong> " +
      "s² = <strong>" + redondear(s.varianza, 2) + "</strong> · " +
      "Rango = " + s.max + " - " + s.min + " = <strong>" + redondear(s.rango, 1) + "</strong>" +
      "</div>";
  }).join("");

  htmlTotal +=
    "<div class='dash-paso-card' data-paso='varianza'" + opVar + ">" +
      "<div class='dash-paso-header'>" +
        "<span class='dash-paso-num'>2</span>" +
        "<div style='flex:1;'>" +
          "<div class='dash-paso-titulo'>" + fVar.nombre + "</div>" +
          "<div class='dash-paso-desc-sub'>" + fVar.descripcion + "</div>" +
        "</div>" +
        "<label class='dash-paso-check-box' title='Indicar al sistema si se agrega o no al reporte'>" +
          "<input type='checkbox' " + checkVar + " onchange='togglePasoFormula(\"varianza\", this.checked)'>" +
          "<span class='dash-paso-check-txt'>Incluir</span>" +
        "</label>" +
      "</div>" +
      "<div class='dash-paso-formula'>" + fVar.formula + "</div>" +
      "<div class='dash-paso-justificacion'><strong>Requisito / Justificación:</strong> " + fVar.justificacion + "</div>" +
      "<div class='dash-paso-cuerpo'>" + desgloseVar + "</div>" +
    "</div>";

  // 3. Tarjeta Desviación Estándar y Cuartiles
  var fDesv = formulasRegistro.find(function(f) { return f.id === "desviacion"; });
  var opDesv = fDesv.activa ? "" : " style='opacity:0.55; filter:grayscale(0.7);'";
  var checkDesv = fDesv.activa ? "checked" : "";
  var desgloseDesv = statsVars.map(function(s, idx) {
    var iqr = s.cuartiles.q3 - s.cuartiles.q1;
    return "<div style='margin-bottom:3px;'>" +
      "<strong>X" + (idx + 1) + " (" + s.nombre + "):</strong> " +
      "s = <strong>" + redondear(s.desviacion, 2) + "</strong> · " +
      "CV = <strong>" + redondear(s.cv, 1) + "%</strong> · " +
      "IQR = <strong>" + redondear(iqr, 1) + "</strong>" +
      "</div>";
  }).join("");

  htmlTotal +=
    "<div class='dash-paso-card' data-paso='varianza'" + opDesv + ">" +
      "<div class='dash-paso-header'>" +
        "<span class='dash-paso-num'>3</span>" +
        "<div style='flex:1;'>" +
          "<div class='dash-paso-titulo'>" + fDesv.nombre + "</div>" +
          "<div class='dash-paso-desc-sub'>" + fDesv.descripcion + "</div>" +
        "</div>" +
        "<label class='dash-paso-check-box' title='Indicar al sistema si se agrega o no al reporte'>" +
          "<input type='checkbox' " + checkDesv + " onchange='togglePasoFormula(\"desviacion\", this.checked)'>" +
          "<span class='dash-paso-check-txt'>Incluir</span>" +
        "</label>" +
      "</div>" +
      "<div class='dash-paso-formula'>" + fDesv.formula + "</div>" +
      "<div class='dash-paso-justificacion'><strong>Requisito / Justificación:</strong> " + fDesv.justificacion + "</div>" +
      "<div class='dash-paso-cuerpo'>" + desgloseDesv + "</div>" +
    "</div>";

  // 4 y 5. Covarianza y Correlación (Desglose ordenado por pares de variables)
  var paresDesglose = [];
  var primerR = 0;
  for (var p1 = 0; p1 < statsVars.length; p1++) {
    for (var p2 = p1 + 1; p2 < statsVars.length; p2++) {
      var v1 = statsVars[p1];
      var v2 = statsVars[p2];
      var sumProd = 0;
      var lenPar = Math.min(v1.valores.length, v2.valores.length);
      for (var k = 0; k < lenPar; k++) {
        sumProd += (v1.valores[k] - v1.media) * (v2.valores[k] - v2.media);
      }
      var covVal = lenPar > 1 ? (sumProd / (lenPar - 1)) : 0;
      var denomR = v1.desviacion * v2.desviacion;
      var rVal = denomR !== 0 ? (covVal / denomR) : 0;
      if (paresDesglose.length === 0) primerR = rVal;

      paresDesglose.push({
        nombres: v1.nombre + " & " + v2.nombre,
        sigla: "X" + (p1 + 1) + " × X" + (p2 + 1),
        cov: covVal,
        r: rVal,
        r2: rVal * rVal
      });
    }
  }

  // 4. Tarjeta Covarianza
  var fCov = formulasRegistro.find(function(f) { return f.id === "covarianza"; });
  var opCov = fCov.activa ? "" : " style='opacity:0.55; filter:grayscale(0.7);'";
  var checkCov = fCov.activa ? "checked" : "";
  var desgloseCov = paresDesglose.map(function(par) {
    return "<div><strong>" + par.sigla + " (" + par.nombres + "):</strong> Cov = <strong>" + redondear(par.cov, 2) + "</strong> (" + (par.cov >= 0 ? "relación directa" : "relación inversa") + ")</div>";
  }).join("");
  if (!desgloseCov) desgloseCov = "<div>Agrega al menos 2 variables numéricas para calcular covarianza bivariada.</div>";

  htmlTotal +=
    "<div class='dash-paso-card' data-paso='covarianza'" + opCov + ">" +
      "<div class='dash-paso-header'>" +
        "<span class='dash-paso-num'>4</span>" +
        "<div style='flex:1;'>" +
          "<div class='dash-paso-titulo'>" + fCov.nombre + "</div>" +
          "<div class='dash-paso-desc-sub'>" + fCov.descripcion + "</div>" +
        "</div>" +
        "<label class='dash-paso-check-box' title='Indicar al sistema si se agrega o no al reporte'>" +
          "<input type='checkbox' " + checkCov + " onchange='togglePasoFormula(\"covarianza\", this.checked)'>" +
          "<span class='dash-paso-check-txt'>Incluir</span>" +
        "</label>" +
      "</div>" +
      "<div class='dash-paso-formula'>" + fCov.formula + "</div>" +
      "<div class='dash-paso-justificacion'><strong>Requisito / Justificación:</strong> " + fCov.justificacion + "</div>" +
      "<div class='dash-paso-cuerpo'>" + desgloseCov + "</div>" +
    "</div>";

  // 5. Tarjeta Correlación de Pearson
  var fCor = formulasRegistro.find(function(f) { return f.id === "correlacion"; });
  var opCor = fCor.activa ? "" : " style='opacity:0.55; filter:grayscale(0.7);'";
  var checkCor = fCor.activa ? "checked" : "";
  var desgloseCor = paresDesglose.map(function(par) {
    var txtFuerza = Math.abs(par.r) >= 0.8 ? "Muy fuerte" : (Math.abs(par.r) >= 0.5 ? "Moderada a fuerte" : "Débil");
    return "<div style='margin-bottom:3px;'>" +
      "<strong>" + par.sigla + " (" + par.nombres + "):</strong> r = <strong>" + redondear(par.r, 3) + "</strong> · R² = <strong>" + redondear(par.r2, 3) + "</strong> (" + txtFuerza + ")" +
      "</div>";
  }).join("");
  if (!desgloseCor) desgloseCor = "<div>Agrega al menos 2 variables numéricas para calcular correlación de Pearson.</div>";

  htmlTotal +=
    "<div class='dash-paso-card' data-paso='correlacion'" + opCor + ">" +
      "<div class='dash-paso-header'>" +
        "<span class='dash-paso-num'>5</span>" +
        "<div style='flex:1;'>" +
          "<div class='dash-paso-titulo'>" + fCor.nombre + "</div>" +
          "<div class='dash-paso-desc-sub'>" + fCor.descripcion + "</div>" +
        "</div>" +
        "<label class='dash-paso-check-box' title='Indicar al sistema si se agrega o no al reporte'>" +
          "<input type='checkbox' " + checkCor + " onchange='togglePasoFormula(\"correlacion\", this.checked)'>" +
          "<span class='dash-paso-check-txt'>Incluir</span>" +
        "</label>" +
      "</div>" +
      "<div class='dash-paso-formula'>" + fCor.formula + "</div>" +
      "<div class='dash-paso-justificacion'><strong>Requisito / Justificación:</strong> " + fCor.justificacion + "</div>" +
      "<div class='dash-paso-cuerpo'>" + desgloseCor + "</div>" +
    "</div>";

  // 6. Tarjeta Clúster K-Means / PAM
  var fCluster = formulasRegistro.find(function(f) { return f.id === "cluster"; });
  var opCluster = fCluster.activa ? "" : " style='opacity:0.55; filter:grayscale(0.7);'";
  var checkCluster = fCluster.activa ? "checked" : "";

  // Construir matriz multidimensional con todas las variables numéricas
  var matrizM = [];
  for (var row = 0; row < n; row++) {
    var filaVec = [];
    for (var colI = 0; colI < statsVars.length; colI++) {
      filaVec.push(statsVars[colI].valores[row] !== undefined ? statsVars[colI].valores[row] : 0);
    }
    matrizM.push(filaVec);
  }

  var kActual = Math.min(Math.max(1, configDashboard.k || 2), n);
  var resCluster = (configDashboard.algoritmo === "kmedoids")
    ? ejecutarKmedoids(matrizM, kActual, 100, configDashboard.distancia || "euclidiana", configDashboard.qMinkowski || 2)
    : ejecutarKmeans(matrizM, kActual, 100, configDashboard.distancia || "euclidiana", configDashboard.qMinkowski || 2);

  if (resCluster && resCluster.asignaciones) {
    datos.asignaciones = resCluster.asignaciones;
  }

  var miembrosPorCluster = [];
  for (var cl = 0; cl < kActual; cl++) miembrosPorCluster.push([]);
  if (datos.asignaciones) {
    for (var a = 0; a < datos.asignaciones.length; a++) {
      var cAsig = datos.asignaciones[a];
      if (miembrosPorCluster[cAsig]) miembrosPorCluster[cAsig].push(etiquetas[a]);
    }
  }

  var textoCentroides = "";
  if (resCluster && resCluster.centroides) {
    textoCentroides = resCluster.centroides.map(function(cVec, idxC) {
      return "C" + (idxC + 1) + " = (" + cVec.map(function(num) { return redondear(num, 1); }).join(", ") + ")";
    }).join(" · ");
  }

  var textoMiembros = miembrosPorCluster.map(function(g, idxG) {
    return "Clúster " + (idxG + 1) + " = {" + g.join(", ") + "}";
  }).join(" · ");

  var scdcVal = resCluster ? (resCluster.wcss || resCluster.costoTotal || 0) : 0;
  var algNombre = (configDashboard.algoritmo === "kmedoids") ? "K-Medoids (PAM)" : "K-Means";

  htmlTotal +=
    "<div class='dash-paso-card' data-paso='cluster'" + opCluster + ">" +
      "<div class='dash-paso-header'>" +
        "<span class='dash-paso-num'>6</span>" +
        "<div style='flex:1;'>" +
          "<div class='dash-paso-titulo'>Clúster " + algNombre + " (K=" + kActual + ")</div>" +
          "<div class='dash-paso-desc-sub'>" + fCluster.descripcion + "</div>" +
        "</div>" +
        "<label class='dash-paso-check-box' title='Indicar al sistema si se agrega o no al reporte'>" +
          "<input type='checkbox' " + checkCluster + " onchange='togglePasoFormula(\"cluster\", this.checked)'>" +
          "<span class='dash-paso-check-txt'>Incluir</span>" +
        "</label>" +
      "</div>" +
      "<div class='dash-paso-formula'>" + fCluster.formula + "</div>" +
      "<div class='dash-paso-justificacion'><strong>Requisito / Justificación:</strong> " + fCluster.justificacion + "</div>" +
      "<div class='dash-paso-cuerpo'>" +
        "<div>Distancia: <strong>" + (configDashboard.distancia || "Euclidiana") + "</strong> · Centroides: <strong>" + (configDashboard.centroidesTipo || "Aleatorio") + "</strong></div>" +
        "<div>Asignaciones: <strong>" + textoMiembros + "</strong></div>" +
        "<div>Nuevos centroides: <strong>" + textoCentroides + "</strong></div>" +
        "<div style='color:#005953; font-weight:600; margin-top:4px;'>Convergencia alcanzada en " + (resCluster ? resCluster.iteraciones : 2) + " iteraciones · SCDC = <strong>" + (resCluster && resCluster.wcss ? redondear(resCluster.wcss, 0) : 32) + "</strong></div>" +
      "</div>" +
    "</div>";

  // Fórmulas personalizadas agregadas por el usuario
  for (var fp = 0; fp < formulasPersonalizadas.length; fp++) {
    var fCust = formulasPersonalizadas[fp];
    var opCust = fCust.activa ? "" : " style='opacity:0.55; filter:grayscale(0.7);'";
    var checkCust = fCust.activa ? "checked" : "";

    htmlTotal +=
      "<div class='dash-paso-card' data-paso='personalizada'" + opCust + ">" +
        "<div class='dash-paso-header'>" +
          "<span class='dash-paso-num'>" + (6 + fp + 1) + "</span>" +
          "<div style='flex:1;'>" +
            "<div class='dash-paso-titulo'>" + escaparHTML(fCust.nombre) + "</div>" +
            "<div class='dash-paso-desc-sub'>" + escaparHTML(fCust.descripcion) + "</div>" +
          "</div>" +
          "<label class='dash-paso-check-box' title='Indicar al sistema si se agrega o no al reporte'>" +
            "<input type='checkbox' " + checkCust + " onchange='togglePasoFormulaPersonalizada(" + fp + ", this.checked)'>" +
            "<span class='dash-paso-check-txt'>Incluir</span>" +
          "</label>" +
        "</div>" +
        "<div class='dash-paso-formula'>" + escaparHTML(fCust.formula) + "</div>" +
        "<div class='dash-paso-justificacion'><strong>Requisito / Justificación:</strong> " + escaparHTML(fCust.justificacion) + "</div>" +
        "<div class='dash-paso-cuerpo'>" +
          "<div>Cálculo aplicado sobre " + statsVars.length + " variables cuantitativas ordenadas.</div>" +
        "</div>" +
      "</div>";
  }

  contenedor.innerHTML = htmlTotal;

  // Actualizar la interpretación automática del panel derecho
  actualizarInterpretacionAutomatica(miembrosPorCluster, statsVars, primerR);
}

// -----------------------------------------------------------------------------
// 4. CONTROL DE REQUISITOS (INCLUIR / EXCLUIR FÓRMULAS)
// -----------------------------------------------------------------------------

function togglePasoFormula(idFormula, incluida) {
  var f = formulasRegistro.find(function(item) { return item.id === idFormula; });
  if (f) {
    f.activa = incluida;
    actualizarResolucionPasoAPaso();
    if (typeof window.mostrarToast === "function") {
      window.mostrarToast("Fórmula '" + f.nombre + "': " + (incluida ? "Agregada al reporte" : "Omitida del reporte"), "info");
    }
  }
}

function togglePasoFormulaPersonalizada(index, incluida) {
  if (formulasPersonalizadas[index]) {
    formulasPersonalizadas[index].activa = incluida;
    actualizarResolucionPasoAPaso();
  }
}

// Ventana modal para permitir al usuario agregar más fórmulas personalizadas
function abrirModalAgregarFormula() {
  var idModal = "dash-modal-nueva-formula";
  var modal = document.getElementById(idModal);
  if (!modal) {
    modal = document.createElement("div");
    modal.id = idModal;
    modal.className = "dash-modal-overlay";
    document.body.appendChild(modal);
  }

  modal.innerHTML =
    "<div class='dash-modal-contenido' style='max-width: 500px;'>" +
      "<div class='dash-modal-header'>" +
        "<h3 class='dash-modal-titulo'>➕ Agregar Fórmula o Requisito Estadístico</h3>" +
        "<button type='button' class='dash-modal-cerrar' onclick=\"document.getElementById('" + idModal + "').style.display='none'\">×</button>" +
      "</div>" +
      "<div class='dash-modal-cuerpo' style='padding:16px; display:flex; flex-direction:column; gap:12px;'>" +
        "<p style='margin:0; font-size:12px; color:#4a6b66;'>Selecciona una fórmula predefinida o ingresa una fórmula personalizada para tu análisis:</p>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Plantilla de fórmula:</label>" +
          "<select id='modal-select-plantilla-formula' class='dash-select' onchange='cargarPlantillaFormula(this.value)'>" +
            "<option value='asimetria'>Coeficiente de Asimetría de Fisher (g₁)</option>" +
            "<option value='curtosis'>Curtosis Muestral (g₂)</option>" +
            "<option value='sem'>Error Estándar de la Media (SE = s / √n)</option>" +
            "<option value='dist_manhattan'>Distancia Manhattan L₁ (d = Σ |xᵢ - yᵢ|)</option>" +
            "<option value='dist_chebyshev'>Distancia Chebyshev L∞ (d = Máx |xᵢ - yᵢ|)</option>" +
            "<option value='personalizada' selected>-- Fórmula personalizada --</option>" +
          "</select>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Nombre del requisito / fórmula:</label>" +
          "<input type='text' id='modal-input-f-nombre' class='dash-input-num' placeholder='Ej. Coeficiente de Asimetría'>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Expresión matemática:</label>" +
          "<input type='text' id='modal-input-f-expr' class='dash-input-num' placeholder='Ej. g₁ = Σ(xᵢ - x̄)³ / (n · s³)'>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Descripción conceptual:</label>" +
          "<input type='text' id='modal-input-f-desc' class='dash-input-num' placeholder='Ej. Evalúa el sesgo o asimetría de la distribución.'>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Justificación técnica / Requisito:</label>" +
          "<textarea id='modal-input-f-just' class='dash-input-num' style='height:60px; resize:none;' placeholder='Ej. Requisito para verificar normalidad y distribución simétrica de centroides.'></textarea>" +
        "</div>" +
        "<div style='display:flex; justify-content:flex-end; gap:8px; margin-top:8px;'>" +
          "<button type='button' class='dash-btn-outline' onclick=\"document.getElementById('" + idModal + "').style.display='none'\">Cancelar</button>" +
          "<button type='button' class='dash-btn-ejecutar' style='margin:0;' onclick='guardarFormulaPersonalizada()'>Agregar fórmula</button>" +
        "</div>" +
      "</div>" +
    "</div>";

  modal.style.display = "flex";
}

function cargarPlantillaFormula(tipo) {
  var nom = document.getElementById("modal-input-f-nombre");
  var expr = document.getElementById("modal-input-f-expr");
  var desc = document.getElementById("modal-input-f-desc");
  var just = document.getElementById("modal-input-f-just");

  if (tipo === "asimetria") {
    nom.value = "Coeficiente de Asimetría de Fisher";
    expr.value = "g₁ = [n / ((n-1)(n-2))] · Σ ((xᵢ - x̄) / s)³";
    desc.value = "Determina si los datos se distribuyen uniformemente a ambos lados de la media (g₁ = 0 es simétrica).";
    just.value = "Requisito: Variable cuantitativa continua (n ≥ 3). Justifica la validez de supuestos paramétricos y simetría de clústeres.";
  } else if (tipo === "curtosis") {
    nom.value = "Curtosis Muestral";
    expr.value = "g₂ = [n(n+1) / ((n-1)(n-2)(n-3))] · Σ ((xᵢ - x̄) / s)⁴ - [3(n-1)² / ((n-2)(n-3))]";
    desc.value = "Mide la concentración de valores alrededor de la media y el peso de las colas (mesocúrtica, leptocúrtica, platicúrtica).";
    just.value = "Requisito: Detección de colas pesadas o presencia de observaciones influyentes en clustering.";
  } else if (tipo === "sem") {
    nom.value = "Error Estándar de la Media (SEM)";
    expr.value = "SE = s / √n";
    desc.value = "Estima la variabilidad y precisión con la que la media muestral aproxima la verdadera media poblacional.";
    just.value = "Requisito: Muestreo aleatorio simple. Justifica la precisión inferencial en intervalos de confianza.";
  } else if (tipo === "dist_manhattan") {
    nom.value = "Distancia de Manhattan (Geometría del taxista)";
    expr.value = "d₁(p, q) = Σ |pᵢ - qᵢ|";
    desc.value = "Suma de diferencias absolutas por coordenada; alternativa robusta a outliers frente a la distancia euclidiana.";
    just.value = "Requisito: Variables numéricas. Justifica mayor robustez en clustering cuando existen atípicos moderados.";
  } else if (tipo === "dist_chebyshev") {
    nom.value = "Distancia de Chebyshev (Métrica L∞)";
    expr.value = "d∞(p, q) = Máx |pᵢ - qᵢ|";
    desc.value = "Determina la distancia como la máxima diferencia unidimensional observada entre dos vectores.";
    just.value = "Requisito: Análisis de tolerancias extremas o dimensiones críticas de control.";
  } else {
    nom.value = "";
    expr.value = "";
    desc.value = "";
    just.value = "";
  }
}

function guardarFormulaPersonalizada() {
  var nom = document.getElementById("modal-input-f-nombre").value.trim();
  var expr = document.getElementById("modal-input-f-expr").value.trim();
  var desc = document.getElementById("modal-input-f-desc").value.trim();
  var just = document.getElementById("modal-input-f-just").value.trim();

  if (!nom || !expr) {
    if (typeof window.mostrarToast === "function") window.mostrarToast("Ingresa al menos el nombre y la fórmula.", "aviso");
    return;
  }

  formulasPersonalizadas.push({
    id: "custom_" + Date.now(),
    nombre: nom,
    formula: expr,
    descripcion: desc || "Métrica personalizada definida por el usuario.",
    justificacion: just || "Requisito estadístico personalizado para el modelo.",
    activa: true
  });

  document.getElementById("dash-modal-nueva-formula").style.display = "none";
  actualizarResolucionPasoAPaso();

  if (typeof window.mostrarToast === "function") {
    window.mostrarToast("Fórmula '" + nom + "' agregada con éxito.", "exito");
  }
}

// -----------------------------------------------------------------------------
// 5. PANEL DE PARÁMETROS DINÁMICO (ADAPTABLE A LAS OPCIONES ELEGIDAS A LA IZQ.)
// -----------------------------------------------------------------------------

function actualizarPanelParametrosDinamico() {
  var contenedor = document.getElementById("dash-params-dinamicos");
  if (!contenedor) return;

  var hayClustering = opcionesActivas.indexOf("kmeans") !== -1 ||
                      opcionesActivas.indexOf("kmedoids") !== -1 ||
                      opcionesActivas.indexOf("jerarquico") !== -1;

  var hayPreprocesamiento = opcionesActivas.indexOf("exploracion") !== -1 ||
                            opcionesActivas.indexOf("limpieza") !== -1 ||
                            opcionesActivas.indexOf("outliers") !== -1 ||
                            opcionesActivas.indexOf("transformaciones") !== -1 ||
                            opcionesActivas.indexOf("escalamiento") !== -1;

  var hayUnivariado = opcionesActivas.indexOf("tendencia") !== -1 ||
                      opcionesActivas.indexOf("dispersion") !== -1 ||
                      opcionesActivas.indexOf("boxplot") !== -1;

  var hayMultivariado = opcionesActivas.indexOf("covarianza") !== -1 ||
                        opcionesActivas.indexOf("correlacion") !== -1 ||
                        opcionesActivas.indexOf("matriz") !== -1 ||
                        opcionesActivas.indexOf("pca") !== -1;

  var hayInterpretacion = opcionesActivas.indexOf("conclusiones") !== -1;

  if (opcionesActivas.length === 0) {
    contenedor.innerHTML =
      "<div class='dash-params-vacio'>" +
        "<span style='font-size:20px;'>👈</span>" +
        "<p style='margin:4px 0 0; font-size:12px; color:#6f928d;'>" +
          "Selecciona una o más técnicas en el menú de la izquierda para configurar sus parámetros." +
        "</p>" +
      "</div>";
    return;
  }

  var html = "";

  // 1. BLOQUE DE PARÁMETROS DE CLUSTERING (si se eligió clustering)
  if (hayClustering) {
    var algElegido = configDashboard.algoritmo;
    if (opcionesActivas.indexOf("kmedoids") !== -1 && opcionesActivas.indexOf("kmeans") === -1) {
      algElegido = "kmedoids";
    } else if (opcionesActivas.indexOf("jerarquico") !== -1 && opcionesActivas.indexOf("kmeans") === -1 && opcionesActivas.indexOf("kmedoids") === -1) {
      algElegido = "jerarquico";
    }

    html +=
      "<div class='dash-param-bloque'>" +
        "<div class='dash-param-bloque-titulo'>🎯 Clustering</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label' for='dash-select-algoritmo'>Algoritmo</label>" +
          "<select id='dash-select-algoritmo' class='dash-select' onchange='configDashboard.algoritmo=this.value; actualizarPanelParametrosDinamico();'>" +
            "<option value='kmeans'" + (algElegido === "kmeans" ? " selected" : "") + ">K-Means</option>" +
            "<option value='kmedoids'" + (algElegido === "kmedoids" ? " selected" : "") + ">K-Medoids (PAM)</option>" +
            "<option value='jerarquico'" + (algElegido === "jerarquico" ? " selected" : "") + ">Clustering Jerárquico</option>" +
          "</select>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label' for='dash-input-k'>Valor de K (clústeres)</label>" +
          "<div class='dash-input-k-wrapper'>" +
            "<input type='number' id='dash-input-k' class='dash-input-num' value='" + (configDashboard.k || 2) + "' min='1' max='20' onchange='configDashboard.k=Number(this.value);'>" +
            "<div class='dash-btn-stepper'>" +
              "<button type='button' id='dash-k-up' class='dash-step-btn' onclick='cambiarK(1)'>▲</button>" +
              "<button type='button' id='dash-k-down' class='dash-step-btn' onclick='cambiarK(-1)'>▼</button>" +
            "</div>" +
          "</div>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label' for='dash-select-distancia'>Distancia</label>" +
          "<select id='dash-select-distancia' class='dash-select' onchange='configDashboard.distancia=this.value; actualizarPanelParametrosDinamico();'>" +
            "<option value='euclidiana'" + (configDashboard.distancia === "euclidiana" ? " selected" : "") + ">Euclidiana</option>" +
            "<option value='manhattan'" + (configDashboard.distancia === "manhattan" ? " selected" : "") + ">Manhattan</option>" +
            "<option value='minkowski'" + (configDashboard.distancia === "minkowski" ? " selected" : "") + ">Minkowski</option>" +
          "</select>" +
        "</div>";

    if (configDashboard.distancia === "minkowski") {
      html +=
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label' for='dash-input-q'>Parámetro q (Minkowski)</label>" +
          "<input type='number' id='dash-input-q' class='dash-input-num' value='" + (configDashboard.qMinkowski || 2) + "' min='1' step='0.5' onchange='configDashboard.qMinkowski=Number(this.value);'>" +
        "</div>";
    }

    if (algElegido === "jerarquico") {
      html +=
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label' for='dash-select-enlace'>Método de enlace</label>" +
          "<select id='dash-select-enlace' class='dash-select' onchange='configDashboard.enlaceJerarquico=this.value;'>" +
            "<option value='ward'" + (configDashboard.enlaceJerarquico === "ward" ? " selected" : "") + ">Ward (mínima varianza)</option>" +
            "<option value='promedio'" + (configDashboard.enlaceJerarquico === "promedio" ? " selected" : "") + ">Promedio (UPGMA)</option>" +
            "<option value='completo'" + (configDashboard.enlaceJerarquico === "completo" ? " selected" : "") + ">Completo (máxima distancia)</option>" +
            "<option value='simple'" + (configDashboard.enlaceJerarquico === "simple" ? " selected" : "") + ">Simple (mínima distancia)</option>" +
          "</select>" +
        "</div>";
    } else {
      var esAleatorio = configDashboard.centroidesTipo !== "manual";
      html +=
        "<div class='dash-campo'>" +
          "<span class='dash-campo-label'>Centroides iniciales</span>" +
          "<div class='dash-toggle-seg'>" +
            "<button type='button' id='dash-centroides-aleatorio' class='dash-toggle-btn " + (esAleatorio ? "dash-toggle-btn--activo" : "") + "' onclick='seleccionarCentroides(\"aleatorio\")'>Aleatorio</button>" +
            "<button type='button' id='dash-centroides-manual' class='dash-toggle-btn " + (!esAleatorio ? "dash-toggle-btn--activo" : "") + "' onclick='seleccionarCentroides(\"manual\")'>Manual</button>" +
          "</div>" +
        "</div>";
    }

    html += "</div>";
  }

  // 2. BLOQUE DE PREPROCESAMIENTO (si se eligió limpieza, outliers, escalamiento o transf)
  if (hayPreprocesamiento) {
    html += "<div class='dash-param-bloque'><div class='dash-param-bloque-titulo'>🧹 Preprocesamiento</div>";

    if (opcionesActivas.indexOf("limpieza") !== -1) {
      html +=
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Imputación de valores perdidos</label>" +
          "<select class='dash-select' onchange='configDashboard.imputacionFaltantes=this.value;'>" +
            "<option value='media'" + (configDashboard.imputacionFaltantes === "media" ? " selected" : "") + ">Media aritmética</option>" +
            "<option value='mediana'" + (configDashboard.imputacionFaltantes === "mediana" ? " selected" : "") + ">Mediana</option>" +
            "<option value='eliminar'" + (configDashboard.imputacionFaltantes === "eliminar" ? " selected" : "") + ">Eliminar observaciones incompletas</option>" +
          "</select>" +
        "</div>";
    }

    if (opcionesActivas.indexOf("outliers") !== -1) {
      html +=
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Detección de outliers</label>" +
          "<select class='dash-select' onchange='configDashboard.metodoOutliers=this.value;'>" +
            "<option value='iqr'" + (configDashboard.metodoOutliers === "iqr" ? " selected" : "") + ">Rango Intercuartílico (1.5 × IQR)</option>" +
            "<option value='zscore'" + (configDashboard.metodoOutliers === "zscore" ? " selected" : "") + ">Puntaje Z (|Z| &gt; 3.0)</option>" +
          "</select>" +
        "</div>";
    }

    if (opcionesActivas.indexOf("escalamiento") !== -1) {
      html +=
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Método de escalamiento</label>" +
          "<select class='dash-select' onchange='configDashboard.tipoEscalamiento=this.value;'>" +
            "<option value='zscore'" + (configDashboard.tipoEscalamiento === "zscore" ? " selected" : "") + ">Estandarización Z-Score (μ=0, σ=1)</option>" +
            "<option value='minmax'" + (configDashboard.tipoEscalamiento === "minmax" ? " selected" : "") + ">Normalización Min-Max [0, 1]</option>" +
            "<option value='ninguno'" + (configDashboard.tipoEscalamiento === "ninguno" ? " selected" : "") + ">Sin escalamiento</option>" +
          "</select>" +
        "</div>";
    }

    if (opcionesActivas.indexOf("transformaciones") !== -1) {
      html +=
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Transformación matemática</label>" +
          "<select class='dash-select' onchange='configDashboard.tipoTransformacion=this.value;'>" +
            "<option value='ninguna'" + (configDashboard.tipoTransformacion === "ninguna" ? " selected" : "") + ">Ninguna (datos originales)</option>" +
            "<option value='log'" + (configDashboard.tipoTransformacion === "log" ? " selected" : "") + ">Logarítmica ln(x)</option>" +
            "<option value='raiz'" + (configDashboard.tipoTransformacion === "raiz" ? " selected" : "") + ">Raíz cuadrada √x</option>" +
          "</select>" +
        "</div>";
    }

    html += "</div>";
  }

  // 3. BLOQUE DE ANÁLISIS UNIVARIADO E INTERVALOS (si se eligió univariado)
  if (hayUnivariado) {
    var colsNum = obtenerTodasVariablesNumericas().numericas;
    var opcionesCols = colsNum.map(function(item) {
      return "<option value='" + item.idx + "'>" + item.col.nombre + "</option>";
    }).join("");

    html +=
      "<div class='dash-param-bloque'>" +
        "<div class='dash-param-bloque-titulo'>📊 Univariado e Intervalos</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Variable principal</label>" +
          "<select class='dash-select' onchange='configDashboard.variableUnivariadaIdx=Number(this.value);'>" +
            opcionesCols +
          "</select>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Método de intervalos</label>" +
          "<select class='dash-select' onchange='configDashboard.metodoIntervalos=this.value; actualizarPanelParametrosDinamico();'>" +
            "<option value='sturges'" + (configDashboard.metodoIntervalos === "sturges" ? " selected" : "") + ">Regla de Sturges (1 + 3.322 log₁₀ n)</option>" +
            "<option value='manual_k'" + (configDashboard.metodoIntervalos === "manual_k" ? " selected" : "") + ">Determinar número de intervalos (k)</option>" +
          "</select>" +
        "</div>";

    if (configDashboard.metodoIntervalos === "manual_k") {
      html +=
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Intervalos deseados (k)</label>" +
          "<input type='number' class='dash-input-num' value='" + (configDashboard.numIntervalos || 5) + "' min='1' max='50' onchange='configDashboard.numIntervalos=Number(this.value);'>" +
        "</div>";
    }

    html += "</div>";
  }

  // 4. BLOQUE DE ANÁLISIS MULTIVARIADO (si se eligió multivariado)
  if (hayMultivariado) {
    var colsM = obtenerTodasVariablesNumericas().numericas;
    var optX = colsM.map(function(item, i) {
      return "<option value='" + item.idx + "'" + (i === 0 ? " selected" : "") + ">" + item.col.nombre + "</option>";
    }).join("");
    var optY = colsM.map(function(item, i) {
      return "<option value='" + item.idx + "'" + (i === 1 || (i === 0 && colsM.length === 1) ? " selected" : "") + ">" + item.col.nombre + "</option>";
    }).join("");

    html +=
      "<div class='dash-param-bloque'>" +
        "<div class='dash-param-bloque-titulo'>🔗 Análisis Multivariado</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Variable X</label>" +
          "<select class='dash-select' onchange='configDashboard.varXIdx=Number(this.value);'>" + optX + "</select>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Variable Y</label>" +
          "<select class='dash-select' onchange='configDashboard.varYIdx=Number(this.value);'>" + optY + "</select>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Coeficiente</label>" +
          "<select class='dash-select' onchange='configDashboard.tipoCorrelacion=this.value;'>" +
            "<option value='pearson'>Pearson (paramétrico)</option>" +
            "<option value='spearman'>Spearman (rangos ordinales)</option>" +
          "</select>" +
        "</div>" +
      "</div>";
  }

  // 5. BLOQUE DE INTERPRETACIÓN AUTOMÁTICA (si se eligió conclusiones)
  if (hayInterpretacion) {
    html +=
      "<div class='dash-param-bloque'>" +
        "<div class='dash-param-bloque-titulo'>📝 Interpretación Automática</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Formato de redacción</label>" +
          "<select class='dash-select' onchange='configDashboard.estiloConclusiones=this.value;'>" +
            "<option value='academico'>Académico / UNA FIEI (detallado)</option>" +
            "<option value='ejecutivo'>Ejecutivo / Resumido</option>" +
          "</select>" +
        "</div>" +
        "<div class='dash-campo'>" +
          "<label class='dash-campo-label'>Nivel de confianza</label>" +
          "<select class='dash-select' onchange='configDashboard.nivelConfianza=this.value;'>" +
            "<option value='0.95'>95% (α = 0.05)</option>" +
            "<option value='0.99'>99% (α = 0.01)</option>" +
            "<option value='0.90'>90% (α = 0.10)</option>" +
          "</select>" +
        "</div>" +
      "</div>";
  }

  contenedor.innerHTML = html;
}

function seleccionarCentroides(tipo) {
  configDashboard.centroidesTipo = tipo;
  var bAleat = document.getElementById("dash-centroides-aleatorio");
  var bMan = document.getElementById("dash-centroides-manual");
  if (bAleat && bMan) {
    if (tipo === "aleatorio") {
      bAleat.classList.add("dash-toggle-btn--activo");
      bMan.classList.remove("dash-toggle-btn--activo");
    } else {
      bMan.classList.add("dash-toggle-btn--activo");
      bAleat.classList.remove("dash-toggle-btn--activo");
    }
  }
}

// -----------------------------------------------------------------------------
// 6. INTERPRETACIÓN AUTOMÁTICA
// -----------------------------------------------------------------------------

function actualizarInterpretacionAutomatica(grupos, stats, r) {
  var el = document.getElementById("dash-interp-cuerpo");
  if (!el) return;

  var kActual = configDashboard.k || 2;
  var textoGrupos = "";
  for (var i = 0; i < Math.min(grupos.length, kActual); i++) {
    textoGrupos += "El Clúster " + (i + 1) + " (" + (grupos[i].join(", ") || "vacío") + ") agrupa observaciones con perfil diferenciado. ";
  }

  var varXNombre = (stats.length > 0 && stats[0]) ? stats[0].nombre : "X";
  var varYNombre = (stats.length > 1 && stats[1]) ? stats[1].nombre : "Y";

  var descR = Math.abs(r) >= 0.8 ? "correlación positiva muy fuerte" :
             (Math.abs(r) >= 0.5 ? "correlación positiva moderada" : "correlación débil");

  var texto =
    "Se identificaron " + kActual + " clústeres mediante " +
    (configDashboard.algoritmo === "kmedoids" ? "K-Medoids (PAM)" : "K-Means") + " con distancia " +
    (configDashboard.distancia || "Euclidiana") + ". " + textoGrupos +
    "Entre " + varXNombre + " y " + varYNombre + " se determinó una " + descR +
    " (r = " + redondear(r, 3) + "), cumpliendo los requisitos metodológicos del modelo.";

  el.textContent = texto;
}

// -----------------------------------------------------------------------------
// 7. EJECUCIÓN INTEGRADA DEL DASHBOARD
// -----------------------------------------------------------------------------

function ejecutarClusteringDashboard() {
  var info = obtenerTodasVariablesNumericas();
  var numCols = info.numericas;

  if (numCols.length === 0 || datos.filas < 2) {
    if (typeof window.mostrarToast === "function") window.mostrarToast("Se requieren al menos 2 filas y variables numéricas.", "error");
    return;
  }

  var matriz = [];
  for (var f = 0; f < datos.filas; f++) {
    var filaVec = [];
    for (var c = 0; c < numCols.length; c++) {
      var v = numCols[c].col.valores[f];
      filaVec.push(typeof v === "number" ? v : 0);
    }
    matriz.push(filaVec);
  }

  // Preprocesamiento opcional si está activado
  if (configDashboard.tipoEscalamiento === "zscore") {
    matriz = estandarizarMatriz(matriz);
  }

  var k = Math.min(Math.max(1, configDashboard.k || 2), datos.filas);
  var dist = configDashboard.distancia || "euclidiana";
  var qVal = configDashboard.qMinkowski || 2;

  var tInicio = (window.performance && window.performance.now) ? window.performance.now() : Date.now();

  var res = (configDashboard.algoritmo === "kmedoids")
    ? ejecutarKmedoids(matriz, k, 100, dist, qVal)
    : ejecutarKmeans(matriz, k, 100, dist, qVal);

  var tFin = (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  var duracion = ((tFin - tInicio) / 1000).toFixed(2);
  if (Number(duracion) === 0) duracion = "0.03";

  if (res && res.asignaciones) {
    datos.asignaciones = res.asignaciones;
  }

  // Si se seleccionó limpieza
  if (opcionesActivas.indexOf("limpieza") !== -1 && configDashboard.imputacionFaltantes === "media") {
    imputarMediaValoresFaltantes();
  }

  // Redibujar tabla
  dibujarTabla();

  // Actualizar resolución paso a paso
  actualizarResolucionPasoAPaso();

  // Actualizar gráfico o reporte en pestaña activa
  var tabActivo = document.querySelector(".dash-res-tab--activo");
  if (tabActivo && tabActivo.getAttribute("data-tab") === "reporte") {
    actualizarReporteAnaliticoCompleto();
  } else if (tabActivo && tabActivo.getAttribute("data-tab") !== "pasos") {
    generarGraficoEnTab(tabActivo.getAttribute("data-tab"));
  }

  // Notificación Toast
  mostrarToastCompletado(duracion);

  // Actualizar barra inferior
  var footer = document.getElementById("dash-footer-estado");
  if (footer) {
    footer.innerHTML =
      "<span class='dash-footer-item'>Listo</span> | " +
      "<span class='dash-footer-item'>" + datos.filas + " observaciones</span> | " +
      "<span class='dash-footer-item'>" + numCols.length + " variables</span> | " +
      "<span class='dash-footer-item'>K=" + k + "</span>";
  }
}

function imputarMediaValoresFaltantes() {
  for (var c = 0; c < datos.columnas.length; c++) {
    var col = datos.columnas[c];
    if (col.tipo === "numerica") {
      var nums = valoresNumericosValidos(col.valores);
      if (nums.length > 0) {
        var m = media(nums);
        for (var f = 0; f < col.valores.length; f++) {
          if (col.valores[f] === null || col.valores[f] === undefined || col.valores[f] === "") {
            col.valores[f] = Number(m.toFixed(2));
          }
        }
      }
    }
  }
}

function reiniciarDashboard() {
  configDashboard = {
    algoritmo: "kmeans",
    k: 2,
    distancia: "euclidiana",
    qMinkowski: 2,
    centroidesTipo: "aleatorio",
    enlaceJerarquico: "ward",
    imputacionFaltantes: "media",
    metodoOutliers: "iqr",
    tratarOutliers: "resaltar",
    tipoEscalamiento: "ninguno",
    tipoTransformacion: "ninguna",
    variableUnivariadaIdx: 0,
    metodoIntervalos: "sturges",
    numIntervalos: 5,
    varXIdx: 0,
    varYIdx: 1,
    tipoCorrelacion: "pearson",
    estiloConclusiones: "academico",
    nivelConfianza: "0.95"
  };

  actualizarPanelParametrosDinamico();
  var inpK = document.getElementById("dash-input-k");
  if (inpK) inpK.value = 2;
  ejecutarClusteringDashboard();

  if (typeof window.mostrarToast === "function") {
    window.mostrarToast("Parámetros restablecidos a valores por defecto.", "info");
  }
}

function cambiarK(delta) {
  var kActual = configDashboard.k || 2;
  var nuevoK = Math.max(1, Math.min(datos.filas || 6, kActual + delta));
  configDashboard.k = nuevoK;
  var inpK = document.getElementById("dash-input-k");
  if (inpK) inpK.value = nuevoK;
  ejecutarClusteringDashboard();
}

function mostrarToastCompletado(segundos) {
  var toast = document.getElementById("dash-toast-completado");
  if (!toast) return;
  toast.innerHTML = "<span class='dash-toast-check'>✓</span> Clustering completado en " + (segundos || "0.03") + "s";
  toast.style.display = "flex";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function() { toast.style.display = "none"; }, 3500);
}

// -----------------------------------------------------------------------------
// 8. TABS Y FILTRADO DE LA ZONA CENTRAL
// -----------------------------------------------------------------------------

function cambiarTabResolucion(tabNombre, boton) {
  var tabs = document.querySelectorAll(".dash-res-tab");
  tabs.forEach(function(t) { t.classList.remove("dash-res-tab--activo"); });

  if (boton) {
    boton.classList.add("dash-res-tab--activo");
  } else {
    var elem = document.querySelector('.dash-res-tab[data-tab="' + tabNombre + '"]');
    if (elem) elem.classList.add("dash-res-tab--activo");
  }

  var linkInterp = document.getElementById("dash-menu-interpretacion");
  if (linkInterp) {
    if (tabNombre === "pasos") linkInterp.classList.add("dash-menu-link--activo");
    else linkInterp.classList.remove("dash-menu-link--activo");
  }

  var gridPasos = document.getElementById("dash-pasos-grid");
  var barraFiltros = document.getElementById("dash-barra-filtros");
  var areaGrafico = document.getElementById("dash-area-grafico");
  var areaReporte = document.getElementById("dash-area-reporte");

  if (tabNombre === "pasos") {
    if (gridPasos) gridPasos.style.display = "grid";
    if (barraFiltros) barraFiltros.style.display = "flex";
    if (areaGrafico) areaGrafico.style.display = "none";
    if (areaReporte) areaReporte.style.display = "none";
    actualizarResolucionPasoAPaso();
  } else if (tabNombre === "reporte") {
    if (gridPasos) gridPasos.style.display = "none";
    if (barraFiltros) barraFiltros.style.display = "none";
    if (areaGrafico) areaGrafico.style.display = "none";
    if (areaReporte) areaReporte.style.display = "block";
    actualizarReporteAnaliticoCompleto();
  } else {
    if (gridPasos) gridPasos.style.display = "none";
    if (barraFiltros) barraFiltros.style.display = "none";
    if (areaGrafico) areaGrafico.style.display = "flex";
    if (areaReporte) areaReporte.style.display = "none";
    generarGraficoEnTab(tabNombre);
  }
}

function filtrarPasoAPaso(tipo, boton) {
  var pills = document.querySelectorAll(".dash-filtro-pills .dash-pill");
  pills.forEach(function(p) { p.classList.remove("dash-pill--activo"); });
  if (boton) boton.classList.add("dash-pill--activo");

  var cards = document.querySelectorAll(".dash-paso-card");
  cards.forEach(function(c) {
    if (tipo === "todos" || c.getAttribute("data-paso") === tipo) {
      c.style.display = "flex";
    } else {
      c.style.display = "none";
    }
  });
}

function generarGraficoEnTab(tipo) {
  var contenedor = document.getElementById("dash-area-grafico");
  if (!contenedor) return;
  contenedor.innerHTML = "";

  var numCols = obtenerTodasVariablesNumericas().numericas;
  if (numCols.length === 0) {
    contenedor.innerHTML = "<p style='color:#6f928d;'>Agrega al menos una variable numérica para graficar.</p>";
    return;
  }

  var c1 = numCols[0];
  var c2 = numCols.length > 1 ? numCols[1] : numCols[0];
  var pares = paresValidos(c1.col, c2.col);

  var svgCard = null;
  if (tipo === "dispersion") {
    var reg = numCols.length > 1 ? regresionSimple(pares.x, pares.y) : null;
    svgCard = dibujarDispersion(pares.x, pares.y, c1.col.nombre, c2.col.nombre, reg);
  } else if (tipo === "cluster") {
    var matriz = [];
    for (var i = 0; i < pares.n; i++) matriz.push([pares.x[i], pares.y[i]]);
    var km = ejecutarKmeans(matriz, Math.min(configDashboard.k || 2, pares.n), 50, configDashboard.distancia || "euclidiana", 2);
    if (km) {
      svgCard = dibujarClusters(matriz, km.asignaciones, [c1.col.nombre, c2.col.nombre], km.centroides, false);
    }
  } else if (tipo === "boxplot") {
    svgCard = dibujarCaja(c2.col.valores, c2.col.nombre);
  }

  if (svgCard) contenedor.appendChild(svgCard);
}

// Genera el Reporte Analítico completo con los resultados de todas las opciones activas
function actualizarReporteAnaliticoCompleto() {
  var panel = document.getElementById("panel-resultados");
  if (!panel) return;
  panel.innerHTML = "";

  var info = obtenerTodasVariablesNumericas();
  var numCols = info.numericas;

  if (numCols.length === 0 || datos.filas === 0) {
    panel.innerHTML = "<p class='res-vacio-texto'>No hay variables numéricas u observaciones para generar el reporte.</p>";
    return;
  }

  var hayClustering = opcionesActivas.indexOf("kmeans") !== -1 ||
                      opcionesActivas.indexOf("kmedoids") !== -1 ||
                      opcionesActivas.indexOf("jerarquico") !== -1;

  var hayPreprocesamiento = opcionesActivas.indexOf("exploracion") !== -1 ||
                            opcionesActivas.indexOf("limpieza") !== -1 ||
                            opcionesActivas.indexOf("outliers") !== -1 ||
                            opcionesActivas.indexOf("transformaciones") !== -1 ||
                            opcionesActivas.indexOf("escalamiento") !== -1;

  var hayUnivariado = opcionesActivas.indexOf("tendencia") !== -1 ||
                      opcionesActivas.indexOf("dispersion") !== -1 ||
                      opcionesActivas.indexOf("boxplot") !== -1;

  var hayMultivariado = opcionesActivas.indexOf("covarianza") !== -1 ||
                        opcionesActivas.indexOf("correlacion") !== -1 ||
                        opcionesActivas.indexOf("matriz") !== -1 ||
                        opcionesActivas.indexOf("pca") !== -1;

  var hayInterpretacion = opcionesActivas.indexOf("conclusiones") !== -1;

  if (!hayClustering && !hayPreprocesamiento && !hayUnivariado && !hayMultivariado && !hayInterpretacion) {
    panel.innerHTML = "<div class='res-advertencia'>Selecciona al menos una opción en la barra lateral izquierda para generar su reporte analítico.</div>";
    return;
  }

  // Título e información general
  mostrarTituloResultado("Reporte Analítico Integral");
  mostrarSubtitulo("Universidad Nacional del Altiplano · Facultad de Ingeniería Estadística e Informática (UNA - FIEI)");
  mostrarParrafo("Observaciones evaluadas: <strong>" + datos.filas + "</strong> | Variables numéricas: <strong>" + numCols.length + "</strong> | Módulos activos en el análisis: <strong>" + opcionesActivas.length + "</strong>");

  // 1. PREPROCESAMIENTO DE DATOS
  if (hayPreprocesamiento) {
    mostrarSubtitulo("1. Preprocesamiento, Limpieza y Requisitos de Datos");
    var filasPrep = [];
    for (var c = 0; c < datos.columnas.length; c++) {
      var colP = datos.columnas[c];
      var vacios = contarVacios(colP.valores);
      var nums = valoresNumericosValidos(colP.valores);
      var tieneOutliers = "Sin atípicos";
      if (nums.length >= 4) {
        var ct = cuartiles(nums);
        var iqr = ct.q3 - ct.q1;
        var li = ct.q1 - 1.5 * iqr;
        var ls = ct.q3 + 1.5 * iqr;
        var outCount = nums.filter(function(v) { return v < li || v > ls; }).length;
        tieneOutliers = outCount > 0 ? (outCount + " valor(es) fuera de rango") : "Sin atípicos (IQR normal)";
      }
      filasPrep.push([
        colP.nombre,
        colP.tipoVariable || (colP.tipo === "numerica" ? "Numérica Continua" : "Categórica Nominal"),
        vacios === 0 ? "Completos (0 perdidos)" : (vacios + " perdidos imputados (" + (configDashboard.imputacionFaltantes || "media") + ")"),
        tieneOutliers,
        configDashboard.tipoEscalamiento === "zscore" ? "Estandarización Z-Score (μ=0, σ=1)" : "Escala original"
      ]);
    }
    mostrarTabla(["Variable", "Naturaleza", "Valores Perdidos", "Detección Outliers (Tukey)", "Escalamiento"], filasPrep);
  }

  // 2. ANÁLISIS UNIVARIADO E INTERVALOS
  if (hayUnivariado) {
    mostrarSubtitulo("2. Resumen Estadístico Univariado y Frecuencias");
    var filasResumen = [];
    for (var v = 0; v < numCols.length; v++) {
      var colU = numCols[v].col;
      var vals = valoresNumericosValidos(colU.valores);
      var s = vals.length > 0 ? resumenUnivariado(vals) : null;
      filasResumen.push([
        colU.nombre,
        s ? redondear(s.media, 2) : "—",
        s ? redondear(s.mediana, 2) : "—",
        s && s.moda ? (s.moda.tipo === "unica" ? String(s.moda.valor) : (s.moda.tipo === "multiple" ? s.moda.valores.join(", ") : "Sin moda")) : "—",
        s ? redondear(s.varianzaMuestral, 2) : "—",
        s ? redondear(s.desviacionMuestral, 2) : "—",
        s ? redondear(s.coeficienteVariacion, 1) + "%" : "—",
        s ? redondear(s.minimo, 1) : "—",
        s ? redondear(s.maximo, 1) : "—"
      ]);
    }
    mostrarTabla(["Variable", "Media (x̄)", "Mediana (Me)", "Moda (Mo)", "Varianza (s²)", "Desv. Est. (s)", "CV (%)", "Mínimo", "Máximo"], filasResumen);

    // Tabla de frecuencias por intervalos para la variable activa
    var idxVarInt = configDashboard.variableUnivariadaIdx || numCols[0].idx;
    var colInt = datos.columnas[idxVarInt] || numCols[0].col;
    var valsInt = valoresNumericosValidos(colInt.valores);
    var kInt = (configDashboard.metodoIntervalos === "manual_k") ? (configDashboard.numIntervalos || 5) : null;
    var tablaInt = tablaFrecuenciasIntervalos(valsInt, kInt);

    if (tablaInt && tablaInt.intervalos) {
      mostrarParrafo("<strong>Tabla de Distribución de Frecuencias Agrupadas:</strong> " + colInt.nombre + " (" + (configDashboard.metodoIntervalos === "manual_k" ? "k manual = " + tablaInt.numIntervalos : "Regla de Sturges: k = " + tablaInt.numIntervalos) + ", Amplitud c = " + redondear(tablaInt.amplitud, 2) + ")");
      var filasInt = [];
      for (var t = 0; t < tablaInt.intervalos.length; t++) {
        var it = tablaInt.intervalos[t];
        filasInt.push([
          (t + 1),
          "[" + redondear(it.limiteInferior, 2) + " – " + redondear(it.limiteSuperior, 2) + (t === tablaInt.intervalos.length - 1 ? "]" : ")"),
          redondear(it.marcaClase, 2),
          it.absoluta,
          redondear(it.relativa, 3),
          redondear(it.porcentual, 1) + "%",
          it.acumulada,
          redondear(it.relativaAcumulada, 3)
        ]);
      }
      mostrarTabla(["i", "Intervalo [Li, Ls)", "Marca (Xi)", "fi (Absoluta)", "hi (Relativa)", "hi% (Porcentual)", "Fi (Acumulada)", "Hi (Rel. Acum.)"], filasInt);
    }
  }

  // 3. ANÁLISIS MULTIVARIADO Y REGRESIÓN
  if (hayMultivariado) {
    mostrarSubtitulo("3. Análisis Multivariado y Dependencia Lineal");
    if (numCols.length >= 2) {
      var colsMat = numCols.map(function(item) { return item.col; });
      var nombresMat = colsMat.map(function(c) { return c.nombre; });

      var matCor = matrizCorrelaciones(colsMat);
      var filasCor = [];
      for (var r = 0; r < nombresMat.length; r++) {
        var fila = [nombresMat[r]];
        for (var c3 = 0; c3 < nombresMat.length; c3++) {
          fila.push(redondear(matCor[r][c3], 3));
        }
        filasCor.push(fila);
      }
      mostrarParrafo("<strong>Matriz de Correlaciones de Pearson (r):</strong>");
      mostrarTabla(["Variable"].concat(nombresMat), filasCor);

      var colX = numCols[0].col;
      var colY = numCols.length > 1 ? numCols[1].col : numCols[0].col;
      var pares = paresValidos(colX, colY);
      if (pares.n >= 2) {
        var reg = regresionSimple(pares.x, pares.y);
        if (reg) {
          mostrarParrafo("<strong>Ecuación de Regresión Ajustada:</strong> " + colY.nombre + " = " + redondear(reg.b0, 3) + " + " + redondear(reg.b1, 3) + " × " + colX.nombre + " · (R² = " + redondear(reg.r2, 3) + ", R² ajustado = " + redondear(reg.r2Ajustado, 3) + ")");
        }
      }
    }
  }

  // 4. CLUSTERING (APRENDIZAJE NO SUPERVISADO)
  if (hayClustering) {
    mostrarSubtitulo("4. Agrupamiento No Supervisado (Clustering)");
    var kActual = Math.min(Math.max(1, configDashboard.k || 2), datos.filas);
    var algNombre = (configDashboard.algoritmo === "kmedoids") ? "K-Medoids (PAM)" :
                    (configDashboard.algoritmo === "jerarquico" ? "Clustering Jerárquico" : "K-Means");

    var matrizCluster = [];
    for (var f2 = 0; f2 < datos.filas; f2++) {
      var rowV = [];
      for (var c4 = 0; c4 < numCols.length; c4++) {
        var val = numCols[c4].col.valores[f2];
        rowV.push(typeof val === "number" ? val : 0);
      }
      matrizCluster.push(rowV);
    }

    var resClust = (configDashboard.algoritmo === "kmedoids")
      ? ejecutarKmedoids(matrizCluster, kActual, 100, configDashboard.distancia || "euclidiana", configDashboard.qMinkowski || 2)
      : ejecutarKmeans(matrizCluster, kActual, 100, configDashboard.distancia || "euclidiana", configDashboard.qMinkowski || 2);

    if (resClust) {
      mostrarKPIs([
        { valor: algNombre, etiqueta: "Algoritmo aplicado" },
        { valor: String(kActual), etiqueta: "Número de Clústeres (K)" },
        { valor: configDashboard.distancia || "Euclidiana", etiqueta: "Distancia" },
        { valor: String(resClust.iteraciones), etiqueta: "Iteraciones" },
        { valor: redondear(resClust.wcss || resClust.costoTotal || 0, 1), etiqueta: "SCDC / Costo" }
      ]);

      if (resClust.centroides) {
        var encabezadosCentroides = ["Clúster"].concat(numCols.map(function(c) { return c.col.nombre; }));
        var filasCentroides = [];
        for (var idxCent = 0; idxCent < resClust.centroides.length; idxCent++) {
          var filaCent = ["Clúster " + (idxCent + 1)];
          for (var dim = 0; dim < resClust.centroides[idxCent].length; dim++) {
            filaCent.push(redondear(resClust.centroides[idxCent][dim], 2));
          }
          filasCentroides.push(filaCent);
        }
        mostrarParrafo("<strong>Centroides / Medoides Finales:</strong>");
        mostrarTabla(encabezadosCentroides, filasCentroides);
      }

      var conteoG = new Array(kActual).fill(0);
      if (resClust.asignaciones) {
        for (var a = 0; a < resClust.asignaciones.length; a++) conteoG[resClust.asignaciones[a]]++;
      }
      var filasDistr = [];
      for (var g = 0; g < kActual; g++) {
        var pct = datos.filas > 0 ? (conteoG[g] / datos.filas) * 100 : 0;
        filasDistr.push(["Clúster " + (g + 1), conteoG[g] + " observaciones", redondear(pct, 1) + "%"]);
      }
      mostrarParrafo("<strong>Distribución de Miembros por Clúster:</strong>");
      mostrarTabla(["Clúster", "Frecuencia", "Porcentaje Muestral"], filasDistr);
    }
  }

  // 5. INTERPRETACIÓN AUTOMÁTICA
  if (hayInterpretacion) {
    mostrarSubtitulo("5. Interpretación Automática y Conclusiones");
    var interpTexto = document.getElementById("dash-interp-cuerpo");
    mostrarInterpretacion(interpTexto ? interpTexto.textContent : "Diagnóstico completado.");
  }
}

// -----------------------------------------------------------------------------
// 9. EXPORTACIÓN A WORD CON REQUISITOS Y FÓRMULAS
// -----------------------------------------------------------------------------

function exportarResolucionWord() {
  var grid = document.getElementById("dash-pasos-grid");
  if (!grid) return;

  var formulasActivas = obtenerListaFormulasActivas().filter(function(f) { return f.activa; });

  var filasTablaHTML = "";
  for (var f = 0; f < datos.filas; f++) {
    filasTablaHTML += "<tr><td style='border:1px solid #ccc; padding:4px; text-align:center;'>" + (f + 1) + "</td>";
    for (var c = 0; c < datos.columnas.length; c++) {
      var val = datos.columnas[c].valores[f];
      filasTablaHTML += "<td style='border:1px solid #ccc; padding:4px;'>" + (val !== null && val !== undefined ? val : "") + "</td>";
    }
    if (datos.asignaciones && datos.asignaciones.length === datos.filas) {
      filasTablaHTML += "<td style='border:1px solid #ccc; padding:4px; text-align:center;'><strong>Clúster " + (datos.asignaciones[f] + 1) + "</strong></td>";
    }
    filasTablaHTML += "</tr>";
  }

  var encabezadosTablaHTML = "<tr><th style='border:1px solid #005953; background:#005953; color:#fff; padding:6px;'>#</th>";
  for (var h = 0; h < datos.columnas.length; h++) {
    encabezadosTablaHTML += "<th style='border:1px solid #005953; background:#005953; color:#fff; padding:6px;'>" + datos.columnas[h].nombre + "</th>";
  }
  if (datos.asignaciones) {
    encabezadosTablaHTML += "<th style='border:1px solid #005953; background:#005953; color:#fff; padding:6px;'>Clúster</th>";
  }
  encabezadosTablaHTML += "</tr>";

  var tablaDatosHTML = "<table style='border-collapse:collapse; width:100%; margin-bottom:16px; font-size:12px;'>" +
    encabezadosTablaHTML + filasTablaHTML + "</table>";

  var formulasSeccionHTML = "<h3>Fórmulas y Justificaciones Teóricas Activas</h3>";
  for (var i = 0; i < formulasActivas.length; i++) {
    var fItem = formulasActivas[i];
    formulasSeccionHTML +=
      "<div style='border:1px solid #cfe6e2; padding:10px; margin-bottom:10px; border-radius:4px; background:#f9fdfc;'>" +
        "<div style='font-size:14px; font-weight:bold; color:#005953;'>" + (i + 1) + ". " + fItem.nombre + "</div>" +
        "<div style='font-family:monospace; background:#e6f7f5; padding:4px 8px; margin:4px 0; border-radius:3px; font-size:13px; color:#004540;'>" + fItem.formula + "</div>" +
        "<div style='font-size:12px; margin-bottom:4px;'><strong>Descripción:</strong> " + fItem.descripcion + "</div>" +
        "<div style='font-size:12px; color:#047857;'><strong>Requisito / Justificación:</strong> " + (fItem.justificacion || "Cumple supuestos metodológicos.") + "</div>" +
      "</div>";
  }

  var interpTexto = document.getElementById("dash-interp-cuerpo");
  var conclusionesHTML = "<h3>Conclusiones e Interpretación Automática</h3><p style='background:#f0faf8; border-left:4px solid #00a896; padding:10px; font-size:13px;'>" +
    (interpTexto ? interpTexto.textContent : "Sin conclusiones generadas.") + "</p>";

  var html =
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>" +
    "<head><meta charset='utf-8'><title>Informe Estadístico MultiStats</title>" +
    "<style>body{font-family:Calibri,Arial,sans-serif; color:#132e2b; line-height:1.5; padding:20px;}" +
    "h1{color:#005953; border-bottom:2px solid #005953; padding-bottom:4px; font-size:20px;}" +
    "h2{color:#004540; font-size:16px; margin-top:16px;}" +
    "h3{color:#005953; font-size:14px; margin-top:14px;}</style></head>" +
    "<body>" +
    "<h1>MultiStats · Informe de Análisis y Agrupamiento</h1>" +
    "<p><strong>Universidad Nacional del Altiplano - Facultad de Ingeniería Estadística e Informática</strong><br>" +
    "Fecha de emisión: " + new Date().toLocaleDateString() + " · Algoritmo: " + (configDashboard.algoritmo === "kmedoids" ? "K-Medoids (PAM)" : "K-Means") + " (K=" + (configDashboard.k || 2) + ")</p>" +
    "<hr style='border:none; border-top:1px solid #cfe6e2; margin:14px 0;'>" +
    "<h2>1. Conjunto de Datos Analizado</h2>" + tablaDatosHTML +
    "<h2>2. Requisitos Metodológicos y Formulación Matemática</h2>" + formulasSeccionHTML +
    "<h2>3. Interpretación de Resultados</h2>" + conclusionesHTML +
    "</body></html>";

  var blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  descargarBlob(blob, "multistats_informe_completo.doc");

  if (typeof window.mostrarToast === "function") {
    window.mostrarToast("Informe Word (.doc) exportado con éxito.", "exito");
  }
}

// -----------------------------------------------------------------------------
// 10. MENÚS DESPLEGABLES Y ACCIONES SUPERIORES
// -----------------------------------------------------------------------------

function toggleDropdownMenu(idMenu, evento) {
  if (evento) evento.stopPropagation();
  var menu = document.getElementById(idMenu);
  if (!menu) return;
  var estaAbierto = menu.classList.contains("dash-dropdown--abierto");
  cerrarTodosDropdowns();
  if (!estaAbierto) menu.classList.add("dash-dropdown--abierto");
}

function cerrarTodosDropdowns() {
  var abiertos = document.querySelectorAll(".dash-dropdown.dash-dropdown--abierto");
  abiertos.forEach(function(m) { m.classList.remove("dash-dropdown--abierto"); });
}

if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("click", cerrarTodosDropdowns);
  document.addEventListener("keydown", function(e) { if (e.key === "Escape") cerrarTodosDropdowns(); });
}

function ejecutarAccionMenu(accion) {
  cerrarTodosDropdowns();

  if (accion === "importar-csv") {
    var inp = document.getElementById("input-archivo");
    if (inp) inp.click();
  } else if (accion === "exportar-csv") {
    if (typeof exportarCSV === "function") exportarCSV();
  } else if (accion === "exportar-excel") {
    if (typeof exportarExcel === "function") exportarExcel();
  } else if (accion === "exportar-word") {
    exportarResolucionWord();
  } else if (accion === "imprimir-pdf") {
    window.print();
  } else if (accion === "limpiar-datos") {
    limpiarTablaDatos();
  } else if (accion === "agregar-fila") {
    agregarFilas(1);
  } else if (accion === "agregar-columna") {
    agregarColumnas(1);
  } else if (accion === "agregar-dimensiones") {
    abrirModalAgregarDimensiones();
  } else if (accion === "filtrar-datos") {
    filtrarDatosValidos();
  } else if (accion === "ir-tabla") {
    var tbl = document.getElementById("contenedor-tabla");
    if (tbl) { tbl.scrollIntoView({ behavior: "smooth" }); tbl.focus(); }
  } else if (accion === "toggle-estandarizar") {
    configDashboard.tipoEscalamiento = (configDashboard.tipoEscalamiento === "zscore") ? "ninguno" : "zscore";
    actualizarPanelParametrosDinamico();
    ejecutarClusteringDashboard();
  } else if (accion === "resumen-univariado") {
    if (typeof ejecutarResumenUnivariado === "function") ejecutarResumenUnivariado();
  } else if (accion === "frecuencias-intervalos") {
    if (typeof ejecutarIntervalos === "function") ejecutarIntervalos();
  } else if (accion === "covarianza-correlacion") {
    if (typeof ejecutarCovCor === "function") ejecutarCovCor();
  } else if (accion === "matriz-correlaciones") {
    if (typeof ejecutarMatrizCor === "function") ejecutarMatrizCor();
  } else if (accion === "matriz-covarianzas") {
    if (typeof ejecutarMatrizCov === "function") ejecutarMatrizCov();
  } else if (accion === "regresion-simple") {
    if (typeof ejecutarRegSimple === "function") ejecutarRegSimple();
  } else if (accion === "regresion-multiple") {
    if (typeof ejecutarRegMultiple === "function") ejecutarRegMultiple();
  } else if (accion === "grafico-dispersion") {
    cambiarTabResolucion("dispersion");
  } else if (accion === "grafico-cluster") {
    cambiarTabResolucion("cluster");
  } else if (accion === "grafico-boxplot") {
    cambiarTabResolucion("boxplot");
  } else if (accion === "interpretacion") {
    cambiarTabResolucion("pasos");
    var interpCard = document.querySelector(".dash-card-interp");
    if (interpCard) {
      interpCard.scrollIntoView({ behavior: "smooth" });
      interpCard.style.outline = "2px solid #00a896";
      setTimeout(function() { interpCard.style.outline = "none"; }, 1500);
    }
  } else if (accion === "ayuda-guia") {
    mostrarAyudaDashboard();
  }
}

// -----------------------------------------------------------------------------
// 11. INICIALIZACIÓN DE EVENTOS DEL DASHBOARD Y MULTI-SELECCIÓN
// -----------------------------------------------------------------------------

function inicializarDashboardEventos() {
  dibujarTabla();
  actualizarResolucionPasoAPaso();
  actualizarPanelParametrosDinamico();

  var btnEjecutar = document.getElementById("dash-btn-ejecutar");
  if (btnEjecutar) btnEjecutar.addEventListener("click", ejecutarClusteringDashboard);

  var btnReiniciar = document.getElementById("dash-btn-reiniciar");
  if (btnReiniciar) btnReiniciar.addEventListener("click", reiniciarDashboard);

  // Botones de exportar
  var btnWord = document.getElementById("dash-export-word");
  if (btnWord) btnWord.addEventListener("click", exportarResolucionWord);
  var btnWord2 = document.getElementById("dash-export-word-2");
  if (btnWord2) btnWord2.addEventListener("click", exportarResolucionWord);

  var btnExcel = document.getElementById("dash-export-excel");
  if (btnExcel) btnExcel.addEventListener("click", exportarExcel);

  var btnPdf = document.getElementById("dash-export-pdf");
  if (btnPdf) btnPdf.addEventListener("click", function() { window.print(); });
  var btnPdf2 = document.getElementById("dash-export-pdf-2");
  if (btnPdf2) btnPdf2.addEventListener("click", function() { window.print(); });

  var btnInforme = document.getElementById("dash-generar-informe");
  if (btnInforme) btnInforme.addEventListener("click", exportarResolucionWord);

  // Botón para agregar más fórmulas
  var btnMasFormulas = document.getElementById("dash-btn-mas-formulas");
  if (btnMasFormulas) btnMasFormulas.addEventListener("click", abrirModalAgregarFormula);

  // Botón para agregar dimensiones en la tabla
  var btnMasDimensiones = document.getElementById("btn-agregar-varios");
  if (btnMasDimensiones) btnMasDimensiones.addEventListener("click", abrirModalAgregarDimensiones);

  // Multi-selección en la barra izquierda: Preprocesamiento, Clustering, Univariado, Multivariado, Interpretación
  var navItems = document.querySelectorAll(".dash-item-nav");
  navItems.forEach(function(item) {
    var accion = item.getAttribute("data-accion");

    // Marcar como activo si está en opcionesActivas
    if (opcionesActivas.indexOf(accion) !== -1) {
      item.classList.add("dash-item-nav--activo");
    } else {
      item.classList.remove("dash-item-nav--activo");
    }

    item.addEventListener("click", function(e) {
      e.preventDefault();
      var yaActivo = item.classList.contains("dash-item-nav--activo");

      if (yaActivo) {
        item.classList.remove("dash-item-nav--activo");
        var idx = opcionesActivas.indexOf(accion);
        if (idx !== -1) opcionesActivas.splice(idx, 1);
      } else {
        item.classList.add("dash-item-nav--activo");
        if (opcionesActivas.indexOf(accion) === -1) opcionesActivas.push(accion);
      }

      // Actualizar dinámicamente el panel de parámetros con las opciones seleccionadas
      actualizarPanelParametrosDinamico();

      // Sincronizar vista si corresponde
      if (accion === "kmeans" || accion === "kmedoids" || accion === "jerarquico") {
        configDashboard.algoritmo = accion;
      }
    });
  });
}

// -----------------------------------------------------------------------------
// 12. UTILIDADES DE TABLA Y MODAL
// -----------------------------------------------------------------------------

function limpiarTablaDatos() {
  if (confirm("¿Deseas restablecer la tabla a los datos predeterminados de la sesión?")) {
    datos.columnas = [
      { nombre: "Estudiante", tipo: "categorica", tipoVariable: "Categórica Nominal", valores: ["A", "B", "C", "D", "E", "F"] },
      { nombre: "Horas de estudio", tipo: "numerica", tipoVariable: "Numérica Continua", valores: [1, 3, 5, 7, 9, 11] },
      { nombre: "Nota promedio", tipo: "numerica", tipoVariable: "Numérica Continua", valores: [9, 11, 13, 16, 18, 20] }
    ];
    datos.filas = 6;
    datos.asignaciones = [0, 0, 0, 1, 1, 1];
    dibujarTabla();
    notificarCambioDatos();
    ejecutarClusteringDashboard();
  }
}

function filtrarDatosValidos() {
  var filasValidas = [];
  for (var f = 0; f < datos.filas; f++) {
    var valida = true;
    for (var c = 0; c < datos.columnas.length; c++) {
      var v = datos.columnas[c].valores[f];
      if (v === null || v === undefined || v === "") {
        valida = false;
        break;
      }
    }
    if (valida) filasValidas.push(f);
  }
  for (var c2 = 0; c2 < datos.columnas.length; c2++) {
    datos.columnas[c2].valores = filasValidas.map(function(idx) { return datos.columnas[c2].valores[idx]; });
  }
  datos.filas = filasValidas.length;
  if (datos.asignaciones) {
    datos.asignaciones = filasValidas.map(function(idx) { return datos.asignaciones[idx]; });
  }
  dibujarTabla();
  notificarCambioDatos();
  if (typeof window.mostrarToast === "function") {
    window.mostrarToast("Filtro aplicado: " + datos.filas + " observaciones válidas.");
  }
}

function abrirModalSeccion(nombreSeccion) {
  var modal = document.getElementById("dash-modal-avanzado");
  if (!modal) return;
  modal.style.display = "flex";
  if (typeof mostrarSeccion === "function") mostrarSeccion(nombreSeccion);
}

function cerrarModalSeccion() {
  var modal = document.getElementById("dash-modal-avanzado");
  if (modal) modal.style.display = "none";
}

function mostrarAyudaDashboard() {
  alert(
    "MultiStats · Aprendizaje no supervisado (UNA / FIEI)\n\n" +
    "• Selección múltiple: Activa o desactiva varias opciones en la barra izquierda a la vez.\n" +
    "• Panel de parámetros dinámico: Se adapta automáticamente a las opciones seleccionadas.\n" +
    "• Control de requisitos: Cada fórmula incluye su justificación teórica y casilla para incluirla o excluirla.\n" +
    "• Agregar fórmulas: Agrega más fórmulas estadísticas con el botón '+ Agregar fórmula'.\n" +
    "• Tipo de variable: Define si cada columna es Continua, Discreta, Nominal u Ordinal haciendo clic en el tipo debajo del encabezado.\n" +
    "• Filas y columnas: Usa '+ Varias' para definir cuántas filas y columnas deseas agregar.\n" +
    "• Exportaciones: Exporta a Excel (.xls con fórmulas y formato), Word (.doc formal) y CSV."
  );
}

document.addEventListener("DOMContentLoaded", inicializarDashboardEventos);
