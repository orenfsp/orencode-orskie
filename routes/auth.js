const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const auth = require('../auth/checkAuth');
const {
  requireRole, badRequest, conflict, notFound, validationError,
} = require('../auth/permissions');
const {
  checkRegistration, checkRoleFields, checkProfile, checkReason, text,
} = require('../validation');
const {
  getUserRoles, getRoleDetails, addUserRole, isKnownRole,
} = require('../db/roles');
const { notify, notifyFederation } = require('../notifications');

const router = express.Router();

/* --- Вспомогательные функции -------------------------------------------- */

function normalizeDisciplines(value) {
  const list = Array.isArray(value) ? value : text(value) ? text(value).split(',') : [];
  return list.map((item) => Number(item)).filter((id) => Number.isInteger(id) && id > 0);
}

function splitDisciplines(value) {
  return String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function ensureReferences(fields, body) {
  if (body.organizationId !== undefined && body.organizationId !== null && body.organizationId !== '') {
    const organizationId = Number(body.organizationId);
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      fields.organizationId = 'Выберите организацию из списка';
    } else {
      const found = db.prepare('SELECT id FROM organizations WHERE id = ?').get(organizationId);
      if (!found) fields.organizationId = 'Организация не найдена';
    }
  }

  if (body.disciplines !== undefined) {
    normalizeDisciplines(body.disciplines).forEach((id) => {
      const found = db.prepare('SELECT id FROM disciplines WHERE id = ?').get(id);
      if (!found) fields.disciplines = 'Дисциплина не найдена';
    });
  }
}

function audit(userId, action, entity, entityId) {
  db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id) VALUES (?, ?, ?, ?)')
    .run(userId, action, entity, entityId);
}

function profilePayload(userId) {
  const row = db.prepare(`
    SELECT u.*, o.name AS organization_name
    FROM users u
    LEFT JOIN organizations o ON o.id = u.organization_id
    WHERE u.id = ?
  `).get(userId);

  if (!row) return null;

  return {
    id: row.id,
    login: row.login,
    fio: row.fio,
    email: row.email,
    phone: row.phone,
    consentPd: !!row.consent_pd,
    legalRepresentative: row.legal_representative,
    birthDate: row.birth_date,
    municipality: row.municipality,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    startYear: row.start_year,
    disciplines: splitDisciplines(row.disciplines),
    rankType: row.rank_type,
    rankUntil: row.rank_until,
    category: row.category,
    categoryUntil: row.category_until,
    rusadaDate: row.rusada_date,
    rusadaUrl: row.rusada_url,
  };
}

function sessionPayload(userId, activeRole) {
  const roles = getUserRoles(userId);
  const profile = profilePayload(userId);
  return {
    token: jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '24h' }),
    user: { id: userId, fio: profile.fio, login: profile.login },
    roles,
    roleDetails: getRoleDetails(userId),
    activeRole: activeRole && roles.indexOf(activeRole) !== -1 ? activeRole : roles[0] || null,
    profile,
  };
}

function federationRequest(userId) {
  return db.prepare(`
    SELECT id, status FROM requests
    WHERE user_id = ? AND type = 'federation'
    ORDER BY id DESC LIMIT 1
  `).get(userId);
}

/* --- Регистрация --------------------------------------------------------- */

router.post('/register', (req, res) => {
  const body = req.body || {};
  const fields = checkRegistration(body);

  const role = text(body.role);
  if (role && !isKnownRole(role)) fields.role = 'Недопустимая роль';
  if (role && role !== 'federation') {
    Object.assign(fields, checkRoleFields(role, body));
  }
  ensureReferences(fields, body);

  if (Object.keys(fields).length) throw validationError(fields);

  const existing = db.prepare('SELECT id FROM users WHERE login = ?').get(text(body.login));
  if (existing) throw conflict('логин уже занят');

  const isFederationRequest = role === 'federation';
  const hash = bcrypt.hashSync(String(body.password), 10);
  const disciplines = role === 'athlete' || role === 'coach' ? normalizeDisciplines(body.disciplines) : [];

  const info = db.prepare(`
    INSERT INTO users (
      login, password_hash, fio, roles, email, phone,
      consent_pd, legal_representative,
      birth_date, municipality, organization_id, start_year, disciplines
    ) VALUES (?, ?, ?, '', ?, ?, 1, ?, ?, ?, ?, ?, ?)
  `).run(
    text(body.login),
    hash,
    text(body.fio),
    text(body.email) || null,
    text(body.phone) || null,
    role === 'athlete' ? text(body.legalRepresentative) || null : null,
    role === 'athlete' ? text(body.birthDate) || null : null,
    role === 'athlete' ? text(body.municipality) || null : null,
    role === 'athlete' && body.organizationId ? Number(body.organizationId) : null,
    role === 'athlete' && body.startYear ? Number(body.startYear) : null,
    role === 'athlete' ? disciplines.join(',') : null
  );

  const userId = info.lastInsertRowid;

  if (isFederationRequest) {
    db.prepare(`
      INSERT INTO requests (type, user_id, requested_type, status)
      VALUES ('federation', ?, 'federation', 'pending')
    `).run(userId);
  } else {
    addUserRole(userId, role, {
      experienceYears: body.experienceYears === undefined || body.experienceYears === '' ? null : Number(body.experienceYears),
      judgeCategory: role === 'judge' ? text(body.judgeCategory) : null,
      disciplines: role === 'coach' || role === 'athlete' ? disciplines : null,
    });
  }

  audit(userId, 'register', 'user', userId);

  const payload = sessionPayload(userId, isFederationRequest ? null : role);
  res.status(201).json({
    ...payload,
    pendingFederation: isFederationRequest,
  });
});

