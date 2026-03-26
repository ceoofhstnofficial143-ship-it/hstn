import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSecureAPIMiddleware } from '@/lib/api-security';

const addressSchema = {
  full_name: { type: 'string', required: false },
  phone_number: { type: 'string', required: false },
  address_line1: { type: 'string', required: false },
  address_line2: { type: 'string', required: false },
  landmark: { type: 'string', required: false },
  city: { type: 'string', required: false },
  state: { type: 'string', required: false },
  pincode: { type: 'string', required: false },
  label: { type: 'string', required: false },
};

// PUT: Update an address
async function updateAddressHandler(req: NextRequest, { user, validatedData }: any, { params }: any) {
  const { id } = params;

  // First verify ownership
  const { data: existingAddress, error: checkError } = await supabaseAdmin
    .from('addresses')
    .select('user_id')
    .eq('id', id)
    .single();

  if (checkError || !existingAddress) {
    return NextResponse.json({ error: 'Address not found' }, { status: 404 });
  }

  if (existingAddress.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized: not owner' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('addresses')
    .update(validatedData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

// DELETE: Delete an address
async function deleteAddressHandler(req: NextRequest, { user }: any, { params }: any) {
  const { id } = params;

  // Verify ownership
  const { data: existingAddress, error: checkError } = await supabaseAdmin
    .from('addresses')
    .select('user_id, is_default')
    .eq('id', id)
    .single();

  if (checkError || !existingAddress) {
    return NextResponse.json({ error: 'Address not found' }, { status: 404 });
  }

  if (existingAddress.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized: not owner' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('addresses')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If deleted address was default, set the most recent address as default
  if (existingAddress.is_default) {
    const { data: latestAddress } = await supabaseAdmin
      .from('addresses')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestAddress) {
      await supabaseAdmin
        .from('addresses')
        .update({ is_default: true })
        .eq('id', latestAddress.id);
    }
  }

  return NextResponse.json({ success: true });
}

export const PUT = createSecureAPIMiddleware({ 
  requireAuth: true, 
  validateInput: addressSchema 
})(updateAddressHandler as any);

export const DELETE = createSecureAPIMiddleware({ 
  requireAuth: true 
})(deleteAddressHandler as any);
