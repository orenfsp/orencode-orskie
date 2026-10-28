/* ==========================================================================
   Каркас приложения: меню по ролям, маршрутизация, главная страница, запуск.
   ========================================================================== */

/* --- Меню ---------------------------------------------------------------- */

function navGroups() {
  var groups = [
    {
      title: 'Общее',
      links: [
        { href: '#/dashboard', label: 'Главная' },
        { href: '#/competitions', label: 'Соревнования' },
        { href: '#/rating', label: 'Рейтинг и сборная' }
      ]
    }
  ];

  if (auth.activeRole === 'athlete') {
    groups.push({
      title: 'Спортсмен',
      links: [
        { href: '#/applications', label: 'Мои заявки' },
        { href: '#/my-results', label: 'Мои результаты' },
        { href: '#/rank', label: 'Мой разряд' }
      ]
    });
  }

  if (auth.activeRole === 'coach') {
    groups.push({
      title: 'Тренер',
      links: [
        { href: '#/athletes', label: 'Мои спортсмены' },
        { href: '#/coach-applications', label: 'Заявки подопечных' },
        { href: '#/coach-ranks', label: 'Разряды подопечных' }
      ]
    });
  }

  if (auth.activeRole === 'judge') {
    groups.push({
      title: 'Судья',
      links: [
        { href: '#/judge', label: 'Мои назначения' },
        { href: '#/judge/category', label: 'Моя категория' }
      ]
    });
  }

  if (auth.activeRole === 'federation') {
    groups.push({
      title: 'Федерация',
      links: [
        { href: '#/federation/competitions', label: 'Соревнования' },
        { href: '#/federation/applications', label: 'Заявки участников' },
        { href: '#/federation/results', label: 'Ввод результатов' },
        { href: '#/federation/ranks', label: 'Разряды' },
        { href: '#/federation/judges', label: 'Судейская коллегия' },
        { href: '#/federation/requests', label: 'Заявки на роль' },
        { href: '#/registry', label: 'Реестр' },
        { href: '#/reports', label: 'Отчёты' }
      ]
    });
  }

  var accountLinks = [
    { href: '#/profile', label: 'Профиль' },
    { href: '#/notifications', label: 'Уведомления' }
  ];

  if (auth.roles.length < ROLE_ORDER.length) {
    accountLinks.push({ href: '#/add-role', label: 'Добавить роль' });
  }

  groups.push({
    title: 'Аккаунт',
    links: accountLinks
  });

  return groups;
}

function isActiveLink(href) {
  var current = location.hash.split('?')[0];
  if (!current) current = '#/dashboard';

  if (current === href) return true;
  if (href === '#/competitions' && current.indexOf('#/competition/') === 0) return true;

  return false;
}

function updateNav() {
  var nav = document.getElementById('nav');
  if (!nav) return;

  nav.innerHTML = navGroups().map(function (group) {
    var links = group.links.map(function (link) {
      return '<a class="nav-link' + (isActiveLink(link.href) ? ' active' : '') + '" href="' + link.href + '">' +
        '<span class="dot"></span>' + esc(link.label) +
      '</a>';
    }).join('');

    return '<div class="nav-group">' +
      '<div class="nav-group-title">' + esc(group.title) + '</div>' +
      '<div class="nav-links">' + links + '</div>' +
    '</div>';
  }).join('');
}

/* --- Каркас -------------------------------------------------------------- */

