/* ==========================================================================
   tablero.js — Tablero EPH Río Cuarto.

   Los datos llegan agregados en datos/eph-rio-cuarto.js (window.DATOS_EPH),
   generado fuera del repo por exportar_tablero.py. Cada serie es una lista
   alineada con DATOS_EPH.periodos, con [valor, casos, cv] o null.

   Todo el HTML con datos se arma con createElement + textContent.
   ========================================================================== */

const UNIDAD_PCT = '%';

// Estado de los filtros y referencias a los gráficos.
const estado = { periodo: null, modo: 'trimestral' };
const graficos = {};

/* --- Lectura de datos ----------------------------------------------------- */

function datos() {
  const d = window.DATOS_EPH;
  if (!d || !Array.isArray(d.periodos) || !d.series) {
    throw new Error('No se encontraron los datos (datos/eph-rio-cuarto.js).');
  }
  return d;
}

/** Celda [valor, casos, cv] de una serie, o null. area: 'rc' | 'total'. */
function celda(area, indicador, corte, categoria, indice) {
  const s = datos().series[area];
  const lista = s && s[indicador] && s[indicador][corte] && s[indicador][corte][categoria];
  return (lista && lista[indice]) || null;
}

function valor(area, indicador, indice, corte, categoria) {
  const c = celda(area, indicador, corte || 'total', categoria || 'Total', indice);
  return c ? c[0] : null;
}

function serie(area, indicador, corte, categoria) {
  return datos().periodos.map(function (_, i) {
    return valor(area, indicador, i, corte, categoria);
  });
}

/* --- Formatos ------------------------------------------------------------- */

function etiquetaPeriodo(p) {
  return p.charAt(4) + 'T ' + p.slice(0, 4);
}

function etiquetaPeriodoLarga(p) {
  const ordinal = { 1: '1.er', 2: '2.º', 3: '3.er', 4: '4.º' }[p.charAt(4)];
  return ordinal + ' trimestre de ' + p.slice(0, 4);
}

function formatoNumero(v, decimales) {
  if (v === null || v === undefined || Number.isNaN(v)) { return '—'; }
  return Number(v).toLocaleString('es-AR', {
    minimumFractionDigits: decimales, maximumFractionDigits: decimales
  });
}

function formatoPesos(v) {
  return v === null ? '—' : '$ ' + formatoNumero(v, 0);
}

function redondear(v, dec) {
  if (v === null || Number.isNaN(v)) { return null; }
  const f = Math.pow(10, dec);
  return Math.round(v * f) / f;
}

/** Precisión según el CV aproximado. */
function precision(cv) {
  if (cv === null || cv === undefined) { return { clase: 'neutro', texto: 'Sin estimar' }; }
  if (cv <= 0.16) { return { clase: 'ok', texto: 'Buena' }; }
  if (cv <= 0.33) { return { clase: 'alerta', texto: 'Con precaución' }; }
  return { clase: 'grave', texto: 'Poco confiable' };
}

/* --- Series para los gráficos de evolución --------------------------------- */

/** Promedio móvil de 4 trimestres (null si falta alguno de los 4). */
function movil(valores, dec) {
  return valores.map(function (_, i) {
    if (i < 3) { return null; }
    const ventana = valores.slice(i - 3, i + 1);
    if (ventana.some(function (v) { return v === null; })) { return null; }
    return redondear(ventana.reduce(function (a, b) { return a + b; }, 0) / 4, dec);
  });
}

/** Arma la config de un gráfico de líneas según el modo elegido. */
function configEvolucion(lista, unidad, dec) {
  const periodos = datos().periodos;
  let categorias = periodos.map(etiquetaPeriodo);
  let series = lista.map(function (s) { return { nombre: s.nombre, valores: s.valores.slice() }; });
  if (estado.modo === 'movil') {
    series = series.map(function (s) { return { nombre: s.nombre, valores: movil(s.valores, dec) }; });
    categorias = categorias.slice(3);
    series.forEach(function (s) { s.valores = s.valores.slice(3); });
  }
  return { tipo: 'lineas', categorias: categorias, series: series, unidad: unidad };
}

