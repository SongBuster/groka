# Gmail Ticket Processor - Setup Guide

## 📧 Configuración de Gmail API

### 1. Crear cuenta Gmail dedicada

Crea una cuenta Gmail nueva para recibir los tickets reenviados:
- Ejemplo: `groka.tickets@gmail.com`
- Esta será la cuenta donde los usuarios reenviarán sus PDFs

### 2. Configurar Google Cloud Project

1. Ve a: https://console.cloud.google.com
2. Crea un nuevo proyecto: "Groka Email Processor"
3. Habilita Gmail API:
   - APIs & Services → Library
   - Busca "Gmail API" → Enable

### 3. Crear credenciales OAuth 2.0

1. APIs & Services → Credentials → Create Credentials → OAuth client ID
2. Application type: **Web application**
3. Authorized redirect URIs:
   ```
   http://localhost:3000/oauth/callback
   https://groka.vercel.app/oauth/callback
   ```
4. Guarda:
   - **Client ID**
   - **Client Secret**

### 4. Obtener Access Token y Refresh Token

Ejecuta este script para obtener los tokens (requiere Node.js):

```javascript
// scripts/get-gmail-tokens.js
import readline from 'readline'
import { google } from 'googleapis'

const CLIENT_ID = 'tu-client-id'
const CLIENT_SECRET = 'tu-client-secret'
const REDIRECT_URI = 'http://localhost:3000/oauth/callback'

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

// Scopes necesarios
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
]

// Paso 1: Generar URL de autorización
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
})

console.log('Autoriza esta app visitando esta URL:', authUrl)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

rl.question('Introduce el código de autorización: ', async (code) => {
  const { tokens } = await oauth2Client.getToken(code)
  console.log('\n=== GUARDA ESTOS TOKENS ===')
  console.log('Access Token:', tokens.access_token)
  console.log('Refresh Token:', tokens.refresh_token)
  rl.close()
})
```

**Ejecutar:**
```bash
npm install googleapis
node scripts/get-gmail-tokens.js
```

### 5. Configurar variables de entorno en Vercel

Ve a Vercel Dashboard → Settings → Environment Variables y añade:

```bash
# Supabase (ya las tienes)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Gmail API (nuevas)
GMAIL_ACCESS_TOKEN=ya29.xxx...
GMAIL_REFRESH_TOKEN=1//xxx...
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxx...

# Security
GMAIL_POLLER_SECRET=genera-un-secret-aleatorio-aqui
```

Para generar `GMAIL_POLLER_SECRET`:
```bash
openssl rand -base64 32
```

---

## 🚀 Uso

### Opción 1: Vercel Cron (Automático)

El archivo `vercel.json` ya está configurado para ejecutar el poller cada 10 minutos automáticamente.

**No requiere acción adicional después del deploy.**

### Opción 2: Llamada manual (Testing)

```bash
curl -X GET https://groka.vercel.app/api/email/gmail-poller \
  -H "Authorization: Bearer TU_GMAIL_POLLER_SECRET"
```

### Opción 3: Script local (Development)

```bash
cd groka
npm run poll-emails
```

---

## 📋 Flujo de usuario

1. Usuario recibe email de Mercadona con ticket PDF adjunto
2. Usuario reenvía ese email a: `groka.tickets@gmail.com`
3. Cada 10 minutos (o manual), el poller:
   - Lee emails no leídos
   - Verifica que el remitente esté registrado en Groka
   - Descarga PDFs adjuntos
   - Parsea tickets y guarda en Supabase
   - Envía email de confirmación al usuario
   - Marca email como leído
4. Usuario recibe confirmación y ve el ticket en su cuenta

---

## 🔧 Monitoreo

### Ver logs en Vercel
- Vercel Dashboard → Functions → Logs en tiempo real
- Busca: "gmail-poller"

### Verificar emails procesados
```sql
-- En Supabase SQL Editor
SELECT 
  t.id,
  t.file_name,
  t.created_at,
  u.email as user_email
FROM tickets t
JOIN users u ON u.id = t.user_id
ORDER BY t.created_at DESC
LIMIT 50;
```

---

## ⚠️ Refresh Token

Los access tokens de Gmail expiran cada hora. El refresh token se usa para obtener nuevos access tokens automáticamente.

**Implementación futura (opcional):**
Crea `/api/email/refresh-token.ts` para renovar el access token automáticamente usando el refresh token.

Por ahora, si el access token expira, vuelve a ejecutar `get-gmail-tokens.js` y actualiza la variable en Vercel.

---

## 🛡️ Seguridad

1. **GMAIL_POLLER_SECRET**: Solo Vercel Cron conoce este secret
2. **Service Role Key**: Solo en server-side, nunca en frontend
3. **Validación de usuario**: Solo procesa emails de usuarios registrados
4. **Rate limiting**: Gmail API tiene límites (10k requests/día gratis)

---

## 📊 Límites de Gmail API (gratuito)

- **Cuota diaria:** 1 billón de unidades (suficiente para ~10k emails/día)
- **Envío de emails:** 500/día (usuarios Gmail) o 2000/día (Google Workspace)
- **Attachments:** 35 MB máximo por email

Para Groka MVP: **Suficiente** ✅

---

## 🎯 Próximos pasos

1. Ejecuta `scripts/get-gmail-tokens.js` para obtener tokens
2. Configura variables de entorno en Vercel
3. Deploy a Vercel: `git push`
4. Prueba enviando email con PDF a `groka.tickets@gmail.com`
5. Verifica logs en Vercel
6. Comprueba que el ticket aparece en Groka

---

## 🐛 Troubleshooting

**Error: "Invalid grant"**
- Refresh token expirado → vuelve a ejecutar `get-gmail-tokens.js`

**Error: "Unauthorized"**
- Verifica `GMAIL_POLLER_SECRET` en headers

**No procesa PDFs**
- Verifica que el email tenga adjuntos PDF
- Revisa logs: `console.log` mostrará el error del parser

**Usuario no registrado**
- El email del remitente debe coincidir exactamente con el email en Supabase
- Busca en logs: "User not found"