function mountShell() {
  var app = document.getElementById('app');

  app.innerHTML =
    '<div class="shell">' +
      '<header class="topbar">' +
        '<button class="icon-btn burger" id="burger" aria-label="Открыть меню"><span class="burger-lines"></span></button>' +
        '<a class="brand" href="#/dashboard">' +
          '<span class="brand-mark">ФСП</span>' +
          '<span class="brand-text"><strong>Федерация спортивного программирования</strong><small>Оренбургская область</small></span>' +
        '</a>' +
        '<div class="topbar-actions">' +
          '<label class="role-switch"><span>Кабинет</span><select id="role-select"></select></label>' +
          '<a class="icon-btn bell-btn" id="notif-link" href="#/notifications" aria-label="Уведомления" title="Уведомления">' +
            '<span class="bell-shape"></span>' +
            '<span class="notif-count" id="notif-count" hidden>0</span>' +
          '</a>' +
          '<a class="user-chip" href="#/profile">' +
            '<span class="avatar" id="avatar">?</span>' +
            '<span class="user-meta"><strong id="user-fio"></strong><small id="user-role"></small></span>' +
          '</a>' +
          '<button class="icon-btn logout-btn" id="logout-button" title="Выйти" aria-label="Выйти">Выйти</button>' +
        '</div>' +
      '</header>' +
      '<div class="layout">' +
        '<aside class="sidebar" id="sidebar">' +
          '<nav class="nav" id="nav"></nav>' +
          '<div class="sidebar-foot">Региональное отделение<br>Оренбургская область</div>' +
        '</aside>' +
        '<main class="content" id="view" tabindex="-1"></main>' +
      '</div>' +
    '</div>';

  var burger = document.getElementById('burger');
  if (burger) {
    burger.addEventListener('click', function () {
      var sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('open');
    });
  }

  var logoutButton = document.getElementById('logout-button');
  if (logoutButton) logoutButton.addEventListener('click', logout);

  var roleSelect = document.getElementById('role-select');
  if (roleSelect) {
    roleSelect.addEventListener('change', function (event) {
      switchToRole(event.target.value);
    });
  }

  var nav = app.querySelector('#nav');
  if (nav) {
    nav.addEventListener('click', function (event) {
      if (event.target.closest('.nav-link')) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
      }
    });
  }

  if (typeof loadUnreadCount === 'function' && !window.__notifTimer) {
    window.__notifTimer = setInterval(loadUnreadCount, 60000);
  }

  /* Таблицы после каждой перерисовки получают подписи для мобильных карточек. */
  var view = document.getElementById('view');
  if (window.MutationObserver && view) {
    var frame = null;
    var observer = new MutationObserver(function () {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        decorateTables(view);
      });
    });
    observer.observe(view, { childList: true, subtree: true });
  }
}

function updateShell() {
  var select = document.getElementById('role-select');
  if (!select) return;

  select.innerHTML = auth.roles.map(function (role) {
    return '<option value="' + esc(role) + '"' + (role === auth.activeRole ? ' selected' : '') + '>' +
      esc(ROLE_TITLES[role] || role) +
    '</option>';
  }).join('');

  var fio = auth.user ? auth.user.fio : '';
  var avatar = document.getElementById('avatar');
  var fioBox = document.getElementById('user-fio');
  var roleBox = document.getElementById('user-role');

  if (avatar) avatar.textContent = initial(fio);
  if (fioBox) fioBox.textContent = fio;
  if (roleBox) roleBox.textContent = ROLE_TITLES[auth.activeRole] || '';

  if (typeof loadUnreadCount === 'function') loadUnreadCount();
}

function switchToRole(role) {
  if (!role || auth.roles.indexOf(role) === -1) return;

  auth.activeRole = role;
  saveAuth();

  updateShell();
  updateNav();

  if (location.hash === '#/dashboard' || location.hash === '') {
    renderRoute();
  } else {
    location.hash = '#/dashboard';
  }
}

function logout() {
  clearAuth();
  location.hash = '#/login';
  onRouteChange();
}

function goToLogin() {
  clearAuth();
  location.hash = '#/login';
  onRouteChange();
}

/* --- Маршрутизация ------------------------------------------------------- */

function parseRoute() {
  var raw = location.hash.slice(1) || '/dashboard';
  var questionIndex = raw.indexOf('?');
  var path = questionIndex === -1 ? raw : raw.slice(0, questionIndex);
  var queryString = questionIndex === -1 ? '' : raw.slice(questionIndex + 1);

  return {
    parts: path.split('/').filter(Boolean),
    query: new URLSearchParams(queryString)
  };
}