function comparada(indicador) {
  return [
    { nombre: 'Río Cuarto', valores: serie('rc', indicador) },
    { nombre: 'Total 31 aglomerados', valores: serie('total', indicador) }
  ];
}

/** Brecha de ingresos de la ocupación principal: (1 - mujeres/varones) * 100. */
function brecha(area) {
  const v = serie(area, 'ingreso_ocup_principal_media', 'sexo', 'Varones');
  const m = serie(area, 'ingreso_ocup_principal_media', 'sexo', 'Mujeres');
  return v.map(function (x, i) {
    return x && m[i] ? redondear((1 - m[i] / x) * 100, 1) : null;
  });
}

/** Mediana del IPCF de Río Cuarto con el total 31 aglomerados = 100. */
function ipcfRelativo() {
  const rc = serie('rc', 'ipcf_mediana');
  const tot = serie('total', 'ipcf_mediana');
  return rc.map(function (x, i) { return x && tot[i] ? redondear(x / tot[i] * 100, 1) : null; });
}

const EVOLUCION = {
  'g-desocupacion': function () { return configEvolucion(comparada('tasa_de_desocupacion'), UNIDAD_PCT, 1); },
  'g-actividad': function () { return configEvolucion(comparada('tasa_de_actividad'), UNIDAD_PCT, 1); },
  'g-empleo': function () { return configEvolucion(comparada('tasa_de_empleo'), UNIDAD_PCT, 1); },
  'g-subocupacion': function () { return configEvolucion(comparada('tasa_de_subocupacion'), UNIDAD_PCT, 1); },
  'g-demandantes': function () { return configEvolucion(comparada('tasa_de_ocupacion_demandante'), UNIDAD_PCT, 1); },
  'g-informalidad': function () { return configEvolucion(comparada('asalariados_sin_descuento_jubilatorio'), UNIDAD_PCT, 1); },
  'g-ipcf': function () { return configEvolucion(comparada('ipcf_mediana'), 'pesos', 0); },
  'g-ipcf-relativo': function () {
    return configEvolucion([{ nombre: 'Río Cuarto (total 31 aglomerados = 100)', valores: ipcfRelativo() }], '', 1);
  },
  'g-gini': function () { return configEvolucion(comparada('gini_ipcf'), '', 3); },
  'g-brecha': function () {
    return configEvolucion([
      { nombre: 'Río Cuarto', valores: brecha('rc') },
      { nombre: 'Total 31 aglomerados', valores: brecha('total') }
    ], UNIDAD_PCT, 1);
  },
  'g-secundario': function () { return configEvolucion(comparada('secundario_completo_o_mas_25'), UNIDAD_PCT, 1); },
  'g-superior': function () { return configEvolucion(comparada('superior_completo_25'), UNIDAD_PCT, 1); }
};

/* --- Gráficos del trimestre elegido --------------------------------------- */

function configSexo(i) {
  const tasas = [
    ['Actividad', 'tasa_de_actividad'],
    ['Empleo', 'tasa_de_empleo'],
    ['Desocupación', 'tasa_de_desocupacion']
  ];
  return {
    tipo: 'barras',
    categorias: tasas.map(function (t) { return t[0]; }),
    series: ['Varones', 'Mujeres'].map(function (sexo) {
      return { nombre: sexo, valores: tasas.map(function (t) { return valor('rc', t[1], i, 'sexo', sexo); }) };
    }),
    unidad: UNIDAD_PCT
  };
}

