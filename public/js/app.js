/* ========================================
   ULTRAPROGOL - LIGA MX · app.js
   ======================================== */

const API = 'https://ultragol-api-3.vercel.app';
/* ESPN logos by numeric team ID (confirmed working) */
const ESPN_LOGO_ID = id => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;

/* ---- TEAM DATA ---- */
const TEAM_COLORS = {
  'Chivas': '#cc0000', 'Guadalajara': '#cc0000',
  'Cruz Azul': '#1a3a6e',
  'Toluca': '#c8102e',
  'Pumas': '#003566', 'Pumas UNAM': '#003566',
  'Pachuca': '#10234d',
  'Atlas': '#8b0000',
  'Tigres': '#f9a01b', 'Tigres UANL': '#f9a01b',
  'Club América': '#c8a900', 'América': '#c8a900',
  'Monterrey': '#1a2d6e',
  'Juárez': '#e07b00', 'FC Juarez': '#e07b00',
  'Necaxa': '#c8102e',
  'León': '#005c1e',
  'Tijuana': '#222222',
  'Puebla': '#003087',
  'San Luis': '#cc0000', 'Atlético de San Luis': '#cc0000',
  'Mazatlán': '#002a6e', 'Mazatlán FC': '#002a6e',
  'Querétaro': '#1a5fa8',
  'Santos Laguna': '#017a30', 'Santos': '#017a30',
};

/* ESPN numeric team IDs → confirmed working URLs */
const TEAM_ESPN_IDS = {
  'Chivas': 219, 'Guadalajara': 219,
  'Cruz Azul': 218,
  'Toluca': 223,
  'Pumas': 233, 'Pumas UNAM': 233,
  'Pachuca': 234,
  'Atlas': 216,
  'Tigres': 232, 'Tigres UANL': 232,
  'Club América': 227, 'América': 227,
  'Monterrey': 220,
  'Juárez': 17851, 'FC Juarez': 17851,
  'Necaxa': 229,
  'León': 228,
  'Tijuana': 10125,
  'Puebla': 231,
  'San Luis': 15720, 'Atlético de San Luis': 15720,
  'Mazatlán': 20702, 'Mazatlán FC': 20702,
  'Querétaro': 222,
  'Santos Laguna': 225, 'Santos': 225,
};

const TEAM_ABBR = {
  'Chivas': 'GDL', 'Guadalajara': 'GDL',
  'Cruz Azul': 'CRZ', 'Toluca': 'TOL',
  'Pumas': 'PUM', 'Pumas UNAM': 'PUM',
  'Pachuca': 'PAC', 'Atlas': 'ATL',
  'Tigres': 'TIG', 'Tigres UANL': 'TIG',
  'Club América': 'AME', 'América': 'AME',
  'Monterrey': 'MTY', 'Juárez': 'JUA', 'FC Juarez': 'JUA',
  'Necaxa': 'NEC', 'León': 'LEO', 'Tijuana': 'TIJ',
  'Puebla': 'PUE', 'San Luis': 'SLP', 'Atlético de San Luis': 'SLP',
  'Mazatlán': 'MAZ', 'Mazatlán FC': 'MAZ',
  'Querétaro': 'QRO', 'Santos Laguna': 'SAN', 'Santos': 'SAN',
};

