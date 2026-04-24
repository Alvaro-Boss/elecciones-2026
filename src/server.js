const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const BASE = 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend/resumen-general';

// IDs de elección
const ELECCIONES = {
  presidencial: process.env.ID_PRES || '10',
  senado:       process.env.ID_SEN  || '15',
  diputados:    process.env.ID_DIP  || '12',
};

// Códigos ubigeo ONPE
// Cusco región = ubigeo 080000, idDistrito varía por distrito
// El endpoint de la ONPE para filtrar por ubigeo usa tipoFiltro=departamento/provincia/distrito
const UBIGEO_CUSCO_REGION = '08'; // código departamento Cusco

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Referer': 'https://resultadoelectoral.onpe.gob.pe/',
  'Origin':  'https://resultadoelectoral.onpe.gob.pe',
};

// ── Cache principal (nacional) ────────────────────────────────────────────────
const cache = {
  presidencial: null,
  senado: null,
  diputados: null,
  lastFetch: null,
  onpeOnline: false,
};
const historial = [];
const MAX_HISTORY = 288;

// ── Cache Cusco distrital ─────────────────────────────────────────────────────
const cacheCusco = {
  distritos: null,        // array de { ubigeo, distrito, provincia, participantes, pctActas }
  lastFetch: null,
  online: false,
};

// Provincias de Cusco con sus ubigeos (código INEI/ONPE)
// El formato del ubigeo en la ONPE: departamento(2) + provincia(2) + distrito(2)
const PROVINCIAS_CUSCO = [
  { id: '0801', nombre: 'Cusco' },
  { id: '0802', nombre: 'Acomayo' },
  { id: '0803', nombre: 'Anta' },
  { id: '0804', nombre: 'Calca' },
  { id: '0805', nombre: 'Canas' },
  { id: '0806', nombre: 'Canchis' },
  { id: '0807', nombre: 'Chumbivilcas' },
  { id: '0808', nombre: 'Espinar' },
  { id: '0809', nombre: 'La Convención' },
  { id: '0810', nombre: 'Paruro' },
  { id: '0811', nombre: 'Paucartambo' },
  { id: '0812', nombre: 'Quispicanchi' },
  { id: '0813', nombre: 'Urubamba' },
];

function extractPctActas(totalesData) {
  const t = Array.isArray(totalesData) ? totalesData[0] : totalesData;
  if (!t) return null;
  return t.actasContabilizadas
      || t.porcentajeActas
      || t.porcentaje_actas
      || (t.contabilizadas && t.totalActas ? t.contabilizadas / t.totalActas * 100 : null);
}

// ── Fetch nacional ────────────────────────────────────────────────────────────
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

// ── Fetch Cusco por provincia → distritos ────────────────────────────────────
// La API de la ONPE acepta:
//   /participantes?idEleccion=10&tipoFiltro=departamento&codigoUbigeo=08
//   /participantes?idEleccion=10&tipoFiltro=provincia&codigoUbigeo=0801
//   /participantes?idEleccion=10&tipoFiltro=distrito&codigoUbigeo=080101
//
// Para obtener todos los distritos, primero consultamos por provincia para
// obtener la lista de distritos, luego consultamos cada distrito.

