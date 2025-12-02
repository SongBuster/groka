# ⚡ Quick Setup - Email Processor

## Pasos mínimos para activar el procesamiento de tickets por email

### 1️⃣ Crear cuenta Gmail (5 min)
```
1. Ve a gmail.com
2. Crea cuenta: groka.tickets@gmail.com (o el nombre que prefieras)
3. Guarda las credenciales
```

### 2️⃣ Configurar Google Cloud (10 min)
```
1. Ve a: https://console.cloud.google.com
2. Crear proyecto: "Groka Email Processor"
3. Habilitar Gmail API:
   - APIs & Services → Library → Gmail API → Enable
4. Crear credenciales OAuth 2.0:
   - APIs & Services → Credentials → Create → OAuth client ID
   - Type: Web application
   - Redirect URIs: http://localhost:3000/oauth/callback
5. Guardar Client ID y Client Secret
```

### 3️⃣ Obtener tokens (5 min)
```bash
# En tu terminal, en la carpeta groka:
export GMAIL_CLIENT_ID="tu-client-id"
export GMAIL_CLIENT_SECRET="tu-client-secret"
npm run gmail:setup

# Sigue las instrucciones:
# 1. Visita la URL que aparece
# 2. Autoriza la app
# 3. Copia el código de autorización
# 4. Guarda los tokens que aparecen
```

### 4️⃣ Configurar variables de entorno en Vercel (5 min)
```
Ve a: Vercel Dashboard → Tu proyecto → Settings → Environment Variables

Añade estas variables (obtén los valores del paso anterior):

GMAIL_ACCESS_TOKEN=ya29.xxx...
GMAIL_REFRESH_TOKEN=1//xxx...
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxx...
GMAIL_POLLER_SECRET=[genera con: openssl rand -base64 32]
SUPABASE_SERVICE_ROLE_KEY=[cópialo de Supabase Dashboard → Settings → API]
```

### 5️⃣ Deploy (2 min)
```bash
git add .
git commit -m "feat: add email processor"
git push
```

Vercel automáticamente desplegará y activará el cron job.

### 6️⃣ Test (3 min)
```
1. Envía email de prueba a: groka.tickets@gmail.com
   - Desde: tu email registrado en Groka
   - Adjunto: cualquier PDF de ticket
2. Espera 10 minutos (o ejecuta manualmente: npm run gmail:poll)
3. Verifica en Groka que el ticket aparece
4. Deberías recibir email de confirmación
```

---

## ✅ Checklist completo

- [ ] Cuenta Gmail creada
- [ ] Proyecto Google Cloud creado
- [ ] Gmail API habilitada
- [ ] Credenciales OAuth 2.0 creadas
- [ ] Tokens obtenidos con `npm run gmail:setup`
- [ ] Variables de entorno configuradas en Vercel
- [ ] Código pusheado y desplegado
- [ ] Email de prueba enviado
- [ ] Ticket aparece en Groka
- [ ] Email de confirmación recibido

---

## 🆘 Ayuda rápida

**No funciona?**
1. Revisa logs: `vercel logs --follow`
2. Busca errores en: Vercel Dashboard → Functions → Logs
3. Verifica variables de entorno: todas deben estar configuradas
4. Prueba tokens: `npm run gmail:poll` (debe devolver success)

**Más detalles:** Ver [docs/GMAIL_SETUP.md](./GMAIL_SETUP.md)

**Tiempo total estimado:** 30 minutos