function getTeamColor(name) { return TEAM_COLORS[name] || '#374151'; }
function getTeamAbbr(name) {
  if (TEAM_ABBR[name]) return TEAM_ABBR[name];
  const words = name.split(' ');
  return words.length === 1 ? name.substring(0, 3).toUpperCase() : words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function getTeamLogo(name) {
  const id = TEAM_ESPN_IDS[name];
  return id ? ESPN_LOGO_ID(id) : null;
}

/* Render a team logo image with fallback colored badge */
function teamLogoHTML(name, size = 'md') {
  const logo = getTeamLogo(name);
  const color = getTeamColor(name);
  const abbr = getTeamAbbr(name);
  const cls = size === 'sm' ? 'team-logo-sm' : size === 'lg' ? 'team-logo-lg' : 'team-logo-md';
  if (logo) {
    return `<div class="team-logo-wrap ${cls}" style="--fallback:${color}">
      <img src="${logo}" alt="${name}" class="team-logo-img" onerror="this.parentElement.innerHTML='<span class=\\'logo-fallback\\' style=\\'background:${color}\\'>${abbr}</span>'">
    </div>`;
  }
  return `<div class="team-logo-wrap ${cls}"><span class="logo-fallback" style="background:${color}">${abbr}</span></div>`;
}

/* ---- STATE ---- */
let progolPicks = {}; // { matchId: 'L'|'E'|'V' }
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
  document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      switchTab(link.dataset.tab);
      $('mobileMenu').classList.remove('open');
    });
  });
  $('heroBtn').addEventListener('click', () => switchTab('progol'));
  $('heroBtnTabla').addEventListener('click', () => switchTab('tabla'));
  $('hamburger').addEventListener('click', () => $('mobileMenu').classList.toggle('open'));
  window.addEventListener('scroll', () => {
    $('navbar').classList.toggle('scrolled', window.scrollY > 10);
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const section = $(`tab-${tab}`);
  if (section) section.classList.add('active');
  document.querySelectorAll(`.nav-link[data-tab="${tab}"]`).forEach(l => l.classList.add('active'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---- FETCH ---- */
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

/* ---- LOAD ALL ---- */
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
  const totalGF = tabla.reduce((s, t) => s + (t.estadisticas?.gf || 0), 0) / 2;
  $('statGoles').textContent = Math.round(totalGF);
  if (tabla.length > 0) $('statLider').textContent = getTeamAbbr(tabla[0].equipo);
  $('statJornada').textContent = tablaJson.jornadasTotales || '—';
}

/* ---- TABLA ---- */
function renderTabla(tabla, updated) {
  const tbody = $('standingsBody');
  if (!tabla || tabla.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">Sin datos disponibles</td></tr>';
    return;
  }
  if (updated) $('tablaFuente').textContent = `Liga MX · Actualizado: ${formatDate(updated)}`;

  tbody.innerHTML = tabla.map(team => {
    const pos = team.posicion;
    const s = team.estadisticas || {};
    const zoneClass = pos <= 8 ? 'zone-liguilla' : pos <= 12 ? 'zone-repechaje' : pos >= 17 ? 'zone-descenso' : '';
    const dif = s.dif >= 0 ? `+${s.dif}` : s.dif;
    const difClass = s.dif > 0 ? 'dif-pos' : s.dif < 0 ? 'dif-neg' : '';
    return `
      <tr class="${zoneClass}">
        <td class="pos">${pos}</td>
        <td>
          <div class="team-cell">
            ${teamLogoHTML(team.equipo, 'sm')}
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
    const trophyLabel = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '';
    const initials = g.jugador.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    const color = getTeamColor(g.equipo);
    return `
      <div class="goleador-card">
        <div class="goleador-rank ${rankClass}">${pos}</div>
        <div class="goleador-avatar" style="background:${color};">${initials}</div>
        <div class="goleador-info">
          <div class="goleador-name">${trophyLabel} ${g.jugador}</div>
          <div class="goleador-team">${teamLogoHTML(g.equipo, 'sm')} ${g.equipo}</div>
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
        <p>El calendario no tiene partidos en este momento.<br>Vuelve más tarde para ver los próximos encuentros.</p>
      </div>`;
    return;
  }
  const jornadas = {};
  calendario.forEach(m => {
    const j = m.jornada || 'Próximos';
    if (!jornadas[j]) jornadas[j] = [];
    jornadas[j].push(m);
  });
  container.innerHTML = Object.entries(jornadas).map(([j, matches]) => `
    <div class="jornada-section">
      <div class="jornada-title">Jornada ${j}</div>
      <div class="calendario-grid">${matches.map(m => renderCalMatch(m)).join('')}</div>
    </div>`).join('');
}

function renderCalMatch(m) {
  const local = m.local || m.equipo_local || 'Local';
  const visitante = m.visitante || m.equipo_visitante || 'Visitante';
  const marcador = m.marcador || null;
  const estado = m.estado || m.status || 'próximo';
  let scores = '<span class="cal-dash">vs</span>';
  if (marcador && (marcador.local !== undefined || marcador.goles_local !== undefined)) {
    const gl = marcador.local ?? marcador.goles_local ?? '-';
    const gv = marcador.visitante ?? marcador.goles_visitante ?? '-';
    scores = `<span class="cal-score">${gl}</span><span class="cal-dash">-</span><span class="cal-score">${gv}</span>`;
  }
  const est = (estado || '').toLowerCase();
  let statusBadge = '';
  if (est.includes('viv') || est.includes('live') || est.includes("'")) {
    statusBadge = `<span class="cal-status status-live">⚡ EN VIVO</span>`;
  } else if (est.includes('fin') || est.includes('term') || est.includes('ft')) {
    statusBadge = `<span class="cal-status status-finished">FT</span>`;
  } else {
    statusBadge = `<span class="cal-status status-upcoming">${m.hora || m.time || 'Próximo'}</span>`;
  }
  return `
    <div class="cal-card">
      <div class="cal-team">
        ${teamLogoHTML(local, 'sm')}
        <span class="cal-team-name">${local}</span>
      </div>
      <div class="cal-center">
        <div class="cal-score-box">${scores}</div>
        ${statusBadge}
      </div>
      <div class="cal-team away">
        ${teamLogoHTML(visitante, 'sm')}
        <span class="cal-team-name">${visitante}</span>
      </div>
    </div>`;
}

/* ---- PROGOL ---- */
function buildProgolMatches(calendario, tablaJson) {
  const container = $('progolMatches');
  if (calendario && calendario.length > 0) {
    matchesForProgol = calendario.slice(0, 14).map((m, i) => ({
      id: i,
      local: m.local || m.equipo_local || `Equipo ${i * 2 + 1}`,
      visitante: m.visitante || m.equipo_visitante || `Equipo ${i * 2 + 2}`,
      jornada: m.jornada || '—', hora: m.hora || m.time || '', fecha: m.fecha || '',
    }));
  } else if (tablaJson && tablaJson.tabla && tablaJson.tabla.length >= 2) {
    const equipos = tablaJson.tabla.map(t => t.equipo);
    matchesForProgol = [[0,17],[1,16],[2,15],[3,14],[4,13],[5,12],[6,11],[7,10],[8,9]]
      .map((pair, i) => ({ id: i, local: equipos[pair[0]] || `Equipo ${pair[0]+1}`, visitante: equipos[pair[1]] || `Equipo ${pair[1]+1}`, jornada: '13', hora: '', fecha: '' }));
  } else {
    matchesForProgol = [
      { id:0, local:'Chivas', visitante:'Cruz Azul', jornada:'13', hora:'17:00', fecha:'' },
      { id:1, local:'Toluca', visitante:'Pumas UNAM', jornada:'13', hora:'19:00', fecha:'' },
      { id:2, local:'Pachuca', visitante:'Atlas', jornada:'13', hora:'19:00', fecha:'' },
      { id:3, local:'Tigres UANL', visitante:'Club América', jornada:'13', hora:'21:00', fecha:'' },
      { id:4, local:'Monterrey', visitante:'Necaxa', jornada:'13', hora:'21:00', fecha:'' },
      { id:5, local:'León', visitante:'FC Juarez', jornada:'13', hora:'17:00', fecha:'' },
      { id:6, local:'Tijuana', visitante:'Puebla', jornada:'13', hora:'18:00', fecha:'' },
      { id:7, local:'Atlético de San Luis', visitante:'Mazatlán FC', jornada:'13', hora:'20:00', fecha:'' },
      { id:8, local:'Querétaro', visitante:'Santos Laguna', jornada:'13', hora:'20:00', fecha:'' },
    ];
  }
  renderProgolMatches(container, matchesForProgol);
}

function renderProgolMatches(container, matches) {
  if (!matches || matches.length === 0) {
    container.innerHTML = `<div class="no-matches" style="grid-column:1/-1"><div class="emoji">📋</div><h3>Sin partidos</h3><p>No hay partidos disponibles ahora.</p></div>`;
    return;
  }
  container.innerHTML = matches.map((match, idx) => {
    const hora = match.hora || '';
    const dateStr = match.fecha ? ` · ${match.fecha}` : '';
    return `
      <div class="progol-card" id="card-${match.id}">
        <div class="match-num">
          <span>Partido ${idx + 1} · J${match.jornada}</span>
          <span class="match-date">${hora}${dateStr}</span>
        </div>
        <div class="match-teams">
          <div class="match-team">
            ${teamLogoHTML(match.local, 'lg')}
            <span class="team-name">${match.local}</span>
          </div>
          <div class="match-vs">VS</div>
          <div class="match-team">
            ${teamLogoHTML(match.visitante, 'lg')}
            <span class="team-name">${match.visitante}</span>
          </div>
        </div>
        <div class="progol-btns">
          <button class="progol-btn btn-l" data-match="${match.id}" data-pick="L" onclick="setPick(${match.id},'L',this)">
            <span class="btn-pick-label">L</span>
            <span class="btn-pick-sub">Local</span>
          </button>
          <button class="progol-btn btn-e" data-match="${match.id}" data-pick="E" onclick="setPick(${match.id},'E',this)">
            <span class="btn-pick-label">E</span>
            <span class="btn-pick-sub">Empate</span>
          </button>
          <button class="progol-btn btn-v" data-match="${match.id}" data-pick="V" onclick="setPick(${match.id},'V',this)">
            <span class="btn-pick-label">V</span>
            <span class="btn-pick-sub">Visita</span>
          </button>
        </div>
      </div>`;
  }).join('');
}

window.setPick = function(matchId, pick, btn) {
  progolPicks[matchId] = pick;
  const card = $(`card-${matchId}`);
  if (!card) return;
  card.querySelectorAll('.progol-btn').forEach(b => b.classList.remove('active-l', 'active-e', 'active-v'));
  const cls = pick === 'L' ? 'active-l' : pick === 'E' ? 'active-e' : 'active-v';
  btn.classList.add(cls);
  card.classList.add('selected');
  if (Object.keys(progolPicks).length === matchesForProgol.length) {
    showToast('🎯 ¡Quiniela completa! Guárdala para verla.');
  }
};

/* ---- SAVE / CLEAR / SUMMARY ---- */
function initProgolActions() {
  $('saveProgol').addEventListener('click', () => {
    const filled = Object.keys(progolPicks).length;
    if (filled === 0) { showToast('⚠️ Selecciona al menos un resultado'); return; }
    renderSummary();
    $('progolSummary').style.display = 'block';
    $('progolSummary').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const total = matchesForProgol.length;
    showToast(filled < total ? `📋 Quiniela guardada (${filled}/${total} partidos)` : '🏆 ¡Quiniela completa guardada!');
  });

  $('clearProgol').addEventListener('click', () => {
    progolPicks = {};
    document.querySelectorAll('.progol-btn').forEach(b => b.classList.remove('active-l', 'active-e', 'active-v'));
    document.querySelectorAll('.progol-card').forEach(c => c.classList.remove('selected'));
    $('progolSummary').style.display = 'none';
    showToast('🗑️ Quiniela borrada');
  });

  $('summaryClose').addEventListener('click', () => { $('progolSummary').style.display = 'none'; });

  $('copyProgol').addEventListener('click', () => {
    const text = generateQuinielaText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast('📋 Quiniela copiada al portapapeles'));
    } else {
      showToast('No se pudo copiar automáticamente');
    }
  });
}

function renderSummary() {
  $('summaryContent').innerHTML = matchesForProgol.map((match, idx) => {
    const pick = progolPicks[match.id];
    const badgeClass = pick === 'L' ? 'badge-l' : pick === 'E' ? 'badge-e' : pick === 'V' ? 'badge-v' : 'badge-none';
    const label = `${idx + 1}. ${match.local} vs ${match.visitante}`;
    return `
      <div class="summary-item">
        <span class="match-label" title="${label}">${label}</span>
        <span class="summary-badge ${badgeClass}">${pick || '?'}</span>
      </div>`;
  }).join('');
}

function generateQuinielaText() {
  const lines = ['🏆 MI QUINIELA PROGOL - LIGA MX', '═'.repeat(38)];
  matchesForProgol.forEach((match, idx) => {
    const pick = progolPicks[match.id] || '?';
    const label = pick === 'L' ? 'LOCAL' : pick === 'E' ? 'EMPATE' : pick === 'V' ? 'VISITA' : '?';
    lines.push(`${String(idx+1).padStart(2,'0')}. ${match.local} vs ${match.visitante} → [${pick}] ${label}`);
  });
  lines.push('═'.repeat(38));
  lines.push('UltraProgol · ultraprogol.vercel.app');
  return lines.join('\n');
}

/* ---- DATE HELPERS ---- */
function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleDateString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  } catch { return isoStr; }
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initProgolActions();
  loadAll();
});
