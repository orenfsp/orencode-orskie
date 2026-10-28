/* ==========================================================================
   Вход, регистрация, добавление роли, ожидание роли федерации и профиль.
   ========================================================================== */

/* --- Общие блоки форм ---------------------------------------------------- */

function authLayout(content, wide) {
  return '<div class="auth-page">' +
    '<section class="auth-hero">' +
      '<div class="auth-brand">' +
        '<span class="brand-mark lg">ФСП</span>' +
        '<div><strong>Федерация спортивного программирования</strong><small>Оренбургская область</small></div>' +
      '</div>' +
      '<div>' +
        '<h1>Единая цифровая <span>платформа федерации</span></h1>' +
        '<p class="auth-lead">Соревнования, заявки, результаты, протоколы, разряды, рейтинг и сборная - в одном рабочем месте для спортсменов, тренеров, судей и федерации.</p>' +
        '<ul class="auth-points">' +
          '<li>Календарь и приём заявок</li>' +
          '<li>Результаты и протоколы</li>' +
          '<li>Разряды и судейские категории</li>' +
          '<li>Рейтинг и состав сборной</li>' +
          '<li>Реестр спортсменов и отчёты</li>' +
          '<li>Один аккаунт на все роли</li>' +
        '</ul>' +
      '</div>' +
      '<div class="auth-foot"><span>Региональное отделение, Оренбург</span><span>демо-версия 2026</span></div>' +
    '</section>' +
    '<section class="auth-panel">' +
      '<div class="auth-card' + (wide ? ' auth-wide' : '') + '">' + content + '</div>' +
    '</section>' +
  '</div>';
}

function roleTabsHtml(roles, activeRole) {
  return '<div class="role-tabs" id="role-tabs">' +
    roles.map(function (role) {
      return '<button type="button" data-role="' + esc(role) + '"' +
        (role === activeRole ? ' class="active"' : '') + '>' + esc(ROLE_TITLES[role]) + '</button>';
    }).join('') +
  '</div>';
}

function disciplineChecksHtml(catalog, selected) {
  var list = selected || [];

  if (!catalog.disciplines.length) {
    return '<span class="hint">Справочник дисциплин недоступен.</span>';
  }

  return catalog.disciplines.map(function (discipline) {
    var checked = list.indexOf(Number(discipline.id)) !== -1;
    return '<label class="check-line">' +
      '<input type="checkbox" name="disciplines" value="' + esc(discipline.id) + '"' + (checked ? ' checked' : '') + '>' +
      '<span>' + esc(discipline.name) + '</span>' +
    '</label>';
  }).join('');
}

function disciplinesBlock(catalog, selected) {
  return '<div class="field" id="disciplines-field">' +
    '<span>Дисциплины</span>' +
    '<div class="check-list">' + disciplineChecksHtml(catalog, selected) + '</div>' +
    '<div class="hint">Можно выбрать несколько дисциплин.</div>' +
  '</div>';
}

