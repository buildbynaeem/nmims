-- Advanced Analytics and Reporting Queries for MediGuide
-- Complex queries for insights, reporting, and advanced features

-- =====================================================
-- ADVANCED PRESCRIPTION ANALYTICS
-- =====================================================

-- 1. Prescription processing performance metrics
CREATE OR REPLACE FUNCTION public.get_prescription_processing_metrics(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    date DATE,
    total_processed INTEGER,
    avg_processing_time_minutes NUMERIC,
    success_rate NUMERIC,
    most_common_medication TEXT,
    total_medications_extracted INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.created_at::DATE as date,
        COUNT(*) as total_processed,
        ROUND(
            AVG(EXTRACT(EPOCH FROM (p.updated_at - p.created_at)) / 60), 
            2
        ) as avg_processing_time_minutes,
        ROUND(
            (COUNT(*) FILTER (WHERE p.status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100, 
            2
        ) as success_rate,
        (
            SELECT medication_name
            FROM (
                SELECT 
                    jsonb_array_elements(p2.processed_data->'medications')->>'medication_name' as medication_name,
                    COUNT(*) as frequency
                FROM public.prescriptions p2
                WHERE p2.created_at::DATE = p.created_at::DATE
                AND p2.status = 'completed'
                GROUP BY medication_name
                ORDER BY frequency DESC
                LIMIT 1
            ) most_common
        ) as most_common_medication,
        COALESCE(
            SUM(jsonb_array_length(p.processed_data->'medications')) FILTER (WHERE p.status = 'completed'), 
            0
        )::INTEGER as total_medications_extracted
    FROM public.prescriptions p
    WHERE p.created_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY p.created_at::DATE
    ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Medication frequency analysis across all users
CREATE OR REPLACE FUNCTION public.get_medication_frequency_analysis(
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    medication_name TEXT,
    total_prescriptions INTEGER,
    unique_users INTEGER,
    avg_dosage_numeric NUMERIC,
    most_common_frequency TEXT,
    most_common_food_timing TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.name,
        COUNT(*) as total_prescriptions,
        COUNT(DISTINCT m.user_id) as unique_users,
        AVG(
            CASE 
                WHEN m.dosage ~ '^[0-9]+(\.[0-9]+)?'
                THEN (regexp_match(m.dosage, '^([0-9]+(?:\.[0-9]+)?)'))[1]::NUMERIC
                ELSE NULL
            END
        ) as avg_dosage_numeric,
        MODE() WITHIN GROUP (ORDER BY m.frequency) as most_common_frequency,
        MODE() WITHIN GROUP (ORDER BY m.food_timing) as most_common_food_timing
    FROM public.medications m
    WHERE m.is_active = true
    GROUP BY m.name
    ORDER BY total_prescriptions DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ADVANCED ADHERENCE ANALYTICS
-- =====================================================

-- 3. Adherence pattern analysis by time of day
CREATE OR REPLACE FUNCTION public.get_adherence_by_time_patterns(
    p_user_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 90
)
RETURNS TABLE (
    hour_of_day INTEGER,
    total_scheduled INTEGER,
    total_taken INTEGER,
    adherence_rate NUMERIC,
    avg_delay_minutes NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(HOUR FROM al.scheduled_time)::INTEGER as hour_of_day,
        COUNT(*) as total_scheduled,
        COUNT(*) FILTER (WHERE al.status = 'taken') as total_taken,
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
        ) as avg_delay_minutes
    FROM public.adherence_logs al
    WHERE (p_user_id IS NULL OR al.user_id = p_user_id)
    AND al.scheduled_time >= CURRENT_DATE - INTERVAL '1 day' * p_days
    GROUP BY EXTRACT(HOUR FROM al.scheduled_time)
    ORDER BY hour_of_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Adherence correlation with day of week
CREATE OR REPLACE FUNCTION public.get_adherence_by_weekday(
    p_user_id UUID,
    p_weeks INTEGER DEFAULT 12
)
RETURNS TABLE (
    day_of_week INTEGER,
    day_name TEXT,
    total_scheduled INTEGER,
    total_taken INTEGER,
    adherence_rate NUMERIC,
    missed_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(DOW FROM al.scheduled_time)::INTEGER as day_of_week,
        CASE EXTRACT(DOW FROM al.scheduled_time)::INTEGER
            WHEN 0 THEN 'Sunday'
            WHEN 1 THEN 'Monday'
            WHEN 2 THEN 'Tuesday'
            WHEN 3 THEN 'Wednesday'
            WHEN 4 THEN 'Thursday'
            WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
        END as day_name,
        COUNT(*) as total_scheduled,
        COUNT(*) FILTER (WHERE al.status = 'taken') as total_taken,
        ROUND(
            (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 
            2
        ) as adherence_rate,
        ROUND(
            (COUNT(*) FILTER (WHERE al.status = 'missed')::NUMERIC / COUNT(*)::NUMERIC) * 100, 
            2
        ) as missed_rate
    FROM public.adherence_logs al
    WHERE al.user_id = p_user_id
    AND al.scheduled_time >= CURRENT_DATE - INTERVAL '1 week' * p_weeks
    GROUP BY EXTRACT(DOW FROM al.scheduled_time)
    ORDER BY day_of_week;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Medication interaction risk assessment
CREATE OR REPLACE FUNCTION public.assess_medication_interactions(
    p_user_id UUID
)
RETURNS TABLE (
    medication_1 TEXT,
    medication_2 TEXT,
    same_time_frequency INTEGER,
    risk_level TEXT,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m1.name as medication_1,
        m2.name as medication_2,
        COUNT(*) as same_time_frequency,
        CASE 
            WHEN COUNT(*) > 10 THEN 'HIGH'
            WHEN COUNT(*) > 5 THEN 'MEDIUM'
            ELSE 'LOW'
        END as risk_level,
        CASE 
            WHEN COUNT(*) > 10 THEN 'Consult pharmacist about potential interactions'
            WHEN COUNT(*) > 5 THEN 'Monitor for side effects'
            ELSE 'Low interaction risk'
        END as recommendation
    FROM public.medication_schedules ms1
    JOIN public.medications m1 ON ms1.medication_id = m1.id
    JOIN public.medication_schedules ms2 ON ms1.scheduled_time = ms2.scheduled_time
    JOIN public.medications m2 ON ms2.medication_id = m2.id
    WHERE ms1.user_id = p_user_id
    AND ms2.user_id = p_user_id
    AND m1.id < m2.id  -- Avoid duplicate pairs
    AND m1.is_active = true
    AND m2.is_active = true
    GROUP BY m1.name, m2.name, m1.id, m2.id
    ORDER BY same_time_frequency DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PREDICTIVE ANALYTICS
-- =====================================================

-- 6. Predict adherence risk based on historical patterns
CREATE OR REPLACE FUNCTION public.predict_adherence_risk(
    p_user_id UUID
)
RETURNS TABLE (
    medication_name TEXT,
    current_adherence_rate NUMERIC,
    trend_direction TEXT,
    risk_score INTEGER,
    risk_level TEXT,
    recommendation TEXT
) AS $$
DECLARE
    rec RECORD;
    recent_rate NUMERIC;
    older_rate NUMERIC;
    trend TEXT;
    risk INTEGER;
    level TEXT;
    advice TEXT;
BEGIN
    FOR rec IN
        SELECT m.id, m.name
        FROM public.medications m
        WHERE m.user_id = p_user_id
        AND m.is_active = true
    LOOP
        -- Calculate recent adherence (last 7 days)
        SELECT COALESCE(
            (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100, 
            0
        ) INTO recent_rate
        FROM public.adherence_logs al
        WHERE al.user_id = p_user_id
        AND al.medication_id = rec.id
        AND al.scheduled_time >= CURRENT_DATE - INTERVAL '7 days';
        
        -- Calculate older adherence (8-14 days ago)
        SELECT COALESCE(
            (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100, 
            0
        ) INTO older_rate
        FROM public.adherence_logs al
        WHERE al.user_id = p_user_id
        AND al.medication_id = rec.id
        AND al.scheduled_time BETWEEN CURRENT_DATE - INTERVAL '14 days' AND CURRENT_DATE - INTERVAL '8 days';
        
        -- Determine trend
        IF recent_rate > older_rate + 10 THEN
            trend := 'IMPROVING';
        ELSIF recent_rate < older_rate - 10 THEN
            trend := 'DECLINING';
        ELSE
            trend := 'STABLE';
        END IF;
        
        -- Calculate risk score (0-100)
        risk := CASE 
            WHEN recent_rate >= 90 AND trend != 'DECLINING' THEN 10
            WHEN recent_rate >= 80 AND trend = 'STABLE' THEN 25
            WHEN recent_rate >= 70 AND trend = 'IMPROVING' THEN 35
            WHEN recent_rate >= 60 THEN 50
            WHEN recent_rate >= 40 THEN 70
            ELSE 90
        END;
        
        -- Determine risk level and recommendation
        IF risk <= 25 THEN
            level := 'LOW';
            advice := 'Continue current routine';
        ELSIF risk <= 50 THEN
            level := 'MEDIUM';
            advice := 'Consider setting additional reminders';
        ELSIF risk <= 75 THEN
            level := 'HIGH';
            advice := 'Review medication schedule and barriers';
        ELSE
            level := 'CRITICAL';
            advice := 'Immediate intervention needed - consult healthcare provider';
        END IF;
        
        RETURN QUERY SELECT rec.name, recent_rate, trend, risk, level, advice;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CARE CIRCLE ANALYTICS
-- =====================================================

-- 7. Care circle engagement metrics
CREATE OR REPLACE FUNCTION public.get_care_circle_engagement(
    p_patient_id UUID
)
RETURNS TABLE (
    member_name TEXT,
    member_email TEXT,
    role TEXT,
    days_since_joined INTEGER,
    engagement_score INTEGER,
    last_activity_type TEXT,
    recommendations TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ccm.member_name,
        ccm.member_email,
        ccm.role,
        CASE 
            WHEN ccm.joined_at IS NOT NULL 
            THEN (CURRENT_DATE - ccm.joined_at::DATE)::INTEGER
            ELSE NULL
        END as days_since_joined,
        -- Engagement score based on various factors
        CASE 
            WHEN ccm.status = 'active' AND ccm.joined_at > CURRENT_DATE - INTERVAL '7 days' THEN 90
            WHEN ccm.status = 'active' AND ccm.joined_at > CURRENT_DATE - INTERVAL '30 days' THEN 70
            WHEN ccm.status = 'active' THEN 50
            WHEN ccm.status = 'pending' THEN 20
            ELSE 10
        END as engagement_score,
        CASE ccm.status
            WHEN 'active' THEN 'Member joined care circle'
            WHEN 'pending' THEN 'Invitation pending'
            WHEN 'declined' THEN 'Declined invitation'
            ELSE 'Unknown'
        END as last_activity_type,
        CASE 
            WHEN ccm.status = 'pending' THEN ARRAY['Send reminder invitation', 'Try alternative contact method']
            WHEN ccm.status = 'declined' THEN ARRAY['Respect decision', 'Consider other family members']
            WHEN ccm.status = 'active' AND ccm.role = 'family' THEN ARRAY['Share weekly adherence reports', 'Enable medication reminders']
            WHEN ccm.status = 'active' AND ccm.role = 'doctor' THEN ARRAY['Share monthly analytics', 'Enable critical alerts']
            ELSE ARRAY['Monitor engagement', 'Provide regular updates']
        END as recommendations
    FROM public.care_circle_members ccm
    WHERE ccm.patient_id = p_patient_id
    ORDER BY engagement_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- REPORTING AND DASHBOARD QUERIES
-- =====================================================

-- 8. Generate comprehensive health report
CREATE OR REPLACE FUNCTION public.generate_health_report(
    p_user_id UUID,
    p_report_period INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
    report JSONB;
    adherence_summary RECORD;
    medication_count INTEGER;
    prescription_count INTEGER;
BEGIN
    -- Get basic counts
    SELECT COUNT(*) INTO medication_count
    FROM public.medications
    WHERE user_id = p_user_id AND is_active = true;
    
    SELECT COUNT(*) INTO prescription_count
    FROM public.prescriptions
    WHERE user_id = p_user_id 
    AND created_at >= CURRENT_DATE - INTERVAL '1 day' * p_report_period;
    
    -- Get adherence summary
    SELECT 
        COUNT(*) as total_scheduled,
        COUNT(*) FILTER (WHERE status = 'taken') as total_taken,
        ROUND((COUNT(*) FILTER (WHERE status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) as adherence_rate
    INTO adherence_summary
    FROM public.adherence_logs
    WHERE user_id = p_user_id
    AND scheduled_time >= CURRENT_DATE - INTERVAL '1 day' * p_report_period;
    
    -- Build comprehensive report
    SELECT jsonb_build_object(
        'report_period_days', p_report_period,
        'generated_at', NOW(),
        'user_id', p_user_id,
        'summary', jsonb_build_object(
            'active_medications', medication_count,
            'prescriptions_processed', prescription_count,
            'overall_adherence_rate', COALESCE(adherence_summary.adherence_rate, 0),
            'total_doses_scheduled', COALESCE(adherence_summary.total_scheduled, 0),
            'total_doses_taken', COALESCE(adherence_summary.total_taken, 0)
        ),
        'medications', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'name', m.name,
                    'dosage', m.dosage,
                    'frequency', m.frequency,
                    'adherence_rate', COALESCE(
                        (SELECT ROUND(
                            (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
                        )
                        FROM public.adherence_logs al
                        WHERE al.medication_id = m.id
                        AND al.scheduled_time >= CURRENT_DATE - INTERVAL '1 day' * p_report_period), 0
                    )
                )
            )
            FROM public.medications m
            WHERE m.user_id = p_user_id AND m.is_active = true
        ),
        'adherence_trends', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'date', date,
                    'adherence_rate', daily_rate
                )
            )
            FROM (
                SELECT 
                    al.scheduled_time::DATE as date,
                    ROUND(
                        (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
                    ) as daily_rate
                FROM public.adherence_logs al
                WHERE al.user_id = p_user_id
                AND al.scheduled_time >= CURRENT_DATE - INTERVAL '1 day' * p_report_period
                GROUP BY al.scheduled_time::DATE
                ORDER BY date DESC
                LIMIT 30
            ) daily_trends
        ),
        'recommendations', (
            SELECT jsonb_agg(recommendation)
            FROM (
                SELECT 
                    CASE 
                        WHEN adherence_summary.adherence_rate >= 95 THEN 'Excellent adherence! Keep up the great work.'
                        WHEN adherence_summary.adherence_rate >= 85 THEN 'Good adherence. Consider setting reminders for missed doses.'
                        WHEN adherence_summary.adherence_rate >= 70 THEN 'Moderate adherence. Review your medication schedule and identify barriers.'
                        ELSE 'Low adherence detected. Please consult with your healthcare provider.'
                    END as recommendation
                UNION ALL
                SELECT 'Review medication interactions with your pharmacist.' as recommendation
                WHERE medication_count > 3
                UNION ALL
                SELECT 'Consider using a pill organizer for better medication management.' as recommendation
                WHERE medication_count > 2
            ) recommendations_list
        )
    ) INTO report;
    
    RETURN report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Real-time dashboard data
CREATE OR REPLACE FUNCTION public.get_dashboard_data(
    p_user_id UUID
)
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'today_schedule', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'medication_name', medication_name,
                    'dosage', dosage,
                    'scheduled_time', scheduled_time,
                    'status', adherence_status,
                    'food_timing', food_timing
                )
            )
            FROM public.get_todays_schedule(p_user_id)
        ),
        'upcoming_doses', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'medication_name', medication_name,
                    'dosage', dosage,
                    'scheduled_time', scheduled_time,
                    'food_timing', food_timing
                )
            )
            FROM public.get_upcoming_doses(p_user_id, 5)
        ),
        'missed_alerts', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'medication_name', medication_name,
                    'dosage', dosage,
                    'scheduled_time', scheduled_time,
                    'hours_overdue', hours_overdue
                )
            )
            FROM public.get_missed_medication_alerts(p_user_id, 1)
        ),
        'adherence_rate_7_days', (
            SELECT public.calculate_adherence_rate(p_user_id, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE)
        ),
        'adherence_rate_30_days', (
            SELECT public.calculate_adherence_rate(p_user_id, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE)
        ),
        'current_streak', (
            SELECT current_streak FROM public.get_adherence_streaks(p_user_id, 30)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create additional indexes for performance
-- Note: Function-based indexes require immutable functions, so we'll use simpler approaches
CREATE INDEX IF NOT EXISTS idx_adherence_logs_user_time ON public.adherence_logs(user_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_adherence_logs_user_status ON public.adherence_logs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_medications_name_active ON public.medications(name, is_active) WHERE is_active = true;