-- =====================================================
-- GROKA - Database Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- Tickets uploaded by users
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Metadata
  file_name TEXT NOT NULL,
  file_url TEXT, -- URL in Supabase Storage
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Parsed data
  ticket_number TEXT,
  store_name TEXT,
  purchase_date DATE,
  total_amount DECIMAL(10, 2),
  
  -- Status
  parsed BOOLEAN DEFAULT FALSE,
  parsing_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products catalog (unique products across all users)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items in a ticket (individual products purchased)
CREATE TABLE ticket_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Product info
  name TEXT NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2),
  total_price DECIMAL(10, 2) NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shopping lists
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL DEFAULT 'Mi lista',
  description TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items in shopping lists
CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Product info
  name TEXT NOT NULL,
  quantity DECIMAL(10, 3) DEFAULT 1,
  notes TEXT,
  
  -- Status
  checked BOOLEAN DEFAULT FALSE,
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Share shopping lists with other users
CREATE TABLE list_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Permissions
  can_edit BOOLEAN DEFAULT TRUE,
  can_share BOOLEAN DEFAULT FALSE,
  
  -- Status
  accepted BOOLEAN DEFAULT FALSE,
  accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(list_id, user_id)
);

-- User profiles (optional extended info)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  display_name TEXT,
  avatar_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES for better performance
-- =====================================================

CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_purchase_date ON tickets(purchase_date);
CREATE INDEX idx_ticket_items_ticket_id ON ticket_items(ticket_id);
CREATE INDEX idx_ticket_items_product_id ON ticket_items(product_id);
CREATE INDEX idx_shopping_lists_owner_id ON shopping_lists(owner_id);
CREATE INDEX idx_shopping_list_items_list_id ON shopping_list_items(list_id);
CREATE INDEX idx_list_shares_user_id ON list_shares(user_id);
CREATE INDEX idx_list_shares_list_id ON list_shares(list_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Tickets: Users can only see their own tickets
CREATE POLICY "Users can view their own tickets" ON tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tickets" ON tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tickets" ON tickets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tickets" ON tickets
  FOR DELETE USING (auth.uid() = user_id);

-- Products: Everyone can read, anyone can create (catalog is shared)
CREATE POLICY "Anyone can view products" ON products
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert products" ON products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Ticket Items: Users can see items from their own tickets
CREATE POLICY "Users can view their ticket items" ON ticket_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_items.ticket_id
      AND tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ticket items" ON ticket_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_items.ticket_id
      AND tickets.user_id = auth.uid()
    )
  );

-- Shopping Lists: Users can see lists they own or that are shared with them
CREATE POLICY "Users can view their own lists" ON shopping_lists
  FOR SELECT USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM list_shares
      WHERE list_shares.list_id = shopping_lists.id
      AND list_shares.user_id = auth.uid()
      AND list_shares.accepted = true
    )
  );

CREATE POLICY "Users can insert their own lists" ON shopping_lists
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own lists or shared lists with edit permission" ON shopping_lists
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM list_shares
      WHERE list_shares.list_id = shopping_lists.id
      AND list_shares.user_id = auth.uid()
      AND list_shares.can_edit = true
      AND list_shares.accepted = true
    )
  );

CREATE POLICY "Users can delete their own lists" ON shopping_lists
  FOR DELETE USING (owner_id = auth.uid());

-- Shopping List Items: Users can see items from lists they have access to
CREATE POLICY "Users can view shopping list items" ON shopping_list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.list_id
      AND (
        shopping_lists.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM list_shares
          WHERE list_shares.list_id = shopping_lists.id
          AND list_shares.user_id = auth.uid()
          AND list_shares.accepted = true
        )
      )
    )
  );

CREATE POLICY "Users can insert items in accessible lists" ON shopping_list_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.list_id
      AND (
        shopping_lists.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM list_shares
          WHERE list_shares.list_id = shopping_lists.id
          AND list_shares.user_id = auth.uid()
          AND list_shares.can_edit = true
          AND list_shares.accepted = true
        )
      )
    )
  );

CREATE POLICY "Users can update items in accessible lists" ON shopping_list_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.list_id
      AND (
        shopping_lists.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM list_shares
          WHERE list_shares.list_id = shopping_lists.id
          AND list_shares.user_id = auth.uid()
          AND list_shares.can_edit = true
          AND list_shares.accepted = true
        )
      )
    )
  );

CREATE POLICY "Users can delete items in accessible lists" ON shopping_list_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.list_id
      AND (
        shopping_lists.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM list_shares
          WHERE list_shares.list_id = shopping_lists.id
          AND list_shares.user_id = auth.uid()
          AND list_shares.can_edit = true
          AND list_shares.accepted = true
        )
      )
    )
  );

-- List Shares: Users can see shares for their lists or shares directed to them
CREATE POLICY "Users can view list shares" ON list_shares
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = list_shares.list_id
      AND shopping_lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "List owners can create shares" ON list_shares
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = list_shares.list_id
      AND shopping_lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "List owners can update shares" ON list_shares
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = list_shares.list_id
      AND shopping_lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "List owners can delete shares" ON list_shares
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = list_shares.list_id
      AND shopping_lists.owner_id = auth.uid()
    )
  );

-- Profiles: Users can view all profiles but only update their own
CREATE POLICY "Anyone can view profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_lists_updated_at BEFORE UPDATE ON shopping_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_list_items_updated_at BEFORE UPDATE ON shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

-- Create storage bucket for ticket PDFs
-- Run this in Supabase Dashboard > Storage:
-- Bucket name: tickets
-- Public: false
-- File size limit: 10MB
-- Allowed MIME types: application/pdf