/* Поля, которые зависят от роли. */
function roleFieldsHtml(role, catalog, values) {
  var data = values || {};

  if (role === 'athlete') {
    return '<div class="form-row">' +
        '<label class="field">Дата рождения<input name="birthDate" type="date" value="' + esc(data.birthDate || '') + '" required></label>' +
        '<label class="field">Муниципалитет<input name="municipality" value="' + esc(data.municipality || '') + '" placeholder="Оренбург" required></label>' +
      '</div>' +
      '<div class="form-row">' +
        '<label class="field">Организация<select name="organizationId">' +
          optionsHtml(catalog.organizations, data.organizationId || null, 'Без организации') +
        '</select></label>' +
        '<label class="field">Год начала занятий<input name="startYear" type="number" min="1950" max="' + new Date().getFullYear() + '" value="' + esc(data.startYear || '') + '" placeholder="2018"></label>' +
      '</div>' +
      disciplinesBlock(catalog, data.disciplines) +
      '<label class="field">Законный представитель' +
        '<input name="legalRepresentative" value="' + esc(data.legalRepresentative || '') + '" placeholder="Нужен, если спортсмену меньше 18 лет">' +
        '<span class="hint">Для несовершеннолетнего согласие даёт законный представитель.</span>' +
      '</label>';
  }

  if (role === 'coach') {
    return '<div class="form-row">' +
        '<label class="field">Стаж работы тренером, лет<input name="experienceYears" type="number" min="0" max="60" value="' + esc(data.experienceYears === 0 ? '0' : data.experienceYears || '') + '" placeholder="5" required></label>' +
        '<label class="field">Муниципалитет<input name="municipality" value="' + esc(data.municipality || '') + '" placeholder="Оренбург"></label>' +
      '</div>' +
      disciplinesBlock(catalog, data.disciplines);
  }

  if (role === 'judge') {
    return '<div class="form-row">' +
        '<label class="field">Судейская категория<select name="judgeCategory" required>' +
          optionsHtml(JUDGE_CATEGORY_OPTIONS, data.judgeCategory || null, 'Выберите категорию') +
        '</select></label>' +
        '<label class="field">Стаж судейства, лет<input name="experienceYears" type="number" min="0" max="60" value="' + esc(data.experienceYears === 0 ? '0' : data.experienceYears || '') + '" placeholder="3"></label>' +
      '</div>' +
      '<div class="notice">Категорию подтверждает федерация. После отправки заявки она появится в кабинете судьи.</div>';
  }

  return '<div class="notice">Роль федерации выдаётся после одобрения действующим представителем федерации. До этого доступны остальные ваши кабинеты.</div>';
}

function commonRegisterRules() {
  return [
    { name: 'login', required: true, emptyMessage: 'Укажите логин' },
    { name: 'password', required: true, emptyMessage: 'Укажите пароль' },
    { name: 'fio', required: true, emptyMessage: 'Укажите ФИО' },
    { name: 'email' },
    { name: 'phone' },
    { name: 'consentPd', checked: true, message: 'Нужно согласие на обработку персональных данных' }
  ];
}

function roleRules(role) {
  if (role === 'athlete') {
    return [
      { name: 'birthDate', required: true, emptyMessage: 'Укажите дату рождения' },
      { name: 'municipality', required: true, emptyMessage: 'Укажите муниципалитет' },
      { name: 'startYear' },
      { name: 'legalRepresentative' }
    ];
  }

  if (role === 'coach') {
    return [
      { name: 'experienceYears', required: true, emptyMessage: 'Укажите стаж работы тренером' },
      { name: 'municipality' }
    ];
  }

  if (role === 'judge') {
    return [
      { name: 'judgeCategory', required: true, emptyMessage: 'Выберите судейскую категорию' },
      { name: 'experienceYears' }
    ];
  }

  return [];
}

function collectRolePayload(form, role) {
  var payload = { role: role };
  var data = new FormData(form);

  if (role === 'athlete' || role === 'coach') {
    var disciplines = [];
    data.getAll('disciplines').forEach(function (value) { disciplines.push(Number(value)); });
    payload.disciplines = disciplines;
  }

  if (role === 'athlete') {
    payload.birthDate = String(data.get('birthDate') || '');
    payload.municipality = String(data.get('municipality') || '').trim();
    payload.organizationId = data.get('organizationId') ? Number(data.get('organizationId')) : null;
    payload.startYear = data.get('startYear') ? Number(data.get('startYear')) : null;
    payload.legalRepresentative = String(data.get('legalRepresentative') || '').trim() || null;
  }

  if (role === 'coach') {
    payload.experienceYears = data.get('experienceYears') === '' ? null : Number(data.get('experienceYears'));
    payload.municipality = String(data.get('municipality') || '').trim() || null;
  }

  if (role === 'judge') {
    payload.judgeCategory = String(data.get('judgeCategory') || '');
    payload.experienceYears = data.get('experienceYears') === '' ? null : Number(data.get('experienceYears'));
  }

  return payload;
}

function checkRoleForm(form, role) {
  var ok = validateForm(form, roleRules(role));

  if (role === 'athlete' || role === 'coach') {
    var groupError = checkDisciplineGroup(form, true);
    setGroupError(form, 'disciplines', groupError);
    if (groupError && ok) ok = false;
  }

  if (role === 'athlete') {
    var birthDate = form.elements.birthDate ? form.elements.birthDate.value : '';
    var representative = form.elements.legalRepresentative ? form.elements.legalRepresentative.value.trim() : '';

    if (birthDate && calcAgeFromDate(birthDate) !== null && calcAgeFromDate(birthDate) < 18 && !representative) {
      setFieldError(form.elements.legalRepresentative, 'Для несовершеннолетнего укажите законного представителя');
      ok = false;
    }
  }

  return ok;
}

