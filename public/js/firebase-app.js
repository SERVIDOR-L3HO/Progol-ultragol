/* ========================================
   ULTRAPROGOL - Firebase Auth + Firestore
   ======================================== */

const ADMIN_EMAIL = 'servidorl3ho@gmail.com';

/* ---- FIREBASE CONFIG ---- */
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

/* ---- CURRENT USER STATE ---- */
window.currentUser     = null;
window.currentProfile  = null;

/* ========================================
   AUTH STATE OBSERVER
   ======================================== */
auth.onAuthStateChanged(async user => {
  if (user) {
    window.currentUser = user;
    const profile = await loadProfile(user.uid);
    window.currentProfile = profile;

    // Update UI
    updateUserUI(user, profile);
    showApp();

    // If admin, show admin tab
    if (user.email === ADMIN_EMAIL) {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
    }
  } else {
    window.currentUser    = null;
    window.currentProfile = null;
    showLogin();
  }
});

/* ========================================
   LOGIN / REGISTER FUNCTIONS
   ======================================== */
async function login(email, password) {
  setAuthLoading(true);
  clearAuthError();
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    showAuthError(friendlyError(err.code));
  } finally {
    setAuthLoading(false);
  }
}

async function register(nombre, apellidos, email, password) {
  setAuthLoading(true);
  clearAuthError();
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;
    await cred.user.updateProfile({ displayName: `${nombre} ${apellidos}` });
    await db.collection('users').doc(uid).set({
      nombre,
      apellidos,
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    window.currentProfile = { nombre, apellidos, email };
  } catch (err) {
    showAuthError(friendlyError(err.code));
  } finally {
    setAuthLoading(false);
  }
}

window.logout = async function() {
  await auth.signOut();
  window.progolPicks = {};
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
};

/* ========================================
   PROFILE / QUINIELA FIRESTORE
   ======================================== */
async function loadProfile(uid) {
  try {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? snap.data() : null;
  } catch { return null; }
}

window.saveQuinielaToFirestore = async function(picks, matches) {
  if (!window.currentUser) return;
  const uid = window.currentUser.uid;
  const profile = window.currentProfile || {};
  try {
    await db.collection('quinielas').doc(uid).set({
      userId:    uid,
      nombre:    profile.nombre    || window.currentUser.displayName || '',
      apellidos: profile.apellidos || '',
      email:     window.currentUser.email,
      picks:     picks,
      matches:   matches.map(m => ({ id: m.id, local: m.local, visitante: m.visitante, jornada: m.jornada })),
      savedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Error saving quiniela:', err);
    return false;
  }
};

/* ========================================
   ADMIN: LOAD ALL QUINIELAS
   ======================================== */
window.loadAdminData = async function() {
  if (!window.currentUser || window.currentUser.email !== ADMIN_EMAIL) return;

  const container = document.getElementById('adminContent');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando datos...</p></div>';

  try {
    // Load all quinielas
    const snap = await db.collection('quinielas').get();
    const quinielas = [];
    snap.forEach(doc => quinielas.push({ id: doc.id, ...doc.data() }));

    // Load current match results
    let resultados = {};
    try {
      const res = await fetch('https://ultragol-api-3.vercel.app/marcadores');
      const data = await res.json();
      if (data.partidos) {
        data.partidos.forEach(p => {
          if (p.estado?.finalizado) {
            const localId     = p.local?.id;
            const visitanteId = p.visitante?.id;
            let resultado = 'E';
            if (p.local?.ganador)     resultado = 'L';
            if (p.visitante?.ganador) resultado = 'V';
            // Index by team ESPN ID for matching
            resultados[`${localId}_${visitanteId}`] = {
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

    renderAdminPanel(quinielas, resultados);
  } catch (err) {
    container.innerHTML = `<div class="no-matches"><div class="emoji">⚠️</div><h3>Error al cargar datos</h3><p>${err.message}</p></div>`;
  }
};

function calcScore(picks, matches, resultados) {
  let correctos = 0, incorrectos = 0, pendientes = 0;
  matches.forEach(m => {
    const pick     = picks[m.id];
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

function renderAdminPanel(quinielas, resultados) {
  const container = document.getElementById('adminContent');

  if (quinielas.length === 0) {
    container.innerHTML = `
      <div class="no-matches">
        <div class="emoji">📭</div>
        <h3>Sin quinielas registradas</h3>
        <p>Todavía ningún usuario ha guardado su quiniela.</p>
      </div>`;
    return;
  }

  // Calculate scores for ranking
  const ranked = quinielas.map(q => {
    const score = calcScore(q.picks || {}, q.matches || [], resultados);
    return { ...q, score };
  }).sort((a, b) => b.score.correctos - a.score.correctos);

  const maxCorrectos = ranked[0]?.score.correctos || 0;

  container.innerHTML = `
    <div class="admin-stats-row">
      <div class="admin-stat-card">
        <span class="admin-stat-num">${quinielas.length}</span>
        <span class="admin-stat-label">Participantes</span>
      </div>
      <div class="admin-stat-card">
        <span class="admin-stat-num">${maxCorrectos}</span>
        <span class="admin-stat-label">Máx. Aciertos</span>
      </div>
      <div class="admin-stat-card">
        <span class="admin-stat-num">${Object.keys(resultados).length}</span>
        <span class="admin-stat-label">Partidos Finalizados</span>
      </div>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador</th>
            <th>Email</th>
            <th>Aciertos</th>
            <th>Errores</th>
            <th>Pend.</th>
            <th>Total</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${ranked.map((q, idx) => renderAdminRow(q, idx + 1, resultados, maxCorrectos, ranked.length)).join('')}
        </tbody>
      </table>
    </div>
    <div class="admin-detail-container" id="adminDetailContainer"></div>
  `;
}

function playerStatus(score, maxCorrectos, totalJugadores) {
  const { correctos, incorrectos, pendientes, total } = score;
  const posibleMax = correctos + pendientes;
  if (correctos === maxCorrectos && maxCorrectos > 0) {
    return '<span class="status-badge status-ganando">🥇 Ganando</span>';
  }
  if (posibleMax < maxCorrectos) {
    return '<span class="status-badge status-eliminado">❌ Eliminado</span>';
  }
  return '<span class="status-badge status-carrera">📊 En carrera</span>';
}

function renderAdminRow(q, rank, resultados, maxCorrectos, totalJugadores) {
  const { correctos, incorrectos, pendientes, total } = q.score;
  const nombre = `${q.nombre || ''} ${q.apellidos || ''}`.trim() || 'Sin nombre';
  const status = playerStatus(q.score, maxCorrectos, totalJugadores);
  const pct = total > 0 ? Math.round((correctos / total) * 100) : 0;
  return `
    <tr class="admin-row" onclick="toggleDetail('${q.id}')" style="cursor:pointer">
      <td class="admin-rank">${rank}</td>
      <td class="admin-name">${nombre}</td>
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
      <td colspan="9">
        ${renderQuinielaDetail(q, resultados)}
      </td>
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
          const pick = picks[m.id];
          const localId     = window.TEAM_ESPN_IDS?.[m.local];
          const visitanteId = window.TEAM_ESPN_IDS?.[m.visitante];
          const key  = `${localId}_${visitanteId}`;
          const res  = resultados[key];
          let pickClass = 'pick-pending';
          let resultStr  = '⏳ Pendiente';
          if (res) {
            if (!pick) {
              pickClass = 'pick-nopick';
              resultStr  = `Resultado: <strong>${res.resultado}</strong> (${res.marcadorL}-${res.marcadorV})`;
            } else if (pick === res.resultado) {
              pickClass = 'pick-correct';
              resultStr = `✅ ${res.marcadorL}-${res.marcadorV}`;
            } else {
              pickClass = 'pick-wrong';
              resultStr = `❌ Fue ${res.resultado} (${res.marcadorL}-${res.marcadorV})`;
            }
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

window.toggleDetail = function(uid) {
  const row   = document.getElementById(`detail-${uid}`);
  const arrow = document.getElementById(`arrow-${uid}`);
  if (!row) return;
  const visible = row.style.display !== 'none';
  row.style.display  = visible ? 'none' : 'table-row';
  arrow.textContent  = visible ? '▼' : '▲';
};

/* ========================================
   UI HELPERS
   ======================================== */
function showApp() {
  document.getElementById('loginOverlay').style.display  = 'none';
  document.getElementById('mainApp').style.display       = 'block';
}
function showLogin() {
  document.getElementById('loginOverlay').style.display  = 'flex';
  document.getElementById('mainApp').style.display       = 'none';
}
function updateUserUI(user, profile) {
  const nombre = profile?.nombre || user.displayName || user.email;
  document.querySelectorAll('.user-name-display').forEach(el => {
    el.textContent = nombre;
  });
}
function setAuthLoading(on) {
  document.querySelectorAll('.auth-submit-btn').forEach(btn => {
    btn.disabled    = on;
    btn.textContent = on ? 'Cargando...' : btn.dataset.label;
  });
}
function showAuthError(msg) {
  document.querySelectorAll('.auth-error').forEach(el => {
    el.textContent = msg;
    el.style.display = 'block';
  });
}
function clearAuthError() {
  document.querySelectorAll('.auth-error').forEach(el => {
    el.textContent   = '';
    el.style.display = 'none';
  });
}
function friendlyError(code) {
  const map = {
    'auth/user-not-found':      'No existe una cuenta con ese correo.',
    'auth/wrong-password':      'Contraseña incorrecta.',
    'auth/email-already-in-use':'Ese correo ya está registrado.',
    'auth/weak-password':       'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email':       'El correo no es válido.',
    'auth/too-many-requests':   'Demasiados intentos. Espera un momento.',
    'auth/network-request-failed': 'Error de red. Verifica tu conexión.',
    'auth/invalid-credential':  'Correo o contraseña incorrectos.',
  };
  return map[code] || 'Error al iniciar sesión. Intenta de nuevo.';
}

/* ========================================
   INIT AUTH FORMS
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  /* --- TAB SWITCHING --- */
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

  /* --- LOGIN FORM --- */
  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    await login(email, password);
  });

  /* --- REGISTER FORM --- */
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
