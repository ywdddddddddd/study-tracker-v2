-- 在 Supabase Dashboard → SQL Editor 中粘贴执行

-- 1. profiles
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  height NUMERIC NOT NULL DEFAULT 183,
  weight NUMERIC NOT NULL DEFAULT 84,
  age INTEGER NOT NULL DEFAULT 23,
  gender TEXT NOT NULL DEFAULT 'male',
  target_weight NUMERIC NOT NULL DEFAULT 70,
  target_body_fat NUMERIC NOT NULL DEFAULT 8,
  target_date TEXT NOT NULL DEFAULT '2026-08-01'
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- 2. weight_records
CREATE TABLE IF NOT EXISTS weight_records (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  body_fat NUMERIC,
  note TEXT
);
ALTER TABLE weight_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON weight_records FOR ALL USING (true) WITH CHECK (true);

-- 3. daily_plans
CREATE TABLE IF NOT EXISTS daily_plans (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  tasks JSONB NOT NULL DEFAULT '[]',
  conquered TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT '',
  adjust TEXT NOT NULL DEFAULT '',
  completion TEXT NOT NULL DEFAULT '',
  total_focus_minutes INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON daily_plans FOR ALL USING (true) WITH CHECK (true);

-- 4. weekly_reviews
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id SERIAL PRIMARY KEY,
  week_start TEXT NOT NULL,
  time_hole TEXT NOT NULL DEFAULT '',
  focus_hours NUMERIC NOT NULL DEFAULT 0,
  budget_dental NUMERIC NOT NULL DEFAULT 0,
  budget_english NUMERIC NOT NULL DEFAULT 0,
  budget_review NUMERIC NOT NULL DEFAULT 0,
  budget_sport NUMERIC NOT NULL DEFAULT 0,
  goals TEXT NOT NULL DEFAULT '',
  adjust TEXT NOT NULL DEFAULT ''
);
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON weekly_reviews FOR ALL USING (true) WITH CHECK (true);

-- 5. food_entries
CREATE TABLE IF NOT EXISTS food_entries (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  meal TEXT NOT NULL,
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  calories NUMERIC NOT NULL,
  protein NUMERIC NOT NULL,
  carbs NUMERIC NOT NULL,
  fat NUMERIC NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON food_entries FOR ALL USING (true) WITH CHECK (true);

-- 6. workout_logs
CREATE TABLE IF NOT EXISTS workout_logs (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  exercises JSONB NOT NULL DEFAULT '[]',
  duration INTEGER NOT NULL DEFAULT 60,
  notes TEXT NOT NULL DEFAULT ''
);
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON workout_logs FOR ALL USING (true) WITH CHECK (true);

-- 7. ai_conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON ai_conversations FOR ALL USING (true) WITH CHECK (true);

-- 8. sleep_records
CREATE TABLE IF NOT EXISTS sleep_records (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  bed_time TEXT NOT NULL,
  wake_time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  quality INTEGER NOT NULL,
  note TEXT
);
ALTER TABLE sleep_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON sleep_records FOR ALL USING (true) WITH CHECK (true);

-- 9. custom_foods (用户可编辑的食物库)
CREATE TABLE IF NOT EXISTS custom_foods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL,
  grams_per_unit NUMERIC NOT NULL,
  calories NUMERIC NOT NULL,
  protein NUMERIC NOT NULL,
  carbs NUMERIC NOT NULL,
  fat NUMERIC NOT NULL,
  category TEXT NOT NULL
);
ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON custom_foods FOR ALL USING (true) WITH CHECK (true);

-- 10. custom_schedules (用户可编辑的学习计划)
CREATE TABLE IF NOT EXISTS custom_schedules (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  weekday TEXT NOT NULL,
  gym TEXT NOT NULL,
  tasks JSONB NOT NULL DEFAULT '[]'
);
ALTER TABLE custom_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON custom_schedules FOR ALL USING (true) WITH CHECK (true);

-- 11. Add task_goals and progress_goals columns to weekly_reviews
ALTER TABLE weekly_reviews ADD COLUMN IF NOT EXISTS task_goals TEXT DEFAULT '';
ALTER TABLE weekly_reviews ADD COLUMN IF NOT EXISTS progress_goals TEXT DEFAULT '';