/* --- Вход ---------------------------------------------------------------- */

function renderLoginPage() {
  var app = document.getElementById('app');

  app.innerHTML = authLayout(
    '<h2>Вход в личный кабинет</h2>' +
    '<p class="auth-sub">Введите логин и пароль, чтобы продолжить работу.</p>' +
    '<form id="login-form" novalidate>' +
      '<label class="field">Логин' +
        '<input name="login" autocomplete="username" placeholder="например, athlete" required>' +
      '</label>' +
      '<label class="field">Пароль' +
        '<input name="password" type="password" autocomplete="current-password" placeholder="минимум 6 символов" required>' +
      '</label>' +
      '<div class="form-error" id="login-error" hidden></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Войти</button>' +
    '</form>' +
    '<p class="auth-switch">Нет аккаунта? <a href="#/register">Зарегистрироваться</a></p>' +
    '<div class="demo-box">' +
      '<div class="demo-title">Демо-доступы, пароль 123</div>' +
      '<div class="demo-chips">' +
        '<button type="button" data-demo="fed">Федерация</button>' +
        '<button type="button" data-demo="athlete">Спортсмен</button>' +
        '<button type="button" data-demo="coach">Тренер</button>' +
        '<button type="button" data-demo="judge">Судья</button>' +
        '<button type="button" data-demo="both">Спортсмен + тренер</button>' +
      '</div>' +
    '</div>'
  );

  var form = app.querySelector('#login-form');
  var errorBox = app.querySelector('#login-error');
  var submit = form.querySelector('button[type="submit"]');

  bindValidation(form, [
    { name: 'login', required: true, emptyMessage: 'Укажите логин' },
    { name: 'password', required: true, emptyMessage: 'Укажите пароль', plain: true }
  ]);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    clearFieldErrors(form);
    errorBox.hidden = true;

    var valid = validateForm(form, [
      { name: 'login', required: true, emptyMessage: 'Укажите логин' },
      { name: 'password', required: true, emptyMessage: 'Укажите пароль', plain: true }
    ]);

    if (!valid) return;

    var data = new FormData(form);
    var login = String(data.get('login') || '').trim();
    var password = String(data.get('password') || '');

    submit.disabled = true;
    submit.textContent = 'Входим...';

    try {
      var result = await api('POST', '/auth/login', { login: login, password: password }, { role: false });
      applySession(result);

      toast('Добро пожаловать, ' + shortFio(result.user.fio) + '!', 'success');
      location.hash = auth.roles.length ? '#/dashboard' : '#/pending';
      onRouteChange();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Войти';
    }
  });

  app.querySelectorAll('[data-demo]').forEach(function (button) {
    button.addEventListener('click', function () {
      form.elements.login.value = button.getAttribute('data-demo');
      form.elements.password.value = '123';
      form.requestSubmit();
    });
  });
}

function applySession(result) {
  auth.token = result.token;
  auth.user = result.user;
  auth.roles = result.roles || [];
  auth.roleDetails = result.roleDetails || [];
  auth.activeRole = result.activeRole || auth.roles[0] || null;
  saveAuth();
}

/* --- Регистрация --------------------------------------------------------- */

function ageFromBirthDate(birthDate) {
  return calcAgeFromDate(birthDate);
}

