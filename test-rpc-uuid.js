// Test RPC with real user UUID
console.log('🔍 Testing RPC with real UUID...');

// First get the current user
supabase.auth.getUser().then(({ data: userData }) => {
    if (!userData.user) {
        console.log('❌ No user logged in');
        return;
    }

    const userId = userData.user.id;
    console.log('✅ Using real user ID:', userId);

    // Test RPC with real UUID
    supabase.rpc("get_seller_purchase_requests", {
        p_seller_id: userId,
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
            console.log('Found', data?.length || 0, 'purchase requests');
        }
    }).catch(e => {
        console.log('❌ RPC Exception:', e);
    });
});
