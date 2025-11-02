-- Specialized Feature Queries for MediGuide
-- Advanced functionality for medication management, reminders, and integrations

-- =====================================================
-- SMART REMINDER SYSTEM
-- =====================================================

-- 1. Dynamic reminder scheduling based on user behavior
CREATE OR REPLACE FUNCTION public.generate_smart_reminders(
    p_user_id UUID,
    p_days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE (
    medication_id UUID,
    medication_name TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    reminder_time TIMESTAMP WITH TIME ZONE,
    reminder_type TEXT,
    priority INTEGER,
    message TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_patterns AS (
        SELECT 
            al.medication_id,
            AVG(EXTRACT(EPOCH FROM (al.actual_time - al.scheduled_time)) / 60) as avg_delay_minutes,
            COUNT(*) FILTER (WHERE al.status = 'missed') as missed_count,
            COUNT(*) as total_count
        FROM public.adherence_logs al
        WHERE al.user_id = p_user_id
        AND al.scheduled_time >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY al.medication_id
    )
    SELECT 
        ms.medication_id,
        m.name,
        ms.scheduled_time,
        CASE 
            -- High-risk medications get earlier reminders
            WHEN up.missed_count::NUMERIC / up.total_count > 0.2 THEN 
                ms.scheduled_time - INTERVAL '2 hours'
            -- Users who are consistently late get earlier reminders
            WHEN up.avg_delay_minutes > 30 THEN 
                ms.scheduled_time - INTERVAL '1 hour'
            -- Standard reminder
            ELSE ms.scheduled_time - INTERVAL '30 minutes'
        END as reminder_time,
        CASE 
            WHEN up.missed_count::NUMERIC / up.total_count > 0.2 THEN 'HIGH_PRIORITY'
            WHEN up.avg_delay_minutes > 30 THEN 'EARLY_REMINDER'
            ELSE 'STANDARD'
        END as reminder_type,
        CASE 
            WHEN up.missed_count::NUMERIC / up.total_count > 0.2 THEN 1
            WHEN up.avg_delay_minutes > 30 THEN 2
            ELSE 3
        END as priority,
        CASE 
            WHEN up.missed_count::NUMERIC / up.total_count > 0.2 THEN 
                'IMPORTANT: Time for ' || m.name || ' (' || m.dosage || '). You''ve missed this medication recently.'
            WHEN up.avg_delay_minutes > 30 THEN 
                'Early reminder: ' || m.name || ' (' || m.dosage || ') is due soon. Take with ' || m.food_timing || '.'
            ELSE 
                'Reminder: Time for ' || m.name || ' (' || m.dosage || '). ' || 
                CASE m.food_timing 
                    WHEN 'with_food' THEN 'Take with food.'
                    WHEN 'without_food' THEN 'Take on empty stomach.'
                    ELSE 'Take as prescribed.'
                END
        END as message
    FROM public.medication_schedules ms
    JOIN public.medications m ON ms.medication_id = m.id
    LEFT JOIN user_patterns up ON ms.medication_id = up.medication_id
    WHERE ms.user_id = p_user_id
    AND ms.scheduled_time BETWEEN NOW() AND NOW() + INTERVAL '1 day' * p_days_ahead
    AND m.is_active = true
    ORDER BY ms.scheduled_time, priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Escalation reminders for missed medications
CREATE OR REPLACE FUNCTION public.get_escalation_reminders(
    p_user_id UUID
)
RETURNS TABLE (
    medication_name TEXT,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    hours_overdue NUMERIC,
    escalation_level INTEGER,
    action_required TEXT,
    care_circle_notify BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.name,
        al.scheduled_time,
        ROUND(EXTRACT(EPOCH FROM (NOW() - al.scheduled_time)) / 3600, 1) as hours_overdue,
        CASE 
            WHEN EXTRACT(EPOCH FROM (NOW() - al.scheduled_time)) / 3600 > 24 THEN 3
            WHEN EXTRACT(EPOCH FROM (NOW() - al.scheduled_time)) / 3600 > 6 THEN 2
            ELSE 1
        END as escalation_level,
        CASE 
            WHEN EXTRACT(EPOCH FROM (NOW() - al.scheduled_time)) / 3600 > 24 THEN 
                'CRITICAL: Contact healthcare provider immediately'
            WHEN EXTRACT(EPOCH FROM (NOW() - al.scheduled_time)) / 3600 > 6 THEN 
                'URGENT: Take medication now and contact pharmacist'
            ELSE 'Take medication as soon as possible'
        END as action_required,
        CASE 
            WHEN EXTRACT(EPOCH FROM (NOW() - al.scheduled_time)) / 3600 > 12 THEN true
            ELSE false
        END as care_circle_notify
    FROM public.adherence_logs al
    JOIN public.medications m ON al.medication_id = m.id
    WHERE al.user_id = p_user_id
    AND al.status = 'scheduled'
    AND al.scheduled_time < NOW()
    AND m.is_active = true
    ORDER BY hours_overdue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DOSAGE ADJUSTMENT TRACKING
-- =====================================================

-- 3. Track dosage changes and effectiveness
CREATE OR REPLACE FUNCTION public.track_dosage_adjustments(
    p_user_id UUID,
    p_medication_id UUID,
    p_new_dosage TEXT,
    p_reason TEXT,
    p_prescribed_by TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    adjustment_id UUID;
    old_dosage TEXT;
BEGIN
    -- Get current dosage
    SELECT dosage INTO old_dosage
    FROM public.medications
    WHERE id = p_medication_id AND user_id = p_user_id;
    
    -- Create adjustment record
    INSERT INTO public.dosage_adjustments (
        id, user_id, medication_id, old_dosage, new_dosage, 
        reason, prescribed_by, created_at
    ) VALUES (
        gen_random_uuid(), p_user_id, p_medication_id, old_dosage, p_new_dosage,
        p_reason, p_prescribed_by, NOW()
    ) RETURNING id INTO adjustment_id;
    
    -- Update medication dosage
    UPDATE public.medications
    SET dosage = p_new_dosage, updated_at = NOW()
    WHERE id = p_medication_id AND user_id = p_user_id;
    
    RETURN adjustment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create dosage_adjustments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.dosage_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    old_dosage TEXT,
    new_dosage TEXT NOT NULL,
    reason TEXT,
    prescribed_by TEXT,
    effectiveness_rating INTEGER CHECK (effectiveness_rating BETWEEN 1 AND 5),
    side_effects TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Analyze dosage effectiveness
CREATE OR REPLACE FUNCTION public.analyze_dosage_effectiveness(
    p_user_id UUID,
    p_medication_id UUID
)
RETURNS TABLE (
    adjustment_date DATE,
    old_dosage TEXT,
    new_dosage TEXT,
    days_on_dosage INTEGER,
    adherence_rate_before NUMERIC,
    adherence_rate_after NUMERIC,
    effectiveness_improvement NUMERIC,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH dosage_periods AS (
        SELECT 
            da.*,
            LEAD(da.created_at) OVER (ORDER BY da.created_at) as next_adjustment,
            COALESCE(
                LEAD(da.created_at) OVER (ORDER BY da.created_at),
                NOW()
            ) as period_end
        FROM public.dosage_adjustments da
        WHERE da.user_id = p_user_id 
        AND da.medication_id = p_medication_id
    )
    SELECT 
        dp.created_at::DATE,
        dp.old_dosage,
        dp.new_dosage,
        (dp.period_end::DATE - dp.created_at::DATE)::INTEGER as days_on_dosage,
        -- Adherence rate 30 days before adjustment
        COALESCE((
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
            )
            FROM public.adherence_logs al
            WHERE al.user_id = p_user_id
            AND al.medication_id = p_medication_id
            AND al.scheduled_time BETWEEN dp.created_at - INTERVAL '30 days' AND dp.created_at
        ), 0) as adherence_rate_before,
        -- Adherence rate 30 days after adjustment
        COALESCE((
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
            )
            FROM public.adherence_logs al
            WHERE al.user_id = p_user_id
            AND al.medication_id = p_medication_id
            AND al.scheduled_time BETWEEN dp.created_at AND LEAST(dp.period_end, dp.created_at + INTERVAL '30 days')
        ), 0) as adherence_rate_after,
        -- Calculate improvement
        COALESCE((
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
            )
            FROM public.adherence_logs al
            WHERE al.user_id = p_user_id
            AND al.medication_id = p_medication_id
            AND al.scheduled_time BETWEEN dp.created_at AND LEAST(dp.period_end, dp.created_at + INTERVAL '30 days')
        ), 0) - COALESCE((
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
            )
            FROM public.adherence_logs al
            WHERE al.user_id = p_user_id
            AND al.medication_id = p_medication_id
            AND al.scheduled_time BETWEEN dp.created_at - INTERVAL '30 days' AND dp.created_at
        ), 0) as effectiveness_improvement,
        -- Recommendation based on improvement
        CASE 
            WHEN COALESCE((
                SELECT ROUND(
                    (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
                )
                FROM public.adherence_logs al
                WHERE al.user_id = p_user_id
                AND al.medication_id = p_medication_id
                AND al.scheduled_time BETWEEN dp.created_at AND LEAST(dp.period_end, dp.created_at + INTERVAL '30 days')
            ), 0) - COALESCE((
                SELECT ROUND(
                    (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
                )
                FROM public.adherence_logs al
                WHERE al.user_id = p_user_id
                AND al.medication_id = p_medication_id
                AND al.scheduled_time BETWEEN dp.created_at - INTERVAL '30 days' AND dp.created_at
            ), 0) > 10 THEN 'Dosage adjustment was effective - continue monitoring'
            WHEN COALESCE((
                SELECT ROUND(
                    (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
                )
                FROM public.adherence_logs al
                WHERE al.user_id = p_user_id
                AND al.medication_id = p_medication_id
                AND al.scheduled_time BETWEEN dp.created_at AND LEAST(dp.period_end, dp.created_at + INTERVAL '30 days')
            ), 0) - COALESCE((
                SELECT ROUND(
                    (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
                )
                FROM public.adherence_logs al
                WHERE al.user_id = p_user_id
                AND al.medication_id = p_medication_id
                AND al.scheduled_time BETWEEN dp.created_at - INTERVAL '30 days' AND dp.created_at
            ), 0) < -10 THEN 'Dosage adjustment may have reduced adherence - consult healthcare provider'
            ELSE 'Minimal change in adherence - monitor for other factors'
        END as recommendation
    FROM dosage_periods dp
    ORDER BY dp.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MEDICATION INVENTORY MANAGEMENT
-- =====================================================

-- 5. Track medication inventory and refill needs
CREATE OR REPLACE FUNCTION public.calculate_refill_dates(
    p_user_id UUID
)
RETURNS TABLE (
    medication_name TEXT,
    current_supply_days INTEGER,
    daily_consumption NUMERIC,
    estimated_refill_date DATE,
    urgency_level TEXT,
    pharmacy_info JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.name,
        COALESCE(mi.current_quantity, 0) as current_supply_days,
        -- Calculate daily consumption based on frequency
        CASE 
            WHEN m.frequency ILIKE '%once%daily%' OR m.frequency ILIKE '%1%day%' THEN 1.0
            WHEN m.frequency ILIKE '%twice%daily%' OR m.frequency ILIKE '%2%day%' THEN 2.0
            WHEN m.frequency ILIKE '%three%daily%' OR m.frequency ILIKE '%3%day%' THEN 3.0
            WHEN m.frequency ILIKE '%four%daily%' OR m.frequency ILIKE '%4%day%' THEN 4.0
            WHEN m.frequency ILIKE '%every%other%day%' THEN 0.5
            WHEN m.frequency ILIKE '%weekly%' OR m.frequency ILIKE '%week%' THEN 0.14
            ELSE 1.0  -- Default to once daily
        END as daily_consumption,
        CASE 
            WHEN mi.current_quantity IS NULL THEN CURRENT_DATE
            ELSE CURRENT_DATE + INTERVAL '1 day' * (
                mi.current_quantity / CASE 
                    WHEN m.frequency ILIKE '%once%daily%' OR m.frequency ILIKE '%1%day%' THEN 1.0
                    WHEN m.frequency ILIKE '%twice%daily%' OR m.frequency ILIKE '%2%day%' THEN 2.0
                    WHEN m.frequency ILIKE '%three%daily%' OR m.frequency ILIKE '%3%day%' THEN 3.0
                    WHEN m.frequency ILIKE '%four%daily%' OR m.frequency ILIKE '%4%day%' THEN 4.0
                    WHEN m.frequency ILIKE '%every%other%day%' THEN 0.5
                    WHEN m.frequency ILIKE '%weekly%' OR m.frequency ILIKE '%week%' THEN 0.14
                    ELSE 1.0
                END
            )
        END::DATE as estimated_refill_date,
        CASE 
            WHEN mi.current_quantity IS NULL THEN 'UNKNOWN'
            WHEN mi.current_quantity <= 3 THEN 'CRITICAL'
            WHEN mi.current_quantity <= 7 THEN 'HIGH'
            WHEN mi.current_quantity <= 14 THEN 'MEDIUM'
            ELSE 'LOW'
        END as urgency_level,
        COALESCE(mi.pharmacy_info, '{}'::jsonb) as pharmacy_info
    FROM public.medications m
    LEFT JOIN public.medication_inventory mi ON m.id = mi.medication_id
    WHERE m.user_id = p_user_id
    AND m.is_active = true
    ORDER BY 
        CASE 
            WHEN mi.current_quantity IS NULL THEN 0
            ELSE mi.current_quantity
        END ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create medication inventory table
CREATE TABLE IF NOT EXISTS public.medication_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    last_refill_date DATE,
    pharmacy_info JSONB DEFAULT '{}',
    auto_refill_enabled BOOLEAN DEFAULT false,
    low_stock_threshold INTEGER DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, medication_id)
);

-- 6. Generate pharmacy refill orders
CREATE OR REPLACE FUNCTION public.generate_refill_orders(
    p_user_id UUID,
    p_urgency_levels TEXT[] DEFAULT ARRAY['CRITICAL', 'HIGH']
)
RETURNS TABLE (
    medication_name TEXT,
    dosage TEXT,
    quantity_needed INTEGER,
    pharmacy_name TEXT,
    pharmacy_phone TEXT,
    prescription_number TEXT,
    estimated_cost NUMERIC,
    order_priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.name,
        m.dosage,
        -- Calculate 30-day supply
        CASE 
            WHEN m.frequency ILIKE '%once%daily%' OR m.frequency ILIKE '%1%day%' THEN 30
            WHEN m.frequency ILIKE '%twice%daily%' OR m.frequency ILIKE '%2%day%' THEN 60
            WHEN m.frequency ILIKE '%three%daily%' OR m.frequency ILIKE '%3%day%' THEN 90
            WHEN m.frequency ILIKE '%four%daily%' OR m.frequency ILIKE '%4%day%' THEN 120
            WHEN m.frequency ILIKE '%every%other%day%' THEN 15
            WHEN m.frequency ILIKE '%weekly%' OR m.frequency ILIKE '%week%' THEN 4
            ELSE 30
        END as quantity_needed,
        COALESCE(mi.pharmacy_info->>'name', 'Unknown Pharmacy') as pharmacy_name,
        COALESCE(mi.pharmacy_info->>'phone', 'N/A') as pharmacy_phone,
        COALESCE(mi.pharmacy_info->>'prescription_number', 'N/A') as prescription_number,
        COALESCE((mi.pharmacy_info->>'estimated_cost')::NUMERIC, 0.00) as estimated_cost,
        CASE 
            WHEN mi.current_quantity <= 3 THEN 1
            WHEN mi.current_quantity <= 7 THEN 2
            WHEN mi.current_quantity <= 14 THEN 3
            ELSE 4
        END as order_priority
    FROM public.medications m
    LEFT JOIN public.medication_inventory mi ON m.id = mi.medication_id
    WHERE m.user_id = p_user_id
    AND m.is_active = true
    AND (
        mi.current_quantity IS NULL OR
        CASE 
            WHEN mi.current_quantity IS NULL THEN 'UNKNOWN'
            WHEN mi.current_quantity <= 3 THEN 'CRITICAL'
            WHEN mi.current_quantity <= 7 THEN 'HIGH'
            WHEN mi.current_quantity <= 14 THEN 'MEDIUM'
            ELSE 'LOW'
        END = ANY(p_urgency_levels)
    )
    ORDER BY order_priority, m.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INTEGRATION HELPERS
-- =====================================================

-- 7. Export data for external systems (EMR, pharmacy, etc.)
CREATE OR REPLACE FUNCTION public.export_medication_data(
    p_user_id UUID,
    p_format TEXT DEFAULT 'json',
    p_include_history BOOLEAN DEFAULT true
)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
    medication_data JSONB;
BEGIN
    -- Build comprehensive medication data
    SELECT jsonb_build_object(
        'patient_id', p_user_id,
        'export_timestamp', NOW(),
        'active_medications', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'name', m.name,
                    'dosage', m.dosage,
                    'frequency', m.frequency,
                    'food_timing', m.food_timing,
                    'start_date', m.start_date,
                    'end_date', m.end_date,
                    'prescribing_doctor', m.prescribing_doctor,
                    'current_adherence_rate', (
                        SELECT ROUND(
                            (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
                        )
                        FROM public.adherence_logs al
                        WHERE al.medication_id = m.id
                        AND al.scheduled_time >= CURRENT_DATE - INTERVAL '30 days'
                    )
                )
            )
            FROM public.medications m
            WHERE m.user_id = p_user_id AND m.is_active = true
        ),
        'adherence_history', CASE 
            WHEN p_include_history THEN (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'medication_name', m.name,
                        'scheduled_time', al.scheduled_time,
                        'actual_time', al.actual_time,
                        'status', al.status,
                        'notes', al.notes
                    )
                )
                FROM public.adherence_logs al
                JOIN public.medications m ON al.medication_id = m.id
                WHERE al.user_id = p_user_id
                AND al.scheduled_time >= CURRENT_DATE - INTERVAL '90 days'
                ORDER BY al.scheduled_time DESC
            )
            ELSE NULL
        END,
        'prescription_history', CASE 
            WHEN p_include_history THEN (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'processed_at', p.created_at,
                        'status', p.status,
                        'medications_extracted', p.processed_data->'medications'
                    )
                )
                FROM public.prescriptions p
                WHERE p.user_id = p_user_id
                ORDER BY p.created_at DESC
                LIMIT 10
            )
            ELSE NULL
        END
    ) INTO medication_data;
    
    -- Format output based on requested format
    CASE p_format
        WHEN 'json' THEN
            result := medication_data::TEXT;
        WHEN 'csv' THEN
            -- Simple CSV format for medications
            result := 'Medication Name,Dosage,Frequency,Food Timing,Adherence Rate' || E'\n';
            result := result || (
                SELECT string_agg(
                    m.name || ',' || 
                    m.dosage || ',' || 
                    m.frequency || ',' || 
                    m.food_timing || ',' ||
                    COALESCE((
                        SELECT ROUND(
                            (COUNT(*) FILTER (WHERE al.status = 'taken')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2
                        )::TEXT
                        FROM public.adherence_logs al
                        WHERE al.medication_id = m.id
                        AND al.scheduled_time >= CURRENT_DATE - INTERVAL '30 days'
                    ), '0'),
                    E'\n'
                )
                FROM public.medications m
                WHERE m.user_id = p_user_id AND m.is_active = true
            );
        ELSE
            result := medication_data::TEXT;
    END CASE;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for new tables
ALTER TABLE public.dosage_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own dosage adjustments" ON public.dosage_adjustments
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own medication inventory" ON public.medication_inventory
    FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dosage_adjustments_user_medication ON public.dosage_adjustments(user_id, medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_inventory_user_medication ON public.medication_inventory(user_id, medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_inventory_refill_urgency ON public.medication_inventory(user_id, current_quantity) WHERE current_quantity <= 14;