async function renderRoute() {
  var view = document.getElementById('view');
  if (!view) return;

  var route = parseRoute();
  var parts = route.parts;
  var head = parts[0] || 'dashboard';

  window.scrollTo(0, 0);
  updateNav();

  try {
    switch (head) {
      case 'dashboard':
        return await renderDashboard(view);
      case 'competitions':
        return await renderCompetitions(view);
      case 'competition':
        return await renderCompetition(view, parts[1]);
      case 'applications':
        return await renderMyApplications(view);
      case 'my-results':
        return await renderMyResults(view);
      case 'rank':
        return await renderMyRank(view);
      case 'athletes':
        return await renderCoachAthletes(view);
      case 'coach-applications':
        return await renderCoachApplications(view);
      case 'coach-ranks':
        return await renderCoachRanks(view);
      case 'judge':
        if (parts[1] === 'category') return await renderJudgeCategory(view);
        return await renderJudgeAssignments(view);
      case 'federation':
        return await renderFederationSection(view, parts[1], route);
      case 'registry':
        return await renderRegistry(view);
      case 'rating':
        return await renderRating(view);
      case 'reports':
        return await renderReports(view);
      case 'notifications':
        return await renderNotifications(view);
      case 'profile':
        return await renderProfile(view);
      case 'add-role':
        return await renderAddRole(view, parts[1]);
      case 'pending':
        renderPendingPage();
        return;
      default:
        view.innerHTML = '<div class="card">' +
          emptyBlock('Страница не найдена', 'Проверьте адрес или вернитесь на главную.') +
          '<div class="form-actions"><a class="btn btn-ghost" href="#/dashboard">На главную</a></div>' +
        '</div>';
    }
  } catch (error) {
    if (!error.silent) showError(view, error);
  } finally {
    decorateTables(view);
  }
}

async function renderFederationSection(view, section, route) {
  if (section === 'applications') return renderFederationApplications(view, route);
  if (section === 'results') return renderFederationResults(view, route);
  if (section === 'ranks') return renderFederationRanks(view);
  if (section === 'judges') return renderFederationJudges(view, route);
  if (section === 'requests') return renderFederationRequests(view);
  return renderFederationCompetitions(view);
}

/* --- Главная страница ---------------------------------------------------- */

