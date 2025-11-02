import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
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

async function testDatabaseConnection() {
    console.log('🔍 Testing database connection...');
    
    try {
        // Test basic connection
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1);
            
        if (error) {
            console.log('❌ Database connection error:', error.message);
            
            // Check if it's a table doesn't exist error
            if (error.message.includes('relation "users" does not exist')) {
                console.log('📝 Users table does not exist. Need to create schema.');
                return 'create_schema';
            } else if (error.message.includes('relation "users" already exists')) {
                console.log('✅ Users table exists but may need updates.');
                return 'update_schema';
            }
            
            return 'connection_error';
        } else {
            console.log('✅ Database connection successful');
            console.log('📊 Users table exists and is accessible');
            return 'connected';
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
        return 'unexpected_error';
    }
}

async function checkTableStructure() {
    console.log('🔍 Checking table structure...');
    
    try {
        // Check users table structure using a direct query
        const { data, error } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_schema', 'public')
            .eq('table_name', 'users')
            .order('ordinal_position');
        
        if (error) {
            console.log('❌ Could not check table structure:', error.message);
            
            // Try alternative approach using raw SQL
            try {
                const { data: rawData, error: rawError } = await supabase.rpc('exec', {
                    sql: `
                        SELECT column_name, data_type 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'users' 
                        ORDER BY ordinal_position;
                    `
                });
                
                if (rawError) {
                    console.log('❌ Raw SQL also failed:', rawError.message);
                    return 'cannot_check';
                }
                
                console.log('📋 Users table structure (via raw SQL):');
                rawData.forEach(col => {
                    console.log(`  - ${col.column_name}: ${col.data_type}`);
                });
                
                const idColumn = rawData.find(col => col.column_name === 'id');
                if (idColumn) {
                    console.log(`🔑 ID column type: ${idColumn.data_type}`);
                    return idColumn.data_type === 'text' ? 'text_id' : 'uuid_id';
                }
                
                return 'no_id_column';
            } catch (rawErr) {
                console.log('❌ Alternative approach failed:', rawErr.message);
                return 'cannot_check';
            }
        }
        
        console.log('📋 Users table structure:');
        data.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });
        
        // Check if id column is UUID or TEXT
        const idColumn = data.find(col => col.column_name === 'id');
        if (idColumn) {
            console.log(`🔑 ID column type: ${idColumn.data_type}`);
            return idColumn.data_type === 'text' ? 'text_id' : 'uuid_id';
        }
        
        return 'no_id_column';
    } catch (err) {
        console.error('❌ Error checking table structure:', err.message);
        return 'error';
    }
}

async function main() {
    console.log('🚀 Starting database diagnosis...\n');
    
    const connectionStatus = await testDatabaseConnection();
    console.log(`\n📊 Connection Status: ${connectionStatus}\n`);
    
    if (connectionStatus === 'connected') {
        const tableStructure = await checkTableStructure();
        console.log(`\n🏗️  Table Structure: ${tableStructure}\n`);
        
        if (tableStructure === 'uuid_id') {
            console.log('⚠️  ISSUE IDENTIFIED:');
            console.log('   - Users table uses UUID for id column');
            console.log('   - Clerk provides non-UUID user IDs (format: user_xxxxxxx)');
            console.log('   - This causes the "Failed to load prescription history" error');
            console.log('\n💡 SOLUTION:');
            console.log('   - Run the database-schema-update.sql file');
            console.log('   - This will convert UUID columns to TEXT to support Clerk user IDs');
        } else if (tableStructure === 'text_id') {
            console.log('✅ GOOD NEWS:');
            console.log('   - Users table already uses TEXT for id column');
            console.log('   - This should support Clerk user IDs');
            console.log('   - The issue might be elsewhere in the code');
        }
    }
    
    console.log('\n🔧 Next Steps:');
    console.log('1. If tables need updating, run the schema update');
    console.log('2. Test the prescription history functionality');
    console.log('3. Check browser console for any remaining errors');
}

main().catch(console.error);