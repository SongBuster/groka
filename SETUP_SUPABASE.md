# 🚀 Guía de Configuración de Supabase

Esta guía te llevará paso a paso para configurar la base de datos y el storage en Supabase.

## 📝 Paso 1: Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Haz clic en "Start your project"
3. Inicia sesión o crea una cuenta
4. Crea un nuevo proyecto:
   - **Name**: Groka
   - **Database Password**: Guarda esta contraseña (la necesitarás más adelante)
   - **Region**: Elige la más cercana a ti
5. Espera a que el proyecto se inicialice (toma ~2 minutos)

## 🔑 Paso 2: Obtener Credenciales

1. En tu proyecto de Supabase, ve a **Settings** (⚙️) > **API**
2. Copia los siguientes valores:
   - **Project URL** (debajo de "Config")
   - **anon public** key (debajo de "Project API keys")

3. Pega estos valores en tu archivo `.env`:
```env
VITE_SUPABASE_URL=https://tuproyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

## 🗄️ Paso 3: Crear el Esquema de Base de Datos

1. En Supabase, ve a **SQL Editor** (icono de <>)
2. Haz clic en **+ New query**
3. Copia **TODO** el contenido del archivo `/supabase/schema.sql`
4. Pégalo en el editor SQL
5. Haz clic en **Run** (o presiona Ctrl/Cmd + Enter)
6. Deberías ver: "Success. No rows returned"

✅ Esto creará todas las tablas, índices, políticas de seguridad y triggers.

## 📦 Paso 4: Configurar Storage

1. En Supabase, ve a **Storage** (icono de 📦)
2. Haz clic en **Create a new bucket**
3. Configura el bucket:
   - **Name**: `tickets`
   - **Public bucket**: ❌ **NO** (déjalo desmarcado para privacidad)
   - **Allowed MIME types**: `application/pdf`
   - **File size limit**: `10` MB

4. Haz clic en **Create bucket**

## 🔐 Paso 5: Configurar Políticas de Storage (RLS)

1. En la lista de buckets, haz clic en el bucket `tickets`
2. Ve a la pestaña **Policies**
3. Haz clic en **New policy**

### Política 1: Upload de tickets (INSERT)

- **Policy name**: Users can upload their own tickets
- **Policy definition**: Custom
- **Target roles**: authenticated
- **Operation**: INSERT
- **WITH CHECK expression**:
```sql
(bucket_id = 'tickets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

### Política 2: Ver tickets propios (SELECT)

- **Policy name**: Users can view their own tickets
- **Policy definition**: Custom
- **Target roles**: authenticated
- **Operation**: SELECT
- **USING expression**:
```sql
(bucket_id = 'tickets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

### Política 3: Eliminar tickets propios (DELETE)

- **Policy name**: Users can delete their own tickets
- **Policy definition**: Custom
- **Target roles**: authenticated
- **Operation**: DELETE
- **USING expression**:
```sql
(bucket_id = 'tickets'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

## ✅ Paso 6: Verificar Configuración

### Verificar Tablas:

1. Ve a **Table Editor**
2. Deberías ver estas tablas:
   - tickets
   - products
   - ticket_items
   - shopping_lists
   - shopping_list_items
   - list_shares
   - profiles

### Verificar Authentication:

1. Ve a **Authentication** > **Providers**
2. Asegúrate de que **Email** está habilitado ✅

## 🏃 Paso 7: Ejecutar la Aplicación

```bash
# En la carpeta del proyecto
npm run dev
```

La app debería abrir en `http://localhost:5173`

## 🧪 Paso 8: Probar la App

1. **Crear una cuenta**: En la app, haz clic en "Crear cuenta" y regístrate
2. **Verificar en Supabase**: Ve a **Authentication** > **Users** y verifica que tu usuario aparece
3. **Subir un ticket**: Arrastra un PDF de ticket de Mercadona
4. **Ver en la base de datos**: Ve a **Table Editor** > `tickets` y verifica que se guardó

## 🐛 Solución de Problemas

### Error: "Invalid API key"
- Verifica que copiaste correctamente la **anon key** en `.env`
- Reinicia el servidor de desarrollo (`npm run dev`)

### Error: "relation does not exist"
- Asegúrate de ejecutar el SQL completo del archivo `schema.sql`
- Ve a **SQL Editor** y verifica que todas las tablas existen

### Error al subir PDF: "new row violates row-level security policy"
- Verifica que las políticas RLS están configuradas correctamente
- Ve a **Table Editor** > tabla `tickets` > **RLS** y verifica que hay políticas

### Los tickets no se ven después de subirlos
- Abre las DevTools del navegador (F12)
- Mira la consola para ver errores
- Verifica que el parseo del PDF funcionó (debería ver logs en consola)

## 📚 Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Policies](https://supabase.com/docs/guides/storage/security/access-control)

## 🎉 ¡Listo!

Tu aplicación Groka está configurada y lista para usar. Ahora puedes:
- ✅ Subir tickets
- ✅ Ver el historial de compras
- 🚧 Crear listas de compra (próximamente)
- 🚧 Compartir listas (próximamente)
- 🚧 Ver análisis (próximamente)
