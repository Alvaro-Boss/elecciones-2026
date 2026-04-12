const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ─── ONPE data URLs ───────────────────────────────────────────────────────────
// La ONPE publica CSVs en su plataforma de resultados. Cuando estén activos
// (desde las 5 pm del 12/04/2026) el servidor los descarga y los sirve al frontend.
// URLs conocidas de procesos anteriores como plantilla estructural:
const ONPE_URLS = {
  presidencial: process.env.ONPE_URL_PRES  || 'https://resultados2026.onpe.gob.pe/EG2026/resultados/presidencial.csv',
  senado:       process.env.ONPE_URL_SEN   || 'https://resultados2026.onpe.gob.pe/EG2026/resultados/senado.csv',
  diputados:    process.env.ONPE_URL_DIP   || 'https://resultados2026.onpe.gob.pe/EG2026/resultados/diputados.csv',
};

// Cache en memoria (se actualiza cada 5 minutos)
const cache = {
  presidencial: null,
  senado: null,
  diputados: null,
  lastFetch: null,
  onpeOnline: false,
};

async function fetchONPE(tipo) {
  try {
    const url = ONPE_URLS[tipo];
    const res = await fetch(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 EleccionesTracker/2.0' }
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text;
  } catch (e) {
    return null;
  }
}

async function refreshCache() {
  console.log('[ONPE] Intentando actualizar caché...', new Date().toISOString());
  const [pres, sen, dip] = await Promise.all([
    fetchONPE('presidencial'),
    fetchONPE('senado'),
    fetchONPE('diputados'),
  ]);

  const online = !!(pres || sen || dip);
  cache.onpeOnline = online;
  cache.lastFetch = new Date().toISOString();

  if (pres) cache.presidencial = pres;
  if (sen)  cache.senado = sen;
  if (dip)  cache.diputados = dip;

  console.log(`[ONPE] Online: ${online} | Actualizado: ${cache.lastFetch}`);
}

// Actualizar al arrancar y cada 5 minutos
refreshCache();
setInterval(refreshCache, 5 * 60 * 1000);

// ─── API endpoints ────────────────────────────────────────────────────────────

// Estado general del sistema
app.get('/api/status', (req, res) => {
  res.json({
    onpeOnline: cache.onpeOnline,
    lastFetch: cache.lastFetch,
    hasData: {
      presidencial: !!cache.presidencial,
      senado: !!cache.senado,
      diputados: !!cache.diputados,
    }
  });
});

// CSV crudo de ONPE (para que el frontend parsee con PapaParse)
app.get('/api/csv/:tipo', (req, res) => {
  const { tipo } = req.params;
  if (!['presidencial', 'senado', 'diputados'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo inválido' });
  }
  const data = cache[tipo];
  if (!data) {
    return res.status(404).json({ error: 'Sin datos disponibles aún' });
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(data);
});

// Proxy manual: el frontend puede pedir que se descargue un CSV de una URL específica
app.post('/api/fetch-csv', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes('onpe.gob.pe')) {
    return res.status(400).json({ error: 'URL debe ser de onpe.gob.pe' });
  }
  try {
    const r = await fetch(url, { timeout: 15000 });
    if (!r.ok) return res.status(r.status).json({ error: 'Error al descargar' });
    const text = await r.text();
    res.setHeader('Content-Type', 'text/csv');
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Forzar refresco (útil para testear)
app.post('/api/refresh', async (req, res) => {
  await refreshCache();
  res.json({ ok: true, onpeOnline: cache.onpeOnline, lastFetch: cache.lastFetch });
});

// ─── Frontend ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🗳️  Elecciones Perú 2026 corriendo en puerto ${PORT}`);
});
