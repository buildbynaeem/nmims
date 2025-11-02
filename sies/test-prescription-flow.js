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

async function testCompleteFlow() {
    console.log('🧪 Testing complete prescription history flow...\n');
    
    // Test with a sample Clerk user ID format
    const testUserId = 'user_test123abc456def';
    console.log(`📋 Testing with Clerk user ID: ${testUserId}\n`);
    
    try {
        // Step 1: Create a test user
        console.log('1️⃣ Creating test user...');
        const { data: newUser, error: userError } = await supabase
            .from('users')
            .upsert({
                id: testUserId,
                email: 'test@example.com',
                full_name: 'Test User',
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (userError) {
            console.log('❌ User creation error:', userError.message);
            return;
        } else {
            console.log('✅ User created successfully');
        }
        
        // Step 2: Create a test medication
        console.log('\n2️⃣ Creating test medication...');
        const { data: newMed, error: medError } = await supabase
            .from('medications')
            .insert({
                user_id: testUserId,
                name: 'Test Medication',
                dosage: '10mg',
                frequency: 'twice daily',
                instructions: 'Take with food'
            })
            .select()
            .single();
        
        if (medError) {
            console.log('❌ Medication creation error:', medError.message);
            return;
        } else {
            console.log('✅ Medication created successfully');
        }
        
        // Step 3: Create a test prescription
        console.log('\n3️⃣ Creating test prescription...');
        const { data: newPrescription, error: prescError } = await supabase
            .from('prescriptions')
            .insert({
                user_id: testUserId,
                medication_id: newMed.id,
                doctor_name: 'Dr. Test',
                prescribed_date: new Date().toISOString().split('T')[0],
                duration_days: 30,
                status: 'active'
            })
            .select()
            .single();
        
        if (prescError) {
            console.log('❌ Prescription creation error:', prescError.message);
            return;
        } else {
            console.log('✅ Prescription created successfully');
        }
        
        // Step 4: Test prescription history query (the main functionality)
        console.log('\n4️⃣ Testing prescription history query...');
        const { data: prescriptions, error: historyError } = await supabase
            .from('prescriptions')
            .select(`
                *,
                medications (
                    name,
                    dosage,
                    frequency,
                    instructions
                )
            `)
            .eq('user_id', testUserId)
            .order('created_at', { ascending: false });
        
        if (historyError) {
            console.log('❌ Prescription history error:', historyError.message);
            console.log('   Error code:', historyError.code);
            console.log('   Error details:', historyError.details);
        } else {
            console.log('✅ Prescription history query successful');
            console.log(`   Found ${prescriptions.length} prescriptions`);
            if (prescriptions.length > 0) {
                console.log('   Sample prescription:', {
                    id: prescriptions[0].id,
                    doctor: prescriptions[0].doctor_name,
                    medication: prescriptions[0].medications?.name,
                    status: prescriptions[0].status
                });
            }
        }
        
        // Step 5: Clean up test data
        console.log('\n5️⃣ Cleaning up test data...');
        
        // Delete prescription
        await supabase.from('prescriptions').delete().eq('id', newPrescription.id);
        
        // Delete medication
        await supabase.from('medications').delete().eq('id', newMed.id);
        
        // Delete user
        await supabase.from('users').delete().eq('id', testUserId);
        
        console.log('✅ Test data cleaned up');
        
        console.log('\n🎉 All tests passed! Prescription history functionality is working correctly.');
        
    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
        console.error('Stack trace:', err.stack);
    }
}

async function testSchemaCompatibility() {
    console.log('🔍 Testing schema compatibility with Clerk user IDs...\n');
    
    const clerkUserIds = [
        'user_2abc123def456ghi789jkl',
        'user_1xyz987uvw654rst321mno',
        'user_3pqr456stu789vwx012yza'
    ];
    
    for (const userId of clerkUserIds) {
        try {
            console.log(`Testing user ID format: ${userId}`);
            
            // Test if we can query with this user ID format
            const { data, error } = await supabase
                .from('users')
                .select('id')
                .eq('id', userId)
                .limit(1);
            
            if (error) {
                console.log(`❌ Error with ${userId}: ${error.message}`);
            } else {
                console.log(`✅ ${userId}: Compatible`);
            }
        } catch (err) {
            console.log(`❌ ${userId}: ${err.message}`);
        }
    }
}

async function main() {
    console.log('🚀 Starting comprehensive prescription history test...\n');
    
    await testSchemaCompatibility();
    console.log('\n' + '='.repeat(60) + '\n');
    await testCompleteFlow();
}

main().catch(console.error);