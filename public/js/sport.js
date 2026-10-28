/* ==========================================================================
   Личные кабинеты: спортсмен, тренер, судья.
   ========================================================================== */

var RANK_OPTIONS = [
  { value: 'III', label: 'III разряд' },
  { value: 'II', label: 'II разряд' },
  { value: 'I', label: 'I разряд' },
  { value: 'КМС', label: 'КМС' },
  { value: 'МС', label: 'МС' }
];

var JUDGE_CATEGORY_OPTIONS = [
  { value: 'третья', label: 'Третья' },
  { value: 'вторая', label: 'Вторая' },
  { value: 'первая', label: 'Первая' },
  { value: 'высшая', label: 'Высшая' }
];

/* --- Спортсмен: мои заявки ----------------------------------------------- */

async function renderMyApplications(el) {
  if (!ensureActiveRole(el, 'athlete')) return;

  el.innerHTML = pageHeader('Мои заявки', 'Заявки на соревнования и их статус') + '<div id="my-applications"></div>';
  var box = el.querySelector('#my-applications');
  showLoading(box);

  var applications;
  try {
    applications = await api('GET', '/applications/my');
  } catch (error) {
    showError(box, error);
    return;
  }

  if (!applications.length) {
    box.innerHTML = emptyBlock('Заявок пока нет', 'Откройте соревнование с открытым приёмом заявок и подайте заявку.');
    return;
  }

  box.innerHTML = '<div class="table-wrap"><table class="table">' +
    '<thead><tr><th>Соревнование</th><th>Дата</th><th>Статус</th><th>Причина отказа</th></tr></thead>' +
    '<tbody>' +
      applications.map(function (application) {
        return '<tr>' +
          '<td class="strong"><a href="#/competition/' + esc(application.competitionId) + '">' + esc(application.competitionName) + '</a></td>' +
          '<td class="num">' + esc(fmtDate(application.dateStart)) + '</td>' +
          '<td>' + statusBadge(application.status) + '</td>' +
          '<td class="muted">' + esc(application.rejectReason || '-') + '</td>' +
        '</tr>';
      }).join('') +
    '</tbody>' +
  '</table></div>';
}

/* --- Спортсмен: мои результаты ------------------------------------------- */

