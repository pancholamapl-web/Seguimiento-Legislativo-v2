(function () {
  'use strict';

  var HISTORY_KEY = 'sl_historial_boletines';
  var HISTORY_MAX = 6;

  var els = {
    form: document.getElementById('search-form'),
    input: document.getElementById('boletin-input'),
    btn: document.getElementById('search-btn'),
    historyChips: document.getElementById('history-chips'),
    status: document.getElementById('status-area'),
    result: document.getElementById('result-area'),

    proyectoNombre: document.getElementById('proyecto-nombre'),
    proyectoBoletin: document.getElementById('proyecto-boletin'),
    proyectoFecha: document.getElementById('proyecto-fecha'),
    proyectoTipo: document.getElementById('proyecto-tipo'),
    proyectoCamara: document.getElementById('proyecto-camara'),
    proyectoAdmisible: document.getElementById('proyecto-admisible'),
    proyectoAutores: document.getElementById('proyecto-autores'),
    proyectoMinisterios: document.getElementById('proyecto-ministerios'),
    proyectoMaterias: document.getElementById('proyecto-materias'),

    votacionesCount: document.getElementById('votaciones-count'),
    votacionesList: document.getElementById('votaciones-list'),

    modal: document.getElementById('votacion-modal'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalClose: document.getElementById('modal-close'),
    modalBody: document.getElementById('modal-body')
  };

  var votacionesCache = {}; // id -> datos crudos de la votación del proyecto (para fallback)

  /* ============================================================
     INIT
     ============================================================ */

  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var boletin = normalizarBoletin(els.input.value);
    if (!boletin) return;
    buscarBoletin(boletin);
  });

  els.modalBackdrop.addEventListener('click', cerrarModal);
  els.modalClose.addEventListener('click', cerrarModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') cerrarModal();
  });

  renderHistorial();

  var params = new URLSearchParams(window.location.search);
  var boletinInicial = params.get('boletin');
  if (boletinInicial) {
    els.input.value = boletinInicial;
    buscarBoletin(normalizarBoletin(boletinInicial));
  }

  /* ============================================================
     BÚSQUEDA PRINCIPAL
     ============================================================ */

  function buscarBoletin(boletin) {
    els.result.hidden = true;
    votacionesCache = {};
    mostrarEstado('loading', 'Buscando boletín ' + boletin + '…');
    els.btn.disabled = true;

    var urlProyecto = CONFIG.BASE_URL + '?accion=proyecto&boletin=' + encodeURIComponent(boletin);
    var urlVotaciones = CONFIG.BASE_URL + '?accion=votaciones&boletin=' + encodeURIComponent(boletin);

    Promise.all([
      fetchJSON(urlProyecto),
      fetchJSON(urlVotaciones)
    ])
      .then(function (respuestas) {
        var proyectoResp = respuestas[0];
        var votacionesResp = respuestas[1];

        if (!proyectoResp.ok) {
          throw new Error(proyectoResp.error || 'No se pudo obtener el proyecto.');
        }

        renderProyecto(proyectoResp.proyecto);
        renderVotaciones(votacionesResp.ok ? votacionesResp.votaciones : []);

        ocultarEstado();
        els.result.hidden = false;
        guardarEnHistorial(boletin);

        var url = new URL(window.location.href);
        url.searchParams.set('boletin', boletin);
        window.history.replaceState({}, '', url);
      })
      .catch(function (err) {
        mostrarEstado('error', 'No se encontró información para ese boletín. ' + (err.message || ''));
      })
      .finally(function () {
        els.btn.disabled = false;
      });
  }

  /* ============================================================
     RENDER — PROYECTO
     ============================================================ */

  function renderProyecto(p) {
    els.proyectoNombre.textContent = p.nombre || 'Sin título disponible';
    els.proyectoBoletin.textContent = 'Boletín ' + (p.boletin || '—');
    els.proyectoFecha.textContent = formatearFecha(p.fecha_ingreso) || '—';
    els.proyectoTipo.textContent = (p.tipo_iniciativa && p.tipo_iniciativa.nombre) || '—';
    els.proyectoCamara.textContent = (p.camara_origen && p.camara_origen.nombre) || '—';
    els.proyectoAdmisible.textContent = p.admisible === true ? 'Sí' : (p.admisible === false ? 'No' : '—');

    llenarLista(els.proyectoAutores, (p.autores || []).map(function (a) {
      return [a.nombre, a.nombre2, a.apellido_paterno, a.apellido_materno].filter(Boolean).join(' ');
    }));

    llenarLista(els.proyectoMinisterios, (p.ministerios || []).map(function (m) { return m.nombre; }));

    llenarLista(els.proyectoMaterias, (p.materias || []).map(function (m) { return m.nombre; }));
  }

  function llenarLista(ul, items) {
    items = items.filter(Boolean);
    ul.innerHTML = '';
    if (items.length === 0) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Sin información';
      ul.appendChild(li);
      return;
    }
    items.forEach(function (texto) {
      var li = document.createElement('li');
      li.textContent = texto;
      ul.appendChild(li);
    });
  }

  /* ============================================================
     RENDER — VOTACIONES
     ============================================================ */

  function renderVotaciones(votaciones) {
    els.votacionesCount.textContent = votaciones.length + (votaciones.length === 1 ? ' votación' : ' votaciones');
    els.votacionesList.innerHTML = '';

    if (votaciones.length === 0) {
      var p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'Este proyecto no registra votaciones en sala.';
      els.votacionesList.appendChild(p);
      return;
    }

    votaciones
      .slice()
      .sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); })
      .forEach(function (v) {
        votacionesCache[v.id] = v;

        var row = document.createElement('div');
        row.className = 'votacion-row';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');

        var main = document.createElement('div');
        main.className = 'votacion-row-main';

        var desc = document.createElement('div');
        desc.className = 'votacion-row-desc';
        desc.textContent = v.descripcion || ('Votación #' + v.id);

        var fecha = document.createElement('div');
        fecha.className = 'votacion-row-fecha';
        fecha.textContent = formatearFecha(v.fecha) || '';

        main.appendChild(desc);
        main.appendChild(fecha);

        var tally = document.createElement('div');
        tally.className = 'votacion-row-tally';
        tally.innerHTML =
          '<span class="tally-si">' + v.total_si + ' A favor</span>' +
          '<span class="tally-no">' + v.total_no + ' En contra</span>' +
          '<span class="tally-abs">' + v.total_abstencion + ' Abst.</span>';

        var pill = document.createElement('span');
        pill.className = 'resultado-pill';
        pill.textContent = (v.resultado && v.resultado.nombre) || '—';

        row.appendChild(main);
        row.appendChild(tally);
        row.appendChild(pill);

        row.addEventListener('click', function () { abrirVotacion(v.id); });
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirVotacion(v.id); }
        });

        els.votacionesList.appendChild(row);
      });
  }

  /* ============================================================
     MODAL — DETALLE DE VOTACIÓN
     ============================================================ */

  function abrirVotacion(votacionId) {
    els.modalBody.innerHTML = '<p class="empty-state">Cargando detalle de la votación…</p>';
    els.modal.hidden = false;

    var url = CONFIG.BASE_URL + '?accion=votacion&votacion_id=' + encodeURIComponent(votacionId);

    fetchJSON(url)
      .then(function (resp) {
        if (!resp.ok) throw new Error(resp.error || 'No se pudo obtener el detalle.');
        renderModalVotacion(resp.votacion);
      })
      .catch(function (err) {
        els.modalBody.innerHTML =
          '<p class="empty-state">No se pudo cargar el detalle de esta votación. ' + (err.message || '') + '</p>';
      });
  }

  function renderModalVotacion(v) {
    var votos = v.votos || [];

    var html = '';
    html += '<h2>' + escapeHTML(v.descripcion || ('Votación #' + v.id)) + '</h2>';
    html += '<p class="votacion-row-fecha">' + escapeHTML(formatearFecha(v.fecha) || '') + '</p>';
    html += '<div class="votacion-row-tally" style="margin-top:10px;">';
    html += '<span class="tally-si">' + v.total_si + ' A favor</span>';
    html += '<span class="tally-no">' + v.total_no + ' En contra</span>';
    html += '<span class="tally-abs">' + v.total_abstencion + ' Abst.</span>';
    html += '</div>';

    html += '<div class="votos-filter" data-filter-group>';
    html += '<button type="button" data-filter="todos" class="active">Todos (' + votos.length + ')</button>';
    html += '<button type="button" data-filter="si">A favor</button>';
    html += '<button type="button" data-filter="no">En contra</button>';
    html += '<button type="button" data-filter="abstencion">Abstención</button>';
    html += '</div>';

    html += '<table class="votos-table"><thead><tr><th>Diputado/a</th><th>Voto</th></tr></thead><tbody id="votos-tbody"></tbody></table>';

    els.modalBody.innerHTML = html;

    var tbody = document.getElementById('votos-tbody');

    function pintarFilas(filtro) {
      tbody.innerHTML = '';
      votos
        .filter(function (voto) {
          if (filtro === 'todos') return true;
          var op = normalizarOpcion(voto.opcion_voto);
          return op === filtro;
        })
        .sort(function (a, b) {
          var na = nombreDiputado(a.diputado);
          var nb = nombreDiputado(b.diputado);
          return na.localeCompare(nb);
        })
        .forEach(function (voto) {
          var tr = document.createElement('tr');
          var tdNombre = document.createElement('td');
          tdNombre.textContent = nombreDiputado(voto.diputado) || '—';
          var tdVoto = document.createElement('td');
          var op = normalizarOpcion(voto.opcion_voto);
          var span = document.createElement('span');
          span.className = 'voto-opcion ' + op;
          span.textContent = (voto.opcion_voto && voto.opcion_voto.nombre) || '—';
          tdVoto.appendChild(span);
          tr.appendChild(tdNombre);
          tr.appendChild(tdVoto);
          tbody.appendChild(tr);
        });
    }

    pintarFilas('todos');

    els.modalBody.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        els.modalBody.querySelectorAll('[data-filter]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        pintarFilas(btn.getAttribute('data-filter'));
      });
    });
  }

  function cerrarModal() {
    els.modal.hidden = true;
    els.modalBody.innerHTML = '';
  }

  /* ============================================================
     HISTORIAL (localStorage)
     ============================================================ */

  function guardarEnHistorial(boletin) {
    var lista = leerHistorial();
    lista = lista.filter(function (b) { return b !== boletin; });
    lista.unshift(boletin);
    lista = lista.slice(0, HISTORY_MAX);
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(lista));
    } catch (e) { /* localStorage no disponible: se ignora */ }
    renderHistorial();
  }

  function leerHistorial() {
    try {
      var raw = window.localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function renderHistorial() {
    var lista = leerHistorial();
    els.historyChips.innerHTML = '';
    if (lista.length === 0) {
      els.historyChips.hidden = true;
      return;
    }
    els.historyChips.hidden = false;
    lista.forEach(function (boletin) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'history-chip';
      chip.textContent = boletin;
      chip.addEventListener('click', function () {
        els.input.value = boletin;
        buscarBoletin(boletin);
      });
      els.historyChips.appendChild(chip);
    });
  }

  /* ============================================================
     ESTADO / MENSAJES
     ============================================================ */

  function mostrarEstado(tipo, mensaje) {
    els.status.hidden = false;
    els.status.className = 'status-area ' + tipo;
    els.status.textContent = mensaje;
  }

  function ocultarEstado() {
    els.status.hidden = true;
    els.status.textContent = '';
    els.status.className = 'status-area';
  }

  /* ============================================================
     UTILIDADES
     ============================================================ */

  function fetchJSON(url) {
    return fetch(url).then(function (resp) {
      if (!resp.ok) throw new Error('Error de red (HTTP ' + resp.status + ')');
      return resp.json();
    });
  }

  function normalizarBoletin(valor) {
    return String(valor || '').trim().replace(/\s+/g, '');
  }

  function formatearFecha(valor) {
    if (!valor) return '';
    var d = new Date(valor);
    if (isNaN(d.getTime())) return valor;
    return d.toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function nombreDiputado(d) {
    if (!d) return '';
    return [d.nombre, d.nombre2, d.apellido_paterno, d.apellido_materno].filter(Boolean).join(' ');
  }

  function normalizarOpcion(opcion) {
    var nombre = ((opcion && opcion.nombre) || '').toLowerCase();
    if (nombre.indexOf('afirm') !== -1 || nombre === 'si' || nombre === 'sí') return 'si';
    if (nombre.indexOf('negat') !== -1 || nombre === 'no') return 'no';
    if (nombre.indexOf('abst') !== -1) return 'abstencion';
    return nombre.replace(/\s+/g, '-') || 'otro';
  }

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
