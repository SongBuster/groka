# 📧 Procesamiento automático de tickets por email

## ¿Qué es esto?

Permite a los usuarios de Groka **reenviar emails con tickets PDF** a una dirección dedicada. El sistema:
1. Lee automáticamente los emails cada 10 minutos
2. Valida que el remitente sea usuario registrado
3. Parsea los PDFs adjuntos
4. Guarda los tickets en la cuenta del usuario
5. Envía email de confirmación

## 🚀 Quick Start

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar Google Cloud y Gmail API

Sigue la guía completa en: [`docs/GMAIL_SETUP.md`](./docs/GMAIL_SETUP.md)

**Resumen:**
1. Crea cuenta Gmail para recibir tickets: `groka.tickets@gmail.com`
2. Crea proyecto en Google Cloud Console
3. Habilita Gmail API
4. Crea credenciales OAuth 2.0
5. Ejecuta: `npm run gmail:setup` para obtener tokens
6. Configura variables de entorno

### 3. Variables de entorno

Copia `.env.example` a `.env.local` y completa:

```bash
# Supabase (ya las tienes)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Gmail API (nuevas - obtén con `npm run gmail:setup`)
GMAIL_ACCESS_TOKEN=ya29.xxx...
GMAIL_REFRESH_TOKEN=1//xxx...
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxx...
GMAIL_POLLER_SECRET=$(openssl rand -base64 32)
```

### 4. Deploy a Vercel

```bash
git add .
git commit -m "feat: add Gmail ticket processor"
git push
```

Vercel automáticamente:
- Desplegará el endpoint `/api/email/gmail-poller`
- Configurará el cron job (cada 10 minutos)

### 5. Configurar variables en Vercel

Ve a Vercel Dashboard → Settings → Environment Variables y añade todas las variables del `.env.local`.

## 🧪 Testing local

### Opción 1: Ejecutar poller manualmente
```bash
# Asegúrate de tener .env.local configurado
npm run gmail:poll
```

### Opción 2: Simular email (sin Gmail API)
```bash
# Envía email de prueba a groka.tickets@gmail.com con PDF adjunto
# Luego ejecuta:
npm run gmail:poll
```

### Opción 3: Vercel local
```bash
vercel dev
# Abre: http://localhost:3000/api/email/gmail-poller
# Header: Authorization: Bearer TU_GMAIL_POLLER_SECRET
```

## 📊 Arquitectura

```
Usuario reenvía email → groka.tickets@gmail.com
                              ↓
            Gmail almacena el email con PDF adjunto
                              ↓
    Vercel Cron ejecuta `/api/email/gmail-poller` (cada 10 min)
                              ↓
              Gmail API lee emails no leídos
                              ↓
        Valida remitente en Supabase (`users` table)
                              ↓
              Descarga PDF adjunto (base64)
                              ↓
          Parser (`pdfParser.ts`) extrae datos
                              ↓
    Sube PDF a Supabase Storage + guarda ticket en DB
                              ↓
         Gmail API envía email de confirmación
                              ↓
              Marca email original como leído
```

## 📁 Archivos clave

| Archivo | Descripción |
|---------|-------------|
| `api/email/gmail-poller.ts` | Endpoint principal - procesa emails |
| `scripts/get-gmail-tokens.js` | Obtiene OAuth tokens iniciales |
| `scripts/test-gmail-poller.js` | Prueba el poller sin esperar cron |
| `vercel.json` | Configuración de Vercel Cron |
| `docs/GMAIL_SETUP.md` | Guía detallada de configuración |

## 🔐 Seguridad

1. **`GMAIL_POLLER_SECRET`**: Solo Vercel Cron y scripts autorizados pueden llamar al endpoint
2. **`SUPABASE_SERVICE_ROLE_KEY`**: Solo en server-side, nunca en frontend
3. **Validación de usuario**: Solo procesa emails de usuarios registrados en Groka
4. **Rate limiting**: Gmail API tiene límites razonables (10k requests/día)

## 📧 Email templates

### ✅ Confirmación exitosa
```html
<h2>¡Tickets procesados!</h2>
<p>Hemos procesado correctamente los siguientes tickets:</p>
<ul>
  <li>ticket_mercadona_20250202.pdf</li>
</ul>
<p>Ya puedes verlos en tu cuenta de <a href="https://groka.app">Groka</a>.</p>
```

### ❌ Usuario no registrado
```html
<h2>No pudimos procesar tu ticket</h2>
<p>El email <strong>user@example.com</strong> no está registrado en Groka.</p>
<p>Por favor, regístrate en <a href="https://groka.app">groka.app</a> primero.</p>
```

### ⚠️ Sin PDFs adjuntos
```html
<h2>No encontramos PDFs adjuntos</h2>
<p>Por favor, reenvía el email con el ticket en formato PDF adjunto.</p>
```

## 🐛 Troubleshooting

### Error: "Invalid grant"
**Causa:** Access token expirado (dura 1 hora)  
**Solución:** Vuelve a ejecutar `npm run gmail:setup` y actualiza `GMAIL_ACCESS_TOKEN` en Vercel

### Error: "Unauthorized" en logs
**Causa:** `GMAIL_POLLER_SECRET` incorrecto  
**Solución:** Verifica que el secret en `.env.local` coincide con el configurado en Vercel

### No procesa PDFs
**Causa:** Parser falla o PDF no es de un supermercado soportado  
**Solución:** Revisa logs en Vercel → busca el error del parser

### Usuario no recibe confirmación
**Causa 1:** Email no está registrado en Groka  
**Causa 2:** Gmail API no tiene permisos de envío  
**Solución:** Verifica scopes OAuth incluyen `gmail.send`

## 📈 Monitoreo

### Ver logs en tiempo real
```bash
vercel logs --follow
```

O en Vercel Dashboard → Functions → Logs

### Verificar tickets procesados
```sql
-- En Supabase SQL Editor
SELECT 
  t.id,
  t.file_name,
  t.ticket_number,
  t.total_amount,
  t.created_at,
  u.email
FROM tickets t
JOIN auth.users u ON u.id = t.user_id
WHERE t.created_at > NOW() - INTERVAL '1 day'
ORDER BY t.created_at DESC;
```

## 🎯 Roadmap

- [ ] Auto-refresh de access token usando refresh token
- [ ] Dashboard para ver emails procesados y errores
- [ ] Soporte para múltiples cuentas Gmail (por usuario)
- [ ] Notificaciones push en la app cuando se procesa ticket
- [ ] OCR mejorado para tickets escaneados/fotografiados
- [ ] Detección automática de duplicados antes de guardar

## 💰 Costes

| Servicio | Gratis hasta | Coste después |
|----------|-------------|---------------|
| Gmail API | 1B unidades/día (~10k emails) | Gratis para uso normal |
| Vercel Cron | 100 invocaciones/mes | $20/mes plan Pro (ilimitado) |
| Supabase Storage | 1GB | $0.021/GB/mes |
| **Total** | **$0/mes** (MVP) | - |

## 🤝 Contribuir

Para añadir soporte de nuevos supermercados al parser, edita:
- `src/services/pdfParser.ts` → añade reglas de detección
- `src/services/supermarketService.ts` → registra nuevo supermercado