/* --- Вход ---------------------------------------------------------------- */

router.post('/login', (req, res) => {
  const { login, password } = req.body || {};
  if (!text(login) || !password) throw badRequest('логин и пароль обязательны');

  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(text(login));
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'неверный логин или пароль' } });
  }

  const roles = getUserRoles(user.id);
  const pending = federationRequest(user.id);

  res.json({
    ...sessionPayload(user.id, null),
    pendingFederation: !!pending && pending.status === 'pending' && roles.length === 0,
  });
});

/* --- Добавление роли к существующему аккаунту --------------------------- */

router.post('/roles', auth, (req, res) => {
  const body = req.body || {};
  const role = text(body.role);

  if (!role) throw validationError({ role: 'Выберите роль' });
  if (!isKnownRole(role)) throw validationError({ role: 'Недопустимая роль' });
  if (req.user.roles.indexOf(role) !== -1) throw conflict('эта роль уже есть у аккаунта');

  if (role === 'federation') {
    const pending = db.prepare(
      "SELECT id FROM requests WHERE user_id = ? AND type = 'federation' AND status = 'pending'"
    ).get(req.user.id);
    if (pending) throw conflict('заявка на роль федерации уже отправлена');

    db.prepare(`
      INSERT INTO requests (type, user_id, requested_type, status)
      VALUES ('federation', ?, 'federation', 'pending')
    `).run(req.user.id);

    audit(req.user.id, 'request_role', 'user', req.user.id);
    notifyFederation('federation_request_new',
      'Новая заявка на роль федерации от пользователя #' + req.user.id);
    notify(req.user.id, 'federation_request_sent',
      'Заявка на роль федерации отправлена и ожидает решения');

    return res.status(201).json({
      roles: req.user.roles,
      roleDetails: getRoleDetails(req.user.id),
      pendingFederation: true,
    });
  }

  const fields = checkRoleFields(role, body);
  ensureReferences(fields, body);
  if (Object.keys(fields).length) throw validationError(fields);

  const disciplines = normalizeDisciplines(body.disciplines);

  addUserRole(req.user.id, role, {
    experienceYears: body.experienceYears === undefined || body.experienceYears === '' ? null : Number(body.experienceYears),
    judgeCategory: role === 'judge' ? text(body.judgeCategory) : null,
    disciplines: role === 'coach' || role === 'athlete' ? disciplines : null,
  });

  if (role === 'athlete') {
    db.prepare(`
      UPDATE users SET
        birth_date = COALESCE(?, birth_date),
        municipality = COALESCE(?, municipality),
        organization_id = COALESCE(?, organization_id),
        start_year = COALESCE(?, start_year),
        disciplines = COALESCE(?, disciplines),
        legal_representative = COALESCE(?, legal_representative)
      WHERE id = ?
    `).run(
      text(body.birthDate) || null,
      text(body.municipality) || null,
      body.organizationId ? Number(body.organizationId) : null,
      body.startYear ? Number(body.startYear) : null,
      disciplines.length ? disciplines.join(',') : null,
      text(body.legalRepresentative) || null,
      req.user.id
    );
  }

  audit(req.user.id, 'add_role', 'user', req.user.id);

  notify(req.user.id, 'role_added', 'Роль "' + role + '" добавлена к аккаунту');

  res.status(201).json({
    roles: getUserRoles(req.user.id),
    roleDetails: getRoleDetails(req.user.id),
    activeRole: role,
    profile: profilePayload(req.user.id),
  });
});

/* --- Текущий пользователь ------------------------------------------------ */

router.get('/me', auth, (req, res) => {
  const pending = federationRequest(req.user.id);

  res.json({
    id: req.user.id,
    login: req.user.login,
    fio: req.user.fio,
    roles: req.user.roles,
    roleDetails: getRoleDetails(req.user.id),
    activeRole: req.user.activeRole,
    profile: profilePayload(req.user.id),
    federationRequest: pending ? { id: pending.id, status: pending.status } : null,
  });
});

/* --- Профиль ------------------------------------------------------------- */

router.get('/profile', auth, (req, res) => {
  const profile = profilePayload(req.user.id);
  res.json({
    ...profile,
    roles: req.user.roles,
    roleDetails: getRoleDetails(req.user.id),
  });
});

