/* ========================================
   ULTRAPROGOL - LIGA MX · app.js
   ======================================== */

const API = 'https://ultragol-api-3.vercel.app';

/* ---- TEAM COLORS ---- */
const TEAM_COLORS = {
  'Chivas': '#ff0000', 'Guadalajara': '#ff0000',
  'Cruz Azul': '#003087',
  'Toluca': '#c8102e',
  'Pumas': '#003087', 'Pumas UNAM': '#003087',
  'Pachuca': '#011e4c',
  'Atlas': '#c8102e',
  'Tigres': '#f9a01b', 'Tigres UANL': '#f9a01b',
  'Club América': '#ffdd00', 'América': '#ffdd00',
  'Monterrey': '#003087',
  'Juárez': '#f7941d', 'FC Juarez': '#f7941d',
  'Necaxa': '#ee1c25',
  'León': '#006629',
  'Tijuana': '#000000',
  'Puebla': '#003087',
  'San Luis': '#ff0000', 'Atlético de San Luis': '#ff0000',
  'Mazatlán': '#002366',
  'Querétaro': '#003087',
  'Santos Laguna': '#018a18', 'Santos': '#018a18',
};

const TEAM_ABBR = {
  'Chivas': 'GDL', 'Guadalajara': 'GDL',
  'Cruz Azul': 'CRZ',
  'Toluca': 'TOL',
  'Pumas': 'PUM', 'Pumas UNAM': 'PUM',
  'Pachuca': 'PAC',
  'Atlas': 'ATL',
  'Tigres': 'TIG', 'Tigres UANL': 'TIG',
  'Club América': 'AME', 'América': 'AME',
  'Monterrey': 'MTY',
  'Juárez': 'JUA', 'FC Juarez': 'JUA',
  'Necaxa': 'NEC',
  'León': 'LEO',
  'Tijuana': 'TIJ',
  'Puebla': 'PUE',
  'San Luis': 'SLP', 'Atlético de San Luis': 'SLP',
  'Mazatlán': 'MAZ',
  'Querétaro': 'QRO',
  'Santos Laguna': 'SAN', 'Santos': 'SAN',
};

function getTeamColor(name) {
  return TEAM_COLORS[name] || '#374151';
}
function getTeamAbbr(name) {
  if (TEAM_ABBR[name]) return TEAM_ABBR[name];
  const words = name.split(' ');
  if (words.length === 1) return name.substring(0, 3).toUpperCase();
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/* ---- STATE ---- */
let progolPicks = {}; // { matchId: '1'|'X'|'2' }
let tablaData = [];
let goleadoresData = [];
let calendarioData = [];
let matchesForProgol = [];

/* ---- DOM HELPERS ---- */
const $ = id => document.getElementById(id);
function showToast(msg, duration = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

/* ---- NAVIGATION ---- */
function initNav() {
  const links = document.querySelectorAll('.nav-link[data-tab]');
  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const tab = link.dataset.tab;
      switchTab(tab);
      // close mobile menu
      $('mobileMenu').classList.remove('open');
    });
  });

  $('heroBtn').addEventListener('click', () => switchTab('progol'));
  $('heroBtnTabla').addEventListener('click', () => switchTab('tabla'));
  $('hamburger').addEventListener('click', () => {
    $('mobileMenu').classList.toggle('open');
  });

  window.addEventListener('scroll', () => {
    const nav = $('navbar');
    if (window.scrollY > 10) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  });
}

