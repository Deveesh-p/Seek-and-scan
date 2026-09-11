-- ============================================================================
-- SEEK & SCAN - COMPLETE SUPABASE POSTGRESQL SCHEMA
-- Run this in your Supabase Project -> SQL Editor
-- ============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Clean Up Existing Tables (if re-running)
DROP TABLE IF EXISTS cheat_logs CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS team_progress CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS rounds CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- 3. Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    leader_name TEXT NOT NULL,
    members TEXT NOT NULL, -- Comma-separated or JSON list of member names
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, -- Stored hash or token
    role TEXT NOT NULL DEFAULT 'team', -- 'team' or 'admin'
    avatar TEXT DEFAULT 'neon-wolf',
    access_code TEXT, -- Unique code provided manually by Admin to team
    is_approved BOOLEAN DEFAULT FALSE, -- Approved by Admin to play
    is_disqualified BOOLEAN DEFAULT FALSE,
    disqualification_reason TEXT,
    disqualified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Rounds Table (The 3 Game Rounds)
CREATE TABLE rounds (
    id SERIAL PRIMARY KEY,
    round_number INT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    qr_code_key TEXT NOT NULL UNIQUE, -- The data encoded in the physical QR
    unlock_code TEXT NOT NULL,       -- Passcode entered to unlock next round
    location_clue TEXT NOT NULL,     -- Clue revealed after solving 5 questions
    location_name TEXT               -- Physical spot (e.g., "Library 2nd Floor")
);

-- 5. Questions Table (5 Questions per Round)
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    round_id INT REFERENCES rounds(id) ON DELETE CASCADE,
    order_index INT NOT NULL, -- 1 to 5
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL, -- 'A', 'B', 'C', or 'D'
    points INT DEFAULT 20,
    hint TEXT
);

