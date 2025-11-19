# ✅ Checklist de Verificación - Groka

Usa este checklist para verificar que todo está configurado correctamente.

## 📦 Instalación

- [ ] Node.js instalado (v18+)
- [ ] Dependencias instaladas (`npm install`)
- [ ] Proyecto compila sin errores (`npm run build`)

## 🗄️ Supabase

### Proyecto Creado
- [ ] Proyecto creado en Supabase
- [ ] URL copiada a `.env`
- [ ] Anon Key copiada a `.env`

### Base de Datos
- [ ] `schema.sql` ejecutado completamente
- [ ] Tabla `tickets` existe
- [ ] Tabla `products` existe
- [ ] Tabla `ticket_items` existe
- [ ] Tabla `shopping_lists` existe
- [ ] Tabla `shopping_list_items` existe
- [ ] Tabla `list_shares` existe
- [ ] Tabla `profiles` existe
- [ ] Políticas RLS activadas

### Storage
- [ ] Bucket `tickets` creado
- [ ] Bucket configurado como **privado**
- [ ] Política INSERT configurada
- [ ] Política SELECT configurada
- [ ] Política DELETE configurada

### Authentication
- [ ] Email provider habilitado
- [ ] Email confirmación deshabilitada (desarrollo)

## 🧪 Pruebas Funcionales

### Autenticación
- [ ] Puedo registrarme con email/password
- [ ] El usuario aparece en Supabase Auth
- [ ] Puedo hacer login
- [ ] Puedo hacer logout
- [ ] El perfil se crea automáticamente en tabla `profiles`

### Upload de Tickets
- [ ] Puedo arrastrar un PDF al área de upload
- [ ] El PDF se sube a Supabase Storage
- [ ] El ticket aparece en la tabla `tickets`
- [ ] El parseo se ejecuta automáticamente
- [ ] Los productos se guardan en `ticket_items`
- [ ] Los productos únicos se crean en `products`

### Vista de Tickets
- [ ] Veo la lista de mis tickets
- [ ] La información es correcta (tienda, fecha, total)
- [ ] El estado "Parseado" se muestra correctamente

## 🔍 Depuración

Si algo no funciona, verifica:

### Frontend
```bash
# Consola del navegador (F12)
# ¿Hay errores en rojo?
# ¿Las peticiones a Supabase fallan?
```

### Supabase
```sql
-- En SQL Editor, verifica que hay datos:
SELECT * FROM tickets;
SELECT * FROM products;
SELECT * FROM ticket_items;
SELECT * FROM profiles;
```

### Storage
```
En Supabase Storage > tickets:
¿Se suben los archivos PDF?
¿Están organizados por userId?
```

## 🎯 Funcionalidades Verificadas

- [x] Autenticación con email/password
- [x] Upload de PDFs
- [x] Parseo automático de tickets Mercadona
- [x] Almacenamiento en Supabase
- [x] Vista de historial de tickets
- [ ] Listas de compra (pendiente)
- [ ] Compartir listas (pendiente)
- [ ] Dashboard de análisis (pendiente)

## 📊 Estado del Proyecto

**Versión:** 1.0.0-alpha  
**Última actualización:** 19 de noviembre de 2025  
**Estado:** ✅ Funcional (MVP)

## 🚀 Siguiente Paso

Una vez verificado todo:
1. Lee `PROJECT_STATUS.md` para ver el roadmap
2. Empieza a implementar las listas de compra
3. Sigue con el sistema de compartir

---

**¿Todo funcionando?** 🎉  
¡Felicidades! Tu app Groka está lista para usar.
