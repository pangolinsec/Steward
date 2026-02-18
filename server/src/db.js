const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.ALMANAC_DATA_DIR || path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'almanac.db');
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
  `);
}

initialize();

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
};

module.exports = db;