async function renderRegisterPage() {
  var app = document.getElementById('app');

  showLoading(app, 'Готовим форму регистрации...');

  var catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    catalog = { disciplines: [], ageGroups: [], organizations: [] };
  }

  app.innerHTML = authLayout(
    '<h2>Регистрация</h2>' +
    '<p class="auth-sub">Создайте аккаунт спортсмена, тренера или судьи. Роль федерации выдаётся после одобрения. Остальные роли можно добавить позже без повторного входа.</p>' +

    roleTabsHtml(['athlete', 'coach', 'judge', 'federation'], 'athlete') +

    '<form id="register-form" novalidate>' +
      '<div class="form-row">' +
        '<label class="field">Логин<input name="login" autocomplete="username" placeholder="ivanov" required></label>' +
        '<label class="field">Пароль<input name="password" type="password" autocomplete="new-password" placeholder="минимум 6 символов" required></label>' +
      '</div>' +
      '<label class="field">ФИО полностью<input name="fio" placeholder="Иванов Иван Иванович" required></label>' +
      '<div class="form-row">' +
        '<label class="field">E-mail<input name="email" type="email" placeholder="name@example.ru"></label>' +
        '<label class="field">Телефон<input name="phone" placeholder="+7 900 000-00-00"></label>' +
      '</div>' +

      '<div id="role-fields">' + roleFieldsHtml('athlete', catalog) + '</div>' +

      '<label class="check-line">' +
        '<input type="checkbox" name="consentPd">' +
        '<span>Согласен на обработку персональных данных в соответствии с политикой платформы.</span>' +
      '</label>' +

      '<div class="form-error" id="register-error" hidden></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Создать аккаунт</button>' +
    '</form>' +

    '<p class="auth-switch">Уже есть аккаунт? <a href="#/login">Войти</a></p>'
  , true);

  var form = app.querySelector('#register-form');
  var errorBox = app.querySelector('#register-error');
  var roleFields = app.querySelector('#role-fields');
  var currentRole = 'athlete';

  function bindRole() {
    bindValidation(form, roleRules(currentRole));

    form.querySelectorAll('[name="disciplines"]').forEach(function (box) {
      box.addEventListener('change', function () {
        setGroupError(form, 'disciplines', '');
      });
    });
  }

  function setRole(role) {
    currentRole = role;

    app.querySelectorAll('#role-tabs button').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-role') === role);
    });

    roleFields.innerHTML = roleFieldsHtml(role, catalog);
    bindRole();
  }

  app.querySelectorAll('#role-tabs button').forEach(function (button) {
    button.addEventListener('click', function () {
      setRole(button.getAttribute('data-role'));
    });
  });

  bindValidation(form, commonRegisterRules());
  bindRole();

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    errorBox.hidden = true;
    clearFieldErrors(form);

    var valid = validateForm(form, commonRegisterRules());
    if (!checkRoleForm(form, currentRole)) valid = false;
    if (!valid) return;

    var data = new FormData(form);
    var payload = {
      login: String(data.get('login') || '').trim(),
      password: String(data.get('password') || ''),
      fio: String(data.get('fio') || '').trim(),
      email: String(data.get('email') || '').trim() || null,
      phone: String(data.get('phone') || '').trim() || null,
      consentPd: true,
      role: currentRole
    };

    if (currentRole !== 'federation') {
      var roleData = collectRolePayload(form, currentRole);
      Object.keys(roleData).forEach(function (key) {
        if (key !== 'role') payload[key] = roleData[key];
      });
    }

    var submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Создаём аккаунт...';

    try {
      var result = await api('POST', '/auth/register', payload, { role: false });
      applySession(result);

      if (result.pendingFederation) {
        toast('Заявка на роль федерации отправлена.', 'warn');
        location.hash = '#/pending';
      } else {
        toast('Аккаунт создан. Добро пожаловать!', 'success');
        location.hash = '#/dashboard';
      }
      onRouteChange();
    } catch (error) {
      if (error.fields) showServerFieldErrors(form, error.fields);
      else {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
      }
      submit.disabled = false;
      submit.textContent = 'Создать аккаунт';
    }
  });
}

/* --- Добавление роли ----------------------------------------------------- */

