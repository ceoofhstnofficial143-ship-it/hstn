// Comprehensive RPC debugging
const debugRpcCalls = async () => {
    console.log('=== RPC Function Debugging ===');

    // Step 1: Check authentication
    const { data: authData } = await supabase.auth.getUser();
    console.log('🔐 Auth status:', authData.user ? 'Logged in as ' + authData.user.id : 'Not logged in');

    if (!authData.user) {
        console.log('❌ Cannot test RPC without authentication');
        return;
    }

    const userId = authData.user.id;

    // Step 2: Test basic RPC function existence
    console.log('🔍 Testing RPC function availability...');

    // Test 2a: Check if function exists via raw SQL
    try {
        const { data: funcData, error: funcError } = await supabase.rpc('pg_get_function_identity_arguments', {
            oid: 'get_seller_purchase_requests'
        });
        console.log('📋 Function exists check:', funcError ? '❌ Error' : '✅ Function found', funcError);
    } catch (e) {
        console.log('📋 Function exists check exception:', e.message);
    }

    // Step 3: Test RPC call with different parameters
    console.log('🚀 Testing RPC call variations...');

    // Test 3a: Basic call
    try {
        console.log('Calling: get_seller_purchase_requests with minimal params');
        const { data: data1, error: error1 } = await supabase.rpc("get_seller_purchase_requests", {
            p_seller_id: userId
        });
        console.log('Result:', error1 ? '❌ Error: ' + JSON.stringify(error1) : '✅ Success: ' + (data1?.length || 0) + ' records');
    } catch (e) {
        console.log('Exception:', e.message);
    }

    // Test 3b: With null status
    try {
        console.log('Calling: get_seller_purchase_requests with null status');
        const { data: data2, error: error2 } = await supabase.rpc("get_seller_purchase_requests", {
            p_seller_id: userId,
            p_status: null
        });
        console.log('Result:', error2 ? '❌ Error: ' + JSON.stringify(error2) : '✅ Success: ' + (data2?.length || 0) + ' records');
    } catch (e) {
        console.log('Exception:', e.message);
    }

    // Test 3c: With all parameters
    try {
        console.log('Calling: get_seller_purchase_requests with all params');
        const { data: data3, error: error3 } = await supabase.rpc("get_seller_purchase_requests", {
            p_seller_id: userId,
            p_status: null,
            p_limit: 10,
            p_offset: 0
        });
        console.log('Result:', error3 ? '❌ Error: ' + JSON.stringify(error3) : '✅ Success: ' + (data3?.length || 0) + ' records');
    } catch (e) {
        console.log('Exception:', e.message);
    }

    // Step 4: Check table existence
    console.log('📊 Testing table access...');
    try {
        const { data: tableData, error: tableError } = await supabase
            .from('purchase_requests')
            .select('count', { count: 'exact' })
            .limit(1);

        console.log('Table access:', tableError ? '❌ Error: ' + JSON.stringify(tableError) : '✅ Success: ' + (tableData?.length || 0) + ' records');
    } catch (e) {
        console.log('Table access exception:', e.message);
    }

    // Step 5: Check for any purchase_requests data
    console.log('📈 Checking for existing data...');
    try {
        const { data: existingData, error: existingError } = await supabase
            .from('purchase_requests')
            .select('*')
            .limit(5);

        console.log('Existing data:', existingError ? '❌ Error: ' + JSON.stringify(existingError) : '✅ Found: ' + (existingData?.length || 0) + ' records');
        if (existingData && existingData.length > 0) {
            console.log('Sample record:', existingData[0]);
        }
    } catch (e) {
        console.log('Existing data exception:', e.message);
    }

    console.log('=== Debug Complete ===');
};

// Auto-run the debug
debugRpcCalls();
