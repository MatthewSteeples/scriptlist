CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  raw_row_count INTEGER,
  prescribed_item_count INTEGER,
  practice_count INTEGER,
  bnf_item_count INTEGER,
  period_count INTEGER,
  error_summary TEXT
);

CREATE TABLE IF NOT EXISTS prescribed_items (
  import_run_id TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  practice_code TEXT NOT NULL,
  bnf_code TEXT NOT NULL,
  bnf_description TEXT NOT NULL,
  items INTEGER NOT NULL,
  nic_pence INTEGER NOT NULL,
  actual_cost_pence INTEGER NOT NULL,
  quantity REAL NOT NULL,
  total_quantity REAL NOT NULL,
  period_end_date TEXT NOT NULL,
  data_originator TEXT NOT NULL,
  PRIMARY KEY (import_run_id, row_number)
);

CREATE INDEX IF NOT EXISTS idx_prescribed_items_bnf_code ON prescribed_items (bnf_code);
CREATE INDEX IF NOT EXISTS idx_prescribed_items_period_end_date ON prescribed_items (period_end_date);
CREATE INDEX IF NOT EXISTS idx_prescribed_items_practice_code ON prescribed_items (practice_code);

CREATE TABLE IF NOT EXISTS practices (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  addr1 TEXT NOT NULL,
  addr2 TEXT NOT NULL,
  addr3 TEXT NOT NULL,
  addr4 TEXT NOT NULL,
  addr5 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bnf_items (
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (code, name)
);

CREATE TABLE IF NOT EXISTS periods (
  period_end_date TEXT PRIMARY KEY,
  data_originator TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_run_id TEXT NOT NULL,
  row_number INTEGER,
  message TEXT NOT NULL,
  raw_row TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
