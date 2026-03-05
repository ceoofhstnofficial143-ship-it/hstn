// Test the trust update path for purchase requests
console.log('🧪 Testing trust update path...');

// First create a test purchase request
supabase.auth.getUser().then(({ data: userData }) => {
    if (!userData.user) {
        console.log('❌ No user logged in');
        return;
    }

    const buyerId = userData.user.id;
    console.log('✅ Testing with buyer ID:', buyerId);

    // 1. Create a test request (if none exist)
    supabase.rpc('create_purchase_request', {
        p_product_id: '00000000-0000-0000-0000-000000000001', // Dummy product ID
        p_buyer_id: buyerId,
        p_buyer_message: 'Test for trust update verification'
    }).then(({ data: requestId, error: createError }) => {
        if (createError) {
            console.log('❌ Create request failed:', createError.message);
            // If request already exists, continue to test confirmation
            testTrustUpdate(buyerId);
        } else {
            console.log('✅ Test request created:', requestId);
            // Now test the trust update path
            testTrustUpdate(buyerId);
        }
    });
});

function testTrustUpdate(buyerId) {
    // Get a test request marked as completed
    supabase.rpc('get_buyer_purchase_requests', {
        p_buyer_id: buyerId,
        p_limit: 1,
        p_offset: 0
    }).then(({ data: requests, error }) => {
        if (error) {
            console.log('❌ Get requests failed:', error.message);
            return;
        }

        if (!requests || requests.length === 0) {
            console.log('❌ No requests found for trust testing');
            return;
        }

        const testRequest = requests[0];
        console.log('📋 Testing trust update on request:', testRequest.id);

        // Check initial trust score
        supabase
            .from('trust_scores')
            .select('score')
            .eq('user_id', testRequest.seller_id)
            .single()
            .then(({ data: initialTrust, error: trustError }) => {
                if (trustError) {
                    console.log('❌ Initial trust fetch failed:', trustError.message);
                    return;
                }

                const initialScore = initialTrust?.score || 0;
                console.log('📊 Initial trust score:', initialScore);

                // Test the trust update RPC
                console.log('🚀 Calling confirm_request_completion_with_trust...');
                supabase.rpc('confirm_request_completion_with_trust', {
                    p_request_id: testRequest.id,
                    p_buyer_id: buyerId
                }).then(({ data, error: confirmError }) => {
                    if (confirmError) {
                        console.log('❌ Trust update failed:', confirmError.message);
                    } else {
                        console.log('✅ Trust update RPC succeeded');

                        // Check trust score after update
                        setTimeout(() => {
                            supabase
                                .from('trust_scores')
                                .select('score')
                                .eq('user_id', testRequest.seller_id)
                                .single()
                                .then(({ data: finalTrust, error: finalTrustError }) => {
                                    if (finalTrustError) {
                                        console.log('❌ Final trust fetch failed:', finalTrustError.message);
                                    } else {
                                        const finalScore = finalTrust?.score || 0;
                                        console.log('📈 Final trust score:', finalScore);

                                        if (finalScore > initialScore) {
                                            console.log('🎉 TRUST UPDATE WORKS! Score increased from', initialScore, 'to', finalScore);
                                        } else {
                                            console.log('⚠️ TRUST UPDATE MAYBE BROKEN - Score did not increase');
                                        }
                                    }
                                });
                        }, 1000); // Wait 1 second for trigger to fire
                    }
                });
            });
    });
}
