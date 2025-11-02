-- Fix RLS Policies for Clerk Authentication Integration
-- This script updates the Row Level Security policies to work with Clerk user IDs

-- First, let's disable RLS temporarily to allow operations
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_circle_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can insert own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can update own medications" ON public.medications;
DROP POLICY IF EXISTS "Users can delete own medications" ON public.medications;
DROP POLICY IF EXISTS "Care circle can view patient medications" ON public.medications;
DROP POLICY IF EXISTS "Users can manage own schedules" ON public.medication_schedules;
DROP POLICY IF EXISTS "Users can view own adherence" ON public.adherence_logs;
DROP POLICY IF EXISTS "Users can insert own adherence" ON public.adherence_logs;
DROP POLICY IF EXISTS "Users can update own adherence" ON public.adherence_logs;
DROP POLICY IF EXISTS "Users can delete own adherence" ON public.adherence_logs;
DROP POLICY IF EXISTS "Users can manage own care circle" ON public.care_circle_members;
DROP POLICY IF EXISTS "Members can view care circle they belong to" ON public.care_circle_members;
DROP POLICY IF EXISTS "Users can manage own prescriptions" ON public.prescriptions;

-- Create new policies that work with Clerk authentication
-- Note: These policies use current_setting to get the user ID from JWT claims
-- This assumes proper JWT configuration with Clerk

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT 
    USING (
        id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE 
    USING (
        id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT 
    WITH CHECK (
        id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

-- Medications policies
CREATE POLICY "Users can view own medications" ON public.medications FOR SELECT 
    USING (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

CREATE POLICY "Users can insert own medications" ON public.medications FOR INSERT 
    WITH CHECK (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

CREATE POLICY "Users can update own medications" ON public.medications FOR UPDATE 
    USING (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

CREATE POLICY "Users can delete own medications" ON public.medications FOR DELETE 
    USING (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

-- Prescriptions policies
CREATE POLICY "Users can view own prescriptions" ON public.prescriptions FOR SELECT 
    USING (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

CREATE POLICY "Users can insert own prescriptions" ON public.prescriptions FOR INSERT 
    WITH CHECK (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

CREATE POLICY "Users can update own prescriptions" ON public.prescriptions FOR UPDATE 
    USING (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

CREATE POLICY "Users can delete own prescriptions" ON public.prescriptions FOR DELETE 
    USING (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

-- Medication schedules policies
CREATE POLICY "Users can manage own schedules" ON public.medication_schedules FOR ALL 
    USING (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

-- Adherence logs policies
CREATE POLICY "Users can manage own adherence" ON public.adherence_logs FOR ALL 
    USING (
        user_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

-- Care circle policies
CREATE POLICY "Users can manage own care circle" ON public.care_circle_members FOR ALL 
    USING (
        patient_id = COALESCE(
            current_setting('request.jwt.claims', true)::json->>'sub',
            current_setting('request.jwt.claims', true)::json->>'user_id',
            auth.uid()::text
        )
    );

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Create a function to temporarily disable RLS for testing
CREATE OR REPLACE FUNCTION public.disable_rls_for_testing()
RETURNS void AS $$
BEGIN
    ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.medications DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.medication_schedules DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.adherence_logs DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.care_circle_members DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.prescriptions DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS disabled for testing - remember to re-enable!';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to re-enable RLS
CREATE OR REPLACE FUNCTION public.enable_rls()
RETURNS void AS $$
BEGIN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.adherence_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.care_circle_members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS re-enabled for all tables';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;