async function renderMyResults(el) {
  if (!ensureActiveRole(el, 'athlete')) return;

  el.innerHTML =
    pageHeader('Мои результаты', 'История выступлений и скачивание отчёта') +
    '<div id="my-results"></div>';

  var box = el.querySelector('#my-results');
  showLoading(box);

  var results;
  try {
    results = await api('GET', '/results/athlete/' + auth.user.id);
  } catch (error) {
    showError(box, error);
    return;
  }

  var downloadButton = '<button class="btn btn-ghost" id="download-athlete-report">Скачать отчёт (.docx)</button>';

  if (!results.length) {
    box.innerHTML =
      '<div class="card">' + emptyBlock('Результатов пока нет', 'Результаты появляются после внесения федерацией.') +
      '<div class="form-actions">' + downloadButton + '</div></div>';
  } else {
    box.innerHTML =
      '<div class="card">' +
        '<div class="card-head"><h2>Выступления</h2>' + downloadButton + '</div>' +
        '<div class="table-wrap"><table class="table">' +
          '<thead><tr><th>Соревнование</th><th>Дата</th><th>Уровень</th><th>Место</th><th>Баллы</th></tr></thead>' +
          '<tbody>' +
            results.map(function (result) {
              return '<tr>' +
                '<td class="strong">' + esc(result.competitionName) + '</td>' +
                '<td class="num">' + esc(fmtDate(result.dateStart)) + '</td>' +
                '<td class="muted">' + esc(result.level) + '</td>' +
                '<td><span class="rating-place' + (result.place && result.place <= 3 ? ' top-' + result.place : '') + '">' + esc(result.place || '-') + '</span></td>' +
                '<td class="num">' + esc(result.points === null || result.points === undefined ? '-' : result.points) + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table></div>' +
      '</div>';
  }

  var downloadButton = box.querySelector('#download-athlete-report');
  if (downloadButton) {
    downloadButton.addEventListener('click', async function () {
      try {
        await downloadFile('/reports/athlete/' + auth.user.id, 'athlete_' + auth.user.id + '.docx');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  }
}

/* --- Спортсмен: мой разряд ----------------------------------------------- */

async function renderMyRank(el) {
  if (!ensureActiveRole(el, 'athlete')) return;

  el.innerHTML = pageHeader('Мой разряд', 'Действующий разряд и заявка на присвоение') + '<div id="my-rank"></div>';
  var box = el.querySelector('#my-rank');
  showLoading(box);

  var rank;
  try {
    rank = await api('GET', '/ranks/my');
  } catch (error) {
    showError(box, error);
    return;
  }

  var results = [];
  try {
    results = await api('GET', '/results/athlete/' + auth.user.id);
  } catch (error) {
    results = [];
  }

  var rankCard =
    '<div class="stat">' +
      '<div class="stat-label">Текущий разряд</div>' +
      '<div class="stat-value">' + esc(rank.rankType || 'нет') + '</div>' +
      '<div class="stat-note">действует до ' + esc(fmtDate(rank.rankUntil)) + '</div>' +
    '</div>';

  var warning = rank.expiringSoon
    ? '<div class="notice warn" style="margin-top:16px">Срок действия разряда истекает в течение 30 дней. Подайте заявку на подтверждение.</div>'
    : '';

  var formHtml;

  if (!results.length) {
    formHtml = emptyBlock('Нет результатов для заявки', 'Сначала нужно выступить на завершённом соревновании - заявка на разряд подаётся по результату.');
  } else {
    formHtml =
      '<form id="rank-request-form" class="grid cols-3" style="align-items:end">' +
        '<label class="field">Результат<select name="result" required>' +
          optionsHtml(results.map(function (result) {
            return {
              value: result.id,
              label: result.competitionName + ' - ' + (result.place || '-') + ' место (' + fmtDate(result.dateStart) + ')'
            };
          }), null, 'Выберите результат') +
        '</select></label>' +
        '<label class="field">Разряд<select name="rankType" required>' +
          optionsHtml(RANK_OPTIONS, null, 'Выберите разряд') +
        '</select></label>' +
        '<button class="btn btn-primary" type="submit" style="height:42px">Подать заявку</button>' +
      '</form>' +
      '<p class="hint" style="margin-top:10px">Заявку рассматривает федерация. После одобрения разряд обновится автоматически.</p>';

    /* Соответствие результата и соревнования храним в data-атрибутах опций */
  }

  box.innerHTML =
    '<div class="grid cols-2">' +
      rankCard +
      '<div class="card">' +
        '<div class="card-head"><h2>Заявка на присвоение разряда</h2></div>' +
        formHtml +
      '</div>' +
    '</div>' +
    warning;

  if (results.length) {
    var form = box.querySelector('#rank-request-form');
    var rankRules = [
      { name: 'result', required: true, emptyMessage: 'Выберите результат' },
      { name: 'rankType', required: true, emptyMessage: 'Выберите разряд' }
    ];

    bindValidation(form, rankRules);

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearFieldErrors(form);

      if (!validateForm(form, rankRules)) return;

      var data = new FormData(form);
      var resultId = Number(data.get('result'));
      var rankType = String(data.get('rankType') || '');
      var found = results.find(function (item) { return Number(item.id) === resultId; });

      if (!found) {
        setFieldError(form.elements.result, 'Выберите результат из списка');
        return;
      }

      var submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Отправляем...';

      try {
        await api('POST', '/ranks/request', {
          competitionId: Number(found.competitionId),
          resultId: resultId,
          rankType: rankType
        });
        toast('Заявка на разряд отправлена федерации.', 'success');
        form.reset();
      } catch (error) {
        toast(error.message, 'error');
      }

      submit.disabled = false;
      submit.textContent = 'Подать заявку';
    });
  }
}

/* --- Тренер: мои спортсмены ---------------------------------------------- */

async function renderCoachAthletes(el) {
  if (!ensureActiveRole(el, 'coach')) return;

  el.innerHTML =
    pageHeader('Мои спортсмены', 'Привязка спортсменов и управление связями') +
    '<div id="coach-athletes"></div>';

  var box = el.querySelector('#coach-athletes');
  showLoading(box);

  var catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    catalog = CATALOG;
  }

  var links;
  try {
    links = await api('GET', '/coach-athlete');
  } catch (error) {
    showError(box, error);
    return;
  }

  var addForm =
    '<section class="card">' +
      '<div class="card-head">' +
        '<div><h2>Добавить спортсмена</h2><div class="sub">Спортсмен должен подтвердить привязку в своём кабинете</div></div>' +
      '</div>' +
      '<form id="add-athlete-form" class="grid cols-3" style="align-items:end">' +
        '<label class="field">Логин спортсмена<input name="athleteLogin" placeholder="например, athlete" required></label>' +
        '<label class="field">Дисциплина<select name="disciplineId" required>' +
          optionsHtml(catalog.disciplines, null, 'Выберите дисциплину') +
        '</select></label>' +
        '<button class="btn btn-primary" type="submit" style="height:42px">Отправить запрос</button>' +
      '</form>' +
      '<p class="hint" style="margin-top:10px">После запроса сообщите спортсмену номер связи из таблицы - по нему он подтвердит привязку.</p>' +
    '</section>' +
    '<section class="card">' +
      '<div class="card-head"><h2>Связи</h2><span class="small muted">' + esc(links.length) + ' шт.</span></div>' +
      (links.length ? coachLinksTable(links) : emptyBlock('Спортсменов пока нет', 'Отправьте запрос по логину спортсмена.')) +
    '</section>';

  box.innerHTML = addForm;

  var addAthleteForm = box.querySelector('#add-athlete-form');
  var addAthleteRules = [
    { name: 'athleteLogin', required: true, emptyMessage: 'Укажите логин спортсмена' },
    { name: 'disciplineId', required: true, emptyMessage: 'Выберите дисциплину' }
  ];

  bindValidation(addAthleteForm, addAthleteRules);

  addAthleteForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearFieldErrors(addAthleteForm);

    if (!validateForm(addAthleteForm, addAthleteRules)) return;

    var data = new FormData(event.target);
    var athleteLogin = String(data.get('athleteLogin') || '').trim();
    var disciplineId = Number(data.get('disciplineId'));

    var submit = event.target.querySelector('button[type="submit"]');
    submit.disabled = true;

    try {
      await api('POST', '/coach-athlete/request', {
        athleteLogin: athleteLogin,
        disciplineId: disciplineId
      });
      toast('Запрос на привязку отправлен.', 'success');
      renderCoachAthletes(el);
    } catch (error) {
      if (error.fields) showServerFieldErrors(addAthleteForm, error.fields);
      else toast(error.message, 'error');
      submit.disabled = false;
    }
  });

  box.querySelectorAll('[data-link-action]').forEach(function (button) {
    button.addEventListener('click', async function () {
      var id = button.getAttribute('data-id');
      var action = button.getAttribute('data-link-action');
      var titles = { pause: 'приостановлена', finish: 'завершена' };

      if (action === 'finish' && !confirm('Завершить связь со спортсменом?')) return;

      button.disabled = true;

      try {
        await api('POST', '/coach-athlete/' + id + '/' + action);
        toast('Связь ' + titles[action] + '.', 'success');
        renderCoachAthletes(el);
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
      }
    });
  });
}

