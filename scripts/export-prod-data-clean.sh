#!/bin/bash

# Script mejorado para exportar solo datos de tablas públicas
# Uso: ./scripts/export-prod-data-clean.sh

echo "🔄 Exportando datos de producción (solo tablas públicas)..."

# Crear directorio para seeds si no existe
mkdir -p supabase/seed

# Tablas a exportar (solo las tablas de la app, no auth ni storage)
TABLES=(
    "public.categories"
    "public.products"
    "public.tickets"
    "public.ticket_items"
    "public.shopping_lists"
    "public.shopping_list_items"
    "public.shopping_list_shares"
)

# Crear archivo temporal
TEMP_FILE="supabase/seed/temp_data.sql"
OUTPUT_FILE="supabase/seed.sql"

# Limpiar archivos anteriores
rm -f $OUTPUT_FILE $TEMP_FILE

# Encabezado del archivo
echo "-- Seed data from production" > $OUTPUT_FILE
echo "-- Generated: $(date)" >> $OUTPUT_FILE
echo "-- This file contains only public schema data" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "SET session_replication_role = replica;" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Exportar cada tabla
for TABLE in "${TABLES[@]}"; do
    echo "  📦 Exportando $TABLE..."
    supabase db dump --data-only --use-copy -t $TABLE -f $TEMP_FILE 2>/dev/null
    
    if [ $? -eq 0 ]; then
        # Filtrar solo las líneas COPY y los datos
        grep -A 10000 "COPY $TABLE" $TEMP_FILE | sed '/^--/d' >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
    else
        echo "  ⚠️  No se pudo exportar $TABLE (puede que esté vacía)"
    fi
done

# Limpiar archivo temporal
rm -f $TEMP_FILE

# Restaurar configuración
echo "SET session_replication_role = DEFAULT;" >> $OUTPUT_FILE

if [ -f $OUTPUT_FILE ]; then
    echo "✅ Datos exportados a $OUTPUT_FILE"
    echo ""
    echo "📊 Resumen:"
    wc -l $OUTPUT_FILE
    echo ""
    echo "Para aplicar los datos:"
    echo "  supabase db reset"
else
    echo "❌ Error al exportar datos"
    exit 1
fi
