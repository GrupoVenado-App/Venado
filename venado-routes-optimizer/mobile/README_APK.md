# APK Android - Venado Rutas

Esta carpeta contiene una app Expo para generar una APK instalable.

La APK abre la web publicada:

```txt
https://venado-routes-optimizer.onrender.com
```

La API configurada queda en:

```txt
https://venado-routes-optimizer.onrender.com
```

## Probar en Expo

```powershell
cd "C:\Users\Samy\Documents\Innova\venado-routes-optimizer\mobile"
npm install
npx expo start
```

## Generar APK

Instala EAS CLI si no lo tienes:

```powershell
npm install -g eas-cli
```

Inicia sesion:

```powershell
eas login
```

Genera la APK:

```powershell
cd "C:\Users\Samy\Documents\Innova\venado-routes-optimizer\mobile"
eas build -p android --profile preview
```

Tambien puedes usar:

```powershell
npm run build:apk
```

Cuando termine, Expo/EAS mostrara un enlace para descargar la APK.

## Arquitectura

```txt
APK Expo Android
  -> WebView: https://venado-routes-optimizer.onrender.com
  -> FastAPI backend en Render
  -> PostgreSQL/PostGIS en Render
```

## Notas

- El perfil `preview` en `eas.json` usa `android.buildType: "apk"`.
- La app solicita permisos de ubicacion y camara porque la web usa check-in geografico y evidencias.
- No se modifico el frontend web ni el backend para crear la APK.