function configEdad(i) {
  const grupos = ['14-29', '30-64', '65+'];
  return {
    tipo: 'barras',
    categorias: grupos.map(function (g) { return g === '65+' ? '65 y más' : g + ' años'; }),
    series: [
      { nombre: 'Actividad', valores: grupos.map(function (g) { return valor('rc', 'tasa_de_actividad', i, 'edad', g); }) },
      { nombre: 'Empleo', valores: grupos.map(function (g) { return valor('rc', 'tasa_de_empleo', i, 'edad', g); }) }
    ],
    unidad: UNIDAD_PCT
  };
}

function configInformalidadSexo(i) {
  const ind = 'asalariados_sin_descuento_jubilatorio';
  return {
    tipo: 'barras',
    categorias: ['Río Cuarto', 'Total 31 aglomerados'],
    series: ['Varones', 'Mujeres'].map(function (sexo) {
      return { nombre: sexo, valores: [valor('rc', ind, i, 'sexo', sexo), valor('total', ind, i, 'sexo', sexo)] };
    }),
    unidad: UNIDAD_PCT
  };
}

/* --- Contexto nacional (API INDEC) ---------------------------------------- */

function etiquetaSemestre(p) {
  return p.charAt(4) + 'S ' + p.slice(0, 4);
}

/* --- Pobreza (cuadros oficiales del INDEC, por semestre) ------------------ */

function pobreza() {
  return datos().pobreza || null;
}

/** Gráfico de una tasa de pobreza o indigencia: Río Cuarto vs total 31 aglomerados. */
function configPobrezaArea(variable) {
  const p = pobreza();
  if (!p) { return { tipo: 'lineas', categorias: [], series: [], unidad: UNIDAD_PCT }; }
  return {
    tipo: 'lineas',
    categorias: p.periodos.map(etiquetaSemestre),
    series: [
      { nombre: 'Río Cuarto', valores: p.rc[variable] },
      { nombre: 'Total 31 aglomerados', valores: p.total[variable] }
    ],
    unidad: UNIDAD_PCT
  };
}

function etiquetaSemestreLarga(p) {
  return (p.charAt(4) === '1' ? '1.er' : '2.º') + ' semestre de ' + p.slice(0, 4);
}

/* --- Canastas básicas -------------------------------------------------------- */

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

function etiquetaMes(m) {
  return NOMBRES_MES[Number(m.slice(5, 7)) - 1] + ' de ' + m.slice(0, 4);
}

function etiquetaMesCorta(m) {
  return NOMBRES_MES[Number(m.slice(5, 7)) - 1].slice(0, 3) + ' ' + m.slice(2, 4);
}

function canastas() {
  return datos().canastas || null;
}

function configCanastasGba() {
  const c = canastas();
  if (!c || !c.gba) { return { tipo: 'lineas', categorias: [], series: [], unidad: 'pesos' }; }
  return {
    tipo: 'lineas',
    categorias: c.gba.meses.map(etiquetaMesCorta),
    series: [
      { nombre: 'Canasta básica total (línea de pobreza)', valores: c.gba.cbt.map(function (v) { return Math.round(v); }) },
      { nombre: 'Canasta básica alimentaria (línea de indigencia)', valores: c.gba.cba.map(function (v) { return Math.round(v); }) }
    ],
    unidad: 'pesos'
  };
}

/** Pampeana, último mes con dato: { mes, cba, cbt } o null. */
function ultimaPampeana() {
  const c = canastas();
  const reg = c && c.regionales && c.regionales.regiones.Pampeana;
  if (!reg || !reg.cbt) { return null; }
  for (let i = c.regionales.meses.length - 1; i >= 0; i--) {
    if (reg.cbt[i] !== null) {
      return { indice: i, mes: c.regionales.meses[i], cba: reg.cba[i], cbt: reg.cbt[i] };
    }
  }
  return null;
}

