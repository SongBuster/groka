-- ============================================================================
-- FIX COMPLETO: Resolver todos los problemas de listas compartidas
-- ============================================================================

-- PASO 1: Eliminar todas las políticas problemáticas
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view shares where they are involved" ON public.shopping_list_shares;
DROP POLICY IF EXISTS "List owners can create shares" ON public.shopping_list_shares;
DROP POLICY IF EXISTS "List owners can delete shares" ON public.shopping_list_shares;
DROP POLICY IF EXISTS "List owners can update shares" ON public.shopping_list_shares;

-- PASO 2: Eliminar funciones antiguas
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS is_list_owner(UUID, UUID);

-- PASO 3: Crear función helper con nombres no ambiguos
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_list_owner(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.shopping_lists sl
    WHERE sl.id = p_list_id AND sl.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- PASO 4: Recrear políticas con la función corregida
-- ----------------------------------------------------------------
CREATE POLICY "Users can view shares where they are involved"
  ON public.shopping_list_shares
  FOR SELECT
  USING (
    auth.uid() = shared_with_user_id OR 
    auth.uid() = shared_by_user_id
  );

CREATE POLICY "List owners can create shares"
  ON public.shopping_list_shares
  FOR INSERT
  WITH CHECK (
    is_list_owner(list_id, auth.uid())
  );

CREATE POLICY "List owners can delete shares"
  ON public.shopping_list_shares
  FOR DELETE
  USING (
    is_list_owner(list_id, auth.uid())
  );

CREATE POLICY "List owners can update shares"
  ON public.shopping_list_shares
  FOR UPDATE
  USING (
    is_list_owner(list_id, auth.uid())
  )
  WITH CHECK (
    is_list_owner(list_id, auth.uid())
  );

-- ============================================================================
-- VERIFICACIÓN: Probar que funciona
-- ============================================================================
-- Esto debería devolver true si eres dueño de la lista:
-- SELECT is_list_owner('tu-list-id-uuid', auth.uid());
-- ============================================================================
