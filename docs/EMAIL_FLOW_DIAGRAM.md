# 📧 Flujo completo del Email Processor

```
┌─────────────────────────────────────────────────────────────────────┐
│                        1. USUARIO REENVÍA EMAIL                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Usuario recibe ticket por email
                                  │ (ej: Mercadona envía PDF)
                                  ▼
                    ╔═════════════════════════════╗
                    ║  usuario@gmail.com          ║
                    ║  ┌───────────────────────┐  ║
                    ║  │ Fwd: Tu ticket        │  ║
                    ║  │ 📎 ticket.pdf         │  ║
                    ║  └───────────────────────┘  ║
                    ╚═════════════════════════════╝
                                  │
                                  │ Reenvía a →
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    2. GMAIL RECIBE Y ALMACENA                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ╔═════════════════════════════╗
                    ║  groka.tickets@gmail.com    ║
                    ║  ┌───────────────────────┐  ║
                    ║  │ Email sin leer (⚫)   │  ║
                    ║  │ From: usuario@...     │  ║
                    ║  │ 📎 ticket.pdf         │  ║
                    ║  └───────────────────────┘  ║
                    ╚═════════════════════════════╝
                                  │
                                  │ Esperando procesamiento
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    3. VERCEL CRON SE EJECUTA                         │
│                      (cada 10 minutos)                               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────────────────────┐
                    │  Vercel Cron Scheduler      │
                    │  ⏰ */10 * * * *            │
                    │  (cada 10 minutos)          │
                    └─────────────────────────────┘
                                  │
                                  │ Trigger
                                  ▼
                    ┌─────────────────────────────┐
                    │  /api/email/gmail-poller    │
                    │  Authorization: Bearer ***  │
                    └─────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    4. POLLING Y VALIDACIÓN                           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────────────────────┐
                    │  Gmail API                  │
                    │  GET /messages?q=is:unread  │
                    └─────────────────────────────┘
                                  │
                                  │ Devuelve lista de mensajes
                                  ▼
                    ┌─────────────────────────────┐
                    │  Extraer remitente          │
                    │  usuario@gmail.com          │
                    └─────────────────────────────┘
                                  │
                                  │ Verificar en DB
                                  ▼
                    ┌─────────────────────────────┐
                    │  Supabase                   │
                    │  SELECT * FROM users        │
                    │  WHERE email = 'usuario@..' │
                    └─────────────────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
         ❌ No existe                        ✅ Existe
                │                                   │
                ▼                                   ▼
    ┌───────────────────────┐         ┌───────────────────────┐
    │ Enviar email rechazo  │         │ Continuar procesando  │
    │ "Regístrate primero"  │         └───────────────────────┘
    │ Marcar como leído     │                     │
    └───────────────────────┘                     │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    5. DESCARGA Y PARSEO DE PDF                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────────────────────┐
                    │  Gmail API                  │
                    │  GET /attachments/{id}      │
                    │  → Descarga PDF (base64)    │
                    └─────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │  pdfParser.ts               │
                    │  • Detecta supermercado     │
                    │  • Extrae fecha, total      │
                    │  • Parsea líneas/productos  │
                    └─────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │  Resultado parseado:        │
                    │  {                          │
                    │    supermarketId,           │
                    │    date, total,             │
                    │    products: [...]          │
                    │  }                          │
                    └─────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    6. GUARDADO EN SUPABASE                           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
                ▼                                   ▼
    ┌───────────────────────┐         ┌───────────────────────┐
    │  Supabase Storage     │         │  Supabase PostgreSQL  │
    │  Upload PDF           │         │  INSERT ticket        │
    │  → /tickets/user/...  │         │  INSERT ticket_items  │
    └───────────────────────┘         └───────────────────────┘
                │                                   │
                └─────────────────┬─────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │  Ticket guardado ✅         │
                    │  ID: abc123                 │
                    │  User: usuario@gmail.com    │
                    └─────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    7. CONFIRMACIÓN AL USUARIO                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────────────────────┐
                    │  Gmail API                  │
                    │  POST /messages/send        │
                    │  To: usuario@gmail.com      │
                    └─────────────────────────────┘
                                  │
                                  ▼
                    ╔═════════════════════════════╗
                    ║  Email de confirmación      ║
                    ║  ┌───────────────────────┐  ║
                    ║  │ ✅ Ticket procesado   │  ║
                    ║  │ ticket.pdf            │  ║
                    ║  │ Total: 45.67€         │  ║
                    ║  │ Ver en Groka →        │  ║
                    ║  └───────────────────────┘  ║
                    ╚═════════════════════════════╝
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │  Marcar email como leído    │
                    │  Gmail API: modify labels   │
                    │  removeLabelIds: ["UNREAD"] │
                    └─────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    8. USUARIO VE TICKET EN GROKA                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ╔═════════════════════════════╗
                    ║  groka.app                  ║
                    ║  ┌───────────────────────┐  ║
                    ║  │ 📄 Tickets            │  ║
                    ║  │ ┌─────────────────┐   │  ║
                    ║  │ │ Mercadona       │   │  ║
                    ║  │ │ 02/12/2025      │   │  ║
                    ║  │ │ 45.67€          │   │  ║
                    ║  │ └─────────────────┘   │  ║
                    ║  └───────────────────────┘  ║
                    ╚═════════════════════════════╝
                                  │
                                  ▼
                            ¡Completado! 🎉


═══════════════════════════════════════════════════════════════════════

VENTAJAS DE ESTE FLUJO:

✅ Sin dominio propio (usa Gmail gratis)
✅ Automático (cada 10 minutos)
✅ Seguro (valida usuarios registrados)
✅ Feedback inmediato (email de confirmación)
✅ Serverless (sin servidor propio)
✅ Escalable (Gmail API maneja millones de emails)
✅ $0 coste inicial

═══════════════════════════════════════════════════════════════════════

COMPONENTES NECESARIOS:

1. Cuenta Gmail (groka.tickets@gmail.com)
2. Google Cloud Project (Gmail API habilitada)
3. OAuth tokens (access + refresh)
4. Vercel Cron (automático tras deploy)
5. Variables de entorno en Vercel
6. Parser de tickets existente (ya lo tienes)
7. Supabase (ya configurado)

═══════════════════════════════════════════════════════════════════════
```