function configCanastasRegiones() {
  const c = canastas();
  const u = ultimaPampeana();
  if (!c || !u) { return { tipo: 'barras', categorias: [], series: [], unidad: 'pesos' }; }
  const regiones = Object.keys(c.regionales.regiones)
    .map(function (r) { return { nombre: r, valor: c.regionales.regiones[r].cbt[u.indice] }; })
    .filter(function (r) { return r.valor !== null; })
    .sort(function (a, b) { return b.valor - a.valor; });
  return {
    tipo: 'barras',
    horizontal: true,
    categorias: regiones.map(function (r) { return r.nombre; }),
    series: [{ nombre: 'Canasta básica total por adulto', valores: regiones.map(function (r) { return Math.round(r.valor); }) }],
    unidad: 'pesos'
  };
}

function pintarTablaCanastas() {
  const c = canastas();
  const cuerpo = document.getElementById('tabla-canastas');
  const reg = c && c.regionales && c.regionales.regiones.Pampeana;
  if (!reg) { return; }
  const ae = c.ae_hogares || {};
  const filas = c.regionales.meses.map(function (m, i) { return { mes: m, cba: reg.cba[i], cbt: reg.cbt[i] }; })
    .filter(function (f) { return f.cbt !== null; })
    .reverse();
  cuerpo.replaceChildren.apply(cuerpo, filas.map(function (f) {
    const tr = document.createElement('tr');
    tr.append(
      crear('td', '', etiquetaMes(f.mes)),
      crear('td', 'numero', formatoPesos(Math.round(f.cba))),
      crear('td', 'numero', formatoPesos(Math.round(f.cbt))),
      crear('td', 'numero', ae.hogar_1 ? formatoPesos(Math.round(f.cbt * ae.hogar_1)) : '—'),
      crear('td', 'numero', ae.hogar_2 ? formatoPesos(Math.round(f.cbt * ae.hogar_2)) : '—'),
      crear('td', 'numero', ae.hogar_3 ? formatoPesos(Math.round(f.cbt * ae.hogar_3)) : '—')
    );
    return tr;
  }));
  const u = ultimaPampeana();
  if (u) {
    document.getElementById('nota-canastas-regiones').textContent =
      'Valor por adulto equivalente en ' + etiquetaMes(u.mes) + ', el último mes publicado por región. Río Cuarto pertenece a la región Pampeana.';
  }
}

/** KPIs de pobreza y canastas: no dependen del filtro de trimestre. */
function pintarKpisPobreza() {
  const cont = document.getElementById('indicadores-pobreza');
  const tarjetas = [];
  const p = pobreza();
  if (p) {
    const ult = p.periodos.length - 1;
    const anterior = ult >= 2 ? ult - 2 : null;  // mismo semestre del año anterior
    [['Personas bajo la línea de pobreza', 'pobreza_personas'],
      ['Personas bajo la línea de indigencia', 'indigencia_personas']].forEach(function (k) {
      const v = p.rc[k[1]][ult];
      const partes = ['Total 31 aglomerados: ' + textoValor('pct', p.total[k[1]][ult])];
      if (anterior !== null && v !== null && p.rc[k[1]][anterior] !== null) {
        const dif = v - p.rc[k[1]][anterior];
        partes.push('Interanual: ' + (dif > 0 ? '+' : (dif < 0 ? '−' : '')) + formatoNumero(Math.abs(dif), 1) + ' p.p.');
      }
      const cv = p.cv_ultimo_rc && p.cv_ultimo_rc.periodo === p.periodos[ult] ? p.cv_ultimo_rc[k[1]] : null;
      const tarjeta = crear('div', 'kpi');
      const prec = crear('p', 'precision');
      prec.append(crearEstado(cv === null || cv === undefined ? null : cv / 100));
      tarjeta.append(
        crear('p', 'etiqueta', k[0] + ' · ' + etiquetaSemestreLarga(p.periodos[ult])),
        crear('p', 'valor', textoValor('pct', v)),
        crear('p', 'detalle', partes.join(' · ')),
        prec
      );
      tarjetas.push(tarjeta);
    });
  }
  const u = ultimaPampeana();
  const c = canastas();
  if (u) {
    const reg = c.regionales.regiones.Pampeana.cbt;
    const previo = u.indice > 0 ? reg[u.indice - 1] : null;
    const tarjeta = crear('div', 'kpi');
    tarjeta.append(
      crear('p', 'etiqueta', 'Canasta básica total por adulto · Pampeana, ' + etiquetaMes(u.mes)),
      crear('p', 'valor', formatoPesos(Math.round(u.cbt))),
      crear('p', 'detalle', 'Línea de pobreza por adulto equivalente' +
        (previo ? ' · Variación mensual: ' + formatoNumero((u.cbt / previo - 1) * 100, 1) + '%' : ''))
    );
    tarjetas.push(tarjeta);
    if (c.ae_hogares && c.ae_hogares.hogar_2) {
      const hogar = crear('div', 'kpi');
      hogar.append(
        crear('p', 'etiqueta', 'Canasta básica total, hogar de 4 · Pampeana, ' + etiquetaMes(u.mes)),
        crear('p', 'valor', formatoPesos(Math.round(u.cbt * c.ae_hogares.hogar_2))),
        crear('p', 'detalle', 'Lo que necesita una pareja con dos hijos de 6 y 8 años para no ser pobre')
      );
      tarjetas.push(hogar);
    }
  }
  cont.replaceChildren.apply(cont, tarjetas);
}

