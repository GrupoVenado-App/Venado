# Venado Routes Optimizer

Sistema full-stack para optimizar rutas y cobertura del Canal Tradicional de Industrias Venado en La Paz.

## Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios, Leaflet, Recharts, Lucide.
- Backend: FastAPI, SQLAlchemy 2, Pydantic v2, GeoAlchemy2/PostGIS, JWT, OR-Tools.
- Base de datos: PostgreSQL 15 + PostGIS.

## Datos reales

El seed usa `backend/app/data/pdvs_la_paz.csv`, generado desde:

`C:/Users/Samy/Desktop/INFORMACION DE DATOS TRADICIONAL LA PAZ rev..xlsx`

La hoja tiene 474 PDVs validos. La numeracion llega hasta 487, pero faltan 13 numeros en el archivo fuente. En esta version no hay PDVs `PARETO`; el catalogo de micro-tareas PARETO queda precargado.

## Ejecutar

```bash
docker-compose up --build
```

Servicios:

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Swagger: http://localhost:8000/docs

## Usuarios demo

- Supervisor: `supervisor.1@venado.local` / `supervisor123`
- Reponedor: `reponedor.1@venado.local` / `reponedor123`

Todos los supervisores y reponedores reales quedan creados con emails en formato `nombre.con.puntos@venado.local`.

## Flujo demo

1. Entrar como supervisor.
2. Ir a `/optimizador`.
3. Calcular rutas para una fecha con el subset inicial o seleccionar mas PDVs.
4. Entrar como reponedor asignado.
5. Ver `/app/ruta-hoy`, abrir una visita, usar `Simular`, iniciar, completar micro-tareas y finalizar.
6. Revisar dashboard, desviaciones, feedback loop y exportacion BI.

## Endpoints clave

- `POST /auth/login`
- `GET /pdvs`, `GET /pdvs/mapa`
- `POST /rutas/optimizar`
- `GET /rutas/mis-rutas`
- `POST /visitas/{id}/iniciar`
- `POST /visitas/{id}/finalizar`
- `GET /dashboard/resumen-hoy`
- `GET /reportes/exportar-bi`
- `POST /feedback-loop/recalcular`
