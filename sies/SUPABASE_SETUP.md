# Supabase Database Setup Guide

This guide will walk you through setting up Supabase as the database backend for the MediGuide application.

## Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- Node.js and npm installed
- The MediGuide application code

## Step 1: Create a Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: MediGuide
   - **Database Password**: Choose a strong password
   - **Region**: Select the closest region to your users
5. Click "Create new project"
6. Wait for the project to be provisioned (usually takes 1-2 minutes)

## Step 2: Get Your Project Credentials

1. In your Supabase project dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-id.supabase.co`)
   - **Anon public key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

## Step 3: Configure Environment Variables

1. In your MediGuide project root, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

## Step 4: Set Up the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `database-schema.sql` from your project root
4. Paste it into the SQL editor
5. Click "Run" to execute the schema

This will create:
- All necessary tables (users, medications, adherence_logs, etc.)
- Indexes for optimal performance
- Row Level Security (RLS) policies
- Triggers for automatic timestamp updates
- Helper functions for common operations

## Step 5: Configure Authentication (Optional)

If you want to replace Clerk with Supabase Auth:

1. In Supabase dashboard, go to **Authentication** > **Settings**
2. Configure your authentication providers:
   - **Email**: Enable email/password authentication
   - **Social**: Add Google, GitHub, or other providers as needed
3. Set up email templates in **Authentication** > **Email Templates**
4. Configure redirect URLs in **Authentication** > **URL Configuration**

## Step 6: Test the Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. The application should now connect to Supabase. Check the browser console for any connection errors.

## Database Schema Overview

### Core Tables

#### `users`
- Extends Supabase auth.users
- Stores user profile information
- Links to all other user-specific data

#### `medications`
- Stores medication information
- Links to user via `user_id`
- Includes dosage, frequency, timing preferences

#### `medication_schedules`
- Defines when medications should be taken
- Links to medications and users
- Supports daily and weekly scheduling

#### `adherence_logs`
- Tracks medication intake history
- Records taken/missed/pending status
- Includes timestamps and notes

#### `care_circle_members`
- Manages family/caregiver access
- Role-based permissions system
- Invitation and status tracking

#### `prescriptions`
- Stores prescription processing data
- Links original text to processed information
- Tracks processing status

### Security Features

- **Row Level Security (RLS)**: Users can only access their own data
- **Care Circle Access**: Authorized members can view patient data
- **Secure Functions**: Database functions run with elevated privileges
- **Audit Trail**: All changes are timestamped

### Helper Functions

#### `calculate_adherence_rate(user_id, start_date, end_date)`
Calculates medication adherence percentage for a given period.

#### `get_upcoming_doses(user_id, limit)`
Returns upcoming scheduled medication doses.

## Integration with Existing Code

The Supabase client is configured in `/src/lib/supabase.ts` with:

- Type-safe database operations
- Helper functions for common queries
- Error handling and validation
- TypeScript interfaces for all tables

### Example Usage

```typescript
import { supabase, dbOperations } from '@/lib/supabase'

// Create a new medication
const medication = await dbOperations.createMedication({
  user_id: userId,
  name: 'Metformin',
  dosage: '500mg',
  frequency: 'Twice daily',
  times_per_day: 2,
  food_timing: 'with_food'
})

// Get user's medications
const medications = await dbOperations.getUserMedications(userId)

// Log medication adherence
const adherenceLog = await dbOperations.logAdherence({
  user_id: userId,
  medication_id: medicationId,
  scheduled_time: new Date().toISOString(),
  status: 'taken'
})
```

## Monitoring and Maintenance

### Dashboard Features
- **Database**: Monitor queries, connections, and performance
- **Auth**: Track user signups and authentication events
- **Storage**: Manage file uploads (for prescription images)
- **Edge Functions**: Deploy serverless functions if needed

### Backup and Recovery
- Supabase automatically backs up your database
- Point-in-time recovery available on paid plans
- Export data via dashboard or API

### Scaling Considerations
- Monitor database performance in the dashboard
- Consider read replicas for high-traffic applications
- Use connection pooling for better performance

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Verify environment variables are correct
   - Check if project is paused (free tier limitation)
   - Ensure network connectivity

2. **RLS Policy Errors**
   - Check if user is authenticated
   - Verify RLS policies allow the operation
   - Test with service role key for debugging

3. **Schema Errors**
   - Ensure schema was applied correctly
   - Check for missing tables or columns
   - Verify foreign key relationships

### Getting Help

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord Community](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)

## Next Steps

After setting up Supabase:

1. **Update Components**: Modify React components to use Supabase instead of local state
2. **Authentication**: Integrate Supabase Auth or keep using Clerk
3. **Real-time Features**: Add real-time subscriptions for live updates
4. **File Storage**: Use Supabase Storage for prescription images
5. **Edge Functions**: Deploy serverless functions for complex operations

## Security Best Practices

- Never expose service role keys in client-side code
- Use RLS policies to secure data access
- Validate all user inputs
- Regularly review and update permissions
- Monitor authentication logs for suspicious activity
- Keep Supabase client library updated

---

For additional support or questions about the MediGuide Supabase integration, please refer to the project documentation or contact the development team.