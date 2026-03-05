// Check profiles table structure
console.log('🔍 Checking profiles table columns...');

supabase
  .from('profiles')
  .select('*')
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.log('❌ Error querying profiles:', error);
    } else if (data && data.length > 0) {
      console.log('✅ Profiles table columns:', Object.keys(data[0]));
      console.log('Sample row:', data[0]);
    } else {
      console.log('❌ No data in profiles table');
    }
  });
