// Debug script to test upload without conflicts
// Run this in browser console on upload page

console.log('=== HSTN Upload Debug ===');

// Test 1: Check if there are any background processes
console.log('Active timers:', window.setTimeout.toString());
console.log('Active intervals:', window.setInterval.toString());

// Test 2: Monitor fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
    console.log('Fetch called:', args[0]);
    if (args[0].includes('/products') && args[1] === 'DELETE') {
        console.warn('DELETE request detected to products API');
    }
    return originalFetch.apply(this, args);
};

// Test 3: Check for any automatic cleanup
console.log('Checking for automatic cleanup processes...');

// Test 4: Monitor Supabase client
if (typeof supabase !== 'undefined') {
    console.log('Supabase client found');
    // Log any Supabase operations
    const originalSupabaseInsert = supabase.from('products').insert;
    supabase.from('products').insert = function(...args) {
        console.log('Supabase insert called:', args);
        return originalSupabaseInsert.apply(this, args);
    };
}

console.log('Debug script loaded. Monitor console for any automatic operations.');