function configFormalidad() {
  const filas = ((datos().api && datos().api.mercado_trabajo) || []).filter(function (f) {
    return f.tasa_de_empleo_formal !== null && f.tasa_de_empleo_formal !== undefined;
  });
  return {
    tipo: 'lineas',
    categorias: filas.map(function (f) { return etiquetaPeriodo(f.periodo); }),
    series: [
      { nombre: 'Empleo formal', valores: filas.map(function (f) { return f.tasa_de_empleo_formal; }) },
      { nombre: 'Empleo informal', valores: filas.map(function (f) { return f.tasa_de_empleo_informal; }) }
    ],
    unidad: UNIDAD_PCT
  };
}

/* --- KPIs ------------------------------------------------------------------ */

const KPIS = [
  { etiqueta: 'Tasa de desocupación', ind: 'tasa_de_desocupacion', tipo: 'pct' },
  { etiqueta: 'Tasa de actividad', ind: 'tasa_de_actividad', tipo: 'pct' },
  { etiqueta: 'Tasa de empleo', ind: 'tasa_de_empleo', tipo: 'pct' },
  { etiqueta: 'Asalariados sin descuento jubilatorio', ind: 'asalariados_sin_descuento_jubilatorio', tipo: 'pct' },
  { etiqueta: 'Ingreso per cápita familiar mediano', ind: 'ipcf_mediana', tipo: 'pesos' },
  { etiqueta: 'Desigualdad (coeficiente de Gini)', ind: 'gini_ipcf', tipo: 'gini' }
];

function textoValor(tipo, v) {
  if (tipo === 'pct') { return v === null ? '—' : formatoNumero(v, 1) + '%'; }
  if (tipo === 'pesos') { return formatoPesos(v); }
  return formatoNumero(v, 3);
}

function detalleKpi(k, i) {
  const rc = valor('rc', k.ind, i);
  const tot = valor('total', k.ind, i);
  const partes = [];
  if (k.tipo === 'pesos') {
    if (rc && tot) { partes.push(formatoNumero(rc / tot * 100, 0) + '% del total 31 aglomerados'); }
  } else {
    partes.push('Total 31 aglomerados: ' + textoValor(k.tipo, tot));
    const antes = i >= 4 ? valor('rc', k.ind, i - 4) : null;
    if (rc !== null && antes !== null) {
      const dif = rc - antes;
      const signo = dif > 0 ? '+' : (dif < 0 ? '−' : '');
      partes.push(k.tipo === 'pct'
        ? 'Interanual: ' + signo + formatoNumero(Math.abs(dif), 1) + ' p.p.'
        : 'Interanual: ' + signo + formatoNumero(Math.abs(dif), 3));
    }
  }
  return partes.join(' · ');
}

