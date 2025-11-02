-- Add member_user_id column to care_circle_members table
-- This allows inviting users by their Clerk user ID

ALTER TABLE public.care_circle_members 
ADD COLUMN IF NOT EXISTS member_user_id TEXT;

-- Add index for better performance when querying by user ID
CREATE INDEX IF NOT EXISTS idx_care_circle_member_user_id 
ON public.care_circle_members(member_user_id);

-- Update the unique constraint to include member_user_id
-- First drop the existing constraint
ALTER TABLE public.care_circle_members 
DROP CONSTRAINT IF EXISTS care_circle_members_patient_id_member_email_key;

-- Add a new constraint that allows either email or user_id to be unique per patient
-- This ensures we don't have duplicate invitations for the same person
CREATE UNIQUE INDEX IF NOT EXISTS idx_care_circle_unique_member 
ON public.care_circle_members(patient_id, COALESCE(member_user_id, member_email));

-- Add a check constraint to ensure either email or user_id is provided
ALTER TABLE public.care_circle_members 
ADD CONSTRAINT check_member_identifier 
CHECK (
    (member_email IS NOT NULL AND member_email != '') OR 
    (member_user_id IS NOT NULL AND member_user_id != '')
);