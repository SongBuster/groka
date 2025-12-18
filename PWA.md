# 📱 Groka PWA - Instalación en Dispositivos Móviles

¡Groka es ahora una Progressive Web App (PWA) y se puede instalar en tu dispositivo móvil!

## ✨ Características PWA

- ✅ Instalable en pantalla de inicio
- ✅ Funciona como app nativa
- ✅ Caché inteligente para mejor rendimiento
- ✅ Service Worker para funcionalidad offline parcial

## 📲 Cómo Instalar

### En iOS (iPhone/iPad)

1. Abre Groka en Safari: https://groka.vercel.app
2. Toca el botón **Compartir** (ícono de flecha hacia arriba)
3. Selecciona **Añadir a pantalla de inicio**
4. Confirma el nombre (o déjalo como "Groka")
5. ¡Listo! La app aparecerá en tu pantalla de inicio

### En Android (Chrome)

1. Abre Groka en Chrome: https://groka.vercel.app
2. Toca el menú (⋮) en la esquina superior derecha
3. Selecciona **"Instalar app"** o **"Añadir a pantalla de inicio"**
4. Confirma
5. ¡Listo! La app aparecerá en tu pantalla de inicio

### En Android (Firefox)

1. Abre Groka en Firefox: https://groka.vercel.app
2. Toca el menú (⋮) en la esquina inferior derecha
3. Selecciona **"Instalar"**
4. Confirma
5. ¡Listo!

## 🎨 Iconos Personalizados

Los iconos actuales son **placeholders**. Para usar iconos reales:

### Opción 1: Usar ImageMagick (rápido)

```bash
# Instala ImageMagick si no lo tienes
brew install imagemagick

# Convierte tu imagen a los tamaños necesarios
convert icon.png -resize 72x72 public/icons/icon-72x72.png
convert icon.png -resize 96x96 public/icons/icon-96x96.png
convert icon.png -resize 128x128 public/icons/icon-128x128.png
convert icon.png -resize 144x144 public/icons/icon-144x144.png
convert icon.png -resize 152x152 public/icons/icon-152x152.png
convert icon.png -resize 192x192 public/icons/icon-192x192.png
convert icon.png -resize 384x384 public/icons/icon-384x384.png
convert icon.png -resize 512x512 public/icons/icon-512x512.png
```

### Opción 2: Usar Sharp (recomendado)

```bash
# Instala sharp
npm install --save-dev sharp

# Luego modifica scripts/generate-icons.js para usar sharp
# y ejecuta:
node scripts/generate-icons.js
```

### Opción 3: Usar generador online

Usa https://www.pwabuilder.com/ para generar automáticamente los iconos.

## 📝 Requisitos de los Iconos

- **Formato:** PNG (recomendado) o JPG
- **Tamaño mínimo:** 512x512 px (preferiblemente cuadrado)
- **Colores:** RGB o RGBA
- **Transparencia:** Soportada (recomendada para versiones "maskable")

## 🔄 Actualizar Iconos

1. Reemplaza los archivos PNG en `public/icons/`
2. El navegador detectará automáticamente los nuevos iconos en el próximo acceso
3. Los usuarios podrían necesitar desinstalar y reinstalar la app para ver los nuevos iconos

## 🛠️ Archivos PWA

- `public/manifest.json` - Configuración de la app (nombre, icono, colores, etc.)
- `public/sw.js` - Service Worker (caché y funcionalidad offline)
- `public/sw-register.js` - Registra el Service Worker
- `public/icons/` - Iconos en diferentes tamaños
- `scripts/generate-icons.js` - Script para generar iconos

## 📊 Configuración en manifest.json

Puedes personalizar:

```json
{
  "name": "Groka - Gestor de Listas de Compra",
  "short_name": "Groka",
  "description": "Organiza tus compras inteligentemente...",
  "theme_color": "#0f766e",        // Color principal
  "background_color": "#ffffff",   // Color de fondo
  "start_url": "/",
  "display": "standalone"
}
```

## ✅ Verificar PWA

Para verificar que la PWA está bien configurada:

1. Abre DevTools (F12)
2. Ve a la pestaña **Application** (Chrome) o **Storage** (Firefox)
3. Verifica que **Manifest** y **Service Workers** están registrados
4. Busca en "Lighthouse" y ejecuta una auditoría PWA

## 🐛 Solución de Problemas

### "No aparece la opción de instalar"

- Asegúrate que estés usando HTTPS (en producción)
- En desarrollo local (http://localhost), funciona pero solo con restricciones
- Espera 30 segundos después de la primera carga

### "Los iconos no se actualizan"

- Limpia el cache del navegador
- Desinstala la app y reinstálala
- En DevTools, bajo Service Workers, haz clic en "Update on reload"

### "La app no funciona offline"

- Esto es normal, es funcionalidad parcial
- Solo los assets estáticos se cachean
- Las llamadas a Supabase siempre necesitan conexión

## 📚 Referencias

- [PWA Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [PWA Builder](https://www.pwabuilder.com/)

---

¡Disfruta usando Groka como app nativa en tu móvil! 🚀
