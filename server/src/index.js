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
const sessionLogRouter = require('./routes/sessionLog');
const exportImportRouter = require('./routes/exportImport');

app.use('/api/campaigns', campaignsRouter);
app.use('/api/campaigns/:id/characters', charactersRouter);
app.use('/api/campaigns/:id/status-effects', statusEffectsRouter);
app.use('/api/campaigns/:id/items', itemsRouter);
app.use('/api/campaigns/:id/encounters', encountersRouter);
app.use('/api/campaigns/:id/environment', environmentRouter);
app.use('/api/campaigns/:id/session-log', sessionLogRouter);
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
