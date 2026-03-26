const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDisputes() {
  const { data, error } = await supabase.from('order_disputes').select('*');
  console.log('Disputes:', data);
}

checkDisputes();
