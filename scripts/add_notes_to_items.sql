-- Add notes column to shopping_list_items
ALTER TABLE public.shopping_list_items
ADD COLUMN IF NOT EXISTS notes text;

-- Create index on notes for future search
CREATE INDEX IF NOT EXISTS shopping_list_items_notes_idx ON public.shopping_list_items(notes);
