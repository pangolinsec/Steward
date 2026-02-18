const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.STEWARD_DATA_DIR || path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'steward.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      attribute_definitions TEXT DEFAULT '[]',
      time_of_day_thresholds TEXT DEFAULT '${JSON.stringify([
        { label: "Night", start: 0 },
        { label: "Dawn", start: 5 },
        { label: "Morning", start: 7 },
        { label: "Afternoon", start: 12 },
        { label: "Dusk", start: 17 },
        { label: "Evening", start: 19 },
        { label: "Night", start: 21 }
      ])}',
      calendar_config TEXT DEFAULT '${JSON.stringify({
        months: [
          { name: "January", days: 31 },
          { name: "February", days: 28 },
          { name: "March", days: 31 },
          { name: "April", days: 30 },
          { name: "May", days: 31 },
          { name: "June", days: 30 },
          { name: "July", days: 31 },
          { name: "August", days: 31 },
          { name: "September", days: 30 },
          { name: "October", days: 31 },
          { name: "November", days: 30 },
          { name: "December", days: 31 }
        ],
        weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      })}',
      weather_options TEXT DEFAULT '${JSON.stringify(["Clear", "Overcast", "Rain", "Heavy Rain", "Snow", "Fog", "Storm", "Windy", "Hail"])}'
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('PC', 'NPC')),
      description TEXT DEFAULT '',
      portrait_url TEXT DEFAULT '',
      base_attributes TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS status_effect_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      modifiers TEXT DEFAULT '[]',
      duration_type TEXT DEFAULT 'indefinite' CHECK(duration_type IN ('indefinite', 'timed', 'rounds')),
      duration_value INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS item_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      item_type TEXT DEFAULT 'misc',
      properties TEXT DEFAULT '{}',
      stackable INTEGER DEFAULT 0,
      modifiers TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS encounter_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      npcs TEXT DEFAULT '[]',
      environment_overrides TEXT DEFAULT '{}',
      loot_table TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS applied_effects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      status_effect_definition_id INTEGER NOT NULL REFERENCES status_effect_definitions(id) ON DELETE CASCADE,
      applied_at TEXT DEFAULT (datetime('now')),
      remaining_rounds INTEGER,
      remaining_hours REAL
    );

    CREATE TABLE IF NOT EXISTS character_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      item_definition_id INTEGER NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
      quantity INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS environment_state (
      campaign_id INTEGER PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
      current_hour INTEGER DEFAULT 12,
      current_minute INTEGER DEFAULT 0,
      current_day INTEGER DEFAULT 1,
      current_month INTEGER DEFAULT 1,
      current_year INTEGER DEFAULT 1,
      weather TEXT DEFAULT 'Clear',
      environment_notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      parent_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      weather_override TEXT DEFAULT NULL,
      encounter_modifier REAL DEFAULT 1.0,
      properties TEXT DEFAULT '{}',
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS location_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      from_location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      to_location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      label TEXT DEFAULT '',
      travel_hours REAL DEFAULT 1.0,
      bidirectional INTEGER DEFAULT 1,
      encounter_modifier REAL DEFAULT 1.0,
      properties TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS session_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      timestamp TEXT DEFAULT (datetime('now')),
      entry_type TEXT DEFAULT 'general',
      message TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_status_effects_campaign ON status_effect_definitions(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_items_campaign ON item_definitions(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_encounters_campaign ON encounter_definitions(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_applied_effects_character ON applied_effects(character_id);
    CREATE INDEX IF NOT EXISTS idx_character_items_character ON character_items(character_id);
    CREATE INDEX IF NOT EXISTS idx_session_log_campaign ON session_log(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_locations_campaign ON locations(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_location_edges_campaign ON location_edges(campaign_id);

    CREATE TABLE IF NOT EXISTS rule_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT DEFAULT '{}',
      conditions TEXT DEFAULT '{"all":[]}',
      actions TEXT DEFAULT '[]',
      action_mode TEXT DEFAULT 'auto',
      priority INTEGER DEFAULT 100,
      tags TEXT DEFAULT '[]',
      target_mode TEXT DEFAULT 'environment',
      target_config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rule_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER REFERENCES rule_definitions(id) ON DELETE CASCADE,
      character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
      state_key TEXT NOT NULL,
      state_value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rule_action_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      rule_id INTEGER REFERENCES rule_definitions(id) ON DELETE SET NULL,
      rule_name TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      action_index INTEGER DEFAULT 0,
      action_type TEXT NOT NULL,
      action_params TEXT DEFAULT '{}',
      target_character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
      target_character_name TEXT DEFAULT '',
      undo_data TEXT DEFAULT '{}',
      applied_at TEXT DEFAULT (datetime('now')),
      undone INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      batch_id TEXT,
      rule_id INTEGER REFERENCES rule_definitions(id) ON DELETE SET NULL,
      rule_name TEXT DEFAULT '',
      notification_type TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      target_character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
      target_character_name TEXT DEFAULT '',
      actions_data TEXT DEFAULT '[]',
      read INTEGER DEFAULT 0,
      dismissed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_rules_campaign ON rule_definitions(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_rules_trigger ON rule_definitions(trigger_type);
    CREATE INDEX IF NOT EXISTS idx_rule_state_rule ON rule_state(rule_id);
    CREATE INDEX IF NOT EXISTS idx_rule_action_log_campaign ON rule_action_log(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_rule_action_log_batch ON rule_action_log(batch_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_campaign ON notifications(campaign_id);

    CREATE TABLE IF NOT EXISTS random_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      table_type TEXT DEFAULT 'weighted',
      entries TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_random_tables_campaign ON random_tables(campaign_id);

    CREATE TABLE IF NOT EXISTS journal_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      tags TEXT DEFAULT '[]',
      starred INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_journal_notes_campaign ON journal_notes(campaign_id);

    CREATE TABLE IF NOT EXISTS session_preps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      status TEXT DEFAULT 'prep' CHECK(status IN ('prep', 'active', 'completed')),
      strong_start TEXT DEFAULT '',
      scenes TEXT DEFAULT '[]',
      secrets TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_session_preps_campaign ON session_preps(campaign_id);
  `);
}

initialize();

// Idempotent ALTER TABLE migrations for new columns
const migrations = [
  `ALTER TABLE environment_state ADD COLUMN current_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL`,
  `ALTER TABLE environment_state ADD COLUMN current_edge_id INTEGER REFERENCES location_edges(id) ON DELETE SET NULL`,
  `ALTER TABLE environment_state ADD COLUMN edge_progress REAL DEFAULT 0`,
  `ALTER TABLE environment_state ADD COLUMN last_encounter_at TEXT DEFAULT NULL`,
  `ALTER TABLE campaigns ADD COLUMN encounter_settings TEXT DEFAULT '{"enabled":false,"base_rate":0.1,"min_interval_hours":1}'`,
  `ALTER TABLE campaigns ADD COLUMN weather_volatility REAL DEFAULT 0.3`,
  `ALTER TABLE campaigns ADD COLUMN weather_transition_table TEXT DEFAULT NULL`,
  `ALTER TABLE encounter_definitions ADD COLUMN conditions TEXT DEFAULT '{}'`,
  `ALTER TABLE location_edges ADD COLUMN description TEXT DEFAULT ''`,
  `ALTER TABLE location_edges ADD COLUMN weather_override TEXT DEFAULT NULL`,
  `ALTER TABLE campaigns ADD COLUMN rules_settings TEXT DEFAULT '{"cascade_depth_limit":3,"engine_enabled":true}'`,
  `ALTER TABLE campaigns ADD COLUMN property_key_registry TEXT DEFAULT '[]'`,
  `ALTER TABLE campaigns ADD COLUMN season_options TEXT DEFAULT '["Spring","Summer","Autumn","Winter"]'`,
  `ALTER TABLE campaigns ADD COLUMN custom_tag_presets TEXT DEFAULT '[]'`,
  `ALTER TABLE campaigns ADD COLUMN dice_settings TEXT DEFAULT '{"log_rolls":false}'`,
  `ALTER TABLE environment_state ADD COLUMN combat_state TEXT DEFAULT NULL`,
  `ALTER TABLE characters ADD COLUMN dm_notes TEXT DEFAULT ''`,
  `ALTER TABLE characters ADD COLUMN max_attributes TEXT DEFAULT '{}'`,
  `ALTER TABLE session_log ADD COLUMN game_time TEXT DEFAULT NULL`,
  `ALTER TABLE encounter_definitions ADD COLUMN starts_combat INTEGER DEFAULT 0`,
  `ALTER TABLE characters ADD COLUMN spawned_from_encounter_id INTEGER DEFAULT NULL`,
  `ALTER TABLE characters ADD COLUMN archived INTEGER DEFAULT 0`,
  `ALTER TABLE campaigns ADD COLUMN time_advance_presets TEXT DEFAULT '${JSON.stringify([
    { label: "+10m", hours: 0, minutes: 10 },
    { label: "+1h", hours: 1, minutes: 0 },
    { label: "+8h", hours: 8, minutes: 0 },
  ])}'`,
  `ALTER TABLE campaigns ADD COLUMN dashboard_time_presets TEXT DEFAULT '${JSON.stringify([
    { label: "+15m", hours: 0, minutes: 15 },
    { label: "+1h", hours: 1, minutes: 0 },
    { label: "+4h", hours: 4, minutes: 0 },
  ])}'`,
  `ALTER TABLE rule_definitions ADD COLUMN last_triggered_at TEXT DEFAULT NULL`,
];

for (const sql of migrations) {
  try { db.exec(sql); } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
  }
}

// Auto-populate game_time on session_log inserts from environment_state
db.exec(`
  CREATE TRIGGER IF NOT EXISTS trg_session_log_game_time
  AFTER INSERT ON session_log
  WHEN NEW.game_time IS NULL
  BEGIN
    UPDATE session_log SET game_time = (
      SELECT printf('%04d-%02d-%02dT%02d:%02d', current_year, current_month, current_day, current_hour, current_minute)
      FROM environment_state WHERE campaign_id = NEW.campaign_id
    ) WHERE id = NEW.rowid;
  END;
`);

// Fix rule_state.rule_id to be nullable (for general state like last_rest_time)
try {
  const info = db.pragma('table_info(rule_state)');
  const ruleIdCol = info.find(c => c.name === 'rule_id');
  if (ruleIdCol && ruleIdCol.notnull === 1) {
    db.exec(`
      CREATE TABLE rule_state_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER REFERENCES rule_definitions(id) ON DELETE CASCADE,
        character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
        state_key TEXT NOT NULL,
        state_value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO rule_state_new SELECT * FROM rule_state;
      DROP TABLE rule_state;
      ALTER TABLE rule_state_new RENAME TO rule_state;
      CREATE INDEX IF NOT EXISTS idx_rule_state_rule ON rule_state(rule_id);
    `);
  }
} catch (e) { /* table doesn't exist yet, will be created by initialize */ }

db.CAMPAIGN_DEFAULTS = {
  time_of_day_thresholds: [
    { label: "Night", start: 0 },
    { label: "Dawn", start: 5 },
    { label: "Morning", start: 7 },
    { label: "Afternoon", start: 12 },
    { label: "Dusk", start: 17 },
    { label: "Evening", start: 19 },
    { label: "Night", start: 21 },
  ],
  calendar_config: {
    months: [
      { name: "January", days: 31 },
      { name: "February", days: 28 },
      { name: "March", days: 31 },
      { name: "April", days: 30 },
      { name: "May", days: 31 },
      { name: "June", days: 30 },
      { name: "July", days: 31 },
      { name: "August", days: 31 },
      { name: "September", days: 30 },
      { name: "October", days: 31 },
      { name: "November", days: 30 },
      { name: "December", days: 31 },
    ],
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  },
  weather_options: ["Clear", "Overcast", "Rain", "Heavy Rain", "Snow", "Fog", "Storm", "Windy", "Hail"],
  encounter_settings: { enabled: false, base_rate: 0.1, min_interval_hours: 1 },
  weather_volatility: 0.3,
  weather_transition_table: null,
};

module.exports = db;
