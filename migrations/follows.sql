CREATE TABLE follows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp WITH TIME ZONE DEFAULT now(),
  UNIQUE(follower_id, seller_id)
);

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see who they follow and who follows them
CREATE POLICY "Allow users to see their own follows"
  ON follows FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = seller_id);

-- Policy: Users can follow others
CREATE POLICY "Allow users to follow others"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Policy: Users can unfollow others
CREATE POLICY "Allow users to unfollow others"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);
