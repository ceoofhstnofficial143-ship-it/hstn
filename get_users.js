const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

let supabaseUrl = ''
let supabaseKey = ''

try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8')
    envFile.split('\n').forEach(line => {
        const parts = line.split('=')
        if (parts.length >= 2) {
            const key = parts[0].trim()
            const value = parts.slice(1).join('=').trim()
            if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value
            if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') supabaseKey = value
        }
    })
} catch (e) {
    console.error('Error reading .env.local:', e)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProfiles() {
    const { data, error } = await supabase.from('profiles').select('id, username, role')
    if (error) {
        console.error('Error:', error)
    } else {
        console.log('Total Profiles:', data.length)
        data.forEach(p => console.log(p))
    }
}

checkProfiles()
