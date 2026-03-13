    -- HSTN Trust Update Fix
    -- Ensures trust only updates after buyer confirmation
    -- Run this in your Supabase SQL Editor

    -- ==============================================================================
    -- CRITICAL FIX: TRUST UPDATE CONDITION
    -- ==============================================================================

    -- Modified simple status update - NO TRUST IMPACT
    CREATE OR REPLACE FUNCTION update_simple_request_status_safe(
        p_request_id UUID,
        p_new_status VARCHAR(20),
        p_seller_notes TEXT DEFAULT NULL
    )
    RETURNS BOOLEAN AS $$
    DECLARE
        current_status VARCHAR(20);
        request_seller_id UUID;
        current_user_id UUID := auth.uid();
    BEGIN
        -- Get current status and verify seller
        SELECT status, seller_id INTO current_status, request_seller_id
        FROM purchase_requests 
        WHERE id = p_request_id;
        
        -- Verify permissions
        IF request_seller_id != current_user_id THEN
            RAISE EXCEPTION 'Unauthorized: Only seller can update request status';
        END IF;
        
        -- Update request WITHOUT trust impact
        UPDATE purchase_requests 
        SET status = p_new_status,
            seller_notes = p_seller_notes,
            updated_at = NOW(),
            contacted_at = CASE WHEN p_new_status = 'contacted' THEN NOW() ELSE contacted_at END,
            completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END
        WHERE id = p_request_id;
        
        -- NO TRUST SCORE UPDATE - REMOVED FOR SAFETY
        
        -- Log event
        INSERT INTO purchase_request_events (
            request_id, event_type, triggered_by
        ) VALUES (
            p_request_id, p_new_status, current_user_id
        );
        
        RETURN TRUE;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Buyer confirmation with trust impact
    CREATE OR REPLACE FUNCTION confirm_request_completion_with_trust(
        p_request_id UUID,
        p_buyer_id UUID
    )
    RETURNS BOOLEAN AS $$
    DECLARE
        request_buyer_id UUID;
        request_status VARCHAR(20);
        request_seller_id UUID;
    BEGIN
        -- Verify buyer owns this request
        SELECT buyer_id, status, seller_id INTO request_buyer_id, request_status, request_seller_id
        FROM purchase_requests 
        WHERE id = p_request_id;
        
        IF request_buyer_id != p_buyer_id THEN
            RAISE EXCEPTION 'Unauthorized: Only buyer can confirm completion';
        END IF;
        
        IF request_status != 'completed' THEN
            RAISE EXCEPTION 'Request must be marked completed by seller first';
        END IF;
        
        -- Update buyer confirmation
        UPDATE purchase_requests 
        SET buyer_confirmed_completion = TRUE
        WHERE id = p_request_id;
        
        -- Log confirmation
        INSERT INTO purchase_request_events (
            request_id, event_type, triggered_by
        ) VALUES (
            p_request_id, 'buyer_confirmed', p_buyer_id
        );
        
        -- ONLY NOW TRUST SCORE UPDATE
        PERFORM handle_order_trust_impact();
        
        RETURN TRUE;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- ==============================================================================
    -- STAGE ZERO CONTROLS
    -- ==============================================================================

    -- Disable trust impact until buyer confirmation UI exists
    CREATE OR REPLACE FUNCTION disable_trust_impact_temporarily()
    RETURNS void AS $$
    BEGIN
        -- Update marketplace stage controls
        UPDATE marketplace_stage_controls 
        SET enable_seller_grading = FALSE,
            updated_at = NOW()
        WHERE id = (SELECT id FROM marketplace_stage_controls ORDER BY created_at DESC LIMIT 1);
        
        RAISE NOTICE 'Trust impact temporarily disabled - buyer confirmation UI needed';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Grant permissions
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