async function renderDashboard(el) {
  var role = auth.activeRole;
  var fio = auth.user ? auth.user.fio : '';

  el.innerHTML =
    pageHeader('Здравствуйте, ' + shortFio(fio), 'Сводка по кабинету "' + (ROLE_TITLES[role] || '') + '"') +
    '<div id="dashboard-body"></div>';

  var box = el.querySelector('#dashboard-body');
  showLoading(box, 'Собираем данные...');

  var stats = [];
  var quick = [];

  async function safe(promise) {
    try {
      return await promise;
    } catch (error) {
      return null;
    }
  }

  if (role === 'athlete') {
    var myApps = await safe(api('GET', '/applications/my'));
    var myResults = await safe(api('GET', '/results/athlete/' + auth.user.id));
    var myRank = await safe(api('GET', '/ranks/my'));

    if (myApps) {
      stats.push({
        label: 'Мои заявки',
        value: myApps.length,
        note: myApps.filter(function (item) { return item.status === 'pending'; }).length + ' на рассмотрении',
        href: '#/applications'
      });
    }
    if (myResults) {
      stats.push({ label: 'Результаты', value: myResults.length, note: 'выступлений', href: '#/my-results' });
    }
    if (myRank) {
      stats.push({
        label: 'Разряд',
        value: myRank.rankType || 'нет',
        note: myRank.rankUntil ? 'до ' + fmtDate(myRank.rankUntil) : 'не присвоен',
        href: '#/rank'
      });
    }

    quick = [
      { href: '#/competitions', title: 'Соревнования', text: 'Календарь и подача заявок' },
      { href: '#/rank', title: 'Мой разряд', text: 'Заявка на присвоение' },
      { href: '#/my-results', title: 'Результаты', text: 'История выступлений' },
      { href: '#/rating', title: 'Рейтинг', text: 'Место в сезоне' }
    ];
  } else if (role === 'coach') {
    var links = await safe(api('GET', '/coach-athlete'));
    var coachApps = await safe(api('GET', '/applications/my-athletes'));

    if (links) {
      stats.push({
        label: 'Спортсмены',
        value: links.filter(function (item) { return item.status === 'active'; }).length,
        note: 'активных связей',
        href: '#/athletes'
      });
      stats.push({
        label: 'Ожидают подтверждения',
        value: links.filter(function (item) { return item.status === 'pending'; }).length,
        href: '#/athletes'
      });
    }
    if (coachApps) {
      stats.push({ label: 'Заявки подопечных', value: coachApps.length, href: '#/coach-applications' });
    }

    quick = [
      { href: '#/athletes', title: 'Мои спортсмены', text: 'Привязка и связи' },
      { href: '#/coach-applications', title: 'Заявки', text: 'Статусы подопечных' },
      { href: '#/coach-ranks', title: 'Разряды', text: 'Заявка за спортсмена' },
      { href: '#/competitions', title: 'Соревнования', text: 'Подать заявку' }
    ];
  } else if (role === 'judge') {
    var assignments = await safe(api('GET', '/judges/my'));
    var category = await safe(api('GET', '/judges/category/my'));

    if (assignments) {
      stats.push({ label: 'Назначения', value: assignments.length, note: 'соревнований', href: '#/judge' });
    }
    if (category) {
      stats.push({
        label: 'Категория',
        value: category.category || 'нет',
        note: category.categoryUntil ? 'до ' + fmtDate(category.categoryUntil) : 'не присвоена',
        href: '#/judge/category'
      });
    }

    quick = [
      { href: '#/judge', title: 'Мои назначения', text: 'Соревнования и должности' },
      { href: '#/judge/category', title: 'Категория', text: 'Заявка на повышение' },
      { href: '#/competitions', title: 'Соревнования', text: 'Протоколы и результаты' }
    ];
  } else if (role === 'federation') {
    var pendingApps = await safe(api('GET', '/applications?status=pending'));
    var competitions = await safe(api('GET', '/competitions'));
    var fedRequests = await safe(api('GET', '/auth/federation-requests'));
    var rankRequests = await safe(api('GET', '/ranks/requests'));

    if (pendingApps) {
      stats.push({ label: 'Заявки на рассмотрении', value: pendingApps.length, href: '#/federation/applications' });
    }
    if (competitions) {
      stats.push({
        label: 'Соревнования',
        value: competitions.length,
        note: competitions.filter(function (item) { return item.status === 'applications_open'; }).length + ' с открытыми заявками',
        href: '#/federation/competitions'
      });
    }
    if (rankRequests) {
      stats.push({
        label: 'Заявки на разряды',
        value: rankRequests.filter(function (item) { return item.status === 'pending'; }).length,
        note: 'ожидают решения',
        href: '#/federation/ranks'
      });
    }
    if (fedRequests) {
      stats.push({
        label: 'Заявки на роль',
        value: fedRequests.filter(function (item) { return item.status === 'pending'; }).length,
        note: 'новых представителей',
        href: '#/federation/requests'
      });
    }

    quick = [
      { href: '#/federation/competitions', title: 'Соревнования', text: 'Создание и публикация' },
      { href: '#/federation/applications', title: 'Заявки', text: 'Модерация участников' },
      { href: '#/federation/results', title: 'Результаты', text: 'Ввод мест и баллов' },
      { href: '#/registry', title: 'Реестр', text: 'Спортсмены и выгрузка' },
      { href: '#/rating', title: 'Сборная', text: 'Рейтинг и состав' },
      { href: '#/reports', title: 'Отчёты', text: 'Протоколы и приказы' }
    ];
  }

  var openCompetitions = await safe(api('GET', '/competitions?status=applications_open'));

  var statsHtml = stats.length
    ? '<div class="grid stats">' + stats.map(statCard).join('') + '</div>'
    : '<div class="notice">Сводка появится после первых данных.</div>';

  var competitionsHtml = openCompetitions && openCompetitions.length
    ? '<div class="table-wrap"><table class="table">' +
        '<thead><tr><th>Соревнование</th><th>Даты</th><th>Место</th><th></th></tr></thead>' +
        '<tbody>' +
          openCompetitions.slice(0, 6).map(function (competition) {
            return '<tr>' +
              '<td class="strong">' + esc(competition.name) + '</td>' +
              '<td class="num">' + esc(fmtPeriod(competition.dateStart, competition.dateEnd)) + '</td>' +
              '<td class="muted">' + esc(competition.place || '-') + '</td>' +
              '<td><a class="btn btn-sm btn-ghost" href="#/competition/' + esc(competition.id) + '">Открыть</a></td>' +
            '</tr>';
          }).join('') +
        '</tbody>' +
      '</table></div>'
    : emptyBlock('Открытых соревнований нет', 'Приём заявок сейчас не идёт.');

  var quickHtml = quick.map(function (item) {
    return '<a class="quick-link" href="' + item.href + '">' +
      '<strong>' + esc(item.title) + '</strong>' +
      '<span>' + esc(item.text) + '</span>' +
    '</a>';
  }).join('');

  box.innerHTML = statsHtml +
    '<div class="grid cols-2" style="margin-top:18px">' +
      '<section class="card">' +
        '<div class="card-head"><h2>Открыт приём заявок</h2><a class="btn btn-ghost btn-sm" href="#/competitions">Все</a></div>' +
        competitionsHtml +
      '</section>' +
      '<section class="card">' +
        '<div class="card-head"><h2>Быстрые действия</h2></div>' +
        '<div class="quick-links">' + quickHtml + '</div>' +
      '</section>' +
    '</div>';
}

