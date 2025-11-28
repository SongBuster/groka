-- Fix RLS policies for shopping_lists to avoid infinite recursion
-- This removes the complex sharing policies temporarily and simplifies to owner-only access

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own lists" ON shopping_lists;
DROP POLICY IF EXISTS "Users can insert their own lists" ON shopping_lists;
DROP POLICY IF EXISTS "Users can update their own lists or shared lists with edit permission" ON shopping_lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON shopping_lists;

-- Create simple policies for owner-only access
CREATE POLICY "Users can view their own lists" ON shopping_lists
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own lists" ON shopping_lists
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own lists" ON shopping_lists
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own lists" ON shopping_lists
  FOR DELETE USING (owner_id = auth.uid());

-- Drop existing policies for shopping_list_items
DROP POLICY IF EXISTS "Users can view shopping list items" ON shopping_list_items;
DROP POLICY IF EXISTS "Users can insert shopping list items" ON shopping_list_items;
DROP POLICY IF EXISTS "Users can update shopping list items" ON shopping_list_items;
DROP POLICY IF EXISTS "Users can delete shopping list items" ON shopping_list_items;

-- Create simple policies for shopping_list_items (join with shopping_lists)
CREATE POLICY "Users can view their list items" ON shopping_list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.list_id
      AND shopping_lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their list items" ON shopping_list_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.list_id
      AND shopping_lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their list items" ON shopping_list_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.list_id
      AND shopping_lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their list items" ON shopping_list_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.list_id
      AND shopping_lists.owner_id = auth.uid()
    )
  );
