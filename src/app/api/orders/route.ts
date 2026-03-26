import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createSecureAPIMiddleware } from '@/lib/api-security';

/**
 * PRODUCTION ORDER CREATION SYSTEM
 * Handles split payments, seller tracking, and address linking.
 */
async function createOrderHandler(req: NextRequest, { user, validatedData }: any) {
  const { address_id, items } = validatedData;

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Order must contain at least one item.' }, { status: 400 });
  }

  // 🕵️ GROUP ITEMS BY SELLER (Crucial for Marketplace Architecture)
  const sellers = [...new Set(items.map((i: any) => i.seller_id))];
  const createdOrders = [];

  try {
    for (const seller_id of sellers) {
      const sellerItems = items.filter((i: any) => i.seller_id === seller_id);
      const sellerTotal = sellerItems.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);

      // 1. Create Per-Seller Order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          buyer_id: user.id,
          seller_id: seller_id, // Link to specific seller
          address_id: address_id,
          total_price: sellerTotal,
          status: 'pending',
          payment_status: 'none'
        }])
        .select()
        .single();

      if (orderError) throw new Error(`Order split failed for seller ${seller_id}: ${orderError.message}`);

      // 2. Map items to this specific order
      const orderItemsData = sellerItems.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id,
        seller_id: seller_id,
        quantity: item.quantity,
        price: item.price,
        selected_size: item.size || 'N/A'
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) throw new Error(`Item linking failed for order ${order.id}: ${itemsError.message}`);

      createdOrders.push(order.id);
    }

    // 3. System Event Logging
    await supabase.from('system_events').insert({
      event_type: 'bulk_orders_created',
      source: 'order_api_v2',
      user_id: user.id,
      metadata: { orders_count: createdOrders.length, master_items: items.length }
    });

    // Return the list of created order IDs (Internal Order Bundle)
    return NextResponse.json({ success: true, order_ids: createdOrders });

  } catch (err: any) {
    console.error('Order Protocol Failure:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Validation schema for incoming order
const orderSchema = {
  address_id: { type: 'string', required: true },
  items: { 
    type: 'array', 
    required: true,
    validate: (val: any) => Array.isArray(val) && val.length > 0 && val.every(i => i.product_id && i.seller_id && i.price && i.quantity) 
  }
};

export const POST = createSecureAPIMiddleware({
  requireAuth: true,
  validateInput: orderSchema
})(createOrderHandler as any);
