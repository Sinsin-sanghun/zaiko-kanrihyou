-- ===================================================
-- 在庫管理システム Supabase マイグレーション
-- ===================================================

-- 1. 拠点テーブル
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sheet_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 在庫品目テーブル
CREATE TABLE inventory_items (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_no TEXT,
  product_name TEXT NOT NULL,
  owner TEXT,
  supplier TEXT,
  location_detail TEXT,
  model TEXT,
  manufacturer TEXT,
  quantity NUMERIC DEFAULT 0,
  unit TEXT,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 日次棚卸記録テーブル
CREATE TABLE daily_counts (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  count_date DATE NOT NULL,
  count_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, count_date)
);

-- 4. インデックス
CREATE INDEX idx_inventory_location ON inventory_items(location_id);
CREATE INDEX idx_daily_counts_item ON daily_counts(item_id);
CREATE INDEX idx_daily_counts_date ON daily_counts(count_date);

-- 5. updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inventory_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. RLS (Row Level Security) ポリシー
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read locations"
  ON locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage locations"
  ON locations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read items"
  ON inventory_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage items"
  ON inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read daily_counts"
  ON daily_counts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage daily_counts"
  ON daily_counts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. 拠点の初期データ
INSERT INTO locations (name, sheet_name, description) VALUES
  ('旧在庫管理表', '(旧)在庫管理表', '旧形式の在庫管理表（ケーブル中心）'),
  ('野田倉庫（金担当）', '野田倉庫棚卸(金担当分)', '野田倉庫 金担当分の棚卸'),
  ('旧シート', '旧シート', '旧形式の管理シート'),
  ('小倉営業所（金担当）', '小倉営業所(金担当分)', '小倉営業所 金担当分'),
  ('東京本社（金＆設計担当）', '26年03月東京本社(金＆設計担当分) ダブルチェック用', '東京本社 金＆設計担当分'),
  ('上和電機', '上和電機在庫', '上和電機保持在庫'),
  ('長沼現場', '長沼現場在庫', '長沼現場の在庫'),
  ('野田倉庫（ゆい・みゆ担当）', '野田倉庫棚卸(ゆい・みゆ担当分) ', '野田倉庫 ゆい・みゆ担当分の棚卸');
