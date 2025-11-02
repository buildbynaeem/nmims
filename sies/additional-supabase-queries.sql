-- Additional Supabase SQL Queries for MediGuide Application
-- Prescription Decoder, Medication Scheduler, and Adherence History

-- =====================================================
-- PRESCRIPTION DECODER QUERIES
-- =====================================================

-- 1. Get all prescription history for a user with pagination
CREATE OR REPLACE FUNCTION public.get_prescription_history_paginated(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    original_text TEXT,
    processed_data JSONB,
    image_url TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    medication_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.original_text,
        p.processed_data,
        p.image_url,
        p.status,
        p.created_at,
        COALESCE(jsonb_array_length(p.processed_data->'medications'), 0)::INTEGER as medication_count
    FROM public.prescriptions p
    WHERE p.user_id = p_user_id
    AND (p_status IS NULL OR p.status = p_status)
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Search prescriptions by medication name or text content
CREATE OR REPLACE FUNCTION public.search_prescriptions(
    p_user_id UUID,
    p_search_term TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    original_text TEXT,
    processed_data JSONB,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    relevance_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.original_text,
        p.processed_data,
        p.status,
        p.created_at,
        (
            CASE 
                WHEN p.original_text ILIKE '%' || p_search_term || '%' THEN 1.0
                WHEN p.processed_data::TEXT ILIKE '%' || p_search_term || '%' THEN 0.8
                ELSE 0.0
            END
        ) as relevance_score
    FROM public.prescriptions p
    WHERE p.user_id = p_user_id
    AND (
        p.original_text ILIKE '%' || p_search_term || '%' 
        OR p.processed_data::TEXT ILIKE '%' || p_search_term || '%'
    )
    ORDER BY relevance_score DESC, p.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Get prescription processing statistics
CREATE OR REPLACE FUNCTION public.get_prescription_stats(
    p_user_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_prescriptions INTEGER,
    successful_prescriptions INTEGER,
    failed_prescriptions INTEGER,
    processing_prescriptions INTEGER,
    success_rate NUMERIC,
    total_medications_decoded INTEGER
) AS $$
DECLARE
    v_total INTEGER;
    v_successful INTEGER;
    v_failed INTEGER;
    v_processing INTEGER;
    v_success_rate NUMERIC;
    v_total_meds INTEGER;
BEGIN
    -- Get counts by status
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'failed'),
        COUNT(*) FILTER (WHERE status = 'processing')
    INTO v_total, v_successful, v_failed, v_processing
    FROM public.prescriptions
    WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days;
    
    -- Calculate success rate
    v_success_rate := CASE 
        WHEN v_total > 0 THEN ROUND((v_successful::NUMERIC / v_total::NUMERIC) * 100, 2)
        ELSE 0
    END;
    
    -- Count total medications decoded
    SELECT COALESCE(SUM(jsonb_array_length(processed_data->'medications')), 0)
    INTO v_total_meds
    FROM public.prescriptions
    WHERE user_id = p_user_id
    AND status = 'completed'
    AND created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days;
    
    RETURN QUERY SELECT v_total, v_successful, v_failed, v_processing, v_success_rate, v_total_meds::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MEDICATION SCHEDULER QUERIES
-- =====================================================

-- 4. Get today's medication schedule with status
CREATE OR REPLACE FUNCTION public.get_todays_schedule(
    p_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    medication_id UUID,
    medication_name TEXT,
    dosage TEXT,
    scheduled_time TIME,
    food_timing TEXT,
    adherence_status TEXT,
    actual_time TIMESTAMP WITH TIME ZONE,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.name,
        m.dosage,
        ms.scheduled_time,
        m.food_timing,
        COALESCE(al.status, 'pending') as adherence_status,
        al.actual_time,
        al.notes
    FROM public.medications m
    JOIN public.medication_schedules ms ON m.id = ms.medication_id
    LEFT JOIN public.adherence_logs al ON (
        al.medication_id = m.id 
        AND al.scheduled_time::DATE = p_date
        AND al.scheduled_time::TIME = ms.scheduled_time
    )
    WHERE m.user_id = p_user_id
    AND m.is_active = true
    AND ms.is_active = true
    AND (ms.day_of_week IS NULL OR ms.day_of_week = EXTRACT(DOW FROM p_date))
    AND (m.start_date <= p_date)
    AND (m.end_date IS NULL OR m.end_date >= p_date)
    ORDER BY ms.scheduled_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Generate medication schedule for a date range
CREATE OR REPLACE FUNCTION public.generate_schedule_for_range(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    medication_id UUID,
    medication_name TEXT,
    dosage TEXT,
    scheduled_datetime TIMESTAMP WITH TIME ZONE,
    food_timing TEXT
) AS $$
DECLARE
    current_date DATE;
BEGIN
    current_date := p_start_date;
    
    WHILE current_date <= p_end_date LOOP
        RETURN QUERY
        SELECT 
            m.id,
            m.name,
            m.dosage,
            (current_date + ms.scheduled_time)::TIMESTAMP WITH TIME ZONE,
            m.food_timing
        FROM public.medications m
        JOIN public.medication_schedules ms ON m.id = ms.medication_id
        WHERE m.user_id = p_user_id
        AND m.is_active = true
        AND ms.is_active = true
        AND (ms.day_of_week IS NULL OR ms.day_of_week = EXTRACT(DOW FROM current_date))
        AND (m.start_date <= current_date)
        AND (m.end_date IS NULL OR m.end_date >= current_date);
        
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Get medication conflicts (same time slots)
CREATE OR REPLACE FUNCTION public.get_medication_conflicts(
    p_user_id UUID
)
RETURNS TABLE (
    scheduled_time TIME,
    conflict_count INTEGER,
    medication_names TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ms.scheduled_time,
        COUNT(*)::INTEGER as conflict_count,
        array_agg(m.name) as medication_names
    FROM public.medication_schedules ms
    JOIN public.medications m ON ms.medication_id = m.id
    WHERE ms.user_id = p_user_id
    AND ms.is_active = true
    AND m.is_active = true
    GROUP BY ms.scheduled_time
    HAVING COUNT(*) > 1
    ORDER BY ms.scheduled_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Get optimal scheduling suggestions
CREATE OR REPLACE FUNCTION public.get_scheduling_suggestions(
    p_user_id UUID,
    p_new_medication_times_per_day INTEGER
)
RETURNS TABLE (
    suggested_time TIME,
    conflict_level INTEGER,
    reason TEXT
) AS $$
DECLARE
    existing_times TIME[];
    suggested_times TIME[] := ARRAY['08:00:00', '12:00:00', '18:00:00', '22:00:00'];
    i INTEGER;
BEGIN
    -- Get existing scheduled times
    SELECT array_agg(DISTINCT scheduled_time) INTO existing_times
    FROM public.medication_schedules ms
    JOIN public.medications m ON ms.medication_id = m.id
    WHERE ms.user_id = p_user_id
    AND ms.is_active = true
    AND m.is_active = true;
    
    -- Generate suggestions based on times per day
    FOR i IN 1..p_new_medication_times_per_day LOOP
        IF i <= array_length(suggested_times, 1) THEN
            RETURN QUERY
            SELECT 
                suggested_times[i],
                CASE 
                    WHEN suggested_times[i] = ANY(existing_times) THEN 1
                    ELSE 0
                END as conflict_level,
                CASE 
                    WHEN suggested_times[i] = ANY(existing_times) THEN 'Time slot already occupied'
                    ELSE 'Available time slot'
                END as reason;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ADHERENCE HISTORY QUERIES
-- =====================================================

-- 8. Get detailed adherence history with trends
CREATE OR REPLACE FUNCTION public.get_adherence_history_detailed(
    p_user_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_medication_id UUID DEFAULT NULL
)
RETURNS TABLE (
    date DATE,
    medication_name TEXT,
    scheduled_count INTEGER,
    taken_count INTEGER,
    missed_count INTEGER,
    skipped_count INTEGER,
    daily_adherence_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.scheduled_time::DATE as date,
        m.name as medication_name,
        COUNT(*) as scheduled_count,
        COUNT(*) FILTER (WHERE al.status = 'taken') as taken_count,
        COUNT(*) FILTER (WHERE al.status = 'missed') as missed_count,
        COUNT(*) FILTER (WHERE al.status = 'skipped') as skipped_count,
        ROUND(
            (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 
            2
        ) as daily_adherence_rate
    FROM public.adherence_logs al
    JOIN public.medications m ON al.medication_id = m.id
    WHERE al.user_id = p_user_id
    AND al.scheduled_time::DATE BETWEEN p_start_date AND p_end_date
    AND (p_medication_id IS NULL OR al.medication_id = p_medication_id)
    GROUP BY al.scheduled_time::DATE, m.name, m.id
    ORDER BY date DESC, m.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Get adherence streaks (consecutive days of perfect adherence)
CREATE OR REPLACE FUNCTION public.get_adherence_streaks(
    p_user_id UUID,
    p_days INTEGER DEFAULT 90
)
RETURNS TABLE (
    current_streak INTEGER,
    longest_streak INTEGER,
    streak_start_date DATE,
    streak_end_date DATE
) AS $$
DECLARE
    v_current_streak INTEGER := 0;
    v_longest_streak INTEGER := 0;
    v_temp_streak INTEGER := 0;
    v_streak_start DATE;
    v_streak_end DATE;
    v_longest_start DATE;
    v_longest_end DATE;
    daily_record RECORD;
BEGIN
    -- Calculate daily adherence rates
    FOR daily_record IN
        SELECT 
            al.scheduled_time::DATE as date,
            CASE 
                WHEN COUNT(*) = COUNT(*) FILTER (WHERE al.status = 'taken') THEN true
                ELSE false
            END as perfect_day
        FROM public.adherence_logs al
        WHERE al.user_id = p_user_id
        AND al.scheduled_time::DATE >= CURRENT_DATE - INTERVAL '1 day' * p_days
        GROUP BY al.scheduled_time::DATE
        ORDER BY date DESC
    LOOP
        IF daily_record.perfect_day THEN
            v_temp_streak := v_temp_streak + 1;
            IF v_streak_start IS NULL THEN
                v_streak_start := daily_record.date;
            END IF;
            v_streak_end := daily_record.date;
        ELSE
            IF v_temp_streak > v_longest_streak THEN
                v_longest_streak := v_temp_streak;
                v_longest_start := v_streak_start;
                v_longest_end := v_streak_end;
            END IF;
            
            -- Reset for current streak calculation
            IF v_current_streak = 0 THEN
                v_current_streak := v_temp_streak;
            END IF;
            
            v_temp_streak := 0;
            v_streak_start := NULL;
            v_streak_end := NULL;
        END IF;
    END LOOP;
    
    -- Handle case where streak continues to present
    IF v_temp_streak > v_longest_streak THEN
        v_longest_streak := v_temp_streak;
        v_longest_start := v_streak_start;
        v_longest_end := v_streak_end;
    END IF;
    
    IF v_current_streak = 0 THEN
        v_current_streak := v_temp_streak;
    END IF;
    
    RETURN QUERY SELECT v_current_streak, v_longest_streak, v_longest_start, v_longest_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Get missed medication alerts
CREATE OR REPLACE FUNCTION public.get_missed_medication_alerts(
    p_user_id UUID,
    p_hours_threshold INTEGER DEFAULT 2
)
RETURNS TABLE (
    medication_name TEXT,
    dosage TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    hours_overdue NUMERIC,
    food_timing TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.name,
        m.dosage,
        al.scheduled_time,
        ROUND(
            EXTRACT(EPOCH FROM (NOW() - al.scheduled_time)) / 3600, 
            1
        ) as hours_overdue,
        m.food_timing
    FROM public.adherence_logs al
    JOIN public.medications m ON al.medication_id = m.id
    WHERE al.user_id = p_user_id
    AND al.status = 'pending'
    AND al.scheduled_time < NOW() - INTERVAL '1 hour' * p_hours_threshold
    ORDER BY al.scheduled_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Get adherence analytics by medication
CREATE OR REPLACE FUNCTION public.get_medication_adherence_analytics(
    p_user_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    medication_name TEXT,
    total_scheduled INTEGER,
    total_taken INTEGER,
    total_missed INTEGER,
    adherence_rate NUMERIC,
    avg_delay_minutes NUMERIC,
    best_time_slot TIME
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.name,
        COUNT(*) as total_scheduled,
        COUNT(*) FILTER (WHERE al.status = 'taken') as total_taken,
        COUNT(*) FILTER (WHERE al.status = 'missed') as total_missed,
        ROUND(
            (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 
            2
        ) as adherence_rate,
        ROUND(
            AVG(
                CASE 
                    WHEN al.status = 'taken' AND al.actual_time IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (al.actual_time - al.scheduled_time)) / 60
                    ELSE NULL
                END
            ), 
            1
        ) as avg_delay_minutes,
        MODE() WITHIN GROUP (ORDER BY al.scheduled_time::TIME) as best_time_slot
    FROM public.adherence_logs al
    JOIN public.medications m ON al.medication_id = m.id
    WHERE al.user_id = p_user_id
    AND al.scheduled_time::DATE >= CURRENT_DATE - INTERVAL '1 day' * p_days
    GROUP BY m.id, m.name
    ORDER BY adherence_rate DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Get weekly adherence summary
CREATE OR REPLACE FUNCTION public.get_weekly_adherence_summary(
    p_user_id UUID,
    p_weeks INTEGER DEFAULT 4
)
RETURNS TABLE (
    week_start DATE,
    week_end DATE,
    total_scheduled INTEGER,
    total_taken INTEGER,
    weekly_adherence_rate NUMERIC,
    perfect_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc('week', al.scheduled_time)::DATE as week_start,
        (date_trunc('week', al.scheduled_time) + INTERVAL '6 days')::DATE as week_end,
        COUNT(*) as total_scheduled,
        COUNT(*) FILTER (WHERE al.status = 'taken') as total_taken,
        ROUND(
            (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 
            2
        ) as weekly_adherence_rate,
        COUNT(DISTINCT al.scheduled_time::DATE) FILTER (
            WHERE al.scheduled_time::DATE IN (
                SELECT daily_date
                FROM (
                    SELECT 
                        al2.scheduled_time::DATE as daily_date,
                        COUNT(*) as daily_scheduled,
                        COUNT(*) FILTER (WHERE al2.status = 'taken') as daily_taken
                    FROM public.adherence_logs al2
                    WHERE al2.user_id = p_user_id
                    AND al2.scheduled_time::DATE = al.scheduled_time::DATE
                    GROUP BY al2.scheduled_time::DATE
                    HAVING COUNT(*) = COUNT(*) FILTER (WHERE al2.status = 'taken')
                ) perfect_days_subquery
            )
        ) as perfect_days
    FROM public.adherence_logs al
    WHERE al.user_id = p_user_id
    AND al.scheduled_time >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' * (p_weeks - 1)
    GROUP BY date_trunc('week', al.scheduled_time)
    ORDER BY week_start DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UTILITY QUERIES
-- =====================================================

-- 13. Cleanup old data
CREATE OR REPLACE FUNCTION public.cleanup_old_data(
    p_days_to_keep INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old adherence logs
    DELETE FROM public.adherence_logs
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * p_days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old prescriptions (keep successful ones longer)
    DELETE FROM public.prescriptions
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * p_days_to_keep
    AND status != 'completed';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Export user data (GDPR compliance)
CREATE OR REPLACE FUNCTION public.export_user_data(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    user_data JSONB;
BEGIN
    SELECT jsonb_build_object(
        'user_profile', (
            SELECT to_jsonb(u) FROM public.users u WHERE u.id = p_user_id
        ),
        'medications', (
            SELECT jsonb_agg(to_jsonb(m)) FROM public.medications m WHERE m.user_id = p_user_id
        ),
        'schedules', (
            SELECT jsonb_agg(to_jsonb(ms)) FROM public.medication_schedules ms WHERE ms.user_id = p_user_id
        ),
        'adherence_logs', (
            SELECT jsonb_agg(to_jsonb(al)) FROM public.adherence_logs al WHERE al.user_id = p_user_id
        ),
        'prescriptions', (
            SELECT jsonb_agg(to_jsonb(p)) FROM public.prescriptions p WHERE p.user_id = p_user_id
        ),
        'care_circle', (
            SELECT jsonb_agg(to_jsonb(ccm)) FROM public.care_circle_members ccm WHERE ccm.patient_id = p_user_id
        )
    ) INTO user_data;
    
    RETURN user_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for the new functions
CREATE INDEX IF NOT EXISTS idx_adherence_logs_date ON public.adherence_logs(user_id, scheduled_time::DATE);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status_date ON public.prescriptions(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_medications_active_dates ON public.medications(user_id, is_active, start_date, end_date);