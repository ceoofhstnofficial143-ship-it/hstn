import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSecureAPIMiddleware } from '@/lib/api-security';

// PATCH: Set an address as default
async function setDefaultAddressHandler(req: NextRequest, { user }: any, { params }: any) {
  const { id } = params;

  // Verify ownership
  const { data: existingAddress, error: checkError } = await (supabaseAdmin as any)
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

  // 1. Unset all current default addresses for the user
  const { error: unsetError } = await (supabaseAdmin as any)
    .from('addresses')
    .update({ is_default: false })
    .eq('user_id', user.id);

  if (unsetError) {
    return NextResponse.json({ error: 'Failed to reset default addresses' }, { status: 400 });
  }

  // 2. Set the selected address as default
  const { data, error: setError } = await (supabaseAdmin as any)
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id)
    .select()
    .single();

  if (setError) {
    return NextResponse.json({ error: 'Failed to set as default' }, { status: 400 });
  }

  return NextResponse.json(data);
}

export const PATCH = createSecureAPIMiddleware({ 
  requireAuth: true 
})(setDefaultAddressHandler as any);
