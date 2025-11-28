# 🛒 Groka - Smart Shopping List

Gestiona tus tickets de compra, analiza tus gastos y crea listas inteligentes compartidas.

## 🚀 Características

- 📄 **Upload de PDFs**: Sube tickets de supermercado y se parsean automáticamente
- 📊 **Análisis inteligente**: Estadísticas de gastos, tendencias y predicciones
- 🛍️ **Lista de compra**: Crea y gestiona listas directamente en la app
- 👥 **Colaboración**: Comparte listas con otros usuarios
- ☁️ **En la nube**: Todos tus datos sincronizados y accesibles desde cualquier lugar

## 🛠️ Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Estado**: Zustand
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Routing**: React Router v7
- **PDF Parsing**: PDF.js
- **Iconos**: Lucide React

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Configurar Supabase (ver abajo)

# Iniciar desarrollo
npm run dev
```

## ⚙️ Configuración de Supabase

1. Crear un proyecto en [Supabase](https://supabase.com)
2. Copiar la URL y la ANON KEY a `.env`
3. Ejecutar las migraciones SQL (ver `/supabase/schema.sql`)

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes React reutilizables
├── pages/              # Páginas de la aplicación
├── services/           # Lógica de negocio y APIs
├── lib/                # Utilidades y configuración
├── hooks/              # Custom React hooks
├── types/              # TypeScript types
└── stores/             # Zustand stores (estado global)
```

## 🗄️ Base de Datos

Ver esquema completo en `/supabase/schema.sql`

### Tablas principales:
- `users` - Usuarios (manejado por Supabase Auth)
- `tickets` - Tickets de compra
- `products` - Catálogo de productos
- `ticket_items` - Líneas de productos en tickets
- `shopping_lists` - Listas de compra
- `shopping_list_items` - Productos en listas
- `list_shares` - Compartir listas entre usuarios

## 🎯 Roadmap

- [x] Setup del proyecto
- [ ] Autenticación de usuarios
- [ ] Upload y parseo de PDFs
- [ ] Dashboard de análisis
- [ ] Sistema de listas de compra
- [ ] Compartir listas
- [ ] Predicciones IA
- [ ] App móvil (PWA)
