const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
const campaignsRouter = require('./routes/campaigns');
const charactersRouter = require('./routes/characters');
const statusEffectsRouter = require('./routes/statusEffects');
const itemsRouter = require('./routes/items');
const encountersRouter = require('./routes/encounters');
const environmentRouter = require('./routes/environment');
const locationsRouter = require('./routes/locations');
const sessionLogRouter = require('./routes/sessionLog');
const rulesRouter = require('./routes/rules');
const notificationsRouter = require('./routes/notifications');
const restRouter = require('./routes/rest');
const journalRouter = require('./routes/journal');
const combatRouter = require('./routes/combat');
const randomTablesRouter = require('./routes/randomTables');
const exportImportRouter = require('./routes/exportImport');

app.use('/api/campaigns', campaignsRouter);
app.use('/api/campaigns/:id/characters', charactersRouter);
app.use('/api/campaigns/:id/status-effects', statusEffectsRouter);
app.use('/api/campaigns/:id/items', itemsRouter);
app.use('/api/campaigns/:id/encounters', encountersRouter);
app.use('/api/campaigns/:id/environment', environmentRouter);
app.use('/api/campaigns/:id/locations', locationsRouter);
app.use('/api/campaigns/:id/session-log', sessionLogRouter);
app.use('/api/campaigns/:id/rules', rulesRouter);
app.use('/api/campaigns/:id/notifications', notificationsRouter);
app.use('/api/campaigns/:id/rest', restRouter);
app.use('/api/campaigns/:id/journal', journalRouter);
app.use('/api/campaigns/:id/combat', combatRouter);
app.use('/api/campaigns/:id/random-tables', randomTablesRouter);
app.use('/api/campaigns/:id', exportImportRouter);

// Serve static frontend in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Almanac server running on http://localhost:${PORT}`);
});