function crearEstado(cv) {
  const p = precision(cv);
  const span = crear('span', 'estado estado--' + p.clase, p.texto);
  span.title = cv === null || cv === undefined ? 'Sin CV calculado' : 'CV aproximado: ' + formatoNumero(cv * 100, 0) + '%';
  return span;
}

function pintarKpis(i) {
  const cont = document.getElementById('indicadores');
  cont.replaceChildren.apply(cont, KPIS.map(function (k) {
    const c = celda('rc', k.ind, 'total', 'Total', i);
    const tarjeta = crear('div', 'kpi');
    const precisionP = crear('p', 'precision');
    precisionP.append(crearEstado(c ? c[2] : null));
    tarjeta.append(
      crear('p', 'etiqueta', k.etiqueta),
      crear('p', 'valor', textoValor(k.tipo, c ? c[0] : null)),
      crear('p', 'detalle', detalleKpi(k, i)),
      precisionP
    );
    return tarjeta;
  }));
}

/* --- Tabla ----------------------------------------------------------------- */

const FILAS_TABLA = [
  ['Tasa de actividad', 'tasa_de_actividad', 'pct'],
  ['Tasa de empleo', 'tasa_de_empleo', 'pct'],
  ['Tasa de desocupación', 'tasa_de_desocupacion', 'pct'],
  ['Tasa de subocupación', 'tasa_de_subocupacion', 'pct'],
  ['Subocupación demandante', 'tasa_de_subocupacion_demandante', 'pct'],
  ['Subocupación no demandante', 'tasa_de_subocupacion_no_demandante', 'pct'],
  ['Ocupados demandantes de empleo', 'tasa_de_ocupacion_demandante', 'pct'],
  ['Asalariados sin descuento jubilatorio', 'asalariados_sin_descuento_jubilatorio', 'pct'],
  ['Secundario completo o más (25 años y más)', 'secundario_completo_o_mas_25', 'pct'],
  ['Superior completo (25 años y más)', 'superior_completo_25', 'pct'],
  ['Ingreso per cápita familiar mediano', 'ipcf_mediana', 'pesos'],
  ['Ingreso per cápita familiar promedio', 'ipcf_media', 'pesos'],
  ['Coeficiente de Gini', 'gini_ipcf', 'gini']
];

function pintarTabla(i) {
  const cuerpo = document.getElementById('tabla-indicadores');
  cuerpo.replaceChildren.apply(cuerpo, FILAS_TABLA.map(function (f) {
    const c = celda('rc', f[1], 'total', 'Total', i);
    const tr = document.createElement('tr');
    const tdPrecision = document.createElement('td');
    tdPrecision.append(crearEstado(c ? c[2] : null));
    tr.append(
      crear('td', '', f[0]),
      crear('td', 'numero', textoValor(f[2], c ? c[0] : null)),
      crear('td', 'numero', textoValor(f[2], valor('total', f[1], i))),
      crear('td', 'numero', c ? formatoNumero(c[1], 0) : '—'),
      tdPrecision
    );
    return tr;
  }));
}

/* --- Filtros, pestañas y ciclo de vida ------------------------------------ */

function indicePeriodo() {
  return datos().periodos.indexOf(estado.periodo);
}

function actualizarTrimestre() {
  const i = indicePeriodo();
  pintarKpis(i);
  pintarTabla(i);
  graficos['g-sexo'].actualizar(configSexo(i));
  graficos['g-edad'].actualizar(configEdad(i));
  graficos['g-informalidad-sexo'].actualizar(configInformalidadSexo(i));
  document.getElementById('titulo-kpis').textContent = 'Río Cuarto en el ' + etiquetaPeriodoLarga(estado.periodo);
}

