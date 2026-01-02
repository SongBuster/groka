-- Fix: Permitir que el dueño de la lista vea todos los items de su lista
-- Problema: Las políticas actuales solo permiten ver items que el usuario creó (user_id)
-- o items de listas compartidas CON el usuario. Pero el dueño de la lista no puede
-- ver items creados por otros usuarios en SU propia lista.

-- POLÍTICA DE VISUALIZACIÓN (SELECT)
DROP POLICY IF EXISTS "Users can view own and shared items" ON public.shopping_list_items;
CREATE POLICY "Users can view items in accessible lists"
  ON public.shopping_list_items
  FOR SELECT
  USING (
    -- El usuario creó el item
    auth.uid() = user_id 
    OR
    -- El usuario es dueño de la lista
    list_id IN (
      SELECT id FROM public.shopping_lists WHERE user_id = auth.uid()
    )
    OR
    -- La lista está compartida con el usuario
    list_id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid()
    )
  );

-- POLÍTICA DE INSERCIÓN (INSERT)
DROP POLICY IF EXISTS "Users can insert into own and shared lists" ON public.shopping_list_items;
CREATE POLICY "Users can insert into accessible lists"
  ON public.shopping_list_items
  FOR INSERT
  WITH CHECK (
    -- El usuario está insertando en su propia lista
    list_id IN (
      SELECT id FROM public.shopping_lists WHERE user_id = auth.uid()
    )
    OR
    -- La lista está compartida con el usuario CON permiso de edición
    list_id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid() AND permission = 'edit'
    )
  );

-- POLÍTICA DE ACTUALIZACIÓN (UPDATE)
DROP POLICY IF EXISTS "Users can update own and shared items" ON public.shopping_list_items;
CREATE POLICY "Users can update items in accessible lists"
  ON public.shopping_list_items
  FOR UPDATE
  USING (
    -- El usuario es dueño de la lista
    list_id IN (
      SELECT id FROM public.shopping_lists WHERE user_id = auth.uid()
    )
    OR
    -- La lista está compartida con el usuario CON permiso de edición
    list_id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid() AND permission = 'edit'
    )
  )
  WITH CHECK (
    -- El usuario es dueño de la lista
    list_id IN (
      SELECT id FROM public.shopping_lists WHERE user_id = auth.uid()
    )
    OR
    -- La lista está compartida con el usuario CON permiso de edición
    list_id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid() AND permission = 'edit'
    )
  );

-- POLÍTICA DE ELIMINACIÓN (DELETE)
DROP POLICY IF EXISTS "Users can delete own and shared items" ON public.shopping_list_items;
CREATE POLICY "Users can delete items in accessible lists"
  ON public.shopping_list_items
  FOR DELETE
  USING (
    -- El usuario es dueño de la lista
    list_id IN (
      SELECT id FROM public.shopping_lists WHERE user_id = auth.uid()
    )
    OR
    -- La lista está compartida con el usuario CON permiso de edición
    list_id IN (
      SELECT list_id FROM public.shopping_list_shares 
      WHERE shared_with_user_id = auth.uid() AND permission = 'edit'
    )
  );
