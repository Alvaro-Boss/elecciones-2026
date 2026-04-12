# Elecciones Generales Perú 2026 — Tracker en vivo

Tracker en tiempo real de los resultados electorales del 12 de abril de 2026.
Cubre **Presidencia**, **Senado (60 escaños)** y **Cámara de Diputados (130 escaños)**.

## Cómo funciona

- El servidor Express (Node.js) intenta descargar los CSVs de resultados de la ONPE **cada 5 minutos**.
- Cuando la ONPE active su sistema (desde las 5:00 pm del 12/04/2026), los datos aparecerán automáticamente.
- Si quieres ver datos antes de que el servidor los detecte, puedes **subir un CSV manualmente** desde la pestaña "Datos / CSV".

## Formato del CSV esperado

### Presidencial
```
PARTIDO,VOTOS,ACTAS_COMP,ACTAS_TOTAL
Fuerza Popular,1200000,50000,228000
...
```

### Congreso (Senado / Diputados)
```
PARTIDO,VOTOS,ESCANOS,ACTAS_COMP,ACTAS_TOTAL
Fuerza Popular,1100000,15,50000,228000
...
```

El parser es flexible y acepta variaciones en nombres de columna que usa la ONPE.

## Variables de entorno (Railway)

Puedes configurar las URLs exactas de los CSVs de la ONPE cuando las conozcas:

```
ONPE_URL_PRES=https://resultados2026.onpe.gob.pe/EG2026/resultados/presidencial.csv
ONPE_URL_SEN=https://resultados2026.onpe.gob.pe/EG2026/resultados/senado.csv
ONPE_URL_DIP=https://resultados2026.onpe.gob.pe/EG2026/resultados/diputados.csv
```

## Deploy en Railway

```bash
# Opción 1: desde GitHub
# Sube este repo a GitHub → Railway → Deploy from GitHub

# Opción 2: Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

## Fuentes oficiales

- https://resultados2026.onpe.gob.pe
- https://eg2026.onpe.gob.pe
- https://portal.jne.gob.pe
