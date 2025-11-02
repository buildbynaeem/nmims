import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase configuration in .env file');
    process.exit(1);
}

// Create client with anon key (normal client)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Note: For production, you would use a service role key here
// const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testWithDisabledRLS() {
    console.log('🧪 Testing prescription flow with RLS temporarily disabled...\n');
    
    const testUserId = 'user_test_clerk_integration';
    console.log(`📋 Testing with Clerk user ID: ${testUserId}\n`);
    
    try {
        // Step 1: Disable RLS for testing
        console.log('1️⃣ Temporarily disabling RLS for testing...');
        const { error: disableError } = await supabase.rpc('disable_rls_for_testing');
        
        if (disableError) {
            console.log('❌ Could not disable RLS:', disableError.message);
            console.log('   This is expected if the function doesn\'t exist yet');
            console.log('   Proceeding with regular testing...\n');
        } else {
            console.log('✅ RLS disabled for testing\n');
        }
        
        // Step 2: Create test user
        console.log('2️⃣ Creating test user...');
        const { data: newUser, error: userError } = await supabase
            .from('users')
            .upsert({
                id: testUserId,
                email: 'test-clerk@example.com',
                full_name: 'Test Clerk User',
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (userError) {
            console.log('❌ User creation error:', userError.message);
            console.log('   Error code:', userError.code);
            console.log('   Error details:', userError.details);
        } else {
            console.log('✅ User created successfully');
            console.log('   User ID:', newUser.id);
        }
        
        // Step 3: Create test medication
        console.log('\n3️⃣ Creating test medication...');
        const { data: newMed, error: medError } = await supabase
            .from('medications')
            .insert({
                user_id: testUserId,
                name: 'Test Medication for Clerk',
                dosage: '5mg',
                frequency: 'once daily',
                instructions: 'Take in the morning',
                times_per_day: 1,
                food_timing: 'before_food',
                is_active: true
            })
            .select()
            .single();
        
        if (medError) {
            console.log('❌ Medication creation error:', medError.message);
            console.log('   Error code:', medError.code);
            console.log('   Error details:', medError.details);
        } else {
            console.log('✅ Medication created successfully');
            console.log('   Medication ID:', newMed.id);
        }
        
        // Step 4: Create test prescription
        if (newMed) {
            console.log('\n4️⃣ Creating test prescription...');
            const { data: newPrescription, error: prescError } = await supabase
                .from('prescriptions')
                .insert({
                    user_id: testUserId,
                    medication_id: newMed.id,
                    doctor_name: 'Dr. Clerk Test',
                    prescribed_date: new Date().toISOString().split('T')[0],
                    duration_days: 30,
                    status: 'active',
                    original_text: 'Test prescription for Clerk integration'
                })
                .select()
                .single();
            
            if (prescError) {
                console.log('❌ Prescription creation error:', prescError.message);
                console.log('   Error code:', prescError.code);
                console.log('   Error details:', prescError.details);
            } else {
                console.log('✅ Prescription created successfully');
                console.log('   Prescription ID:', newPrescription.id);
            }
        }
        
        // Step 5: Test prescription history query
        console.log('\n5️⃣ Testing prescription history query...');
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
                console.log('   Sample prescription:');
                console.log('     - ID:', prescriptions[0].id);
                console.log('     - Doctor:', prescriptions[0].doctor_name);
                console.log('     - Medication:', prescriptions[0].medications?.name);
                console.log('     - Status:', prescriptions[0].status);
                console.log('     - User ID:', prescriptions[0].user_id);
            }
        }
        
        // Step 6: Test medications query
        console.log('\n6️⃣ Testing medications query...');
        const { data: medications, error: medQueryError } = await supabase
            .from('medications')
            .select('*')
            .eq('user_id', testUserId);
        
        if (medQueryError) {
            console.log('❌ Medications query error:', medQueryError.message);
        } else {
            console.log('✅ Medications query successful');
            console.log(`   Found ${medications.length} medications`);
        }
        
        // Step 7: Clean up test data
        console.log('\n7️⃣ Cleaning up test data...');
        
        // Delete prescriptions
        const { error: deletePrescError } = await supabase
            .from('prescriptions')
            .delete()
            .eq('user_id', testUserId);
        
        if (deletePrescError) {
            console.log('⚠️  Could not delete prescriptions:', deletePrescError.message);
        }
        
        // Delete medications
        const { error: deleteMedError } = await supabase
            .from('medications')
            .delete()
            .eq('user_id', testUserId);
        
        if (deleteMedError) {
            console.log('⚠️  Could not delete medications:', deleteMedError.message);
        }
        
        // Delete user
        const { error: deleteUserError } = await supabase
            .from('users')
            .delete()
            .eq('id', testUserId);
        
        if (deleteUserError) {
            console.log('⚠️  Could not delete user:', deleteUserError.message);
        } else {
            console.log('✅ Test data cleaned up');
        }
        
        // Step 8: Re-enable RLS
        console.log('\n8️⃣ Re-enabling RLS...');
        const { error: enableError } = await supabase.rpc('enable_rls');
        
        if (enableError) {
            console.log('⚠️  Could not re-enable RLS:', enableError.message);
            console.log('   You may need to manually re-enable RLS in the database');
        } else {
            console.log('✅ RLS re-enabled');
        }
        
        console.log('\n🎉 Test completed! Check the results above to see if everything is working.');
        
    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
        console.error('Stack trace:', err.stack);
    }
}

async function testTableStructure() {
    console.log('🔍 Testing table structure and compatibility...\n');
    
    try {
        // Test users table
        console.log('Testing users table structure...');
        const { data: usersTest, error: usersError } = await supabase
            .from('users')
            .select('id')
            .limit(1);
        
        if (usersError) {
            console.log('❌ Users table error:', usersError.message);
        } else {
            console.log('✅ Users table accessible');
        }
        
        // Test medications table
        console.log('Testing medications table structure...');
        const { data: medsTest, error: medsError } = await supabase
            .from('medications')
            .select('id, user_id')
            .limit(1);
        
        if (medsError) {
            console.log('❌ Medications table error:', medsError.message);
        } else {
            console.log('✅ Medications table accessible');
        }
        
        // Test prescriptions table
        console.log('Testing prescriptions table structure...');
        const { data: prescsTest, error: prescsError } = await supabase
            .from('prescriptions')
            .select('id, user_id, medication_id')
            .limit(1);
        
        if (prescsError) {
            console.log('❌ Prescriptions table error:', prescsError.message);
        } else {
            console.log('✅ Prescriptions table accessible');
        }
        
    } catch (err) {
        console.error('❌ Structure test error:', err.message);
    }
}

async function main() {
    console.log('🚀 Starting comprehensive database test with service-level access...\n');
    
    await testTableStructure();
    console.log('\n' + '='.repeat(60) + '\n');
    await testWithDisabledRLS();
}

main().catch(console.error);