async function renderAddRole(el, preselect) {
  el.innerHTML = pageHeader('Добавить роль', 'Новая роль регистрируется отдельно, вход остаётся прежним') +
    '<div id="add-role-body"></div>';

  var box = el.querySelector('#add-role-body');
  showLoading(box, 'Загружаем данные...');

  var catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    catalog = { disciplines: [], ageGroups: [], organizations: [] };
  }

  var available = ROLE_ORDER.filter(function (role) {
    return auth.roles.indexOf(role) === -1;
  });

  if (!available.length) {
    box.innerHTML =
      '<div class="card">' +
        emptyBlock('Все роли уже добавлены', 'У аккаунта есть все четыре кабинета.') +
        '<div class="form-actions"><a class="btn btn-ghost" href="#/profile">В профиль</a></div>' +
      '</div>';
    return;
  }

  var currentRole = available.indexOf(preselect) !== -1 ? preselect : available[0];
  var pending = false;

  box.innerHTML =
    roleTabsHtml(available, currentRole) +
    '<form id="add-role-form" novalidate>' +
      '<div id="add-role-fields">' + roleFieldsHtml(currentRole, catalog) + '</div>' +
      '<div class="form-error" id="add-role-error" hidden></div>' +
      '<div class="form-actions">' +
        '<button class="btn btn-primary" type="submit">' +
          (currentRole === 'federation' ? 'Подать заявку' : 'Добавить роль') +
        '</button>' +
        '<a class="btn btn-ghost" href="#/profile">Отмена</a>' +
      '</div>' +
    '</form>' +
    '<p class="hint" style="margin-top:14px">Права и разделы меню зависят от активной роли. Переключиться можно в верхней панели или в профиле.</p>';

  var form = box.querySelector('#add-role-form');
  var fieldsBox = box.querySelector('#add-role-fields');
  var errorBox = box.querySelector('#add-role-error');
  var submit = form.querySelector('button[type="submit"]');

  function setRole(role) {
    currentRole = role;
    box.querySelectorAll('#role-tabs button').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-role') === role);
    });
    fieldsBox.innerHTML = roleFieldsHtml(role, catalog);
    submit.textContent = role === 'federation' ? 'Подать заявку' : 'Добавить роль';
    bindRole();
  }

  function bindRole() {
    bindValidation(form, roleRules(currentRole));
    form.querySelectorAll('[name="disciplines"]').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        setGroupError(form, 'disciplines', '');
      });
    });
  }

  box.querySelectorAll('#role-tabs button').forEach(function (button) {
    button.addEventListener('click', function () {
      setRole(button.getAttribute('data-role'));
    });
  });

  bindRole();

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    errorBox.hidden = true;
    clearFieldErrors(form);

    if (!checkRoleForm(form, currentRole)) return;

    var payload = collectRolePayload(form, currentRole);

    submit.disabled = true;
    submit.textContent = 'Отправляем...';

    try {
      var result = await api('POST', '/auth/roles', payload);

      if (result.pendingFederation) {
        pending = true;
        toast('Заявка на роль федерации отправлена.', 'warn');
        location.hash = '#/profile';
        onRouteChange();
        return;
      }

      await refreshMe();
      auth.activeRole = result.activeRole || currentRole;
      saveAuth();
      updateShell();
      toast('Роль "' + ROLE_TITLES[currentRole] + '" добавлена. Открываем кабинет.', 'success');
      location.hash = '#/dashboard';
      onRouteChange();
    } catch (error) {
      if (error.fields) showServerFieldErrors(form, error.fields);
      else {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
      }
      submit.disabled = false;
      submit.textContent = currentRole === 'federation' ? 'Подать заявку' : 'Добавить роль';
    }
  });

  return pending;
}

/* --- Ожидание одобрения роли федерации ---------------------------------- */

