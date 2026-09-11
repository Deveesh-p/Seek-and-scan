-- ============================================================================
-- SEEK & SCAN - DEDICATED ADMIN SUPABASE SQL SCRIPT
-- Paste and Run this in: Supabase Dashboard -> SQL Editor
-- Project URL: https://rwstjqfqouaviiepkzjz.supabase.co
-- ============================================================================

-- 1. Ensure UUID Extension is Enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Ensure Teams Table Exists & Has Admin / Access Code Columns
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    leader_name TEXT NOT NULL,
    members TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'team', -- 'team' or 'admin'
    avatar TEXT DEFAULT 'neon-wolf',
    access_code TEXT,                  -- Manual Access Code issued by Admin
    is_approved BOOLEAN DEFAULT FALSE, -- Must be approved to play
    is_disqualified BOOLEAN DEFAULT FALSE,
    disqualification_reason TEXT,
    disqualified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If table already existed without access_code or is_approved, add them safely
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='access_code') THEN
        ALTER TABLE teams ADD COLUMN access_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teams' AND column_name='is_approved') THEN
        ALTER TABLE teams ADD COLUMN is_approved BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Dedicated Admin Users & Master Credentials Table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Tournament Director',
    role TEXT NOT NULL DEFAULT 'superadmin',
    master_pin TEXT DEFAULT '9988',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Default Master Admin Account into admin_users & teams
INSERT INTO admin_users (email, password_hash, full_name, role, master_pin)
VALUES ('admin@seekandscan.com', 'admin123', 'Tournament Director', 'superadmin', '9988')
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash;

INSERT INTO teams (name, leader_name, members, email, password_hash, role, avatar, access_code, is_approved)
VALUES ('System Admin', 'Mission Director', 'HQ Staff', 'admin@seekandscan.com', 'admin123', 'admin', 'admin-shield', 'MASTER-OVERRIDE', true)
ON CONFLICT (email) DO UPDATE 
SET role = 'admin', is_approved = true;

-- 4. Rounds Table (The 3 Game Rounds)
CREATE TABLE IF NOT EXISTS rounds (
    id SERIAL PRIMARY KEY,
    round_number INT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    qr_code_key TEXT NOT NULL UNIQUE,
    unlock_code TEXT NOT NULL,       -- Passcode entered to unlock next round
    location_clue TEXT NOT NULL,     -- Clue revealed after solving 5 questions
    location_name TEXT               -- Physical spot (e.g. "Library 2nd Floor")
);

-- 5. Questions Table (5 Questions per Round, NO Hints to avoid spoilers)
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    round_id INT REFERENCES rounds(id) ON DELETE CASCADE,
    order_index INT NOT NULL, -- 1 to 5
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL, -- 'A', 'B', 'C', or 'D'
    points INT DEFAULT 20
);

-- 6. Team Progress Table
CREATE TABLE IF NOT EXISTS team_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE UNIQUE,
    current_round INT DEFAULT 1,
    questions_solved INT DEFAULT 0,
    score INT DEFAULT 0,
    round_1_completed BOOLEAN DEFAULT FALSE,
    round_2_completed BOOLEAN DEFAULT FALSE,
    round_3_completed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    elapsed_seconds INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Anti-Cheat Violation Logs (Tab switches, Circle-to-Search, etc.)
CREATE TABLE IF NOT EXISTS cheat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL,
    round_number INT NOT NULL,
    question_index INT,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Enable Row Level Security (RLS) Policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheat_logs ENABLE ROW LEVEL SECURITY;

-- Permissive public policies for tournament flow
DROP POLICY IF EXISTS "Public Read Rounds" ON rounds;
CREATE POLICY "Public Read Rounds" ON rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Questions" ON questions;
CREATE POLICY "Public Read Questions" ON questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Teams" ON teams;
CREATE POLICY "Public Read Teams" ON teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Teams" ON teams;
CREATE POLICY "Public Insert Teams" ON teams FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Teams" ON teams;
CREATE POLICY "Public Update Teams" ON teams FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Read Progress" ON team_progress;
CREATE POLICY "Public Read Progress" ON team_progress FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Upsert Progress" ON team_progress;
CREATE POLICY "Public Upsert Progress" ON team_progress FOR ALL USING (true);

DROP POLICY IF EXISTS "Public Insert Cheat Logs" ON cheat_logs;
CREATE POLICY "Public Insert Cheat Logs" ON cheat_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Cheat Logs" ON cheat_logs;
CREATE POLICY "Public Read Cheat Logs" ON cheat_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Read Admin Users" ON admin_users;
CREATE POLICY "Admin Read Admin Users" ON admin_users FOR SELECT USING (true);

-- 9. Real-Time Publication for Live Dashboard (Safe Check)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teams'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE teams;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_progress'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE team_progress;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cheat_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE cheat_logs;
    END IF;
EXCEPTION 
    WHEN duplicate_object THEN 
        NULL; -- Ignore if already a member
    WHEN OTHERS THEN 
        NULL;
END $$;

-- 10. Convenient Admin Overview View (Useful inside Supabase Table Viewer)
CREATE OR REPLACE VIEW admin_teams_overview AS
SELECT 
    t.id AS team_id,
    t.name AS team_name,
    t.leader_name,
    t.members,
    t.email,
    t.access_code,
    t.is_approved,
    t.is_disqualified,
    t.disqualification_reason,
    COALESCE(p.current_round, 1) AS current_round,
    COALESCE(p.score, 0) AS score,
    COALESCE(p.elapsed_seconds, 0) AS elapsed_seconds,
    t.created_at AS registered_at
