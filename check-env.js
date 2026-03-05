// Check if environment variables are available
console.log('🔍 Checking environment variables...');

// Check Next.js public env vars (these should be available in browser)
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : '❌ Missing');

// Check if supabase client can be created
try {
    const testClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    console.log('✅ Supabase client creation: Success');
} catch (e) {
    console.log('❌ Supabase client creation failed:', e.message);
}
