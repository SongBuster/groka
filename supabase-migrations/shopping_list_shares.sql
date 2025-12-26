-- Tabla para gestionar listas de compra compartidas
CREATE TABLE IF NOT EXISTS public.shopping_list_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Un usuario solo puede tener un permiso por lista
  UNIQUE(list_id, shared_with_user_id)
);

-- Índices para mejorar performance
CREATE INDEX idx_shopping_list_shares_list_id ON public.shopping_list_shares(list_id);
CREATE INDEX idx_shopping_list_shares_shared_with ON public.shopping_list_shares(shared_with_user_id);
CREATE INDEX idx_shopping_list_shares_shared_by ON public.shopping_list_shares(shared_by_user_id);

-- RLS (Row Level Security)
ALTER TABLE public.shopping_list_shares ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver los compartidos donde están involucrados
CREATE POLICY "Users can view shares where they are involved"
  ON public.shopping_list_shares
  FOR SELECT
  USING (
    auth.uid() = shared_with_user_id OR 
    auth.uid() = shared_by_user_id OR
    auth.uid() IN (
      SELECT user_id FROM public.shopping_lists WHERE id = list_id
    )
  );

-- Política: Solo el dueño de la lista puede crear compartidos
CREATE POLICY "List owners can create shares"
  ON public.shopping_list_shares
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.shopping_lists WHERE id = list_id
    )
  );

-- Política: Solo el dueño de la lista puede eliminar compartidos
CREATE POLICY "List owners can delete shares"
  ON public.shopping_list_shares
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.shopping_lists WHERE id = list_id
    )
  );

-- Política: Solo el dueño de la lista puede actualizar compartidos
CREATE POLICY "List owners can update shares"
  ON public.shopping_list_shares
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.shopping_lists WHERE id = list_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.shopping_lists WHERE id = list_id
    )
  );

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_shopping_list_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shopping_list_shares_updated_at
  BEFORE UPDATE ON public.shopping_list_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_shopping_list_shares_updated_at();

-- Actualizar políticas de shopping_lists para incluir usuarios compartidos
DROP POLICY IF EXISTS "Users can view own shopping lists" ON public.shopping_lists;
CREATE POLICY "Users can view own and shared shopping lists"
  ON public.shopping_lists
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid()
    )
  );

-- Actualizar políticas de shopping_list_items para incluir usuarios compartidos
DROP POLICY IF EXISTS "Users can view own items" ON public.shopping_list_items;
CREATE POLICY "Users can view own and shared items"
  ON public.shopping_list_items
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    list_id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own items" ON public.shopping_list_items;
CREATE POLICY "Users can insert into own and shared lists"
  ON public.shopping_list_items
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    list_id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid() AND permission = 'edit'
    )
  );

DROP POLICY IF EXISTS "Users can update own items" ON public.shopping_list_items;
CREATE POLICY "Users can update own and shared items"
  ON public.shopping_list_items
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    list_id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid() AND permission = 'edit'
    )
  )
  WITH CHECK (
    auth.uid() = user_id OR
    list_id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid() AND permission = 'edit'
    )
  );

DROP POLICY IF EXISTS "Users can delete own items" ON public.shopping_list_items;
CREATE POLICY "Users can delete own and shared items"
  ON public.shopping_list_items
  FOR DELETE
  USING (
    auth.uid() = user_id OR
    list_id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid() AND permission = 'edit'
    )
  );

-- Función RPC para buscar usuario por email (necesaria para compartir listas)
CREATE OR REPLACE FUNCTION get_user_by_email(user_email TEXT)
RETURNS TABLE(id UUID, email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email
  FROM auth.users au
  WHERE au.email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función RPC para obtener email de usuario por ID (necesaria para mostrar compartidos)
CREATE OR REPLACE FUNCTION get_user_by_email_from_id(user_id UUID)
RETURNS TABLE(id UUID, email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email
  FROM auth.users au
  WHERE au.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
