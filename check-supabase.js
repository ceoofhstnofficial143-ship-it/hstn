// Direct browser test - paste this into console on http://localhost:3000
console.log('Testing if we can access supabase...');

// Check if supabase is in window
if (window.supabase) {
    console.log('✅ Found supabase in window');
    window.testSupabase();
} else {
    console.log('❌ Supabase not in window, checking if it is imported...');

    // Try to find it in the page context
    let foundSupabase = false;
    for (let key in window) {
        if (key.includes('supabase') || window[key]?.rpc) {
            console.log('Found possible supabase:', key);
            foundSupabase = true;
        }
    }

    if (!foundSupabase) {
        console.log('❌ No supabase found. Make sure you are on http://localhost:3000 and the page has loaded');
    }
}
