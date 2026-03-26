/* ========================================
   ULTRAPROGOL - Firebase Auth + Firestore
   ======================================== */

const ADMIN_EMAIL = 'servidorl3ho@gmail.com';

const firebaseConfig = {
  apiKey: "AIzaSyCAGrsMjwPLIaDbExIUYVg35QS1kssXDH4",
  authDomain: "ultragol-api.firebaseapp.com",
  projectId: "ultragol-api",
  storageBucket: "ultragol-api.firebasestorage.app",
  messagingSenderId: "62425304873",
  appId: "1:62425304873:web:837ab613a4abe12be43138"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

window.currentUser    = null;
window.currentProfile = null;

/* ========================================
   AUTH STATE OBSERVER
   ======================================== */
auth.onAuthStateChanged(async user => {
  if (user) {
    window.currentUser = user;
    const profile = await loadProfile(user.uid);
    window.currentProfile = profile;
    updateUserUI(user, profile);
    showApp();
    if (user.email === ADMIN_EMAIL) {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
    }
    // Auto-load leaderboard data when tab is opened
  } else {
    window.currentUser    = null;
    window.currentProfile = null;
    showLogin();
  }
});

/* ========================================
   LOGIN / REGISTER
   ======================================== */
async function login(email, password) {
  setAuthLoading(true); clearAuthError();
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) { showAuthError(friendlyError(err.code)); }
  finally { setAuthLoading(false); }
}