function statCard(item, index) {
  var tag = item.href ? 'a' : 'div';
  return '<' + tag + ' class="stat' + (index === 0 ? ' accent' : '') + '"' +
    (item.href ? ' href="' + item.href + '"' : '') + '>' +
      '<div class="stat-label">' + esc(item.label) + '</div>' +
      '<div class="stat-value">' + esc(item.value) + '</div>' +
      (item.note ? '<div class="stat-note">' + esc(item.note) + '</div>' : '') +
    '</' + tag + '>';
}

/* --- Перезагрузка данных пользователя ------------------------------------ */

async function refreshMe() {
  var me = await api('GET', '/auth/me', undefined, { role: false });

  auth.user = { id: me.id, fio: me.fio };
  auth.roles = me.roles || [];
  auth.roleDetails = me.roleDetails || [];

  if (auth.roles.indexOf(auth.activeRole) === -1) {
    auth.activeRole = auth.roles[0] || null;
  }

  saveAuth();
}

/* --- Запуск и переходы --------------------------------------------------- */

function onRouteChange() {
  var hash = location.hash;

  if (!auth.token) {
    if (hash === '#/register') {
      renderRegisterPage();
    } else if (hash === '#/pending') {
      renderPendingPage();
    } else {
      renderLoginPage();
    }
    return;
  }

  if (!auth.roles.length) {
    renderPendingPage();
    return;
  }

  if (hash === '#/login' || hash === '#/register' || hash === '#/pending' || hash === '') {
    history.replaceState(null, '', '#/dashboard');
  }

  if (!document.getElementById('view')) {
    mountShell();
  }

  updateShell();
  updateNav();
  renderRoute();
}

async function boot() {
  loadAuth();

  if (auth.token) {
    try {
      await refreshMe();
    } catch (error) {
      if (error.status === 401) clearAuth();
    }
  }

  if (!auth.activeRole && auth.roles.length) {
    auth.activeRole = auth.roles[0];
  }

  onRouteChange();
}

document.addEventListener('DOMContentLoaded', boot);
window.addEventListener('hashchange', onRouteChange);
