# Despliegue en Render

Este proyecto queda preparado para publicarse como un solo servicio web:

- React/Vite se compila como archivos estaticos.
- FastAPI sirve la web y la API desde la misma URL publica.
- Render crea una base PostgreSQL 15.
- La app crea PostGIS, tablas y datos semilla al iniciar.

## Pasos

1. Confirma que el codigo este subido a GitHub:

```powershell
cd "C:\Users\Samy\Documents\Innova\venado-routes-optimizer"
git status
git add .
git commit -m "Prepare Render deployment"
git push origin master
```

2. En Render abre **New > Blueprint**.
3. Conecta el repositorio `Innova-Hack/Venado`.
4. Render detectara `render.yaml` y creara:
   - Servicio web Docker: frontend + backend.
   - Base PostgreSQL: `venado-postgis`.
5. Cuando pida `ORS_API_KEY`, pega tu API key de OpenRouteService.
6. Crea el Blueprint y espera el primer deploy.

La URL publica de Render sera la web. La API quedara en la misma URL, por ejemplo:

```txt
https://tu-app.onrender.com/health
```

## Credenciales demo

Supervisor:

```txt
supervisor.1@venado.local
supervisor123
```

Reponedor:

```txt
reponedor.1@venado.local
reponedor123
```

## Nota sobre fotos

La base PostgreSQL si queda compartida entre equipos. Las fotos se guardan como archivos en `/app/uploads`; en un servicio gratuito de Render ese almacenamiento puede perderse cuando el servicio se reinicia o redeploya. Para conservar fotos de evidencia en produccion, agrega un disco persistente de Render o usa Cloudinary/S3.

## Nota sobre plan gratuito

Render permite probar con servicios gratuitos, pero las bases PostgreSQL gratuitas pueden expirar. Para demo/hackathon sirve; para uso real conviene pasar la base a plan pago antes de presentar datos importantes.
