// Test after restart - check if supabase is now available
console.log('🔄 Testing after restart...');

// Check if supabase client is available
if (typeof supabase !== 'undefined') {
    console.log('✅ Supabase client found after restart!');

    // Test basic connection
    supabase.from('products').select('count', { count: 'exact', head: true })
        .then(({ count, error }) => {
            if (error) {
                console.log('❌ Connection test failed:', error.message);
            } else {
                console.log('✅ Database connection working! Found', count, 'products');
            }
        });

    // Now test the RPC function
    console.log('🚀 Testing RPC function...');
    supabase.rpc("get_seller_purchase_requests", {
        p_seller_id: "test-id",
        p_status: null,
        p_limit: 5,
        p_offset: 0
    }).then(({ data, error }) => {
        if (error) {
            console.log('❌ RPC Error:', error);
            console.log('Error details:', {
                code: error.code,
                message: error.message,
                details: error.details
            });
        } else {
            console.log('✅ RPC Success! Data:', data);
        }
    }).catch(e => {
        console.log('❌ RPC Exception:', e);
    });

} else {
    console.log('❌ Supabase client still not found. Check .env.local file.');
    console.log('Make sure you have:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL=your_project_url');
    console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key');
}