async function register(nombre, apellidos, email, password) {
  setAuthLoading(true); clearAuthError();
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;
    await cred.user.updateProfile({ displayName: `${nombre} ${apellidos}` });
    await db.collection('users').doc(uid).set({
      nombre, apellidos, email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    window.currentProfile = { nombre, apellidos, email };
  } catch (err) { showAuthError(friendlyError(err.code)); }
  finally { setAuthLoading(false); }
}

window.logout = async function() {
  await auth.signOut();
  window.quinielaStates = { 1: {}, 2: {} };
  window.activeQuiniela = 1;
  window.progolPicks    = {};
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
};

/* ========================================
   PROFILE
   ======================================== */
async function loadProfile(uid) {
  try {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? snap.data() : null;
  } catch { return null; }
}

/* ========================================
   SAVE QUINIELA (with quiniela number)
   ======================================== */
window.saveQuinielaToFirestore = async function(picks, matches, quinielaNum = 1) {
  if (!window.currentUser) return false;
  const uid     = window.currentUser.uid;
  const profile = window.currentProfile || {};
  const docId   = `${uid}_${quinielaNum}`;
  try {
    await db.collection('quinielas').doc(docId).set({
      userId:      uid,
      quinielaNum: quinielaNum,
      nombre:      profile.nombre    || window.currentUser.displayName || '',
      apellidos:   profile.apellidos || '',
      email:       window.currentUser.email,
      picks:       picks,
      matches:     matches.map(m => ({ id: m.id, local: m.local, visitante: m.visitante, jornada: m.jornada })),
      savedAt:     firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Error saving quiniela:', err);
    return false;
  }
};

/* ========================================
   SHARED: FETCH MATCH RESULTS
   ======================================== */
async function fetchResultados() {
  const resultados = {};
  try {
    const res  = await fetch('https://ultragol-api-3.vercel.app/marcadores');
    const data = await res.json();
    if (data.partidos) {
      data.partidos.forEach(p => {
        if (p.estado?.finalizado) {
          let resultado = 'E';
          if (p.local?.ganador)     resultado = 'L';
          if (p.visitante?.ganador) resultado = 'V';
          resultados[`${p.local?.id}_${p.visitante?.id}`] = {
            resultado,
            local:     p.local?.nombre,
            visitante: p.visitante?.nombre,
            marcadorL: p.local?.marcador,
            marcadorV: p.visitante?.marcador,
          };
        }
      });
    }
  } catch {}
  return resultados;
}

/* ========================================
   SHARED: CALC SCORE
   ======================================== */
function calcScore(picks, matches, resultados) {
  let correctos = 0, incorrectos = 0, pendientes = 0;
  matches.forEach(m => {
    const pick = picks[m.id];
    if (!pick) { pendientes++; return; }
    const localId     = window.TEAM_ESPN_IDS?.[m.local];
    const visitanteId = window.TEAM_ESPN_IDS?.[m.visitante];
    const key         = `${localId}_${visitanteId}`;
    const res         = resultados[key];
    if (!res) { pendientes++; }
    else if (pick === res.resultado) { correctos++; }
    else { incorrectos++; }
  });
  return { correctos, incorrectos, pendientes, total: matches.length };
}

/* ========================================
   PUBLIC LEADERBOARD
   ======================================== */
window.loadLeaderboard = async function() {
  if (!window.currentUser) return;
  const podiumWrap       = document.getElementById('podiumWrap');
  const leaderboardContent = document.getElementById('leaderboardContent');
  const winnerBanner     = document.getElementById('winnerBanner');
  if (!podiumWrap) return;

  podiumWrap.innerHTML         = '<div class="loading-state"><div class="spinner"></div><p>Cargando posiciones...</p></div>';
  leaderboardContent.innerHTML = '';
  if (winnerBanner) winnerBanner.style.display = 'none';

  try {
    const snap     = await db.collection('quinielas').get();
    const quinielas = [];
    snap.forEach(doc => quinielas.push({ id: doc.id, ...doc.data() }));

    if (quinielas.length === 0) {
      podiumWrap.innerHTML = `<div class="no-matches"><div class="emoji">📭</div><h3>Sin participantes aún</h3><p>Nadie ha guardado su quiniela todavía.</p></div>`;
      return;
    }

    const resultados = await fetchResultados();

    const scored = quinielas.map(q => {
      const score = calcScore(q.picks || {}, q.matches || [], resultados);
      return { ...q, score };
    }).sort((a, b) =>
      b.score.correctos - a.score.correctos ||
      a.score.incorrectos - b.score.incorrectos
    );

    renderLeaderboard(scored, resultados, winnerBanner, podiumWrap, leaderboardContent);
  } catch (err) {
    podiumWrap.innerHTML = `<div class="no-matches"><div class="emoji">⚠️</div><h3>Error al cargar</h3><p>${err.message}</p></div>`;
  }
};

function renderLeaderboard(ranked, resultados, winnerBanner, podiumWrap, leaderboardContent) {
  const maxCorrectos = ranked[0]?.score.correctos || 0;
  const total        = ranked[0]?.matches?.length  || 9;
  const allDone      = ranked.every(q => q.score.pendientes === 0);

  // Winner announcement
  if (winnerBanner) {
    const leaders = ranked.filter(q => q.score.correctos === maxCorrectos && maxCorrectos > 0);
    if (leaders.length > 0) {
      const names = leaders.map(q => `<strong>${q.nombre} ${q.apellidos}</strong>`).join(' y ');
      winnerBanner.innerHTML = leaders.length === 1
        ? `🥇 ¡Líder actual: ${names} con ${maxCorrectos} aciertos!`
        : `🥇 ¡Empate en la cima: ${names} — ${maxCorrectos} aciertos!`;
      winnerBanner.style.display = 'flex';
    }
  }

  // Podium (top 3 but highlight 1st & 2nd)
  const top3 = ranked.slice(0, 3);
  const podiumOrder = top3.length >= 2
    ? [top3[1], top3[0], top3[2]].filter(Boolean)
    : top3;

  podiumWrap.innerHTML = `
    <div class="podium">
      ${podiumOrder.map((q, visIdx) => {
        const rankPos  = ranked.indexOf(q) + 1;
        const medals   = ['🥇','🥈','🥉'];
        const isTop    = rankPos === 1;
        const pctW     = total > 0 ? Math.round((q.score.correctos / total) * 100) : 0;
        const nombre   = `${q.nombre || ''} ${q.apellidos || ''}`.trim() || 'Usuario';
        const quinNum  = q.quinielaNum ? ` · Q${q.quinielaNum}` : '';
        const status   = playerStatus(q.score, maxCorrectos);
        return `
          <div class="podium-place podium-${rankPos} ${isTop ? 'podium-winner' : ''}">
            <div class="podium-medal">${medals[rankPos - 1] || rankPos}</div>
            <div class="podium-avatar">${nombre.charAt(0).toUpperCase()}</div>
            <div class="podium-name">${nombre}</div>
            <div class="podium-sub">${q.email || ''}${quinNum}</div>
            <div class="podium-score">${q.score.correctos}<span>/${total}</span></div>
            <div class="podium-bar-wrap">
              <div class="podium-bar" style="width:${pctW}%"></div>
            </div>
            <div class="podium-status">${status}</div>
          </div>`;
      }).join('')}
    </div>`;

  // Full table
  leaderboardContent.innerHTML = `
    <div class="lb-table-wrap">
      <table class="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Participante</th>
            <th>Q</th>
            <th>✅ Aciertos</th>
            <th>❌ Errores</th>
            <th>⏳ Pend.</th>
            <th>Progreso</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${ranked.map((q, idx) => {
            const nombre  = `${q.nombre || ''} ${q.apellidos || ''}`.trim() || 'Usuario';
            const { correctos, incorrectos, pendientes } = q.score;
            const pct     = total > 0 ? Math.round((correctos / total) * 100) : 0;
            const status  = playerStatus(q.score, maxCorrectos);
            const isSelf  = q.userId === window.currentUser?.uid;
            return `
              <tr class="${isSelf ? 'lb-self-row' : ''}">
                <td class="lb-rank">${idx + 1}</td>
                <td class="lb-name">${nombre}${isSelf ? ' <span class="lb-you">Tú</span>' : ''}</td>
                <td class="lb-qnum">Q${q.quinielaNum || 1}</td>
                <td class="lb-correct">${correctos}</td>
                <td class="lb-wrong">${incorrectos}</td>
                <td class="lb-pend">${pendientes}</td>
                <td class="lb-prog">
                  <div class="score-bar-wrap">
                    <div class="score-bar" style="width:${pct}%"></div>
                    <span>${correctos}/${total}</span>
                  </div>
                </td>
                <td>${status}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function playerStatus(score, maxCorrectos) {
  const { correctos, incorrectos, pendientes } = score;
  const posibleMax = correctos + pendientes;
  if (correctos === maxCorrectos && maxCorrectos > 0)
    return '<span class="status-badge status-ganando">🥇 Ganando</span>';
  if (posibleMax < maxCorrectos)
    return '<span class="status-badge status-eliminado">❌ Eliminado</span>';
  return '<span class="status-badge status-carrera">📊 En carrera</span>';
}

/* ========================================
   ADMIN PANEL
   ======================================== */
window.loadAdminData = async function() {
  if (!window.currentUser || window.currentUser.email !== ADMIN_EMAIL) return;
  const container = document.getElementById('adminContent');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando datos...</p></div>';
  try {
    const snap = await db.collection('quinielas').get();
    const quinielas = [];
    snap.forEach(doc => quinielas.push({ id: doc.id, ...doc.data() }));
    const resultados = await fetchResultados();
    renderAdminPanel(quinielas, resultados);
  } catch (err) {
    container.innerHTML = `<div class="no-matches"><div class="emoji">⚠️</div><h3>Error</h3><p>${err.message}</p></div>`;
  }
};

function calcScoreAdmin(picks, matches, resultados) {
  return calcScore(picks, matches, resultados);
}

function renderAdminPanel(quinielas, resultados) {
  const container = document.getElementById('adminContent');
  if (quinielas.length === 0) {
    container.innerHTML = `<div class="no-matches"><div class="emoji">📭</div><h3>Sin quinielas registradas</h3><p>Nadie ha guardado su quiniela aún.</p></div>`;
    return;
  }
  const ranked = quinielas.map(q => {
    const score = calcScore(q.picks || {}, q.matches || [], resultados);
    return { ...q, score };
  }).sort((a, b) => b.score.correctos - a.score.correctos);
  const maxCorrectos = ranked[0]?.score.correctos || 0;

  container.innerHTML = `
    <div class="admin-stats-row">
      <div class="admin-stat-card">
        <span class="admin-stat-num">${quinielas.length}</span>
        <span class="admin-stat-label">Quinielas</span>
      </div>
      <div class="admin-stat-card">
        <span class="admin-stat-num">${[...new Set(quinielas.map(q=>q.userId))].length}</span>
        <span class="admin-stat-label">Participantes</span>
      </div>
      <div class="admin-stat-card">
        <span class="admin-stat-num">${maxCorrectos}</span>
        <span class="admin-stat-label">Máx. Aciertos</span>
      </div>
      <div class="admin-stat-card">
        <span class="admin-stat-num">${Object.keys(resultados).length}</span>
        <span class="admin-stat-label">Resultados</span>
      </div>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr><th>#</th><th>Jugador</th><th>Q</th><th>Email</th><th>✅</th><th>❌</th><th>⏳</th><th>Progreso</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          ${ranked.map((q, idx) => renderAdminRow(q, idx + 1, resultados, maxCorrectos)).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAdminRow(q, rank, resultados, maxCorrectos) {
  const { correctos, incorrectos, pendientes, total } = q.score;
  const nombre  = `${q.nombre || ''} ${q.apellidos || ''}`.trim() || 'Sin nombre';
  const status  = playerStatus(q.score, maxCorrectos);
  const pct     = total > 0 ? Math.round((correctos / total) * 100) : 0;
  const qNum    = q.quinielaNum || 1;
  return `
    <tr class="admin-row" onclick="toggleDetail('${q.id}')" style="cursor:pointer">
      <td class="admin-rank">${rank}</td>
      <td class="admin-name">${nombre}</td>
      <td><span class="q-badge">Q${qNum}</span></td>
      <td class="admin-email">${q.email || '—'}</td>
      <td class="admin-correctos">${correctos}</td>
      <td class="admin-incorrectos">${incorrectos}</td>
      <td class="admin-pendientes">${pendientes}</td>
      <td class="admin-total">
        <div class="score-bar-wrap">
          <div class="score-bar" style="width:${pct}%"></div>
          <span>${correctos}/${total}</span>
        </div>
      </td>
      <td>${status}</td>
      <td class="admin-expand"><span id="arrow-${q.id}">▼</span></td>
    </tr>
    <tr class="admin-detail-row" id="detail-${q.id}" style="display:none">
      <td colspan="10">${renderQuinielaDetail(q, resultados)}</td>
    </tr>`;
}

function renderQuinielaDetail(q, resultados) {
  const picks   = q.picks   || {};
  const matches = q.matches || [];
  if (matches.length === 0) return '<div class="detail-empty">Sin partidos en esta quiniela</div>';
  return `
    <div class="quiniela-detail">
      <div class="detail-picks-grid">
        ${matches.map((m, idx) => {
          const pick        = picks[m.id];
          const localId     = window.TEAM_ESPN_IDS?.[m.local];
          const visitanteId = window.TEAM_ESPN_IDS?.[m.visitante];
          const res         = resultados[`${localId}_${visitanteId}`];
          let pickClass = 'pick-pending', resultStr = '⏳ Pendiente';
          if (res) {
            if (!pick)                { pickClass = 'pick-nopick';  resultStr = `Resultado: <strong>${res.resultado}</strong> (${res.marcadorL}-${res.marcadorV})`; }
            else if (pick === res.resultado) { pickClass = 'pick-correct'; resultStr = `✅ ${res.marcadorL}-${res.marcadorV}`; }
            else                      { pickClass = 'pick-wrong';   resultStr = `❌ Fue ${res.resultado} (${res.marcadorL}-${res.marcadorV})`; }
          }
          const logoL = localId     ? `https://a.espncdn.com/i/teamlogos/soccer/500/${localId}.png`     : '';
          const logoV = visitanteId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${visitanteId}.png` : '';
          return `
            <div class="detail-match ${pickClass}">
              <div class="detail-match-num">P${idx + 1}</div>
              <div class="detail-teams">
                ${logoL ? `<img src="${logoL}" class="detail-logo" alt="${m.local}">` : ''}
                <span class="detail-team">${m.local}</span>
                <span class="detail-vs">vs</span>
                <span class="detail-team">${m.visitante}</span>
                ${logoV ? `<img src="${logoV}" class="detail-logo" alt="${m.visitante}">` : ''}
              </div>
              <div class="detail-pick-badge pick-badge-${(pick||'none').toLowerCase()}">${pick || '?'}</div>
              <div class="detail-result">${resultStr}</div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

window.toggleDetail = function(id) {
  const row   = document.getElementById(`detail-${id}`);
  const arrow = document.getElementById(`arrow-${id}`);
  if (!row) return;
  const visible = row.style.display !== 'none';
  row.style.display = visible ? 'none' : 'table-row';
  arrow.textContent = visible ? '▼' : '▲';
};

/* ========================================
   UI HELPERS
   ======================================== */
function showApp()   { document.getElementById('loginOverlay').style.display = 'none';  document.getElementById('mainApp').style.display = 'block'; }
function showLogin() { document.getElementById('loginOverlay').style.display = 'flex';  document.getElementById('mainApp').style.display = 'none';  }

function updateUserUI(user, profile) {
  const nombre = profile?.nombre || user.displayName || user.email;
  document.querySelectorAll('.user-name-display').forEach(el => el.textContent = nombre);
}
function setAuthLoading(on) {
  document.querySelectorAll('.auth-submit-btn').forEach(btn => {
    btn.disabled    = on;
    btn.textContent = on ? 'Cargando...' : btn.dataset.label;
  });
}
function showAuthError(msg) {
  document.querySelectorAll('.auth-error').forEach(el => { el.textContent = msg; el.style.display = 'block'; });
}
function clearAuthError() {
  document.querySelectorAll('.auth-error').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
}
function friendlyError(code) {
  const map = {
    'auth/user-not-found':        'No existe una cuenta con ese correo.',
    'auth/wrong-password':        'Contraseña incorrecta.',
    'auth/email-already-in-use':  'Ese correo ya está registrado.',
    'auth/weak-password':         'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email':         'El correo no es válido.',
    'auth/too-many-requests':     'Demasiados intentos. Espera un momento.',
    'auth/network-request-failed':'Error de red. Verifica tu conexión.',
    'auth/invalid-credential':    'Correo o contraseña incorrectos.',
  };
  return map[code] || 'Error al iniciar sesión. Intenta de nuevo.';
}

/* ========================================
   INIT AUTH FORMS
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.auth-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
      clearAuthError();
    });
  });

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    await login(document.getElementById('loginEmail').value.trim(), document.getElementById('loginPassword').value);
  });

  document.getElementById('registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const nombre    = document.getElementById('regNombre').value.trim();
    const apellidos = document.getElementById('regApellidos').value.trim();
    const email     = document.getElementById('regEmail').value.trim();
    const password  = document.getElementById('regPassword').value;
    const confirm   = document.getElementById('regConfirm').value;
    if (password !== confirm) { showAuthError('Las contraseñas no coinciden.'); return; }
    if (!nombre || !apellidos) { showAuthError('Ingresa nombre y apellidos.'); return; }
    await register(nombre, apellidos, email, password);
  });
});
