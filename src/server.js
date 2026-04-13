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
const historial = [];
const MAX_HISTORY = 288;

function extractPctActas(totalesData) {
  // totalesData puede ser objeto directo o array
  const t = Array.isArray(totalesData) ? totalesData[0] : totalesData;
  if (!t) return null;
  // Campo real de la ONPE: actasContabilizadas
  return t.actasContabilizadas
      || t.porcentajeActas
      || t.porcentaje_actas
      || (t.contabilizadas && t.totalActas ? t.contabilizadas / t.totalActas * 100 : null);
}

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

  // Snapshot para historial
  if (pres && pres.participantes && pres.participantes.length > 0) {
    const pctActas = extractPctActas(pres.totales) || 0;
    const snapshot = {
      time: new Date().toISOString(),
      pctActas,
      candidatos: pres.participantes
        .filter(p => p.porcentajeVotosValidos > 0)
        .sort((a, b) => b.porcentajeVotosValidos - a.porcentajeVotosValidos)
        .slice(0, 10)
        .map(p => ({
          nombre:    p.nombreAgrupacionPolitica,
          candidato: p.nombreCandidato,
          pct:       p.porcentajeVotosValidos,
          votos:     p.totalVotosValidos,
        })),
    };
    historial.push(snapshot);
    if (historial.length > MAX_HISTORY) historial.shift();
    console.log(`[ONPE] Snapshot guardado | actas: ${pctActas.toFixed(2)}% | historial: ${historial.length} pts`);
  }

  console.log(`[ONPE] Online: ${cache.onpeOnline}`);
}

refreshCache();
setInterval(refreshCache, 5 * 60 * 1000);

// ── API ───────────────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ onpeOnline: cache.onpeOnline, lastFetch: cache.lastFetch,
    hasData: { presidencial: !!cache.presidencial, senado: !!cache.senado, diputados: !!cache.diputados } });
});

app.get('/api/datos/:tipo', (req, res) => {
  const { tipo } = req.params;
  if (!['presidencial','senado','diputados'].includes(tipo)) return res.status(400).json({ error: 'Tipo invalido' });
  const data = cache[tipo];
  if (!data) return res.status(404).json({ error: 'Sin datos aun' });
  // Añadir pctActas calculado al response
  const pctActas = extractPctActas(data.totales);
  res.json({ ok: true, lastFetch: cache.lastFetch, pctActas, ...data });
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