async function renderPendingPage() {
  var app = document.getElementById('app');
  showLoading(app, 'Проверяем статус заявки...');

  var request = null;
  try {
    request = await api('GET', '/auth/my-federation-request', undefined, { role: false });
  } catch (error) {
    request = null;
  }

  var status = request ? request.status : 'none';
  var title = 'Заявка на роль федерации';
  var text = '';
  var actions = '';

  if (status === 'pending') {
    text = 'Заявка отправлена и ожидает решения действующей федерации. Как только её одобрят, откроется полный кабинет.';
    actions =
      '<button class="btn btn-primary" id="pending-refresh">Проверить статус</button>' +
      '<button class="btn btn-ghost" id="pending-logout">Выйти</button>';
  } else if (status === 'approved') {
    text = 'Заявка одобрена. Роль федерации добавлена к аккаунту.';
    actions = '<button class="btn btn-primary" id="pending-open">Открыть кабинет</button>';
  } else if (status === 'rejected') {
    text = 'Заявка отклонена.' + (request.rejectReason ? ' Причина: ' + request.rejectReason : '');
    actions =
      '<a class="btn btn-ghost" href="#/add-role">Выбрать другую роль</a>' +
      '<button class="btn btn-ghost" id="pending-logout">Выйти</button>';
  } else {
    text = 'Заявка не найдена. Обратитесь в федерацию или зарегистрируйтесь заново.';
    actions = '<a class="btn btn-ghost" href="#/register">Регистрация</a>';
  }

  app.innerHTML =
    '<div class="center-screen">' +
      '<div class="card" style="width:100%;max-width:520px">' +
        '<div class="brand" style="margin-bottom:18px">' +
          '<span class="brand-mark lg">ФСП</span>' +
          '<div class="brand-text"><strong>Федерация спортивного программирования</strong><small>Оренбургская область</small></div>' +
        '</div>' +
        '<h2 style="font-size:21px;margin-bottom:10px">' + esc(title) + '</h2>' +
        '<p class="muted" style="font-size:13.5px;line-height:1.6">' + esc(text) + '</p>' +
        (status === 'pending' ? '<p style="margin-top:14px">' + statusBadge('pending') + '</p>' : '') +
        (status === 'approved' ? '<p style="margin-top:14px">' + statusBadge('approved') + '</p>' : '') +
        (status === 'rejected' ? '<p style="margin-top:14px">' + statusBadge('rejected') + '</p>' : '') +
        '<div class="form-actions">' + actions + '</div>' +
        '<p class="hint" style="margin-top:18px">Аккаунт: ' + esc(auth.user ? auth.user.fio : '') + '</p>' +
      '</div>' +
    '</div>';

  var refreshButton = app.querySelector('#pending-refresh');
  if (refreshButton) {
    refreshButton.addEventListener('click', async function () {
      refreshButton.disabled = true;
      try {
        await refreshMe();
      } catch (error) {
        toast(error.message, 'error');
      }
      if (auth.roles.length) {
        location.hash = '#/dashboard';
        onRouteChange();
      } else {
        renderPendingPage();
      }
    });
  }

  var openButton = app.querySelector('#pending-open');
  if (openButton) {
    openButton.addEventListener('click', async function () {
      try {
        await refreshMe();
        location.hash = '#/dashboard';
        onRouteChange();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  }

  var logoutButton = app.querySelector('#pending-logout');
  if (logoutButton) logoutButton.addEventListener('click', logout);
}

/* --- Профиль ------------------------------------------------------------- */

async function renderProfile(el) {
  el.innerHTML = pageHeader('Профиль', 'Данные аккаунта, роли и личные сведения') + '<div id="profile-body"></div>';

  var box = el.querySelector('#profile-body');
  showLoading(box, 'Загружаем профиль...');

  var profile;
  var catalog;
  try {
    var loaded = await Promise.all([
      api('GET', '/auth/profile'),
      loadCatalog()
    ]);
    profile = loaded[0];
    catalog = loaded[1];
  } catch (error) {
    showError(box, error);
    return;
  }

  var isAthlete = auth.roles.indexOf('athlete') !== -1;
  var rolesHtml = profile.roleDetails.map(function (item) {
    var note = '';

    if (item.role === 'coach' && item.experienceYears !== null && item.experienceYears !== undefined) {
      note = ', стаж ' + item.experienceYears + ' лет';
    }
    if (item.role === 'judge' && item.judgeCategory) {
      note = ', ' + item.judgeCategory + ' категория';
    }

    var active = item.role === auth.activeRole;
    return '<button type="button" class="chip' + (active ? ' active' : '') + '" data-role="' + esc(item.role) + '">' +
      '<b>' + esc(item.title) + '</b>' + esc(note) + (active ? ' - активна' : '') +
    '</button>';
  }).join('');

  var addRoleLink = auth.roles.length < ROLE_ORDER.length
    ? '<a class="btn btn-ghost btn-sm" href="#/add-role">Добавить роль</a>'
    : '';

  box.innerHTML =
    '<div class="grid cols-2">' +
      '<section class="card">' +
        '<div class="card-head"><h2>Учётная запись</h2></div>' +
        '<div class="detail-grid">' +
          '<div class="detail-item"><dt>ФИО</dt><dd>' + esc(profile.fio) + '</dd></div>' +
          '<div class="detail-item"><dt>Логин</dt><dd class="mono">' + esc(profile.login) + '</dd></div>' +
          '<div class="detail-item"><dt>ID пользователя</dt><dd>' + esc(profile.id) + '</dd></div>' +
          '<div class="detail-item"><dt>Активный кабинет</dt><dd>' + esc(ROLE_TITLES[auth.activeRole] || '-') + '</dd></div>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button class="btn btn-ghost" id="profile-logout">Выйти из аккаунта</button>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head">' +
          '<div><h2>Роли аккаунта</h2><div class="sub">Переключение без повторного входа</div></div>' +
          addRoleLink +
        '</div>' +
        '<div class="chips" id="profile-roles">' + rolesHtml + '</div>' +
        '<p class="hint" style="margin-top:12px">Новые роли регистрируются отдельно. Права проверяются по активной роли.</p>' +
      '</section>' +
    '</div>' +

    '<section class="card">' +
      '<div class="card-head">' +
        '<div><h2>Личные данные</h2><div class="sub">Используются в заявках, протоколах и отчётах</div></div>' +
      '</div>' +
      '<form id="profile-form" novalidate>' +
        '<div class="form-row">' +
          '<label class="field">ФИО<input name="fio" value="' + esc(profile.fio) + '" required></label>' +
          '<label class="field">Телефон<input name="phone" value="' + esc(profile.phone || '') + '" placeholder="+7 900 000-00-00"></label>' +
        '</div>' +
        '<div class="form-row">' +
          '<label class="field">E-mail<input name="email" value="' + esc(profile.email || '') + '" placeholder="name@example.ru"></label>' +
          (isAthlete
            ? '<label class="field">Муниципалитет<input name="municipality" value="' + esc(profile.municipality || '') + '" placeholder="Оренбург" required></label>'
            : '<label class="field">Муниципалитет<input name="municipality" value="' + esc(profile.municipality || '') + '" placeholder="Оренбург"></label>') +
        '</div>' +
        (isAthlete
          ? '<div class="form-row">' +
              '<label class="field">Организация<select name="organizationId">' +
                optionsHtml(catalog.organizations, profile.organizationId, 'Без организации') +
              '</select></label>' +
              '<label class="field">Год начала занятий<input name="startYear" type="number" min="1950" max="' + new Date().getFullYear() + '" value="' + esc(profile.startYear || '') + '"></label>' +
            '</div>' +
            '<div class="form-row">' +
              '<label class="field">Законный представитель<input name="legalRepresentative" value="' + esc(profile.legalRepresentative || '') + '"></label>' +
              '<label class="field">Дата курса РУСАДА<input name="rusadaDate" type="date" value="' + esc(profile.rusadaDate || '') + '"></label>' +
            '</div>' +
            '<label class="field">Сертификат РУСАДА (ссылка)' +
              '<input name="rusadaUrl" value="' + esc(profile.rusadaUrl || '') + '" placeholder="https://rusada.ru/...">' +
              '<span class="hint">Официальные материалы: <a href="https://rusada.ru" target="_blank" rel="noopener">rusada.ru</a></span>' +
            '</label>' +
            disciplinesBlock(catalog, profile.disciplines)
          : '') +
        '<div class="form-error" id="profile-error" hidden></div>' +
        '<div class="form-actions">' +
          '<button class="btn btn-primary" type="submit">Сохранить</button>' +
        '</div>' +
      '</form>' +
    '</section>' +

    (isAthlete ? athleteLinkCard() : '') +
    '<div id="profile-request"></div>';

  var profileLogout = el.querySelector('#profile-logout');
  if (profileLogout) profileLogout.addEventListener('click', logout);

  var confirmForm = el.querySelector('#confirm-link-form');
  if (confirmForm) {
    confirmForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      var linkId = Number(new FormData(confirmForm).get('linkId'));

      if (!linkId) {
        setFieldError(confirmForm.elements.linkId, 'Укажите номер связи');
        return;
      }

      try {
        await api('POST', '/coach-athlete/' + linkId + '/confirm');
        toast('Связь с тренером подтверждена.', 'success');
        confirmForm.reset();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  }

  el.querySelectorAll('#profile-roles [data-role]').forEach(function (button) {
    button.addEventListener('click', function () {
      switchToRole(button.getAttribute('data-role'));
    });
  });

  var form = el.querySelector('#profile-form');
  var errorBox = el.querySelector('#profile-error');

  var rules = [
    { name: 'fio', required: true, emptyMessage: 'Укажите ФИО' },
    { name: 'email' },
    { name: 'phone' }
  ];

  if (isAthlete) {
    rules.push(
      { name: 'municipality', required: true, emptyMessage: 'Укажите муниципалитет' },
      { name: 'startYear' },
      { name: 'legalRepresentative' },
      { name: 'rusadaUrl' },
      {
        name: 'rusadaDate',
        custom: function (value) {
          if (!value) return '';
          var time = dateToTime(value);
          if (isNaN(time)) return 'Дата курса РУСАДА: некорректная дата';
          if (time > Date.now()) return 'Дата курса не может быть в будущем';
          return '';
        }
      }
    );
  }

  bindValidation(form, rules);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    errorBox.hidden = true;
    clearFieldErrors(form);

    var valid = validateForm(form, rules);

    if (isAthlete) {
      var groupError = checkDisciplineGroup(form, true);
      setGroupError(form, 'disciplines', groupError);
      if (groupError) valid = false;
    }

    if (!valid) return;

    var data = new FormData(form);
    var payload = {
      fio: String(data.get('fio') || '').trim(),
      email: String(data.get('email') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      municipality: String(data.get('municipality') || '').trim(),
    };

    if (isAthlete) {
      var disciplines = [];
      data.getAll('disciplines').forEach(function (value) { disciplines.push(Number(value)); });

      payload.organizationId = data.get('organizationId') ? Number(data.get('organizationId')) : null;
      payload.startYear = data.get('startYear') ? Number(data.get('startYear')) : null;
      payload.legalRepresentative = String(data.get('legalRepresentative') || '').trim();
      payload.rusadaDate = String(data.get('rusadaDate') || '').trim();
      payload.rusadaUrl = String(data.get('rusadaUrl') || '').trim();
      payload.disciplines = disciplines;
    }

    var submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Сохраняем...';

    try {
      var result = await api('PATCH', '/auth/profile', payload);
      auth.user = { id: result.id, fio: result.fio, login: result.login };
      saveAuth();
      updateShell();
      toast('Профиль сохранён.', 'success');
      renderProfile(el);
    } catch (error) {
      if (error.fields) showServerFieldErrors(form, error.fields);
      else {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
      }
      submit.disabled = false;
      submit.textContent = 'Сохранить';
    }
  });

  var requestBox = el.querySelector('#profile-request');
  try {
    var request = await api('GET', '/auth/my-federation-request');
    if (request) {
      requestBox.innerHTML =
        '<section class="card">' +
          '<div class="card-head"><h2>Заявка на роль федерации</h2>' + statusBadge(request.status) + '</div>' +
          '<div class="detail-grid">' +
            '<div class="detail-item"><dt>Номер заявки</dt><dd>' + esc(request.id) + '</dd></div>' +
            '<div class="detail-item"><dt>Создана</dt><dd>' + esc(fmtDateTime(request.createdAt)) + '</dd></div>' +
            '<div class="detail-item"><dt>Причина отказа</dt><dd>' + esc(request.rejectReason || '-') + '</dd></div>' +
          '</div>' +
        '</section>';
    }
  } catch (error) {
    requestBox.innerHTML = '';
  }
}

/* --- Подтверждение связи с тренером ------------------------------------- */

function athleteLinkCard() {
  return '<section class="card">' +
    '<div class="card-head">' +
      '<div><h2>Привязка тренера</h2><div class="sub">Подтверждение связи по номеру, который сообщает тренер</div></div>' +
    '</div>' +
    '<form id="confirm-link-form" class="form-row" style="align-items:end">' +
      '<label class="field">Номер связи<input name="linkId" type="number" min="1" placeholder="например, 12"></label>' +
      '<button class="btn btn-ghost" type="submit" style="height:42px">Подтвердить</button>' +
    '</form>' +
    '<p class="hint" style="margin-top:10px">Номер связи отображается в кабинете тренера в списке спортсменов.</p>' +
  '</section>';
}