-- 6. Team Progress Table
CREATE TABLE team_progress (
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

-- 7. Submissions Table (Question answers audit)
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    selected_option CHAR(1) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Anti-Cheat Violation Logs (Tab switches, Circle-to-Search, etc.)
CREATE TABLE cheat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL, -- 'TAB_SWITCH', 'WINDOW_BLUR', 'CIRCLE_TO_SEARCH', 'FULLSCREEN_EXIT'
    round_number INT NOT NULL,
    question_index INT,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Rounds" ON rounds FOR SELECT USING (true);
CREATE POLICY "Public Read Questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Public Read Teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public Insert Teams" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Teams" ON teams FOR UPDATE USING (true);
CREATE POLICY "Public Read Progress" ON team_progress FOR SELECT USING (true);
CREATE POLICY "Public Upsert Progress" ON team_progress FOR ALL USING (true);
CREATE POLICY "Public Insert Submissions" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Read Submissions" ON submissions FOR SELECT USING (true);
CREATE POLICY "Public Insert Cheat Logs" ON cheat_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Read Cheat Logs" ON cheat_logs FOR SELECT USING (true);

-- Enable Realtime publication for live leaderboard
ALTER PUBLICATION supabase_realtime ADD TABLE team_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE cheat_logs;

-- ============================================================================
-- SEED DATA: 3 ROUNDS & 5 QUESTIONS EACH (15 QUESTIONS TOTAL)
-- ============================================================================

-- Round 1: Cyber Initiation
INSERT INTO rounds (round_number, title, description, qr_code_key, unlock_code, location_clue, location_name)
VALUES (
    1,
    'Round 1: Cyber Perimeter',
    'Scan Station QR #1 to access the 5 security perimeter challenges.',
    'SEEK_SCAN_STATION_1_ALPHA',
    'CYBER-9081',
    '🔍 CLUE TO NEXT QR: Head to the Ground Floor Cafeteria. Look underneath the blue recycling bin near the beverage vending machine!',
    'Main Courtyard Statue'
);

-- Round 2: Cryptographic Maze
INSERT INTO rounds (round_number, title, description, qr_code_key, unlock_code, location_clue, location_name)
VALUES (
    2,
    'Round 2: Cryptographic Maze',
    'Scan Station QR #2 to unlock the algorithmic and code analysis cipher.',
    'SEEK_SCAN_STATION_2_BETA',
    'CIPHER-4720',
    '🔍 CLUE TO NEXT QR: Ascend to the 3rd Floor Library. Find the Wooden Study Cubicle #14 next to the Computer Science rack!',
    'Ground Floor Cafeteria'
);

-- Round 3: The Core Firewall
INSERT INTO rounds (round_number, title, description, qr_code_key, unlock_code, location_clue, location_name)
VALUES (
    3,
    'Round 3: The Core Firewall',
    'The final showdown! Scan Station QR #3 to crack the core firewall.',
    'SEEK_SCAN_STATION_3_OMEGA',
    'VICTORY-777',
    '🏆 ALL 3 STATIONS SOLVED! Rush back to the Control Desk in the Auditorium to claim your leaderboard ranking!',
    '3rd Floor Library Cubicle'
);

-- 5 Questions for Round 1
INSERT INTO questions (round_id, order_index, question_text, option_a, option_b, option_c, option_d, correct_option, points, hint)
VALUES 
(1, 1, 'Which protocol is used to secure web traffic using SSL/TLS encryption?', 'HTTP', 'HTTPS', 'FTP', 'SMTP', 'B', 20, NULL),
(1, 2, 'What does the abbreviation "SQL" stand for in database architecture?', 'Structured Query Language', 'Simple Query Logic', 'Sequential Queue Link', 'System Quantitative Level', 'A', 20, NULL),
(1, 3, 'In computer science, what is the time complexity of binary search on a sorted array of size N?', 'O(N)', 'O(1)', 'O(log N)', 'O(N^2)', 'C', 20, NULL),
(1, 4, 'Which HTTP status code signifies that a requested resource was not found?', '200', '301', '404', '500', 'C', 20, NULL),
(1, 5, 'What is the primary function of a DNS server on the internet?', 'Translating domain names into IP addresses', 'Encrypting email payloads', 'Hosting frontend files', 'Allocating MAC addresses', 'A', 20, NULL);

-- 5 Questions for Round 2
INSERT INTO questions (round_id, order_index, question_text, option_a, option_b, option_c, option_d, correct_option, points, hint)
VALUES 
(2, 1, 'If the word "SEEK" is encoded using a Caesar cipher with a shift of +3, what is the resulting ciphertext?', 'VHHN', 'VHHL', 'THHL', 'WIIO', 'A', 20, NULL),
(2, 2, 'Which data structure operates strictly on a Last-In, First-Out (LIFO) order?', 'Queue', 'Stack', 'Linked List', 'Hash Map', 'B', 20, NULL),
(2, 3, 'In cryptography, which of the following is an asymmetric encryption algorithm?', 'AES', 'DES', 'RSA', 'Blowfish', 'C', 20, NULL),
(2, 4, 'What is the binary representation of the decimal number 25?', '11001', '10101', '11100', '10011', 'A', 20, NULL),
(2, 5, 'Which Git command is used to combine changes from one branch into another?', 'git fetch', 'git pull', 'git merge', 'git branch', 'C', 20, NULL);

-- 5 Questions for Round 3
INSERT INTO questions (round_id, order_index, question_text, option_a, option_b, option_c, option_d, correct_option, points, hint)
VALUES 
(3, 1, 'What cryptographic hash function produces a 256-bit (32-byte) message digest?', 'MD5', 'SHA-1', 'SHA-256', 'CRC32', 'C', 20, NULL),
(3, 2, 'Which network layer of the OSI model does a standard IP router primarily operate on?', 'Layer 2 (Data Link)', 'Layer 3 (Network)', 'Layer 4 (Transport)', 'Layer 7 (Application)', 'B', 20, NULL),
(3, 3, 'In distributed systems, what does the "P" in the CAP theorem represent?', 'Performance', 'Partition Tolerance', 'Persistence', 'Privacy', 'B', 20, NULL),
(3, 4, 'Which vulnerability occurs when an attacker executes malicious scripts in another user’s browser?', 'SQL Injection', 'Cross-Site Scripting (XSS)', 'Buffer Overflow', 'DNS Poisoning', 'B', 20, NULL),
(3, 5, 'What is the default port number used by HTTPS connections?', '80', '21', '443', '8080', 'C', 20, NULL);

-- Default Admin Account & Sample Teams
INSERT INTO teams (name, leader_name, members, email, password_hash, role, avatar, access_code, is_approved)
VALUES 
('System Admin', 'Mission Director', 'HQ Staff', 'admin@seekandscan.com', 'admin123', 'admin', 'admin-shield', 'MASTER-PASS', true),
('Neon Phantoms', 'Alex Chen', 'Alex Chen, Maya Patel, Liam Scott', 'phantoms@cyber.hunt', 'pass123', 'team', 'neon-wolf', 'SCAN-4091', true),
('Binary Hunters', 'Sarah Jenkins', 'Sarah J., David K.', 'hunters@cyber.hunt', 'pass123', 'team', 'cyber-tiger', 'SCAN-8824', true)
ON CONFLICT (email) DO NOTHING;

-- Initial Demo Leaderboard Progress
INSERT INTO team_progress (team_id, current_round, questions_solved, score, round_1_completed, round_2_completed, round_3_completed, elapsed_seconds)
SELECT id, 2, 5, 100, true, false, false, 340 FROM teams WHERE name = 'Neon Phantoms'
ON CONFLICT (team_id) DO NOTHING;

INSERT INTO team_progress (team_id, current_round, questions_solved, score, round_1_completed, round_2_completed, round_3_completed, elapsed_seconds)
SELECT id, 1, 3, 60, false, false, false, 180 FROM teams WHERE name = 'Binary Hunters'
ON CONFLICT (team_id) DO NOTHING;
