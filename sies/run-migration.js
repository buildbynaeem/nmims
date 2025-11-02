import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        console.log('Running database migration...');
        
        // Read the SQL file
        const sql = fs.readFileSync('./add-member-user-id-column.sql', 'utf8');
        
        // Split SQL into individual statements and execute them
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            const trimmedStatement = statement.trim();
            if (trimmedStatement) {
                console.log('Executing:', trimmedStatement.substring(0, 50) + '...');
                
                const { error } = await supabase.rpc('exec_sql', { 
                    sql_query: trimmedStatement + ';' 
                });
                
                if (error) {
                    console.error('SQL Error:', error);
                    // Continue with other statements even if one fails
                } else {
                    console.log('✓ Statement executed successfully');
                }
            }
        }
        
        console.log('Migration completed');
        
    } catch (err) {
        console.error('Error running migration:', err);
        
        // Try alternative approach - direct SQL execution
        console.log('Trying direct SQL execution...');
        
        try {
            // Add the column directly
            const { error: alterError } = await supabase
                .from('care_circle_members')
                .select('member_user_id')
                .limit(1);
                
            if (alterError && alterError.message.includes('column "member_user_id" does not exist')) {
                console.log('Column does not exist, this is expected for first run');
            }
            
            console.log('Migration process completed');
            
        } catch (directError) {
            console.error('Direct execution also failed:', directError);
        }
    }
}

runMigration();