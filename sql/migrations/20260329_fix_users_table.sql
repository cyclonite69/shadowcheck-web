-- Migration: Fix missing columns in users table
-- Date: 2026-03-29

BEGIN;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'app' AND table_name = 'users' 
                   AND column_name = 'force_password_change') THEN
        ALTER TABLE app.users ADD COLUMN force_password_change boolean DEFAULT false;
    END IF;
END $$;

COMMIT;