function actualizarEvolucion() {
  Object.keys(EVOLUCION).forEach(function (id) { graficos[id].actualizar(EVOLUCION[id]()); });
}

function prepararFiltros() {
  const periodos = datos().periodos;
  const select = document.getElementById('filtro-periodo');
  periodos.slice().reverse().forEach(function (p) {
    const op = crear('option', '', etiquetaPeriodoLarga(p));
    op.value = p;
    select.append(op);
  });
  select.value = estado.periodo;
  select.addEventListener('change', function () {
    estado.periodo = select.value;
    actualizarTrimestre();
  });

  const modo = document.getElementById('filtro-serie');
  modo.addEventListener('change', function () {
    estado.modo = modo.value;
    actualizarEvolucion();
  });
}

function prepararPestanas() {
  const tabs = Array.prototype.slice.call(document.querySelectorAll('.pestanas [role="tab"]'));
  function activar(tab, enfocar) {
    tabs.forEach(function (t) {
      const elegida = t === tab;
      t.setAttribute('aria-selected', elegida ? 'true' : 'false');
      t.tabIndex = elegida ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !elegida;
    });
    if (enfocar) { tab.focus(); }
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { activar(tab, false); });
    tab.addEventListener('keydown', function (e) {
      let destino = null;
      if (e.key === 'ArrowRight') { destino = tabs[(i + 1) % tabs.length]; }
      if (e.key === 'ArrowLeft') { destino = tabs[(i - 1 + tabs.length) % tabs.length]; }
      if (e.key === 'Home') { destino = tabs[0]; }
      if (e.key === 'End') { destino = tabs[tabs.length - 1]; }
      if (destino) { e.preventDefault(); activar(destino, true); }
    });
  });
}

function iniciar() {
  try {
    const d = datos();
    estado.periodo = d.periodos[d.periodos.length - 1];
    document.getElementById('texto-actualizado').textContent =
      'Datos al ' + etiquetaPeriodoLarga(estado.periodo) + ' (EPH, INDEC). Actualizado el ' +
      d.generado.split('-').reverse().join('/') + '.';

    Object.keys(EVOLUCION).forEach(function (id) { graficos[id] = Grafico.crear('#' + id, EVOLUCION[id]()); });
    const i = indicePeriodo();
    graficos['g-sexo'] = Grafico.crear('#g-sexo', configSexo(i));
    graficos['g-edad'] = Grafico.crear('#g-edad', configEdad(i));
    graficos['g-informalidad-sexo'] = Grafico.crear('#g-informalidad-sexo', configInformalidadSexo(i));
    graficos['g-formalidad'] = Grafico.crear('#g-formalidad', configFormalidad());
    ['pobreza_personas', 'indigencia_personas', 'pobreza_hogares', 'indigencia_hogares'].forEach(function (v) {
      const id = 'g-' + v.replace('_', '-');
      graficos[id] = Grafico.crear('#' + id, configPobrezaArea(v));
    });
    graficos['g-canastas'] = Grafico.crear('#g-canastas', configCanastasGba());
    graficos['g-canastas-regiones'] = Grafico.crear('#g-canastas-regiones', configCanastasRegiones());
    pintarKpisPobreza();
    pintarTablaCanastas();

    prepararFiltros();
    prepararPestanas();
    actualizarTrimestre();
  } catch (error) {
    mostrarError(error.message);
  }
}

/* --- Ayudantes de presentación -------------------------------------------- */

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) { el.className = clase; }
  if (texto !== undefined) { el.textContent = texto; }
  return el;
}

function mostrarError(mensaje) {
  const main = document.querySelector('main .contenedor');
  if (!main) { return; }
  const caja = crear('div', 'error');
  caja.append(crear('strong', '', 'No se pudo mostrar el tablero.'), document.createElement('br'), String(mensaje));
  main.replaceChildren(caja);
}

document.addEventListener('DOMContentLoaded', iniciar);
