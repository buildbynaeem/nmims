-- MediGuide Database Schema for Supabase
-- This file contains the complete database schema for the medication management application

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (compatible with Clerk user IDs)
CREATE TABLE public.users (
    id TEXT PRIMARY KEY, -- Changed from UUID to TEXT to support Clerk user IDs
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create medications table
CREATE TABLE public.medications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE NOT NULL, -- Changed from UUID to TEXT
    name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    times_per_day INTEGER NOT NULL DEFAULT 1,
    food_timing TEXT CHECK (food_timing IN ('before_food', 'after_food', 'with_food', 'anytime')),
    instructions TEXT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create medication schedules table
CREATE TABLE public.medication_schedules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    medication_id UUID REFERENCES public.medications(id) ON DELETE CASCADE NOT NULL,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    scheduled_time TIME NOT NULL,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create adherence logs table
CREATE TABLE public.adherence_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE NOT NULL, -- Changed from UUID to TEXT
    medication_id UUID REFERENCES public.medications(id) ON DELETE CASCADE NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_time TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('taken', 'missed', 'pending', 'skipped')) NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create care circle members table
CREATE TABLE public.care_circle_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    member_email TEXT NOT NULL,
    member_name TEXT NOT NULL,
    role TEXT CHECK (role IN ('family', 'caregiver', 'doctor', 'pharmacist')) NOT NULL,
    status TEXT CHECK (status IN ('invited', 'active', 'pending', 'declined')) DEFAULT 'invited',
    permissions TEXT[] DEFAULT ARRAY['view_schedule'],
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(patient_id, member_email)
);

-- Create prescriptions table
CREATE TABLE public.prescriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    original_text TEXT NOT NULL,
    processed_data JSONB,
    image_url TEXT,
    status TEXT CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_medications_user_id ON public.medications(user_id);
CREATE INDEX idx_medications_active ON public.medications(user_id, is_active);
CREATE INDEX idx_medication_schedules_user_id ON public.medication_schedules(user_id);
CREATE INDEX idx_medication_schedules_medication_id ON public.medication_schedules(medication_id);
CREATE INDEX idx_adherence_logs_user_id ON public.adherence_logs(user_id);
CREATE INDEX idx_adherence_logs_medication_id ON public.adherence_logs(medication_id);
CREATE INDEX idx_adherence_logs_scheduled_time ON public.adherence_logs(scheduled_time);
CREATE INDEX idx_care_circle_patient_id ON public.care_circle_members(patient_id);
CREATE INDEX idx_prescriptions_user_id ON public.prescriptions(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON public.medications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medication_schedules_updated_at BEFORE UPDATE ON public.medication_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_adherence_logs_updated_at BEFORE UPDATE ON public.adherence_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_care_circle_members_updated_at BEFORE UPDATE ON public.care_circle_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Medications policies
CREATE POLICY "Users can view own medications" ON public.medications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own medications" ON public.medications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own medications" ON public.medications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own medications" ON public.medications FOR DELETE USING (auth.uid() = user_id);

-- Care circle members can view patient medications
CREATE POLICY "Care circle can view patient medications" ON public.medications FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.care_circle_members 
        WHERE patient_id = medications.user_id 
        AND member_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND status = 'active'
        AND 'view_schedule' = ANY(permissions)
    )
);

-- Medication schedules policies
CREATE POLICY "Users can manage own schedules" ON public.medication_schedules FOR ALL USING (auth.uid() = user_id);

-- Adherence logs policies
CREATE POLICY "Users can manage own adherence logs" ON public.adherence_logs FOR ALL USING (auth.uid() = user_id);

-- Care circle policies
CREATE POLICY "Users can manage own care circle" ON public.care_circle_members FOR ALL USING (auth.uid() = patient_id);
CREATE POLICY "Members can view care circle they belong to" ON public.care_circle_members FOR SELECT USING (
    member_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Prescriptions policies
CREATE POLICY "Users can manage own prescriptions" ON public.prescriptions FOR ALL USING (auth.uid() = user_id);

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to calculate adherence rate
CREATE OR REPLACE FUNCTION public.calculate_adherence_rate(
    p_user_id UUID,
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

-- Create function to get upcoming doses
CREATE OR REPLACE FUNCTION public.get_upcoming_doses(
    p_user_id UUID,
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

-- Insert sample data (optional - for testing)
-- This can be removed in production
/*
INSERT INTO public.users (id, email, full_name) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'test@example.com', 'Test User');

INSERT INTO public.medications (user_id, name, dosage, frequency, times_per_day, food_timing) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Metformin', '500mg', 'Twice daily', 2, 'with_food'),
('550e8400-e29b-41d4-a716-446655440000', 'Lisinopril', '10mg', 'Once daily', 1, 'anytime');
*/