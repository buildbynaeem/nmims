import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPrescriptionHistory() {
    console.log('🧪 Testing prescription history functionality...\n');
    
    // Test with a sample Clerk user ID format
    const testUserId = 'user_2abc123def456ghi789jkl';
    console.log(`📋 Testing with Clerk user ID: ${testUserId}\n`);
    
    try {
        console.log('1️⃣ Testing prescriptions table query...');
        const { data: prescriptions, error: prescError } = await supabase
            .from('prescriptions')
            .select('*')
            .eq('user_id', testUserId)
            .order('created_at', { ascending: false });
        
        if (prescError) {
            console.log('❌ Prescriptions query error:', prescError.message);
            console.log('   Error code:', prescError.code);
            console.log('   Error details:', prescError.details);
        } else {
            console.log('✅ Prescriptions query successful');
            console.log(`   Found ${prescriptions.length} prescriptions`);
        }
        
        console.log('\n2️⃣ Testing users table query...');
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', testUserId)
            .single();
        
        if (userError) {
            console.log('❌ Users query error:', userError.message);
            console.log('   Error code:', userError.code);
            console.log('   Error details:', userError.details);
        } else {
            console.log('✅ Users query successful');
            console.log('   User found:', user ? 'Yes' : 'No');
        }
        
        console.log('\n3️⃣ Testing medications table query...');
        const { data: medications, error: medError } = await supabase
            .from('medications')
            .select('*')
            .eq('user_id', testUserId);
        
        if (medError) {
            console.log('❌ Medications query error:', medError.message);
            console.log('   Error code:', medError.code);
            console.log('   Error details:', medError.details);
        } else {
            console.log('✅ Medications query successful');
            console.log(`   Found ${medications.length} medications`);
        }
        
    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
    }
    
    console.log('\n🔍 Summary:');
    console.log('- If you see "relation does not exist" errors, the tables need to be created');
    console.log('- If you see "invalid input syntax for type uuid" errors, the schema needs updating');
    console.log('- If queries succeed but return no data, that\'s expected for a test user ID');
}

async function testTableExists() {
    console.log('🔍 Testing if tables exist...\n');
    
    const tables = ['users', 'prescriptions', 'medications'];
    
    for (const table of tables) {
        try {
            const { data, error } = await supabase
                .from(table)
                .select('count')
                .limit(1);
            
            if (error) {
                console.log(`❌ Table "${table}": ${error.message}`);
            } else {
                console.log(`✅ Table "${table}": exists and accessible`);
            }
        } catch (err) {
            console.log(`❌ Table "${table}": ${err.message}`);
        }
    }
}

async function main() {
    console.log('🚀 Starting simple database test...\n');
    
    await testTableExists();
    console.log('\n' + '='.repeat(50) + '\n');
    await testPrescriptionHistory();
}

main().catch(console.error);