function coachLinksTable(links) {
  return '<div class="table-wrap"><table class="table">' +
    '<thead><tr><th>№</th><th>Спортсмен</th><th>Дисциплина</th><th>Статус</th><th>Создана</th><th></th></tr></thead>' +
    '<tbody>' +
      links.map(function (link) {
        var actions = '';

        if (link.status === 'pending' || link.status === 'active') {
          actions += '<button class="btn btn-sm btn-ghost" data-link-action="pause" data-id="' + esc(link.id) + '">Приостановить</button>';
        }
        if (link.status !== 'finished') {
          actions += '<button class="btn btn-sm btn-danger" data-link-action="finish" data-id="' + esc(link.id) + '">Завершить</button>';
        }

        return '<tr>' +
          '<td class="num">' + esc(link.id) + '</td>' +
          '<td class="strong">' + esc(link.athleteFio) + '</td>' +
          '<td class="muted">' + esc(link.discipline) + '</td>' +
          '<td>' + statusBadge(link.status) + '</td>' +
          '<td class="num">' + esc(fmtDate(link.createdAt)) + '</td>' +
          '<td><div class="actions">' + actions + '</div></td>' +
        '</tr>';
      }).join('') +
    '</tbody>' +
  '</table></div>';
}

/* --- Тренер: заявки подопечных ------------------------------------------- */

async function renderCoachApplications(el) {
  if (!ensureActiveRole(el, 'coach')) return;

  el.innerHTML = pageHeader('Заявки подопечных', 'Заявки спортсменов, привязанных к вам') + '<div id="coach-applications"></div>';
  var box = el.querySelector('#coach-applications');
  showLoading(box);

  var applications;
  try {
    applications = await api('GET', '/applications/my-athletes');
  } catch (error) {
    showError(box, error);
    return;
  }

  if (!applications.length) {
    box.innerHTML = emptyBlock('Заявок нет', 'Когда спортсмен подаст заявку, она появится здесь.');
    return;
  }

  box.innerHTML = '<div class="table-wrap"><table class="table">' +
    '<thead><tr><th>Спортсмен</th><th>Соревнование</th><th>Статус</th><th>Причина отказа</th></tr></thead>' +
    '<tbody>' +
      applications.map(function (application) {
        return '<tr>' +
          '<td class="strong">' + esc(application.athleteFio) + '</td>' +
          '<td>' + esc(application.competitionName) + '</td>' +
          '<td>' + statusBadge(application.status) + '</td>' +
          '<td class="muted">' + esc(application.rejectReason || '-') + '</td>' +
        '</tr>';
      }).join('') +
    '</tbody>' +
  '</table></div>';
}

