import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSecureAPIMiddleware } from '@/lib/api-security';

const addressSchema = {
  full_name: { type: 'string', required: true, minLength: 2 },
  phone_number: { type: 'string', required: true, minLength: 10 },
  address_line1: { type: 'string', required: true, minLength: 2 },
  address_line2: { type: 'string', required: false },
  landmark: { type: 'string', required: false },
  city: { type: 'string', required: true },
  state: { type: 'string', required: true },
  pincode: { type: 'string', required: true, minLength: 6 },
  country: { type: 'string', required: false },
  label: { type: 'string', required: false },
  is_default: { type: 'boolean', required: false },
};

// GET: Fetch all addresses for the authenticated user
async function getAddressesHandler(req: NextRequest, { user }: any) {
  const { data, error } = await (supabaseAdmin as any)
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

// POST: Create a new address
async function createAddressHandler(req: NextRequest, { user, validatedData }: any) {
  // If this is the first address, make it default automatically
  const { count } = await (supabaseAdmin as any)
    .from('addresses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const isFirstAddress = count === 0;

  const { data, error } = await (supabaseAdmin as any)
    .from('addresses')
    .insert([{ 
      ...validatedData, 
      user_id: user.id,
      is_default: isFirstAddress || validatedData.is_default || false 
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If this new address is set to default, unset others (transactional logic in service/DB preferred but here for simplicity)
  if (data.is_default) {
    await (supabaseAdmin as any)
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .neq('id', data.id);
  }

  return NextResponse.json(data);
}

export const GET = createSecureAPIMiddleware({ requireAuth: true })(getAddressesHandler as any);
export const POST = createSecureAPIMiddleware({ 
  requireAuth: true, 
  validateInput: addressSchema 
})(createAddressHandler as any);