function switchTab(tab) {
  // Hide all sections
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  // Show target
  const section = $(`tab-${tab}`);
  if (section) section.classList.add('active');
  document.querySelectorAll(`.nav-link[data-tab="${tab}"]`).forEach(l => l.classList.add('active'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---- FETCH HELPERS ---- */
async function fetchData(endpoint) {
  try {
    const res = await fetch(`${API}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Error fetching ${endpoint}:`, err);
    return null;
  }
}

/* ---- LOAD ALL DATA ---- */
async function loadAll() {
  const [tabla, goleadores, calendario] = await Promise.all([
    fetchData('/tabla'),
    fetchData('/goleadores'),
    fetchData('/calendario'),
  ]);

  if (tabla) {
    tablaData = tabla.tabla || [];
    renderTabla(tablaData, tabla.actualizadoISO);
    updateHeroStats(tabla);
  }
  if (goleadores) {
    goleadoresData = goleadores.goleadores || [];
    renderGoleadores(goleadoresData);
  }
  if (calendario) {
    calendarioData = calendario.calendario || [];
    renderCalendario(calendarioData);
    buildProgolMatches(calendarioData, tabla);
  } else {
    buildProgolMatches([], tabla);
  }
}

/* ---- HERO STATS ---- */
function updateHeroStats(tablaJson) {
  if (!tablaJson) return;
  const tabla = tablaJson.tabla || [];
  // Total goles
  const totalGF = tabla.reduce((s, t) => s + (t.estadisticas?.gf || 0), 0) / 2;
  $('statGoles').textContent = Math.round(totalGF);
  // Líder
  if (tabla.length > 0) $('statLider').textContent = getTeamAbbr(tabla[0].equipo);
  // Jornada
  $('statJornada').textContent = tablaJson.jornadasTotales || '—';
}

/* ---- TABLA ---- */
function renderTabla(tabla, updated) {
  const tbody = $('standingsBody');
  if (!tabla || tabla.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">Sin datos disponibles</td></tr>';
    return;
  }
  if (updated) {
    $('tablaFuente').textContent = `Liga MX · Actualizado: ${formatDate(updated)}`;
  }
  tbody.innerHTML = tabla.map((team, idx) => {
    const pos = team.posicion;
    const s = team.estadisticas || {};
    const zoneClass =
      pos <= 8 ? 'zone-liguilla' :
      pos <= 12 ? 'zone-repechaje' :
      pos >= 17 ? 'zone-descenso' : '';
    const dif = s.dif >= 0 ? `+${s.dif}` : s.dif;
    const difClass = s.dif > 0 ? 'dif-pos' : s.dif < 0 ? 'dif-neg' : '';
    const color = getTeamColor(team.equipo);
    const abbr = getTeamAbbr(team.equipo);
    return `
      <tr class="${zoneClass}">
        <td class="pos">${pos}</td>
        <td>
          <div class="team-cell">
            <div class="team-mini-badge" style="background:${color};">${abbr}</div>
            <span class="team-name-cell">${team.equipo}</span>
          </div>
        </td>
        <td>${s.pj ?? '—'}</td>
        <td>${s.pg ?? '—'}</td>
        <td>${s.pe ?? '—'}</td>
        <td>${s.pp ?? '—'}</td>
        <td>${s.gf ?? '—'}</td>
        <td>${s.gc ?? '—'}</td>
        <td class="${difClass}">${dif}</td>
        <td class="pts">${s.pts ?? '—'}</td>
      </tr>`;
  }).join('');
}

/* ---- GOLEADORES ---- */
function renderGoleadores(goleadores) {
  const grid = $('goleadoresGrid');
  if (!goleadores || goleadores.length === 0) {
    grid.innerHTML = '<div class="loading-state"><p>Sin datos de goleadores</p></div>';
    return;
  }
  grid.innerHTML = goleadores.map(g => {
    const pos = g.posicion;
    const rankClass = pos === 1 ? 'rank-1' : pos === 2 ? 'rank-2' : pos === 3 ? 'rank-3' : '';
    const color = getTeamColor(g.equipo);
    const initials = g.jugador.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    const trophyLabel = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '';
    return `
      <div class="goleador-card">
        <div class="goleador-rank ${rankClass}">${pos}</div>
        <div class="goleador-avatar" style="background:${color};">${initials}</div>
        <div class="goleador-info">
          <div class="goleador-name">${trophyLabel} ${g.jugador}</div>
          <div class="goleador-team">${g.equipo}</div>
        </div>
        <div class="goleador-goals">
          <div class="goals-num">${g.goles}</div>
          <div class="goals-label">Goles</div>
        </div>
      </div>`;
  }).join('');
}

/* ---- CALENDARIO ---- */
function renderCalendario(calendario) {
  const container = $('calendarioContent');
  if (!calendario || calendario.length === 0) {
    container.innerHTML = `
      <div class="no-matches">
        <div class="emoji">📅</div>
        <h3>Sin partidos disponibles</h3>
        <p>El calendario no tiene partidos disponibles en este momento.<br/>Vuelve más tarde para ver los próximos encuentros.</p>
      </div>`;
    return;
  }
  // Group by jornada
  const jornadas = {};
  calendario.forEach(match => {
    const j = match.jornada || 'Próximos';
    if (!jornadas[j]) jornadas[j] = [];
    jornadas[j].push(match);
  });
  container.innerHTML = Object.entries(jornadas).map(([jornada, matches]) => `
    <div class="jornada-section">
      <div class="jornada-title">Jornada ${jornada}</div>
      <div class="calendario-grid">
        ${matches.map(m => renderCalMatch(m)).join('')}
      </div>
    </div>`).join('');
}

function renderCalMatch(m) {
  const local = m.local || m.equipo_local || 'Local';
  const visitante = m.visitante || m.equipo_visitante || 'Visitante';
  const marcador = m.marcador || null;
  const estado = m.estado || m.status || 'próximo';
  const colorL = getTeamColor(local);
  const colorV = getTeamColor(visitante);
  const abbrL = getTeamAbbr(local);
  const abbrV = getTeamAbbr(visitante);

  let statusBadge = '';
  let scores = '<span class="cal-dash">vs</span>';

  if (marcador && (marcador.local !== undefined || marcador.goles_local !== undefined)) {
    const gl = marcador.local ?? marcador.goles_local ?? '-';
    const gv = marcador.visitante ?? marcador.goles_visitante ?? '-';
    scores = `<span class="cal-score">${gl}</span><span class="cal-dash">-</span><span class="cal-score">${gv}</span>`;
  }

  const estadoLower = (estado || '').toLowerCase();
  if (estadoLower.includes('viv') || estadoLower.includes('live') || estadoLower.includes("'")) {
    statusBadge = `<span class="cal-status status-live">⚡ EN VIVO</span>`;
  } else if (estadoLower.includes('fin') || estadoLower.includes('term') || estadoLower.includes('ft')) {
    statusBadge = `<span class="cal-status status-finished">FT</span>`;
  } else {
    const hora = m.hora || m.time || '';
    statusBadge = `<span class="cal-status status-upcoming">${hora || 'Próximo'}</span>`;
  }

  return `
    <div class="cal-card">
      <div class="cal-team">
        <div class="team-mini-badge" style="background:${colorL};">${abbrL}</div>
        <span class="cal-team-name">${local}</span>
      </div>
      <div class="cal-score-box">${scores}</div>
      <div class="cal-team away">
        <div class="team-mini-badge" style="background:${colorV};">${abbrV}</div>
        <span class="cal-team-name">${visitante}</span>
      </div>
    </div>`;
}

/* ---- PROGOL ---- */
function buildProgolMatches(calendario, tablaJson) {
  const container = $('progolMatches');

  // Try to get matches from calendario
  if (calendario && calendario.length > 0) {
    // Take upcoming or current jornada matches
    matchesForProgol = calendario.slice(0, 14).map((m, i) => ({
      id: i,
      local: m.local || m.equipo_local || `Equipo ${i * 2 + 1}`,
      visitante: m.visitante || m.equipo_visitante || `Equipo ${i * 2 + 2}`,
      jornada: m.jornada || '—',
      hora: m.hora || m.time || '',
      fecha: m.fecha || '',
    }));
  } else if (tablaJson && tablaJson.tabla && tablaJson.tabla.length >= 2) {
    // Generate simulated matches from current standings
    const equipos = tablaJson.tabla.map(t => t.equipo);
    matchesForProgol = generateProgolFromStandings(equipos);
  } else {
    // Fallback default matches
    matchesForProgol = getDefaultMatches();
  }

  renderProgolMatches(container, matchesForProgol);
}

function generateProgolFromStandings(equipos) {
  const fixtures = [
    [0, 17], [1, 16], [2, 15], [3, 14],
    [4, 13], [5, 12], [6, 11], [7, 10],
    [8, 9],
  ];
  return fixtures.map((pair, i) => ({
    id: i,
    local: equipos[pair[0]] || `Equipo ${pair[0] + 1}`,
    visitante: equipos[pair[1]] || `Equipo ${pair[1] + 1}`,
    jornada: '13',
    hora: '',
    fecha: '',
  }));
}

function getDefaultMatches() {
  return [
    { id: 0, local: 'Chivas', visitante: 'Cruz Azul', jornada: '13', hora: '17:00', fecha: '' },
    { id: 1, local: 'Toluca', visitante: 'Pumas', jornada: '13', hora: '19:00', fecha: '' },
    { id: 2, local: 'Pachuca', visitante: 'Atlas', jornada: '13', hora: '19:00', fecha: '' },
    { id: 3, local: 'Tigres', visitante: 'Club América', jornada: '13', hora: '21:00', fecha: '' },
    { id: 4, local: 'Monterrey', visitante: 'Necaxa', jornada: '13', hora: '21:00', fecha: '' },
    { id: 5, local: 'León', visitante: 'Juárez', jornada: '13', hora: '17:00', fecha: '' },
    { id: 6, local: 'Tijuana', visitante: 'Puebla', jornada: '13', hora: '18:00', fecha: '' },
    { id: 7, local: 'San Luis', visitante: 'Mazatlán', jornada: '13', hora: '20:00', fecha: '' },
    { id: 8, local: 'Querétaro', visitante: 'Santos Laguna', jornada: '13', hora: '20:00', fecha: '' },
  ];
}

function renderProgolMatches(container, matches) {
  if (!matches || matches.length === 0) {
    container.innerHTML = `
      <div class="no-matches" style="grid-column:1/-1">
        <div class="emoji">📋</div>
        <h3>Sin partidos cargados</h3>
        <p>No hay partidos disponibles para la quiniela en este momento.</p>
      </div>`;
    return;
  }

  container.innerHTML = matches.map((match, idx) => {
    const colorL = getTeamColor(match.local);
    const colorV = getTeamColor(match.visitante);
    const abbrL = getTeamAbbr(match.local);
    const abbrV = getTeamAbbr(match.visitante);
    const hora = match.hora ? `${match.hora}` : '';
    const dateStr = match.fecha ? ` · ${match.fecha}` : '';
    return `
      <div class="progol-card" id="card-${match.id}">
        <div class="match-num">
          <span>Partido ${idx + 1} · J${match.jornada}</span>
          <span class="match-date">${hora}${dateStr}</span>
        </div>
        <div class="match-teams">
          <div class="match-team">
            <div class="team-badge" style="background:${colorL};">${abbrL}</div>
            <span class="team-name">${match.local}</span>
          </div>
          <div class="match-vs">VS</div>
          <div class="match-team">
            <div class="team-badge" style="background:${colorV};">${abbrV}</div>
            <span class="team-name">${match.visitante}</span>
          </div>
        </div>
        <div class="progol-btns">
          <button class="progol-btn" data-match="${match.id}" data-pick="1" onclick="setPick(${match.id},'1',this)">1</button>
          <button class="progol-btn" data-match="${match.id}" data-pick="X" onclick="setPick(${match.id},'X',this)">X</button>
          <button class="progol-btn" data-match="${match.id}" data-pick="2" onclick="setPick(${match.id},'2',this)">2</button>
        </div>
      </div>`;
  }).join('');
}

window.setPick = function(matchId, pick, btn) {
  progolPicks[matchId] = pick;
  // Update button styles in that card
  const card = $(`card-${matchId}`);
  if (!card) return;
  card.querySelectorAll('.progol-btn').forEach(b => {
    b.classList.remove('active-1', 'active-x', 'active-2');
  });
  const cls = pick === '1' ? 'active-1' : pick === 'X' ? 'active-x' : 'active-2';
  btn.classList.add(cls);
  card.classList.add('selected');
  // Check completion
  const total = matchesForProgol.length;
  const filled = Object.keys(progolPicks).length;
  if (filled === total) {
    showToast('🎯 ¡Quiniela completa! Guárdala para verla.');
  }
};

/* ---- SAVE / CLEAR / SUMMARY ---- */
function initProgolActions() {
  $('saveProgol').addEventListener('click', () => {
    const total = matchesForProgol.length;
    const filled = Object.keys(progolPicks).length;
    if (filled === 0) {
      showToast('⚠️ Selecciona al menos un resultado');
      return;
    }
    renderSummary();
    $('progolSummary').style.display = 'block';
    $('progolSummary').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (filled < total) {
      showToast(`📋 Quiniela guardada (${filled}/${total} partidos)`);
    } else {
      showToast('🏆 Quiniela completa guardada!');
    }
  });

  $('clearProgol').addEventListener('click', () => {
    progolPicks = {};
    document.querySelectorAll('.progol-btn').forEach(b => {
      b.classList.remove('active-1', 'active-x', 'active-2');
    });
    document.querySelectorAll('.progol-card').forEach(c => c.classList.remove('selected'));
    $('progolSummary').style.display = 'none';
    showToast('🗑️ Quiniela borrada');
  });

  $('summaryClose').addEventListener('click', () => {
    $('progolSummary').style.display = 'none';
  });

  $('copyProgol').addEventListener('click', () => {
    const text = generateQuinielaText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast('📋 Quiniela copiada al portapapeles'));
    } else {
      showToast('No se pudo copiar. Copia manualmente.');
    }
  });
}

function renderSummary() {
  const grid = $('summaryContent');
  grid.innerHTML = matchesForProgol.map((match, idx) => {
    const pick = progolPicks[match.id];
    const badgeClass = pick ? `badge-${pick.toLowerCase()}` : 'badge-none';
    const pickLabel = pick || '?';
    const label = `${idx + 1}. ${match.local} vs ${match.visitante}`;
    return `
      <div class="summary-item">
        <span class="match-label" title="${label}">${label}</span>
        <span class="summary-badge ${badgeClass}">${pickLabel}</span>
      </div>`;
  }).join('');
}

function generateQuinielaText() {
  const lines = ['🏆 MI QUINIELA PROGOL - LIGA MX', '═'.repeat(35)];
  matchesForProgol.forEach((match, idx) => {
    const pick = progolPicks[match.id] || '?';
    lines.push(`${String(idx + 1).padStart(2, '0')}. ${match.local} vs ${match.visitante} → ${pick}`);
  });
  lines.push('═'.repeat(35));
  lines.push('Powered by UltraProgol · ultraprogol.vercel.app');
  return lines.join('\n');
}

/* ---- DATE HELPERS ---- */
function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return isoStr; }
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initProgolActions();
  loadAll();
});
