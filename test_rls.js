const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRLS() {
  const { data, error } = await supabase.rpc('get_table_info_manual').catch(()=>({}));
  const res = await supabase.from('pg_class').select('relname, relrowsecurity').eq('relname', 'order_disputes').single().catch(e=>console.log(e));
  console.log('RLS Status:', res?.data);
}

checkRLS();
