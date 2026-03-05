// Test if RPC functions exist
const testRpcFunctions = async () => {
    console.log('=== Testing RPC Functions ===');

    // Test get_seller_purchase_requests
    try {
        const { data: sellerData, error: sellerError } = await supabase.rpc("get_seller_purchase_requests", {
            p_seller_id: 'test-id',
            p_status: null,
            p_limit: 1,
            p_offset: 0
        });
        console.log('get_seller_purchase_requests:', sellerError ? 'ERROR' : 'OK', sellerError);
    } catch (e) {
        console.log('get_seller_purchase_requests: EXCEPTION', e);
    }

    // Test get_buyer_purchase_requests
    try {
        const { data: buyerData, error: buyerError } = await supabase.rpc("get_buyer_purchase_requests", {
            p_buyer_id: 'test-id'
        });
        console.log('get_buyer_purchase_requests:', buyerError ? 'ERROR' : 'OK', buyerError);
    } catch (e) {
        console.log('get_buyer_purchase_requests: EXCEPTION', e);
    }

    console.log('=== Test Complete ===');
};

testRpcFunctions();
