// Simple RPC test - run this on http://localhost:3000 while logged in
const testRpc = async () => {
    console.log('🔍 Testing RPC function...');

    // Check if supabase is available
    if (typeof window.supabase === 'undefined' && typeof supabase === 'undefined') {
        console.log('❌ Supabase not found. Make sure you are on the HSTN page at http://localhost:3000');
        return;
    }

    const client = window.supabase || supabase;

    // Test RPC call
    try {
        const { data, error } = await client.rpc("get_seller_purchase_requests", {
            p_seller_id: "test-id",
            p_status: null,
            p_limit: 5,
            p_offset: 0
        });

        if (error) {
            console.log('❌ RPC Error:', error);
            console.log('Error code:', error.code);
            console.log('Error message:', error.message);
        } else {
            console.log('✅ RPC Success! Data:', data);
        }
    } catch (e) {
        console.log('❌ Exception:', e);
    }

    // Test direct table access
    try {
        const { data: tableData, error: tableError } = await client
            .from('purchase_requests')
            .select('*')
            .limit(3);

        if (tableError) {
            console.log('❌ Table Error:', tableError);
        } else {
            console.log('✅ Table Success! Found', tableData?.length || 0, 'records');
        }
    } catch (e) {
        console.log('❌ Table Exception:', e);
    }
};

testRpc();
