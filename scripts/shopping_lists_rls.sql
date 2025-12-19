-- Enable RLS on shopping lists tables
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for shopping_lists
CREATE POLICY "Users can view their own lists" ON public.shopping_lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lists" ON public.shopping_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists" ON public.shopping_lists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists" ON public.shopping_lists
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for shopping_list_items
CREATE POLICY "Users can view items in their lists" ON public.shopping_list_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create items in their lists" ON public.shopping_list_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update items in their lists" ON public.shopping_list_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete items in their lists" ON public.shopping_list_items
  FOR DELETE USING (auth.uid() = user_id);
