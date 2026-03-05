// Detailed RPC function test
const testRpcDetailed = async () => {
    console.log('=== Detailed RPC Function Test ===');

    // First check if user is logged in
    const { data: userData } = await supabase.auth.getUser();
    console.log('Current user:', userData.user ? userData.user.id : 'Not logged in');

    if (!userData.user) {
        console.log('❌ User not logged in - cannot test RPC functions');
        return;
    }

    // Test 1: Check if RPC function exists by calling it
    console.log('Testing get_seller_purchase_requests...');
    try {
        const { data: sellerData, error: sellerError } = await supabase.rpc("get_seller_purchase_requests", {
            p_seller_id: userData.user.id,
            p_status: null,
            p_limit: 10,
            p_offset: 0
        });

        if (sellerError) {
            console.log('❌ RPC Error:', sellerError);
            console.log('Error code:', sellerError.code);
            console.log('Error message:', sellerError.message);
            console.log('Error details:', sellerError.details);
        } else {
            console.log('✅ RPC Success! Data:', sellerData);
        }
    } catch (e) {
        console.log('❌ RPC Exception:', e);
    }

    // Test 2: Try direct table query to see if data exists
    console.log('Testing direct table query...');
    try {
        const { data: directData, error: directError } = await supabase
            .from('purchase_requests')
            .select('*')
            .limit(5);

        if (directError) {
            console.log('❌ Direct query error:', directError);
        } else {
            console.log('✅ Direct query success! Found', directData?.length || 0, 'requests');
        }
    } catch (e) {
        console.log('❌ Direct query exception:', e);
    }

    console.log('=== Test Complete ===');
};

// Run the test
testRpcDetailed();