/* --- Тренер: разряды подопечных ------------------------------------------ */

async function renderCoachRanks(el) {
  if (!ensureActiveRole(el, 'coach')) return;

  el.innerHTML = pageHeader('Разряды подопечных', 'Действующие разряды и заявки на присвоение') + '<div id="coach-ranks"></div>';
  var box = el.querySelector('#coach-ranks');
  showLoading(box);

  var ranks;
  try {
    ranks = await api('GET', '/ranks/my-athletes');
  } catch (error) {
    showError(box, error);
    return;
  }

  var requestCard;

  if (!ranks.length) {
    requestCard = '<section class="card">' + emptyBlock('Нет привязанных спортсменов', 'Заявку на разряд можно подать после привязки спортсмена.') + '</section>';
  } else {
    requestCard =
      '<section class="card">' +
        '<div class="card-head"><h2>Заявка на разряд за спортсмена</h2></div>' +
        '<form id="coach-rank-form" class="grid cols-3" style="align-items:end">' +
          '<label class="field">Спортсмен<select name="athlete" required>' +
            optionsHtml(ranks.map(function (item) {
              return { value: item.athleteUserId, label: item.athleteFio };
            }), null, 'Выберите спортсмена') +
          '</select></label>' +
          '<label class="field">Результат<select name="result" id="coach-rank-result" required><option value="">Сначала выберите спортсмена</option></select></label>' +
          '<label class="field">Разряд<select name="rankType" required>' +
            optionsHtml(RANK_OPTIONS, null, 'Выберите разряд') +
          '</select></label>' +
          '<button class="btn btn-primary" type="submit" style="height:42px;grid-column:1/-1;justify-self:start">Подать заявку</button>' +
        '</form>' +
      '</section>';
  }

  var tableHtml = ranks.length
    ? '<div class="table-wrap"><table class="table">' +
        '<thead><tr><th>Спортсмен</th><th>Разряд</th><th>Действует до</th><th>Примечание</th></tr></thead>' +
        '<tbody>' +
          ranks.map(function (item) {
            return '<tr>' +
              '<td class="strong">' + esc(item.athleteFio) + '</td>' +
              '<td>' + (item.rankType ? '<span class="badge blue plain">' + esc(item.rankType) + '</span>' : '<span class="muted">нет</span>') + '</td>' +
              '<td class="num">' + esc(fmtDate(item.rankUntil)) + '</td>' +
              '<td>' + (item.expiringSoon ? '<span class="badge yellow">истекает</span>' : '<span class="muted">-</span>') + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody>' +
      '</table></div>'
    : emptyBlock('Данных нет', 'Разряды появятся после подтверждения связей.');

  box.innerHTML = requestCard + '<section class="card"><div class="card-head"><h2>Разряды</h2></div>' + tableHtml + '</section>';

  if (ranks.length) {
    var form = box.querySelector('#coach-rank-form');
    var athleteSelect = form.elements.athlete;
    var resultSelect = box.querySelector('#coach-rank-result');
    var resultsCache = {};

    athleteSelect.addEventListener('change', async function () {
      var athleteId = athleteSelect.value;
      resultSelect.innerHTML = '<option value="">Загрузка...</option>';

      if (!athleteId) {
        resultSelect.innerHTML = '<option value="">Сначала выберите спортсмена</option>';
        return;
      }

      try {
        var results = resultsCache[athleteId];
        if (!results) {
          results = await api('GET', '/results/athlete/' + athleteId);
          resultsCache[athleteId] = results;
        }

        if (!results.length) {
          resultSelect.innerHTML = '<option value="">Нет результатов</option>';
          return;
        }

        resultSelect.innerHTML = optionsHtml(results.map(function (result) {
          return {
            value: result.id,
            label: result.competitionName + ' - ' + (result.place || '-') + ' место'
          };
        }), null, 'Выберите результат');
      } catch (error) {
        resultSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
      }
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      var data = new FormData(form);
      var athleteId = Number(data.get('athlete'));
      var resultId = Number(data.get('result'));
      var rankType = String(data.get('rankType') || '');

      if (!athleteId || !resultId || !rankType) {
        toast('Заполните все поля заявки.', 'warn');
        return;
      }

      var results = resultsCache[athleteId] || [];
      var found = results.find(function (item) { return Number(item.id) === resultId; });

      if (!found) {
        toast('Выберите результат спортсмена.', 'warn');
        return;
      }

      var submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;

      try {
        await api('POST', '/ranks/request', {
          athleteUserId: athleteId,
          competitionId: Number(found.competitionId),
          resultId: resultId,
          rankType: rankType
        });
        toast('Заявка на разряд отправлена.', 'success');
        form.reset();
        resultSelect.innerHTML = '<option value="">Сначала выберите спортсмена</option>';
      } catch (error) {
        toast(error.message, 'error');
      }

      submit.disabled = false;
    });
  }
}

/* --- Судья: назначения --------------------------------------------------- */

async function renderJudgeAssignments(el) {
  if (!ensureActiveRole(el, 'judge')) return;

  el.innerHTML = pageHeader('Мои назначения', 'Соревнования, на которых вы работаете судьёй') + '<div id="judge-assignments"></div>';
  var box = el.querySelector('#judge-assignments');
  showLoading(box);

  var assignments;
  try {
    assignments = await api('GET', '/judges/my');
  } catch (error) {
    showError(box, error);
    return;
  }

  if (!assignments.length) {
    box.innerHTML = emptyBlock('Назначений нет', 'Федерация назначает судей на соревнования.');
    return;
  }

  box.innerHTML = '<div class="table-wrap"><table class="table">' +
    '<thead><tr><th>Соревнование</th><th>Дата</th><th>Должность</th></tr></thead>' +
    '<tbody>' +
      assignments.map(function (assignment) {
        return '<tr>' +
          '<td class="strong"><a href="#/competition/' + esc(assignment.competitionId) + '">' + esc(assignment.competitionName) + '</a></td>' +
          '<td class="num">' + esc(fmtDate(assignment.dateStart)) + '</td>' +
          '<td><span class="badge blue plain">' + esc(assignment.position) + '</span></td>' +
        '</tr>';
      }).join('') +
    '</tbody>' +
  '</table></div>';
}

/* --- Судья: категория ---------------------------------------------------- */

async function renderJudgeCategory(el) {
  if (!ensureActiveRole(el, 'judge')) return;

  el.innerHTML = pageHeader('Моя категория', 'Судейская категория и заявка на повышение') + '<div id="judge-category"></div>';
  var box = el.querySelector('#judge-category');
  showLoading(box);

  var category;
  try {
    category = await api('GET', '/judges/category/my');
  } catch (error) {
    showError(box, error);
    return;
  }

  box.innerHTML =
    '<div class="grid cols-2">' +
      '<div class="stat">' +
        '<div class="stat-label">Судейская категория</div>' +
        '<div class="stat-value">' + esc(category.category || 'нет') + '</div>' +
        '<div class="stat-note">действует до ' + esc(fmtDate(category.categoryUntil)) + '</div>' +
      '</div>' +
      '<section class="card">' +
        '<div class="card-head"><h2>Заявка на категорию</h2></div>' +
        '<form id="judge-category-form" class="form-row" style="align-items:end">' +
          '<label class="field">Желаемая категория<select name="category" required>' +
            optionsHtml(JUDGE_CATEGORY_OPTIONS, null, 'Выберите категорию') +
          '</select></label>' +
          '<button class="btn btn-primary" type="submit" style="height:42px">Подать заявку</button>' +
        '</form>' +
        '<p class="hint" style="margin-top:10px">Заявку рассматривает федерация.</p>' +
      '</section>' +
    '</div>' +
    (category.expiringSoon
      ? '<div class="notice warn" style="margin-top:16px">Срок действия категории истекает в течение 30 дней.</div>'
      : '');

  var categoryForm = box.querySelector('#judge-category-form');

  bindValidation(categoryForm, [
    { name: 'category', required: true, emptyMessage: 'Выберите категорию' }
  ]);

  categoryForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearFieldErrors(categoryForm);

    if (!validateForm(categoryForm, [
      { name: 'category', required: true, emptyMessage: 'Выберите категорию' }
    ])) return;

    var data = new FormData(event.target);
    var categoryValue = String(data.get('category') || '');

    var submit = event.target.querySelector('button[type="submit"]');
    submit.disabled = true;

    try {
      await api('POST', '/judges/category/request', { category: categoryValue });
      toast('Заявка на категорию отправлена.', 'success');
      event.target.reset();
    } catch (error) {
      if (error.fields) showServerFieldErrors(categoryForm, error.fields);
      else toast(error.message, 'error');
    }

    submit.disabled = false;
  });
}