FROM teams t
LEFT JOIN team_progress p ON t.id = p.team_id
WHERE t.role != 'admin'
ORDER BY t.created_at DESC;

-- 11. Initial Seed Data for the 3 Rounds (If empty)
INSERT INTO rounds (round_number, title, description, qr_code_key, unlock_code, location_clue, location_name)
VALUES 
(1, 'Round 1: Cyber Perimeter', 'Scan Station QR #1 to access the 5 security perimeter challenges.', 'SEEK_SCAN_STATION_1_ALPHA', 'CYBER-9081', '🔍 CLUE TO NEXT QR: Head to the Ground Floor Cafeteria. Look underneath the blue recycling bin near the beverage vending machine!', 'Main Courtyard Statue'),
(2, 'Round 2: Cryptographic Maze', 'Scan Station QR #2 to unlock the algorithmic and code analysis cipher.', 'SEEK_SCAN_STATION_2_BETA', 'CIPHER-4720', '🔍 CLUE TO NEXT QR: Ascend to the 3rd Floor Library. Find the Wooden Study Cubicle #14 next to the Computer Science rack!', 'Ground Floor Cafeteria'),
(3, 'Round 3: The Core Firewall', 'The final showdown! Scan Station QR #3 to crack the core firewall.', 'SEEK_SCAN_STATION_3_OMEGA', 'VICTORY-777', '🏆 ALL 3 STATIONS SOLVED! Rush back to the Control Desk in the Auditorium to claim your leaderboard ranking!', '3rd Floor Library Cubicle')
ON CONFLICT (round_number) DO NOTHING;

-- Initial Seed Questions (NO hints/spoilers)
INSERT INTO questions (round_id, order_index, question_text, option_a, option_b, option_c, option_d, correct_option, points)
SELECT r.id, 1, 'Which protocol is used to secure web traffic using SSL/TLS encryption?', 'HTTP', 'HTTPS', 'FTP', 'SMTP', 'B', 20 
FROM rounds r 
WHERE r.round_number = 1 AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.round_id = r.id AND q.order_index = 1);

INSERT INTO questions (round_id, order_index, question_text, option_a, option_b, option_c, option_d, correct_option, points)
SELECT r.id, 2, 'What does the abbreviation "SQL" stand for in database architecture?', 'Structured Query Language', 'Simple Query Logic', 'Sequential Queue Link', 'System Quantitative Level', 'A', 20 
FROM rounds r 
WHERE r.round_number = 1 AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.round_id = r.id AND q.order_index = 2);

INSERT INTO questions (round_id, order_index, question_text, option_a, option_b, option_c, option_d, correct_option, points)
SELECT r.id, 3, 'In computer science, what is the time complexity of binary search on a sorted array of size N?', 'O(N)', 'O(1)', 'O(log N)', 'O(N^2)', 'C', 20 
FROM rounds r 
WHERE r.round_number = 1 AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.round_id = r.id AND q.order_index = 3);

INSERT INTO questions (round_id, order_index, question_text, option_a, option_b, option_c, option_d, correct_option, points)
SELECT r.id, 4, 'Which HTTP status code signifies that a requested resource was not found?', '200', '301', '404', '500', 'C', 20 
FROM rounds r 
WHERE r.round_number = 1 AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.round_id = r.id AND q.order_index = 4);

INSERT INTO questions (round_id, order_index, question_text, option_a, option_b, option_c, option_d, correct_option, points)
SELECT r.id, 5, 'What is the primary function of a DNS server on the internet?', 'Translating domain names into IP addresses', 'Encrypting email payloads', 'Hosting frontend files', 'Allocating MAC addresses', 'A', 20 
FROM rounds r 
WHERE r.round_number = 1 AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.round_id = r.id AND q.order_index = 5);

-- Sample Pre-approved Demo Teams
INSERT INTO teams (name, leader_name, members, email, password_hash, role, avatar, access_code, is_approved)
VALUES 
('Neon Phantoms', 'Alex Chen', 'Alex Chen, Maya Patel, Liam Scott', 'phantoms@cyber.hunt', 'pass', 'team', 'neon-wolf', 'SEEK-1001', true),
('Binary Hunters', 'Sarah Jenkins', 'Sarah J., David K.', 'hunters@cyber.hunt', 'pass', 'team', 'cyber-tiger', 'SEEK-1002', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- USEFUL ADMIN MAINTENANCE QUERIES (RUN AS NEEDED)
-- ============================================================================

-- A. View All Teams & Their Access Codes:
-- SELECT * FROM admin_teams_overview;

-- B. Manually Approve a Team:
-- UPDATE teams SET is_approved = true WHERE name = 'Team Name Here';

-- C. Manually Assign an Access Code:
-- UPDATE teams SET access_code = 'SEEK-9999' WHERE name = 'Team Name Here';

-- D. Reinstate a Disqualified Team:
-- UPDATE teams SET is_disqualified = false, disqualification_reason = NULL WHERE name = 'Team Name Here';

-- E. Wipe Test Teams (Keeps Admin & Rounds):
-- DELETE FROM teams WHERE role != 'admin';