router.patch('/profile', auth, (req, res) => {
  const body = req.body || {};
  const current = profilePayload(req.user.id);
  if (!current) throw notFound('пользователь не найден');

  const next = {
    fio: body.fio === undefined ? current.fio : text(body.fio),
    email: body.email === undefined ? current.email : text(body.email),
    phone: body.phone === undefined ? current.phone : text(body.phone),
    municipality: body.municipality === undefined ? current.municipality : text(body.municipality),
    organizationId: body.organizationId === undefined ? current.organizationId : body.organizationId,
    startYear: body.startYear === undefined ? current.startYear : body.startYear,
    legalRepresentative: body.legalRepresentative === undefined
      ? current.legalRepresentative
      : text(body.legalRepresentative),
    rusadaDate: body.rusadaDate === undefined ? current.rusadaDate : text(body.rusadaDate),
    rusadaUrl: body.rusadaUrl === undefined ? current.rusadaUrl : text(body.rusadaUrl),
    disciplines: body.disciplines === undefined ? current.disciplines : body.disciplines,
  };

  const fields = checkProfile(next, req.user.roles);
  ensureReferences(fields, next);
  if (Object.keys(fields).length) throw validationError(fields);

  const disciplines = normalizeDisciplines(next.disciplines);

  db.prepare(`
    UPDATE users SET
      fio = ?, email = ?, phone = ?, municipality = ?, organization_id = ?,
      start_year = ?, legal_representative = ?, rusada_date = ?, rusada_url = ?,
      disciplines = ?
    WHERE id = ?
  `).run(
    next.fio,
    next.email || null,
    next.phone || null,
    next.municipality || null,
    next.organizationId ? Number(next.organizationId) : null,
    next.startYear ? Number(next.startYear) : null,
    next.legalRepresentative || null,
    next.rusadaDate || null,
    next.rusadaUrl || null,
    disciplines.length ? disciplines.join(',') : null,
    req.user.id
  );

  if (req.user.roles.indexOf('athlete') !== -1) {
    db.prepare('UPDATE user_roles SET disciplines = ? WHERE user_id = ? AND role = ?')
      .run(disciplines.length ? disciplines.join(',') : null, req.user.id, 'athlete');
  }

  audit(req.user.id, 'update', 'user', req.user.id);

  res.json({
    ...profilePayload(req.user.id),
    roles: getUserRoles(req.user.id),
    roleDetails: getRoleDetails(req.user.id),
  });
});

/* --- Заявка на роль федерации ------------------------------------------- */

router.get('/my-federation-request', auth, (req, res) => {
  const request = db.prepare(`
    SELECT id, status, reject_reason, created_at
    FROM requests WHERE user_id = ? AND type = 'federation'
    ORDER BY id DESC LIMIT 1
  `).get(req.user.id);
  if (!request) return res.json(null);
  res.json({
    id: request.id,
    status: request.status,
    rejectReason: request.reject_reason,
    createdAt: request.created_at,
  });
});

router.get('/federation-requests', auth, (req, res) => {
  requireRole(req, ['federation']);
  const rows = db.prepare(`
    SELECT r.id, r.user_id, r.status, r.reject_reason, r.created_at,
           u.fio, u.login, u.email, u.phone
    FROM requests r
    JOIN users u ON u.id = r.user_id
    WHERE r.type = 'federation'
    ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
  `).all();

  res.json(rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    fio: row.fio,
    login: row.login,
    email: row.email,
    phone: row.phone,
    status: row.status,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
  })));
});

router.post('/federation-requests/:id/approve', auth, (req, res) => {
  requireRole(req, ['federation']);
  const request = db.prepare("SELECT * FROM requests WHERE id = ? AND type = 'federation'").get(req.params.id);
  if (!request) throw notFound('заявка не найдена');
  if (request.status !== 'pending') throw badRequest('заявка уже рассмотрена');

  addUserRole(request.user_id, 'federation');
  db.prepare("UPDATE requests SET status = 'approved' WHERE id = ?").run(request.id);
  audit(req.user.id, 'approve_role', 'user', request.user_id);
  notify(request.user_id, 'federation_approved', 'Заявка на роль федерации одобрена');

  res.json({ ok: true, roles: getUserRoles(request.user_id) });
});

router.post('/federation-requests/:id/reject', auth, (req, res) => {
  requireRole(req, ['federation']);
  const request = db.prepare("SELECT * FROM requests WHERE id = ? AND type = 'federation'").get(req.params.id);
  if (!request) throw notFound('заявка не найдена');
  if (request.status !== 'pending') throw badRequest('заявка уже рассмотрена');

  const reason = text(req.body && req.body.reason);
  const reasonError = checkReason(reason);
  if (reasonError) throw validationError({ reason: reasonError });

  db.prepare("UPDATE requests SET status = 'rejected', reject_reason = ? WHERE id = ?")
    .run(reason, request.id);
  notify(request.user_id, 'federation_rejected',
    'Заявка на роль федерации отклонена. Причина: ' + reason);

  res.json({ ok: true });
});

module.exports = router;
