CREATE TABLE outfit_bundles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  product_ids uuid[] NOT NULL,
  price numeric,
  discount_percentage numeric DEFAULT 10,
  created_at timestamp WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE outfit_bundles ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access on outfit_bundles"
  ON outfit_bundles FOR SELECT
  TO public
  USING (true);
