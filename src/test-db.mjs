import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cfnfcjtywnxertswzlce.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmZjanR5d254ZXJ0c3d6bGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MjA1MjYsImV4cCI6MjA4NzE5NjUyNn0.90UusLutctNE3LGKFyZ5SKpA3GaSxt545p7T7hwgwlo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log("Fetching a product schema...");
    const { data, error } = await supabase.from('products').select('*').limit(1);
    console.log("Product:", data ? Object.keys(data[0] || {}) : data, error);

    const { data: catData } = await supabase.from('products').select('category').eq('admin_status', 'approved');
    console.log("Categories:", [...new Set(catData.map(p => p.category))]);

    const { data: prods } = await supabase.from('products').select('id, title, admin_status, category').limit(10);
    console.log("All products:", prods);

    const { data: oData, error: oError } = await supabase.from('orders').select('*').limit(1);
    console.log("Order:", oData ? (oData.length ? Object.keys(oData[0]) : oData) : null, oError);

    const { data: tsData, error: tsError } = await supabase.from('trust_scores').select('*').limit(1);
    console.log("Trust Scores:", tsData ? (tsData.length ? Object.keys(tsData[0]) : tsData) : null, tsError);
}
run();
