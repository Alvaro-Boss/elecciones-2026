const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const BASE = 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend/resumen-general';
const ELECCIONES = {
  presidencial: process.env.ID_PRES || '10',
  senado:       process.env.ID_SEN  || '15',
  diputados:    process.env.ID_DIP  || '12',
};
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Referer': 'https://resultadoelectoral.onpe.gob.pe/',
  'Origin':  'https://resultadoelectoral.onpe.gob.pe',
};

const cache = { presidencial: null, senado: null, diputados: null, lastFetch: null, onpeOnline: false };

// ─── Historial para el gráfico lineal ────────────────────────────────────────
// Guarda snapshots cada 5 min: { time, pctActas, candidatos: [{nombre, pct}] }
const historial = [];
const MAX_HISTORY = 288; // 24 horas a 5 min = 288 puntos

async function fetchONPE(tipo) {
  const id = ELECCIONES[tipo];
  try {
    const [totRes, partRes] = await Promise.all([
      fetch(`${BASE}/totales?idEleccion=${id}&tipoFiltro=eleccion`, { headers: HEADERS, timeout: 10000 }),
      fetch(`${BASE}/participantes?idEleccion=${id}&tipoFiltro=eleccion`, { headers: HEADERS, timeout: 10000 }),
    ]);
    if (!totRes.ok || !partRes.ok) return null;
    const totales       = await totRes.json();
    const participantes = await partRes.json();
    if (!totales.success || !participantes.success) return null;
    return { totales: totales.data, participantes: participantes.data };
  } catch (e) {
    console.error(`[ONPE] Error ${tipo}:`, e.message);
    return null;
  }
}

async function refreshCache() {
  console.log('[ONPE] Actualizando...', new Date().toISOString());
  const [pres, sen, dip] = await Promise.all([
    fetchONPE('presidencial'),
    fetchONPE('senado'),
    fetchONPE('diputados'),
  ]);
  cache.onpeOnline = !!(pres || sen || dip);
  cache.lastFetch  = new Date().toISOString();
  if (pres) cache.presidencial = pres;
  if (sen)  cache.senado       = sen;
  if (dip)  cache.diputados    = dip;

  // Guardar snapshot en historial si hay datos presidenciales
  if (pres && pres.participantes && pres.participantes.length > 0) {
    const t = Array.isArray(pres.totales) ? pres.totales[0] : pres.totales;
    let pctActas = null;
    if (t) {
      pctActas = t.porcentajeActas || t.porcentaje_actas;
      if (!pctActas && t.actasComputadas && t.totalActas) pctActas = t.actasComputadas/t.totalActas*100;
    }
    const snapshot = {
      time: new Date().toISOString(),
      pctActas: pctActas || 0,
      candidatos: pres.participantes
        .filter(p => p.porcentajeVotosValidos > 0)
        .sort((a,b) => b.porcentajeVotosValidos - a.porcentajeVotosValidos)
        .slice(0, 10) // top 10
        .map(p => ({
          nombre: p.nombreAgrupacionPolitica,
          candidato: p.nombreCandidato,
          pct: p.porcentajeVotosValidos,
          votos: p.totalVotosValidos,
        })),
    };
    // Solo añadir si hay datos reales (pctActas > 0)
    if (snapshot.pctActas > 0 || historial.length === 0) {
      historial.push(snapshot);
      if (historial.length > MAX_HISTORY) historial.shift();
    }
  }

  console.log(`[ONPE] Online: ${cache.onpeOnline} | Historial: ${historial.length} puntos`);
}

refreshCache();
setInterval(refreshCache, 5 * 60 * 1000);

// ─── API ──────────────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ onpeOnline: cache.onpeOnline, lastFetch: cache.lastFetch,
    hasData: { presidencial: !!cache.presidencial, senado: !!cache.senado, diputados: !!cache.diputados } });
});

app.get('/api/datos/:tipo', (req, res) => {
  const { tipo } = req.params;
  if (!['presidencial','senado','diputados'].includes(tipo)) return res.status(400).json({ error: 'Tipo invalido' });
  const data = cache[tipo];
  if (!data) return res.status(404).json({ error: 'Sin datos aun' });
  res.json({ ok: true, lastFetch: cache.lastFetch, ...data });
});

app.get('/api/historial', (req, res) => {
  res.json({ ok: true, puntos: historial.length, data: historial });
});

app.post('/api/refresh', async (req, res) => {
  await refreshCache();
  res.json({ ok: true, onpeOnline: cache.onpeOnline, lastFetch: cache.lastFetch });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => console.log(`🗳️  Elecciones Peru 2026 en puerto ${PORT}`));
