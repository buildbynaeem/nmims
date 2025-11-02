import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read environment variables from .env file
let supabaseUrl, supabaseAnonKey;
try {
  const envContent = readFileSync('.env', 'utf8');
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = line.split('=')[1].trim();
    }
  }
} catch (error) {
  console.error('Error reading .env file:', error.message);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPrescriptionHistory() {
  try {
    console.log('Testing prescription history query...');
    console.log('Supabase URL:', supabaseUrl);
    
    // Test basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('prescriptions')
      .select('count', { count: 'exact', head: true });
    
    if (connectionError) {
      console.error('Connection test failed:', connectionError);
      return;
    }
    
    console.log('Connection successful. Total prescriptions:', connectionTest);
    
    // Test the actual query with a sample user ID
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('user_id', 'test-user-id')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Query error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('Query successful. Results:', data);
      console.log('Number of prescriptions found:', data?.length || 0);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testPrescriptionHistory();