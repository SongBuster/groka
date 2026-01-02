#!/bin/bash

# Script para exportar datos de producción a desarrollo local
# Uso: ./scripts/export-prod-data.sh

echo "🔄 Exportando datos de producción..."

# Crear directorio para seeds si no existe
mkdir -p supabase/seed

# Exportar datos de producción (solo datos, sin schema)
supabase db dump --data-only --use-copy -f supabase/seed/production_data.sql

if [ $? -eq 0 ]; then
    echo "✅ Datos exportados a supabase/seed/production_data.sql"
    echo ""
    echo "Para aplicar los datos a tu base de datos local:"
    echo "  supabase db reset"
    echo ""
    echo "O aplicar solo los datos sin resetear:"
    echo "  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed/production_data.sql"
else
    echo "❌ Error al exportar datos"
    exit 1
fi