async function fetchDistritosCusco() {
  const idPres = ELECCIONES.presidencial;
  const resultados = [];

  // Primero obtenemos resultados a nivel departamento para confirmar conectividad
  try {
    const depRes = await fetch(
      `${BASE}/participantes?idEleccion=${idPres}&tipoFiltro=departamento&codigoUbigeo=${UBIGEO_CUSCO_REGION}`,
      { headers: HEADERS, timeout: 12000 }
    );
    if (!depRes.ok) {
      console.warn('[CUSCO] No se pudo conectar con la ONPE para datos departamentales');
      return null;
    }
    const depData = await depRes.json();
    if (!depData.success) return null;

    console.log(`[CUSCO] Conectado. Iniciando scraping de ${PROVINCIAS_CUSCO.length} provincias...`);
  } catch (e) {
    console.error('[CUSCO] Error conexión inicial:', e.message);
    return null;
  }

  // Iterar por cada provincia para obtener sus distritos
  for (const prov of PROVINCIAS_CUSCO) {
    try {
      // Obtener lista de distritos de esta provincia
      const provRes = await fetch(
        `${BASE}/ubigeos?idEleccion=${idPres}&tipoFiltro=provincia&codigoUbigeo=${prov.id}`,
        { headers: HEADERS, timeout: 10000 }
      );

      let distritos = [];

      if (provRes.ok) {
        const provData = await provRes.json();
        if (provData.success && Array.isArray(provData.data)) {
          distritos = provData.data;
        }
      }

      // Si no hay endpoint de ubigeos, construimos ubigeos estándar 
      // (el distrito capital siempre es XX01, intentamos hasta XX20)
      if (distritos.length === 0) {
        // Fallback: consultar la provincia directamente y usar ese resultado
        try {
          const [totRes, partRes] = await Promise.all([
            fetch(`${BASE}/totales?idEleccion=${idPres}&tipoFiltro=provincia&codigoUbigeo=${prov.id}`, { headers: HEADERS, timeout: 10000 }),
            fetch(`${BASE}/participantes?idEleccion=${idPres}&tipoFiltro=provincia&codigoUbigeo=${prov.id}`, { headers: HEADERS, timeout: 10000 }),
          ]);
          if (totRes.ok && partRes.ok) {
            const tot = await totRes.json();
            const part = await partRes.json();
            if (tot.success && part.success) {
              resultados.push({
                ubigeo: prov.id,
                distrito: `(Provincia ${prov.nombre})`,
                provincia: prov.nombre,
                pctActas: extractPctActas(tot.data),
                participantes: (part.data || [])
                  .sort((a, b) => b.porcentajeVotosValidos - a.porcentajeVotosValidos)
                  .slice(0, 8)
                  .map(p => ({
                    partido: p.nombreAgrupacionPolitica,
                    candidato: p.nombreCandidato || '',
                    pct: p.porcentajeVotosValidos,
                    votos: p.totalVotosValidos,
                  })),
              });
            }
          }
        } catch (e2) {
          console.warn(`[CUSCO] Error provincia ${prov.nombre}:`, e2.message);
        }
        continue;
      }

      // Tenemos lista de distritos: consultar cada uno
      for (const dist of distritos) {
        const ubigeo = dist.codigoUbigeo || dist.codigo || dist.ubigeo;
        const nombreDist = dist.nombreDistrito || dist.nombre || dist.descripcion || ubigeo;
        if (!ubigeo) continue;

        try {
          const [totRes, partRes] = await Promise.all([
            fetch(`${BASE}/totales?idEleccion=${idPres}&tipoFiltro=distrito&codigoUbigeo=${ubigeo}`, { headers: HEADERS, timeout: 10000 }),
            fetch(`${BASE}/participantes?idEleccion=${idPres}&tipoFiltro=distrito&codigoUbigeo=${ubigeo}`, { headers: HEADERS, timeout: 10000 }),
          ]);

          if (!totRes.ok || !partRes.ok) continue;
          const tot  = await totRes.json();
          const part = await partRes.json();
          if (!tot.success || !part.success) continue;

          resultados.push({
            ubigeo,
            distrito: nombreDist,
            provincia: prov.nombre,
            pctActas: extractPctActas(tot.data),
            participantes: (part.data || [])
              .sort((a, b) => b.porcentajeVotosValidos - a.porcentajeVotosValidos)
              .slice(0, 8)
              .map(p => ({
                partido: p.nombreAgrupacionPolitica,
                candidato: p.nombreCandidato || '',
                pct: p.porcentajeVotosValidos,
                votos: p.totalVotosValidos,
              })),
          });

          await new Promise(r => setTimeout(r, 150)); // pausa entre requests
        } catch (e3) {
          console.warn(`[CUSCO] Error distrito ${nombreDist}:`, e3.message);
        }
      }

      await new Promise(r => setTimeout(r, 300)); // pausa entre provincias
      console.log(`[CUSCO] Provincia ${prov.nombre}: ${distritos.length} distritos procesados`);
    } catch (e) {
      console.warn(`[CUSCO] Error iterando provincia ${prov.nombre}:`, e.message);
    }
  }

  console.log(`[CUSCO] Total registros obtenidos: ${resultados.length}`);
  return resultados.length > 0 ? resultados : null;
}

