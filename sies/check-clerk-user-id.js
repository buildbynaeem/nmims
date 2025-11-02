// Check Clerk user ID format
console.log('Clerk user ID format examples:');
console.log('- Clerk user IDs typically start with "user_" prefix');
console.log('- Example: user_2abc123def456ghi789jkl');
console.log('- They are NOT standard UUIDs');
console.log('');
console.log('Standard UUID format:');
console.log('- Example: 550e8400-e29b-41d4-a716-446655440000');
console.log('- Pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
console.log('');
console.log('The issue: Database expects UUID but receives Clerk user ID format');
