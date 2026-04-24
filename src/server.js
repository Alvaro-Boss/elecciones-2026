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

// ── 112 distritos de Cusco hardcodeados (ubigeo INEI 6 dígitos) ───────────────
const DISTRITOS_CUSCO = [
  // Provincia Cusco (8)
  { ubigeo:'080101', distrito:'Cusco',          provincia:'Cusco' },
  { ubigeo:'080102', distrito:'Ccorca',         provincia:'Cusco' },
  { ubigeo:'080103', distrito:'Poroy',          provincia:'Cusco' },
  { ubigeo:'080104', distrito:'San Jerónimo',   provincia:'Cusco' },
  { ubigeo:'080105', distrito:'San Sebastián',  provincia:'Cusco' },
  { ubigeo:'080106', distrito:'Santiago',       provincia:'Cusco' },
  { ubigeo:'080107', distrito:'Saylla',         provincia:'Cusco' },
  { ubigeo:'080108', distrito:'Wanchaq',        provincia:'Cusco' },
  // Provincia Acomayo (7)
  { ubigeo:'080201', distrito:'Acomayo',        provincia:'Acomayo' },
  { ubigeo:'080202', distrito:'Acopia',         provincia:'Acomayo' },
  { ubigeo:'080203', distrito:'Acos',           provincia:'Acomayo' },
  { ubigeo:'080204', distrito:'Mosoc Llacta',   provincia:'Acomayo' },
  { ubigeo:'080205', distrito:'Pomacanchi',     provincia:'Acomayo' },
  { ubigeo:'080206', distrito:'Rondocan',       provincia:'Acomayo' },
  { ubigeo:'080207', distrito:'Sangarará',      provincia:'Acomayo' },
  // Provincia Anta (9)
  { ubigeo:'080301', distrito:'Anta',           provincia:'Anta' },
  { ubigeo:'080302', distrito:'Ancahuasi',      provincia:'Anta' },
  { ubigeo:'080303', distrito:'Cachimayo',      provincia:'Anta' },
  { ubigeo:'080304', distrito:'Chinchaypujio',  provincia:'Anta' },
  { ubigeo:'080305', distrito:'Huarocondo',     provincia:'Anta' },
  { ubigeo:'080306', distrito:'Limatambo',      provincia:'Anta' },
  { ubigeo:'080307', distrito:'Mollepata',      provincia:'Anta' },
  { ubigeo:'080308', distrito:'Pucyura',        provincia:'Anta' },
  { ubigeo:'080309', distrito:'Zurite',         provincia:'Anta' },
  // Provincia Calca (8)
  { ubigeo:'080401', distrito:'Calca',          provincia:'Calca' },
  { ubigeo:'080402', distrito:'Coya',           provincia:'Calca' },
  { ubigeo:'080403', distrito:'Lamay',          provincia:'Calca' },
  { ubigeo:'080404', distrito:'Lares',          provincia:'Calca' },
  { ubigeo:'080405', distrito:'Pisac',          provincia:'Calca' },
  { ubigeo:'080406', distrito:'San Salvador',   provincia:'Calca' },
  { ubigeo:'080407', distrito:'Taray',          provincia:'Calca' },
  { ubigeo:'080408', distrito:'Yanatile',       provincia:'Calca' },
  // Provincia Canas (8)
  { ubigeo:'080501', distrito:'Yanaoca',        provincia:'Canas' },
  { ubigeo:'080502', distrito:'Checca',         provincia:'Canas' },
  { ubigeo:'080503', distrito:'Kunturkanki',    provincia:'Canas' },
  { ubigeo:'080504', distrito:'Langui',         provincia:'Canas' },
  { ubigeo:'080505', distrito:'Layo',           provincia:'Canas' },
  { ubigeo:'080506', distrito:'Pampamarca',     provincia:'Canas' },
  { ubigeo:'080507', distrito:'Quehue',         provincia:'Canas' },
  { ubigeo:'080508', distrito:'Túpac Amaru',    provincia:'Canas' },
  // Provincia Canchis (8)
  { ubigeo:'080601', distrito:'Sicuani',        provincia:'Canchis' },
  { ubigeo:'080602', distrito:'Checacupe',      provincia:'Canchis' },
  { ubigeo:'080603', distrito:'Combapata',      provincia:'Canchis' },
  { ubigeo:'080604', distrito:'Marangani',      provincia:'Canchis' },
  { ubigeo:'080605', distrito:'Pitumarca',      provincia:'Canchis' },
  { ubigeo:'080606', distrito:'San Pablo',      provincia:'Canchis' },
  { ubigeo:'080607', distrito:'San Pedro',      provincia:'Canchis' },
  { ubigeo:'080608', distrito:'Tinta',          provincia:'Canchis' },
  // Provincia Chumbivilcas (8)
  { ubigeo:'080701', distrito:'Santo Tomás',    provincia:'Chumbivilcas' },
  { ubigeo:'080702', distrito:'Capacmarca',     provincia:'Chumbivilcas' },
  { ubigeo:'080703', distrito:'Chamaca',        provincia:'Chumbivilcas' },
  { ubigeo:'080704', distrito:'Colquemarca',    provincia:'Chumbivilcas' },
  { ubigeo:'080705', distrito:'Livitaca',       provincia:'Chumbivilcas' },
  { ubigeo:'080706', distrito:'Llusco',         provincia:'Chumbivilcas' },
  { ubigeo:'080707', distrito:'Quiñota',        provincia:'Chumbivilcas' },
  { ubigeo:'080708', distrito:'Velille',        provincia:'Chumbivilcas' },
  // Provincia Espinar (8)
  { ubigeo:'080801', distrito:'Espinar',        provincia:'Espinar' },
  { ubigeo:'080802', distrito:'Condoroma',      provincia:'Espinar' },
  { ubigeo:'080803', distrito:'Coporaque',      provincia:'Espinar' },
  { ubigeo:'080804', distrito:'Ocoruro',        provincia:'Espinar' },
  { ubigeo:'080805', distrito:'Pallpata',       provincia:'Espinar' },
  { ubigeo:'080806', distrito:'Pichigua',       provincia:'Espinar' },
  { ubigeo:'080807', distrito:'Suyckutambo',    provincia:'Espinar' },
  { ubigeo:'080808', distrito:'Alto Pichigua',  provincia:'Espinar' },
  // Provincia La Convención (10)
  { ubigeo:'080901', distrito:'Santa Ana',      provincia:'La Convención' },
  { ubigeo:'080902', distrito:'Echarate',       provincia:'La Convención' },
  { ubigeo:'080903', distrito:'Huayopata',      provincia:'La Convención' },
  { ubigeo:'080904', distrito:'Maranura',       provincia:'La Convención' },
  { ubigeo:'080905', distrito:'Ocobamba',       provincia:'La Convención' },
  { ubigeo:'080906', distrito:'Quellouno',      provincia:'La Convención' },
  { ubigeo:'080907', distrito:'Kimbiri',        provincia:'La Convención' },
  { ubigeo:'080908', distrito:'Santa Teresa',   provincia:'La Convención' },
  { ubigeo:'080909', distrito:'Vilcabamba',     provincia:'La Convención' },
  { ubigeo:'080910', distrito:'Pichari',        provincia:'La Convención' },
  // Provincia Paruro (9)
  { ubigeo:'081001', distrito:'Paruro',         provincia:'Paruro' },
  { ubigeo:'081002', distrito:'Accha',          provincia:'Paruro' },
  { ubigeo:'081003', distrito:'Ccapi',          provincia:'Paruro' },
  { ubigeo:'081004', distrito:'Colcha',         provincia:'Paruro' },
  { ubigeo:'081005', distrito:'Huanoquite',     provincia:'Paruro' },
  { ubigeo:'081006', distrito:'Omacha',         provincia:'Paruro' },
  { ubigeo:'081007', distrito:'Paccaritambo',   provincia:'Paruro' },
  { ubigeo:'081008', distrito:'Pillpinto',      provincia:'Paruro' },
  { ubigeo:'081009', distrito:'Yaurisque',      provincia:'Paruro' },
  // Provincia Paucartambo (6)
  { ubigeo:'081101', distrito:'Paucartambo',    provincia:'Paucartambo' },
  { ubigeo:'081102', distrito:'Caicay',         provincia:'Paucartambo' },
  { ubigeo:'081103', distrito:'Challabamba',    provincia:'Paucartambo' },
  { ubigeo:'081104', distrito:'Colquepata',     provincia:'Paucartambo' },
  { ubigeo:'081105', distrito:'Huancarani',     provincia:'Paucartambo' },
  { ubigeo:'081106', distrito:'Kosñipata',      provincia:'Paucartambo' },
  // Provincia Quispicanchi (12)
  { ubigeo:'081201', distrito:'Urcos',          provincia:'Quispicanchi' },
  { ubigeo:'081202', distrito:'Andahuaylillas', provincia:'Quispicanchi' },
  { ubigeo:'081203', distrito:'Camanti',        provincia:'Quispicanchi' },
  { ubigeo:'081204', distrito:'Ccarhuayo',      provincia:'Quispicanchi' },
  { ubigeo:'081205', distrito:'Ccatca',         provincia:'Quispicanchi' },
  { ubigeo:'081206', distrito:'Cusipata',       provincia:'Quispicanchi' },
  { ubigeo:'081207', distrito:'Huaro',          provincia:'Quispicanchi' },
  { ubigeo:'081208', distrito:'Lucre',          provincia:'Quispicanchi' },
  { ubigeo:'081209', distrito:'Marcapata',      provincia:'Quispicanchi' },
  { ubigeo:'081210', distrito:'Ocongate',       provincia:'Quispicanchi' },
  { ubigeo:'081211', distrito:'Oropesa',        provincia:'Quispicanchi' },
  { ubigeo:'081212', distrito:'Quiquijana',     provincia:'Quispicanchi' },
  // Provincia Urubamba (7)
  { ubigeo:'081301', distrito:'Urubamba',       provincia:'Urubamba' },
  { ubigeo:'081302', distrito:'Chinchero',      provincia:'Urubamba' },
  { ubigeo:'081303', distrito:'Huayllabamba',   provincia:'Urubamba' },
  { ubigeo:'081304', distrito:'Machupicchu',    provincia:'Urubamba' },
  { ubigeo:'081305', distrito:'Maras',          provincia:'Urubamba' },
  { ubigeo:'081306', distrito:'Ollantaytambo',  provincia:'Urubamba' },
  { ubigeo:'081307', distrito:'Yucay',          provincia:'Urubamba' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractPctActas(totalesData) {
  const t = Array.isArray(totalesData) ? totalesData[0] : totalesData;
  if (!t) return null;
  return t.actasContabilizadas
      || t.porcentajeActas
      || t.porcentaje_actas
      || (t.contabilizadas && t.totalActas ? t.contabilizadas / t.totalActas * 100 : null);
}

// Ejecutar promesas en lotes paralelos de N concurrentes
async function pLimit(tasks, concurrency = 12) {
  const results = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Cache principal ───────────────────────────────────────────────────────────
const cache = { presidencial: null, senado: null, diputados: null, lastFetch: null, onpeOnline: false };
const historial = [];
const MAX_HISTORY = 288;

// ── Cache Cusco ───────────────────────────────────────────────────────────────
const cacheCusco = { distritos: null, lastFetch: null, online: false };

// ── Fetch nacional ────────────────────────────────────────────────────────────
async function fetchONPE(tipo) {
  const id = ELECCIONES[tipo];
  try {
    const [totRes, partRes] = await Promise.all([
      fetch(`${BASE}/totales?idEleccion=${id}&tipoFiltro=eleccion`, { headers: HEADERS, timeout: 10000 }),
      fetch(`${BASE}/participantes?idEleccion=${id}&tipoFiltro=eleccion`, { headers: HEADERS, timeout: 10000 }),
    ]);
    if (!totRes.ok || !partRes.ok) return null;
    const totales = await totRes.json();
    const partic  = await partRes.json();
    if (!totales.success || !partic.success) return null;
    return { totales: totales.data, participantes: partic.data };
  } catch (e) {
    console.error(`[ONPE] Error ${tipo}:`, e.message);
    return null;
  }
}

// ── Fetch un distrito ─────────────────────────────────────────────────────────
async function fetchDistrito({ ubigeo, distrito, provincia }) {
  try {
    const [totRes, partRes] = await Promise.all([
      fetch(`${BASE}/totales?idEleccion=${ELECCIONES.presidencial}&tipoFiltro=distrito&codigoUbigeo=${ubigeo}`,
            { headers: HEADERS, timeout: 8000 }),
      fetch(`${BASE}/participantes?idEleccion=${ELECCIONES.presidencial}&tipoFiltro=distrito&codigoUbigeo=${ubigeo}`,
            { headers: HEADERS, timeout: 8000 }),
    ]);
    if (!totRes.ok || !partRes.ok) return null;
    const tot  = await totRes.json();
    const part = await partRes.json();
    if (!tot.success || !part.success) return null;

    return {
      ubigeo, distrito, provincia,
      pctActas: extractPctActas(tot.data),
      participantes: (part.data || [])
        .sort((a, b) => b.porcentajeVotosValidos - a.porcentajeVotosValidos)
        .slice(0, 6)
        .map(p => ({
          partido:   p.nombreAgrupacionPolitica,
          candidato: p.nombreCandidato || '',
          pct:       p.porcentajeVotosValidos,
          votos:     p.totalVotosValidos,
        })),
    };
  } catch (e) {
    console.warn(`[CUSCO] ${distrito} (${ubigeo}): ${e.message}`);
    return null;
  }
}

// ── Fetch Cusco completo en paralelo ──────────────────────────────────────────
async function fetchDistritosCusco() {
  const start = Date.now();
  console.log(`[CUSCO] Lanzando ${DISTRITOS_CUSCO.length} requests (12 en paralelo)...`);

  const tasks = DISTRITOS_CUSCO.map(d => () => fetchDistrito(d));
  const resultados = await pLimit(tasks, 12);
  const validos = resultados.filter(Boolean);

  console.log(`[CUSCO] ${validos.length}/${DISTRITOS_CUSCO.length} distritos OK en ${((Date.now()-start)/1000).toFixed(1)}s`);
  return validos.length > 0 ? validos : null;
}

// ── Refresh nacional ──────────────────────────────────────────────────────────
async function refreshCache() {
  console.log('[ONPE] Actualizando...', new Date().toISOString());
  const [pres, sen, dip] = await Promise.all([
    fetchONPE('presidencial'), fetchONPE('senado'), fetchONPE('diputados'),
  ]);
  cache.onpeOnline = !!(pres || sen || dip);
  cache.lastFetch  = new Date().toISOString();
  if (pres) cache.presidencial = pres;
  if (sen)  cache.senado = sen;
  if (dip)  cache.diputados = dip;

  if (pres?.participantes?.length > 0) {
    const pctActas = extractPctActas(pres.totales) || 0;
    historial.push({
      time: new Date().toISOString(), pctActas,
      candidatos: pres.participantes
        .filter(p => p.porcentajeVotosValidos > 0)
        .sort((a, b) => b.porcentajeVotosValidos - a.porcentajeVotosValidos)
        .slice(0, 10)
        .map(p => ({ nombre: p.nombreAgrupacionPolitica, candidato: p.nombreCandidato, pct: p.porcentajeVotosValidos, votos: p.totalVotosValidos })),
    });
    if (historial.length > MAX_HISTORY) historial.shift();
  }
  console.log(`[ONPE] Online: ${cache.onpeOnline}`);
}

// ── Refresh Cusco ─────────────────────────────────────────────────────────────
async function refreshCusco() {
  console.log('[CUSCO] Iniciando...', new Date().toISOString());
  try {
    const distritos = await fetchDistritosCusco();
    if (distritos) {
      cacheCusco.distritos = distritos;
      cacheCusco.online    = true;
      cacheCusco.lastFetch = new Date().toISOString();
      console.log(`[CUSCO] OK: ${distritos.length} distritos en caché`);
    } else {
      cacheCusco.online = false;
      console.warn('[CUSCO] Sin datos de ONPE');
    }
  } catch (e) {
    cacheCusco.online = false;
    console.error('[CUSCO] Error:', e.message);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
refreshCache();
setInterval(refreshCache, 5 * 60 * 1000);
setTimeout(() => { refreshCusco(); setInterval(refreshCusco, 15 * 60 * 1000); }, 5000);

// ── API nacional ──────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => res.json({
  onpeOnline: cache.onpeOnline, lastFetch: cache.lastFetch,
  hasData: { presidencial: !!cache.presidencial, senado: !!cache.senado, diputados: !!cache.diputados },
}));

app.get('/api/datos/:tipo', (req, res) => {
  const { tipo } = req.params;
  if (!['presidencial','senado','diputados'].includes(tipo)) return res.status(400).json({ error: 'Tipo invalido' });
  const data = cache[tipo];
  if (!data) return res.status(404).json({ error: 'Sin datos aun' });
  res.json({ ok: true, lastFetch: cache.lastFetch, pctActas: extractPctActas(data.totales), ...data });
});

app.get('/api/historial', (req, res) => res.json({ ok: true, puntos: historial.length, data: historial }));

app.post('/api/refresh', async (req, res) => {
  await refreshCache();
  res.json({ ok: true, onpeOnline: cache.onpeOnline, lastFetch: cache.lastFetch });
});

// ── API Cusco ─────────────────────────────────────────────────────────────────
app.get('/api/cusco/distritos', (req, res) => res.json({
  ok: true, online: cacheCusco.online, lastFetch: cacheCusco.lastFetch,
  total: cacheCusco.distritos?.length || 0, distritos: cacheCusco.distritos || [],
}));

app.get('/api/cusco/status', (req, res) => res.json({
  ok: true, online: cacheCusco.online, lastFetch: cacheCusco.lastFetch,
  totalDistritos: cacheCusco.distritos?.length || 0,
}));

app.post('/api/cusco/refresh', (req, res) => {
  res.json({ ok: true, message: `Scraping iniciado: ${DISTRITOS_CUSCO.length} distritos en paralelo` });
  refreshCusco();
});

app.get('/api/cusco/csv', (req, res) => {
  if (!cacheCusco.distritos?.length) return res.status(404).send('Sin datos aún');
  const rows = ['Provincia,Distrito,Ubigeo,% Actas,1° Partido,1° %,2° Partido,2° %,3° Partido,3° %,4° Partido,4° %,5° Partido,5° %,6° Partido,6° %'];
  for (const d of cacheCusco.distritos) {
    const p = d.participantes || [];
    const cols = [d.provincia, d.distrito, d.ubigeo, d.pctActas != null ? d.pctActas.toFixed(2) : ''];
    for (let i = 0; i < 6; i++) { cols.push(p[i]?.partido || ''); cols.push(p[i]?.pct != null ? p[i].pct.toFixed(2) : ''); }
    rows.push(cols.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cusco_distrital_2026.csv"');
  res.send('\uFEFF' + rows.join('\r\n'));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.listen(PORT, () => console.log(`🗳️  Elecciones Peru 2026 en puerto ${PORT}`));
