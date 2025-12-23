-- Tabla para gestionar preferencias de sugerencias inteligentes por usuario
CREATE TABLE IF NOT EXISTS public.suggestion_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('hide_temporary', 'hide_permanent')),
  hide_until TIMESTAMP WITH TIME ZONE NULL, -- NULL si es hide_permanent
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Un usuario solo puede tener una preferencia activa por producto
  UNIQUE(user_id, product_id)
);

-- Índices para mejorar performance
CREATE INDEX idx_suggestion_preferences_user_id ON public.suggestion_preferences(user_id);
CREATE INDEX idx_suggestion_preferences_product_id ON public.suggestion_preferences(product_id);
CREATE INDEX idx_suggestion_preferences_hide_until ON public.suggestion_preferences(hide_until) WHERE hide_until IS NOT NULL;

-- RLS (Row Level Security)
ALTER TABLE public.suggestion_preferences ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver sus propias preferencias
CREATE POLICY "Users can view own suggestion preferences"
  ON public.suggestion_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Los usuarios solo pueden insertar sus propias preferencias
CREATE POLICY "Users can insert own suggestion preferences"
  ON public.suggestion_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios solo pueden actualizar sus propias preferencias
CREATE POLICY "Users can update own suggestion preferences"
  ON public.suggestion_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios solo pueden eliminar sus propias preferencias
CREATE POLICY "Users can delete own suggestion preferences"
  ON public.suggestion_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_suggestion_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suggestion_preferences_updated_at
  BEFORE UPDATE ON public.suggestion_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_suggestion_preferences_updated_at();

-- Función para limpiar preferencias temporales expiradas (opcional, para mantenimiento)
CREATE OR REPLACE FUNCTION clean_expired_suggestion_preferences()
RETURNS void AS $$
BEGIN
  DELETE FROM public.suggestion_preferences
  WHERE action = 'hide_temporary'
    AND hide_until IS NOT NULL
    AND hide_until < NOW();
END;
$$ LANGUAGE plpgsql;
