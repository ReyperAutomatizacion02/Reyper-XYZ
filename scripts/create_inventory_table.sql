-- Create inventory_items table
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category_prefix TEXT,
    category_name TEXT,
    stock_quantity INTEGER DEFAULT 0 NOT NULL,
    min_stock INTEGER DEFAULT 5 NOT NULL,
    location TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Note: You might need to adjust policies depending on your exact Project settings.
-- These are permissive for authenticated users to get started.

CREATE POLICY "Enable read access for all authenticated users" 
ON public.inventory_items FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable write access for authenticated users" 
ON public.inventory_items FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.inventory_items;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
