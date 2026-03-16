require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testFetchProducts() {
    console.log('Testing fetchProducts query...');
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, title, price, image_url, category, user_id, stock, views, admin_status, created_at,
        profiles!products_user_id_fkey(username)
      `)
      .eq('admin_status', 'approved')
      .order('created_at', { ascending: false })
      .range(0, 11);

    if (error) console.error('fetchProducts Error:', error.message);
    else console.log('fetchProducts Success, rows:', data?.length);
}

async function testLoadFeatured() {
    console.log('Testing loadFeatured query...');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    let queryBuilder = supabase
      .from('products')
      .select(`
        id, title, price, image_url, category, user_id, views,
        profiles!products_user_id_fkey(username)
      `)
      .eq('admin_status', 'approved')
      .gte('created_at', twentyFourHoursAgo)
      .limit(6);

    const { data, error } = await queryBuilder;
    if (error) console.error('loadFeatured Error:', error.message);
    else console.log('loadFeatured Success, rows:', data?.length);
}

async function testSearchProducts() {
    console.log('Testing searchProducts query...');
    const trimmedQuery = 'test';
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, title, price, image_url, category, user_id, stock, views, admin_status, created_at, video_url,
        profiles!products_user_id_fkey(username)
      `)
      .eq('admin_status', 'approved')
      .or(`title.ilike.%${trimmedQuery}%,category.ilike.%${trimmedQuery}%,description.ilike.%${trimmedQuery}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) console.error('searchProducts Error:', error.message);
    else console.log('searchProducts Success, rows:', data?.length);
}

async function runAll() {
    await testFetchProducts();
    await testLoadFeatured();
    await testSearchProducts();
}

runAll();
