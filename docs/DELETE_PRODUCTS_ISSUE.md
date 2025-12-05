# Solución: Productos no se eliminan

## Problema
Cuando intentas eliminar un producto, el diálogo de confirmación se muestra pero el producto no se elimina de la base de datos.

## Causa
Probablemente se debe a políticas de Row Level Security (RLS) en Supabase que no permiten eliminaciones de la tabla `products`.

## Solución

### Opción 1: Verificar y Ajustar Políticas RLS en Supabase

1. Ve a tu proyecto en https://supabase.com/dashboard
2. Navega a **SQL Editor**
3. Ejecuta esta query para ver las políticas actuales:

```sql
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'products'
ORDER BY tablename, policyname;
```

4. Si la tabla tiene RLS habilitada pero no hay política de DELETE, añade esta:

```sql
-- Permite que cualquier usuario autenticado elimine productos
CREATE POLICY "Enable delete for authenticated users"
ON public.products
FOR DELETE
USING (auth.role() = 'authenticated');
```

### Opción 2: Deshabilitar RLS en la tabla products (menos seguro)

```sql
-- Desactiva RLS completamente en la tabla products
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
```

### Opción 3: Permitir todo a autenticados (más permisivo)

```sql
-- Permite todas las operaciones a usuarios autenticados
CREATE POLICY "Enable all for authenticated users"
ON public.products
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
```

## Verificación

Para confirmar que funciona:

1. Abre la consola del navegador (F12 → Consola)
2. Intenta eliminar un producto
3. Si ves un error en la consola, copiar el mensaje de error
4. Vuelve a ejecutar las queries SQL para verificar las políticas

## Debug

Si el botón no funciona, revisa:

1. **Consola del navegador**: Busca mensajes de error en la pestaña Console
2. **Logs de Supabase**: Ve a Dashboard → Logs → Edge Logs para ver si hay errores
3. **Estado de RLS**: Asegúrate de que RLS esté habilitado pero con políticas que permitan DELETE

## Logs de Debug

El servicio ahora loguea más información. En la consola del navegador deberías ver:
- `Delete error: {detalle del error}` si hay un error de Supabase
- `Delete response: {datos retornados}` si la eliminación fue exitosa
