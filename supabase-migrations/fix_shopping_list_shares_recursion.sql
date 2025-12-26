-- ============================================================================
-- FIX: Resolver recursión infinita en políticas RLS de listas compartidas
-- ============================================================================
-- Problema: Las políticas de shopping_lists y shopping_list_shares se 
-- referencian mutuamente, causando error 42P17 (infinite recursion)
--
-- Solución: Usar función SECURITY DEFINER para romper el ciclo
-- ============================================================================

-- PASO 1: Eliminar políticas problemáticas de shopping_list_shares
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view shares where they are involved" ON public.shopping_list_shares;
DROP POLICY IF EXISTS "List owners can create shares" ON public.shopping_list_shares;
DROP POLICY IF EXISTS "List owners can delete shares" ON public.shopping_list_shares;
DROP POLICY IF EXISTS "List owners can update shares" ON public.shopping_list_shares;

-- PASO 2: Crear función helper con SECURITY DEFINER
-- ----------------------------------------------------------------
-- Esta función rompe el ciclo de recursión al ejecutarse con privilegios 
-- elevados, evitando que active las políticas RLS de shopping_lists
CREATE OR REPLACE FUNCTION is_list_owner(p_list_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.shopping_lists 
    WHERE id = p_list_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 3: Recrear políticas de shopping_list_shares SIN subconsultas directas
-- ----------------------------------------------------------------
-- Ahora usamos la función is_list_owner() en lugar de subconsultas
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
-- Las políticas de shopping_lists y shopping_list_items ya están correctas
-- y funcionarán sin recursión gracias a la función SECURITY DEFINER
-- ============================================================================