// ── Refresh nacional ──────────────────────────────────────────────────────────
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
  }

  console.log(`[ONPE] Online: ${cache.onpeOnline}`);
}

// ── Refresh Cusco ─────────────────────────────────────────────────────────────
async function refreshCusco() {
  console.log('[CUSCO] Iniciando scraping distrital...', new Date().toISOString());
  try {
    const distritos = await fetchDistritosCusco();
    if (distritos) {
      cacheCusco.distritos = distritos;
      cacheCusco.online    = true;
      cacheCusco.lastFetch = new Date().toISOString();
      console.log(`[CUSCO] Cache actualizado: ${distritos.length} registros`);
    } else {
      cacheCusco.online = false;
      console.warn('[CUSCO] Sin datos disponibles');
    }
  } catch (e) {
    console.error('[CUSCO] Error en refresh:', e.message);
    cacheCusco.online = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
refreshCache();
setInterval(refreshCache, 5 * 60 * 1000);

// Cusco: primera carga tras 5s (para no sobrecargar en arranque), luego cada 15 min
setTimeout(() => {
  refreshCusco();
  setInterval(refreshCusco, 15 * 60 * 1000);
}, 5000);

// ── API nacional ──────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    onpeOnline: cache.onpeOnline,
    lastFetch: cache.lastFetch,
    hasData: {
      presidencial: !!cache.presidencial,
      senado: !!cache.senado,
      diputados: !!cache.diputados,
    },
  });
});

app.get('/api/datos/:tipo', (req, res) => {
  const { tipo } = req.params;
  if (!['presidencial', 'senado', 'diputados'].includes(tipo))
    return res.status(400).json({ error: 'Tipo invalido' });
  const data = cache[tipo];
  if (!data) return res.status(404).json({ error: 'Sin datos aun' });
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

// ── API Cusco distrital ───────────────────────────────────────────────────────
app.get('/api/cusco/distritos', (req, res) => {
  res.json({
    ok: true,
    online: cacheCusco.online,
    lastFetch: cacheCusco.lastFetch,
    total: cacheCusco.distritos?.length || 0,
    distritos: cacheCusco.distritos || [],
  });
});

app.post('/api/cusco/refresh', async (req, res) => {
  // Lanzar en background para no bloquear la respuesta
  res.json({ ok: true, message: 'Scraping de Cusco iniciado, puede tomar 1-3 minutos' });
  refreshCusco();
});

app.get('/api/cusco/status', (req, res) => {
  res.json({
    ok: true,
    online: cacheCusco.online,
    lastFetch: cacheCusco.lastFetch,
    totalDistritos: cacheCusco.distritos?.length || 0,
  });
});

// CSV export de Cusco
app.get('/api/cusco/csv', (req, res) => {
  if (!cacheCusco.distritos || cacheCusco.distritos.length === 0)
    return res.status(404).send('Sin datos');

  const rows = ['Provincia,Distrito,Ubigeo,% Actas,1° Partido,1° %,2° Partido,2° %,3° Partido,3° %,4° Partido,4° %,5° Partido,5° %,6° Partido,6° %'];
  for (const d of cacheCusco.distritos) {
    const p = d.participantes || [];
    const cols = [
      d.provincia,
      d.distrito,
      d.ubigeo,
      d.pctActas != null ? d.pctActas.toFixed(2) : '',
    ];
    for (let i = 0; i < 6; i++) {
      cols.push(p[i]?.partido || '');
      cols.push(p[i]?.pct != null ? p[i].pct.toFixed(2) : '');
    }
    rows.push(cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cusco_distrital_2026.csv"');
  res.send('\uFEFF' + rows.join('\r\n')); // BOM para Excel
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => console.log(`🗳️  Elecciones Peru 2026 en puerto ${PORT}`));
