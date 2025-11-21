-- Cambiar el tipo de columna purchase_date de date a timestamptz para soportar fecha y hora
-- Esto permite almacenar la hora exacta de compra junto con la fecha

ALTER TABLE tickets 
ALTER COLUMN purchase_date TYPE timestamptz 
USING purchase_date::timestamptz;

-- Agregar comentario para documentar el cambio
COMMENT ON COLUMN tickets.purchase_date IS 'Fecha y hora de compra del ticket (timestamp with timezone)';
