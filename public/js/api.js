/* ==========================================================================
   API-слой: состояние входа, запросы, скачивание файлов, справочники.
   ========================================================================== */

var auth = {
  token: null,
  user: null,
  roles: [],
  activeRole: null
};

var ROLE_TITLES = {
  federation: 'Федерация',
  athlete: 'Спортсмен',
  coach: 'Тренер',
  judge: 'Судья'
};

var ROLE_ORDER = ['athlete', 'coach', 'judge', 'federation'];

/* --- Сохранение входа между перезагрузками ------------------------------- */

function saveAuth() {
  localStorage.setItem('fsp.auth', JSON.stringify({
    token: auth.token,
    user: auth.user,
    roles: auth.roles,
    activeRole: auth.activeRole
  }));
}

function loadAuth() {
  var raw = localStorage.getItem('fsp.auth');
  if (!raw) return false;
  try {
    var data = JSON.parse(raw);
    auth.token = data.token || null;
    auth.user = data.user || null;
    auth.roles = data.roles || [];
    auth.roleDetails = data.roleDetails || [];
    auth.activeRole = data.activeRole || null;
    return !!auth.token;
  } catch (e) {
    return false;
  }
}

function clearAuth() {
  auth.token = null;
  auth.user = null;
  auth.roles = [];
  auth.activeRole = null;
  localStorage.removeItem('fsp.auth');
}

function authHeaders() {
  var headers = {};
  if (auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
  if (auth.activeRole) headers['X-Role'] = auth.activeRole;
  return headers;
}

/* --- Ошибка с кодом ответа ----------------------------------------------- */

function makeError(message, status) {
  var error = new Error(message);
  error.status = status;
  return error;
}

/* --- Основной запрос к API ----------------------------------------------- */

async function api(method, url, body, options) {
  options = options || {};
  var headers = {};

  if (auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
  if (options.role !== false && auth.activeRole) headers['X-Role'] = auth.activeRole;
  if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';

  var response;
  try {
    response = await fetch('/api' + url, {
      method: method,
      headers: headers,
      body: body === undefined || body === null ? undefined : JSON.stringify(body)
    });
  } catch (e) {
    throw makeError('Нет связи с сервером. Проверьте, что бэкенд запущен.', 0);
  }

  var type = response.headers.get('content-type') || '';

  if (!response.ok) {
    var message = 'Ошибка запроса (' + response.status + ')';
    var fieldErrors = null;
    if (type.indexOf('application/json') !== -1) {
      try {
        var data = await response.json();
        if (data && data.error && data.error.message) message = data.error.message;
        if (data && data.error && data.error.fields) fieldErrors = data.error.fields;
      } catch (e) {
        /* тело не JSON - оставляем стандартный текст */
      }
    }

    var error = makeError(message, response.status);
    error.fields = fieldErrors;
    if (response.status === 401 && auth.token) {
      clearAuth();
      error.silent = true;
      if (typeof goToLogin === 'function') goToLogin();
    }
    throw error;
  }

  if (type.indexOf('application/json') !== -1) return response.json();
  return response;
}

/* --- Загрузка файлов (multipart) ----------------------------------------- */

async function apiUpload(url, formData) {
  var headers = {};

  if (auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
  if (auth.activeRole) headers['X-Role'] = auth.activeRole;

  var response;
  try {
    response = await fetch('/api' + url, {
      method: 'POST',
      headers: headers,
      body: formData
    });
  } catch (e) {
    throw makeError('Нет связи с сервером.', 0);
  }

  if (!response.ok) {
    var message = 'Не удалось загрузить файл (' + response.status + ')';
    var fields = null;
    try {
      var data = await response.json();
      if (data && data.error && data.error.message) message = data.error.message;
      if (data && data.error && data.error.fields) fields = data.error.fields;
    } catch (e) {
      /* тело не JSON */
    }
    var error = makeError(message, response.status);
    error.fields = fields;
    throw error;
  }

  return response.json();
}

/* --- Скачивание файлов (docx, xlsx) -------------------------------------- */

async function downloadFile(url, filename) {
  var response;
  try {
    response = await fetch('/api' + url, { headers: authHeaders() });
  } catch (e) {
    throw makeError('Нет связи с сервером.', 0);
  }

  if (!response.ok) {
    var message = 'Не удалось скачать файл (' + response.status + ')';
    var type = response.headers.get('content-type') || '';
    if (type.indexOf('application/json') !== -1) {
      try {
        var data = await response.json();
        if (data && data.error && data.error.message) message = data.error.message;
      } catch (e) {
        /* игнорируем */
      }
    }
    throw makeError(message, response.status);
  }

  var blob = await response.blob();
  var link = document.createElement('a');
  var href = URL.createObjectURL(blob);

  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(function () {
    URL.revokeObjectURL(href);
  }, 3000);
}

/* --- Справочники --------------------------------------------------------- */

var CATALOG = {
  disciplines: [],
  ageGroups: [],
  organizations: [],
  loaded: false
};

async function loadCatalog() {
  if (CATALOG.loaded) return CATALOG;

  var parts = await Promise.all([
    api('GET', '/catalog/disciplines'),
    api('GET', '/catalog/age-groups'),
    api('GET', '/catalog/organizations')
  ]);

  CATALOG.disciplines = parts[0] || [];
  CATALOG.ageGroups = parts[1] || [];
  CATALOG.organizations = parts[2] || [];
  CATALOG.loaded = true;
  return CATALOG;
}

function disciplineName(id) {
  var found = CATALOG.disciplines.find(function (d) { return Number(d.id) === Number(id); });
  return found ? found.name : '-';
}

function disciplinesLabel(raw) {
  if (!raw) return '-';
  var names = String(raw).split(',').map(function (value) {
    var id = Number(value.trim());
    if (!id) return '';
    return disciplineName(id);
  }).filter(Boolean);
  return names.length ? names.join(', ') : '-';
}
