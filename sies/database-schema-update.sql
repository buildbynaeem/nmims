-- MediGuide Database Schema Update for Clerk User ID Support
-- This file updates existing tables to support Clerk user IDs (TEXT format)

-- First, let's check if we need to alter existing tables
-- Note: Run these commands one by one and check for errors

-- 1. Update users table if it exists with UUID id
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Check if users table exists and has UUID id column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'id' 
        AND data_type = 'uuid'
    ) THEN
        RAISE NOTICE 'Found users table with UUID id column. Starting conversion...';
        
        -- Drop ALL foreign key constraints that reference users.id
        FOR constraint_record IN 
            SELECT 
                tc.constraint_name,
                tc.table_name,
                tc.table_schema
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu 
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'users'
            AND ccu.column_name = 'id'
            AND tc.table_schema = 'public'
        LOOP
            EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', 
                constraint_record.table_schema, 
                constraint_record.table_name, 
                constraint_record.constraint_name);
            RAISE NOTICE 'Dropped constraint: %', constraint_record.constraint_name;
        END LOOP;
        
        -- Also drop the users table's own foreign key constraint to auth.users if it exists
        ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
        
        -- Drop RLS policies that reference the old column
        DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
        DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
        DROP POLICY IF EXISTS "Users can view own medications" ON public.medications;
        DROP POLICY IF EXISTS "Users can insert own medications" ON public.medications;
        DROP POLICY IF EXISTS "Users can update own medications" ON public.medications;
        DROP POLICY IF EXISTS "Users can delete own medications" ON public.medications;
        DROP POLICY IF EXISTS "Care circle can view patient medications" ON public.medications;
        DROP POLICY IF EXISTS "Users can manage own schedules" ON public.medication_schedules;
        DROP POLICY IF EXISTS "Users can manage own adherence logs" ON public.adherence_logs;
        DROP POLICY IF EXISTS "Users can manage own care circle" ON public.care_circle_members;
        DROP POLICY IF EXISTS "Members can view care circle they belong to" ON public.care_circle_members;
        DROP POLICY IF EXISTS "Users can manage own prescriptions" ON public.prescriptions;
        
        -- Alter the users table id column to TEXT
        ALTER TABLE public.users ALTER COLUMN id TYPE TEXT;
        RAISE NOTICE 'Converted users.id from UUID to TEXT';
        
        -- Alter related tables to use TEXT for user_id columns
        ALTER TABLE IF EXISTS public.medications ALTER COLUMN user_id TYPE TEXT;
        ALTER TABLE IF EXISTS public.medication_schedules ALTER COLUMN user_id TYPE TEXT;
        ALTER TABLE IF EXISTS public.adherence_logs ALTER COLUMN user_id TYPE TEXT;
        ALTER TABLE IF EXISTS public.care_circle_members ALTER COLUMN patient_id TYPE TEXT;
        ALTER TABLE IF EXISTS public.prescriptions ALTER COLUMN user_id TYPE TEXT;
        RAISE NOTICE 'Converted all user_id columns to TEXT';
        
        -- Re-add foreign key constraints (but NOT the auth.users reference since we're using Clerk)
        ALTER TABLE IF EXISTS public.medications ADD CONSTRAINT medications_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
        ALTER TABLE IF EXISTS public.medication_schedules ADD CONSTRAINT medication_schedules_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
        ALTER TABLE IF EXISTS public.adherence_logs ADD CONSTRAINT adherence_logs_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
        ALTER TABLE IF EXISTS public.care_circle_members ADD CONSTRAINT care_circle_members_patient_id_fkey 
            FOREIGN KEY (patient_id) REFERENCES public.users(id) ON DELETE CASCADE;
        ALTER TABLE IF EXISTS public.prescriptions ADD CONSTRAINT prescriptions_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Re-added foreign key constraints';
            
        RAISE NOTICE 'Successfully updated tables to support Clerk user IDs';
    ELSE
        RAISE NOTICE 'Users table either does not exist or already uses TEXT for id column';
    END IF;
END $$;

-- 2. Recreate RLS policies with proper auth checks
-- Note: These policies assume you're using Clerk with Supabase auth integration

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT 
    USING (id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE 
    USING (id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Medications policies
CREATE POLICY "Users can view own medications" ON public.medications FOR SELECT 
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own medications" ON public.medications FOR INSERT 
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own medications" ON public.medications FOR UPDATE 
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete own medications" ON public.medications FOR DELETE 
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Medication schedules policies
CREATE POLICY "Users can manage own schedules" ON public.medication_schedules FOR ALL 
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Adherence logs policies
CREATE POLICY "Users can manage own adherence logs" ON public.adherence_logs FOR ALL 
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Care circle policies
CREATE POLICY "Users can manage own care circle" ON public.care_circle_members FOR ALL 
    USING (patient_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Prescriptions policies
CREATE POLICY "Users can manage own prescriptions" ON public.prescriptions FOR ALL 
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- 3. Update the functions to work with TEXT user IDs
CREATE OR REPLACE FUNCTION public.calculate_adherence_rate(
    p_user_id TEXT,  -- Changed from UUID to TEXT
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
    total_scheduled INTEGER;
    total_taken INTEGER;
    adherence_rate NUMERIC;
BEGIN
    -- Count total scheduled doses
    SELECT COUNT(*) INTO total_scheduled
    FROM public.adherence_logs
    WHERE user_id = p_user_id
    AND scheduled_time::DATE BETWEEN p_start_date AND p_end_date;
    
    -- Count taken doses
    SELECT COUNT(*) INTO total_taken
    FROM public.adherence_logs
    WHERE user_id = p_user_id
    AND scheduled_time::DATE BETWEEN p_start_date AND p_end_date
    AND status = 'taken';
    
    -- Calculate adherence rate
    IF total_scheduled > 0 THEN
        adherence_rate := (total_taken::NUMERIC / total_scheduled::NUMERIC) * 100;
    ELSE
        adherence_rate := 0;
    END IF;
    
    RETURN ROUND(adherence_rate, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_upcoming_doses(
    p_user_id TEXT,  -- Changed from UUID to TEXT
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    medication_name TEXT,
    dosage TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    food_timing TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.name,
        m.dosage,
        al.scheduled_time,
        m.food_timing
    FROM public.adherence_logs al
    JOIN public.medications m ON al.medication_id = m.id
    WHERE al.user_id = p_user_id
    AND al.status = 'pending'
    AND al.scheduled_time > NOW()
    ORDER BY al.scheduled_time ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update the user creation trigger to work with Clerk
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.raw_user_meta_data->>'clerk_user_id',  -- Use Clerk user ID
        NEW.email, 
        NEW.raw_user_meta_data->>'full_name', 
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;