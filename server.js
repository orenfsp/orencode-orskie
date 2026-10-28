require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDb, db } = require('./db');
const { seed } = require('./db/seed');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET не задан. Скопируйте .env.example в .env и укажите секрет.');
}

initDb();
seed();

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
if (process.env.NODE_ENV !== 'production') app.use(cors());

/* Ограничение перебора паролей и спама регистраций. В тестах отключено. */
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'слишком много попыток, попробуйте позже' } },
  }));

  app.use('/api/auth/register', rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'слишком много регистраций с этого IP' } },
  }));
}

app.use('/uploads', express.static('uploads'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/competitions', require('./routes/competitions'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/coach-athlete', require('./routes/coachAthlete'));
app.use('/api/results', require('./routes/results'));
app.use('/api/judges', require('./routes/judges'));
app.use('/api/ranks', require('./routes/ranks'));
app.use('/api/registry', require('./routes/registry'));
app.use('/api/rating', require('./routes/rating'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (req, res) => res.send('ok'));

app.get('/api/debug/db', (req, res) => {
  const count = (name) => db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get().c;
  res.json({
    users: count('users'),
    userRoles: count('user_roles'),
    disciplines: count('disciplines'),
    competitions: count('competitions'),
    results: count('results'),
    applications: count('applications'),
    notifications: count('notifications'),
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'метод API не найден' } });
});

app.use(express.static('public'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL';
  const message = status === 500 ? 'Внутренняя ошибка сервера' : err.message;
  if (status === 500) console.error(err);

  const body = { error: { code, message } };
  if (err.fields) body.error.fields = err.fields;
  res.status(status).json(body);
});

function start(port) {
  require('./workers');
  const listenPort = port || process.env.PORT || 3000;
  return app.listen(listenPort, () => console.log(`http://localhost:${listenPort}`));
}

if (require.main === module) {
  start();

  process.on('SIGINT', () => {
    console.log('закрываю БД...');
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
  });
}

module.exports = { app, start };
