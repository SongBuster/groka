# ⚡ Quick Start - Groka

## 🚀 Inicio Rápido (5 minutos)

### 1️⃣ Instalar Dependencias
```bash
cd /Users/salva/Documents/Desarrollo/web/mercaroba/groka
npm install
```

### 2️⃣ Configurar Supabase

**Opción A: Tengo un proyecto de Supabase** ✅
```bash
# Edita .env y añade tus credenciales
VITE_SUPABASE_URL=https://tuproyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

**Opción B: No tengo Supabase** 🆕
1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto (toma 2 min)
3. Sigue la guía completa: **[SETUP_SUPABASE.md](./SETUP_SUPABASE.md)**

### 3️⃣ Ejecutar Base de Datos

1. En Supabase, ve a **SQL Editor**
2. Copia el contenido de `/supabase/schema.sql`
3. Pégalo y ejecuta (Run)

### 4️⃣ Configurar Storage

1. En Supabase, ve a **Storage**
2. Crea un bucket llamado `tickets`
3. Configura como **privado** (no público)
4. Sigue las políticas en **[SETUP_SUPABASE.md](./SETUP_SUPABASE.md)** (Paso 5)

### 5️⃣ Iniciar Aplicación
```bash
npm run dev
```

Abre http://localhost:5173 🎉

---

## ✅ Verificación Rápida

**¿Todo funciona?** Prueba esto:

1. **Crear cuenta** → Regístrate con un email
2. **Subir ticket** → Arrastra un PDF de Mercadona
3. **Ver ticket** → Debería aparecer parseado en la lista

**Si algo falla:**
- Revisa la consola del navegador (F12)
- Verifica que `.env` tiene las credenciales correctas
- Asegúrate de que ejecutaste el `schema.sql`

---

## 📋 Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview

# Lint (revisar errores)
npm run lint
```

---

## 🗂️ Archivos Importantes

| Archivo | Descripción |
|---------|-------------|
| `SETUP_SUPABASE.md` | Guía completa de configuración de Supabase |
| `PROJECT_STATUS.md` | Estado del proyecto y roadmap |
| `supabase/schema.sql` | Esquema completo de la base de datos |
| `.env` | Variables de entorno (NO subir a Git) |

---

## 🐛 Problemas Comunes

### Error: "Invalid API key"
```bash
# Verifica que .env tiene las credenciales correctas
cat .env

# Reinicia el servidor
npm run dev
```

### Error: "relation does not exist"
→ No ejecutaste el `schema.sql`. Ve al paso 3️⃣

### No se parsean los PDFs
→ Solo funciona con tickets de **Mercadona**. Otros supermercados requieren adaptar el parser.

---

## 🎯 ¿Qué Puedo Hacer Ahora?

### ✅ Funcionando:
- Crear cuenta / Login
- Subir tickets PDF (Mercadona)
- Ver historial de tickets
- Auto-parseo de productos

### 🚧 En desarrollo:
- Listas de compra
- Compartir listas
- Dashboard de análisis
- Predicciones IA

---

## 📚 Más Info

- **Documentación completa**: `README.md`
- **Estado del proyecto**: `PROJECT_STATUS.md`
- **Guía de Supabase**: `SETUP_SUPABASE.md`

---

## 🚀 ¡Listo para Empezar!

Tu aplicación Groka está configurada y lista. Sube tu primer ticket y empieza a gestionar tus compras de forma inteligente 🛒
