# Desarrollo Local con Supabase

Este proyecto está configurado para usar **Supabase local** en desarrollo y **Supabase cloud** en producción.

## 🚀 Configuración Inicial (Solo una vez)

### 1. Levantar Supabase Local

```bash
supabase start
```

Esto iniciará:
- PostgreSQL local (puerto 54322)
- API local (puerto 54321)
- Studio (interfaz web): http://127.0.0.1:54323

**Primera vez:** Tardará varios minutos descargando imágenes Docker.

### 2. Aplicar el Schema Inicial

```bash
# Opción A: Desde el schema principal
supabase db reset

# Opción B: Aplicar migraciones específicas
supabase migration new initial_schema
# Copia el contenido de supabase/schema.sql al archivo de migración creado
supabase db reset
```

### 3. Aplicar Migraciones de Listas Compartidas

```bash
# Ejecuta cada migración en orden
supabase db execute -f supabase-migrations/shopping_list_shares.sql
supabase db execute -f supabase-migrations/fix_shopping_list_items_rls.sql
supabase db execute -f supabase-migrations/fix_get_user_by_email.sql
supabase db execute -f supabase-migrations/fix_complete_sharing.sql
supabase db execute -f supabase-migrations/fix_shopping_list_shares_recursion.sql
```

## 📝 Uso Diario

### Desarrollo
```bash
# 1. Asegúrate que Supabase local está corriendo
supabase status

# 2. Si no está corriendo, inícialo
supabase start

# 3. Corre la app en modo desarrollo (usará la BD local)
npm run dev
```

La app se conectará automáticamente a `http://127.0.0.1:54321` (base de datos local).

### Ver la Base de Datos Local

```bash
# Abrir Supabase Studio (interfaz web)
open http://127.0.0.1:54323

# O conectarte directamente con psql
supabase db reset
```

### Detener Supabase Local

```bash
supabase stop
```

## 🔄 Workflow de Desarrollo

### Exportar Datos de Producción

Cuando quieras trabajar con datos reales de producción en tu entorno local:

```bash
# Exportar datos de producción
node scripts/export-data.mjs

# Aplicar los datos a local (incluye reset de BD)
supabase db reset
```

El script `export-data.mjs` extrae los datos de las siguientes tablas:
- categories
- products
- tickets y ticket_items
- shopping_lists, shopping_list_items y shopping_list_shares

Los datos se guardan en `supabase/seed.sql` y se aplican automáticamente con `supabase db reset`.

### Crear una Nueva Migración

```bash
# 1. Crear archivo de migración
supabase migration new nombre_de_la_migracion

# 2. Editar el archivo generado en supabase/migrations/
# 3. Aplicar la migración localmente
supabase db reset

# 4. Probar que todo funciona
npm run dev

# 5. Si está bien, commitear la migración
git add supabase/migrations/
git commit -m "feat: nueva migración"
```

### Aplicar Migraciones a Producción

Una vez probadas localmente:

```bash
# Opción 1: Manualmente en Supabase Dashboard
# 1. Ve a https://supabase.com/dashboard
# 2. SQL Editor > Nueva Query
# 3. Copia y ejecuta el SQL de la migración

# Opción 2: Con CLI (necesita configuración adicional)
supabase link --project-ref gmvjcllbzgnnohoxbvix
supabase db push
```

## 🌍 Variables de Entorno

El proyecto usa estos archivos:

- **`.env.development.local`** → Supabase LOCAL (desarrollo)
- **`.env.production.local`** → Supabase CLOUD (producción)
- **`.env.example`** → Plantilla de ejemplo

Vite carga automáticamente el archivo correcto según el comando:
- `npm run dev` → usa `.env.development.local`
- `npm run build` → usa `.env.production.local`

## 🛠 Comandos Útiles

```bash
# Ver estado de Supabase local
supabase status

# Ver logs
supabase logs

# Resetear la base de datos (cuidado: borra todo)
supabase db reset

# Crear usuario de prueba
supabase db seed

# Generar tipos TypeScript desde la BD
supabase gen types typescript --local > src/types/supabase.ts
```

## ⚠️ Importante

1. **Nunca** commites archivos `.env*.local` - están en .gitignore
2. Los datos en la BD local se **pierden** al hacer `supabase stop` o `docker system prune`
3. Para datos de prueba persistentes, crea un archivo `supabase/seed.sql`
4. Docker debe estar corriendo para que Supabase local funcione

## 🐛 Troubleshooting

### Error: "Cannot connect to Docker"
```bash
# Asegúrate que Docker Desktop está corriendo
open -a Docker
```

### Error: "Port already in use"
```bash
# Detén Supabase y vuelve a iniciar
supabase stop
supabase start
```

### La app no ve la BD local
```bash
# Verifica que las variables de entorno estén correctas
cat .env.development.local

# Verifica que Supabase local esté corriendo
supabase status
```

### Resetear todo desde cero
```bash
supabase stop
docker system prune -a  # Cuidado: borra TODOS los contenedores Docker
supabase start
```
