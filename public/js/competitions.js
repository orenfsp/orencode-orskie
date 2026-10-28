/* ==========================================================================
   Соревнования: календарь с фильтрами и карточка соревнования.
   ========================================================================== */

var COMP_STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'applications_open', label: 'Приём заявок' },
  { value: 'closed', label: 'Приём закрыт' },
  { value: 'finished', label: 'Завершено' }
];

/* --- Список соревнований ------------------------------------------------- */

async function renderCompetitions(el) {
  el.innerHTML =
    pageHeader('Соревнования', 'Календарь регионального отделения и приём заявок') +
    '<div class="filters">' +
      '<label class="field"><span>Дисциплина</span><select id="filter-discipline"></select></label>' +
      '<label class="field"><span>Возрастная группа</span><select id="filter-age"></select></label>' +
      '<label class="field"><span>Статус</span><select id="filter-status"></select></label>' +
      '<button class="btn btn-ghost" id="filter-reset" style="height:42px">Сбросить</button>' +
    '</div>' +
    '<div id="competitions-list"></div>';

  var listBox = el.querySelector('#competitions-list');
  var disciplineSelect = el.querySelector('#filter-discipline');
  var ageSelect = el.querySelector('#filter-age');
  var statusSelect = el.querySelector('#filter-status');

  var catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    catalog = { disciplines: [], ageGroups: [], organizations: [] };
  }

  disciplineSelect.innerHTML = optionsHtml(catalog.disciplines, null, 'Все дисциплины');
  ageSelect.innerHTML = optionsHtml(catalog.ageGroups, null, 'Все группы');
  statusSelect.innerHTML = optionsHtml(COMP_STATUS_OPTIONS, null, 'Все статусы');

  async function load() {
    showLoading(listBox, 'Загружаем соревнования...');

    var params = [];
    if (disciplineSelect.value) params.push('discipline=' + encodeURIComponent(disciplineSelect.value));
    if (ageSelect.value) params.push('ageGroup=' + encodeURIComponent(ageSelect.value));
    if (statusSelect.value) params.push('status=' + encodeURIComponent(statusSelect.value));

    var query = params.length ? '?' + params.join('&') : '';

    try {
      var competitions = await api('GET', '/competitions' + query);

      if (!competitions.length) {
        listBox.innerHTML = emptyBlock('Соревнований не найдено', 'Попробуйте изменить фильтры или загляните позже.');
        return;
      }

      listBox.innerHTML = '<div class="comp-grid">' + competitions.map(competitionCard).join('') + '</div>';
    } catch (error) {
      showError(listBox, error);
    }
  }

  disciplineSelect.addEventListener('change', load);
  ageSelect.addEventListener('change', load);
  statusSelect.addEventListener('change', load);
  var resetButton = el.querySelector('#filter-reset');
  if (resetButton) {
    resetButton.addEventListener('click', function () {
      disciplineSelect.value = '';
      ageSelect.value = '';
      statusSelect.value = '';
      load();
    });
  }

  await load();
}

function competitionCard(competition) {
  return '<article class="comp-card">' +
    '<div class="comp-top">' +
      '<h3>' + esc(competition.name) + '</h3>' +
      statusBadge(competition.status) +
    '</div>' +
    '<div class="comp-meta">' + esc(competition.discipline.name) + ', ' + esc(competition.ageGroup.name) + '</div>' +
    '<div class="comp-facts">' +
      '<span>' + esc(fmtPeriod(competition.dateStart, competition.dateEnd)) + '</span>' +
      '<span>' + esc(competition.place || '-') + '</span>' +
      '<span>заявки до ' + esc(fmtDate(competition.applicationsDeadline)) + '</span>' +
    '</div>' +
    '<div class="comp-foot">' +
      '<span>' + esc(competition.type) + ', ' + esc(competition.level) + ', ' + esc(competition.format) + '</span>' +
      '<a class="btn btn-ghost btn-sm" href="#/competition/' + esc(competition.id) + '">Подробнее</a>' +
    '</div>' +
  '</article>';
}

/* --- Карточка одного соревнования --------------------------------------- */

async function renderCompetition(el, competitionId) {
  el.innerHTML = '<div id="competition-detail"></div>';
  var box = el.querySelector('#competition-detail');

  showLoading(box, 'Загружаем соревнование...');

  var competition;
  try {
    competition = await api('GET', '/competitions/' + competitionId);
  } catch (error) {
    showError(box, error);
    return;
  }

  var results = [];
  try {
    results = await api('GET', '/results?competitionId=' + competitionId);
  } catch (error) {
    results = [];
  }

  var myApplication = null;
  if (auth.activeRole === 'athlete') {
    try {
      var mine = await api('GET', '/applications/my');
      myApplication = mine.find(function (item) {
        return Number(item.competitionId) === Number(competitionId);
      }) || null;
    } catch (error) {
      myApplication = null;
    }
  }

  var athletes = [];
  if (auth.activeRole === 'coach') {
    try {
      var links = await api('GET', '/coach-athlete');
      athletes = links.filter(function (link) { return link.status === 'active'; });
    } catch (error) {
      athletes = [];
    }
  }

  var isFederation = auth.activeRole === 'federation';
  var canApplyAthlete = auth.activeRole === 'athlete' &&
    competition.status === 'applications_open' && !myApplication;
  var canApplyCoach = auth.activeRole === 'coach' && competition.status === 'applications_open';

  var actions = [];

  if (isFederation) {
    if (competition.status === 'draft') {
      actions.push('<button class="btn btn-primary" data-action="publish">Опубликовать и открыть заявки</button>');
    }
    if (competition.status === 'applications_open') {
      actions.push('<button class="btn btn-ghost" data-action="close">Закрыть приём заявок</button>');
    }
    actions.push('<a class="btn btn-ghost" href="#/federation/applications?competitionId=' + esc(competition.id) + '">Заявки участников</a>');
    actions.push('<a class="btn btn-ghost" href="#/federation/results?competitionId=' + esc(competition.id) + '">Ввод результатов</a>');
  }

  actions.push('<button class="btn btn-ghost" data-action="protocol">Скачать протокол (.docx)</button>');

  if (canApplyCoach) {
    actions.push(
      '<select class="input" id="apply-athlete" style="max-width:260px">' +
        optionsHtml(athletes.map(function (link) {
          return { value: link.athleteUserId, label: link.athleteFio };
        }), null, 'Выберите спортсмена') +
      '</select>' +
      '<button class="btn btn-primary" data-action="apply-coach">Подать заявку за спортсмена</button>'
    );
  }

  var applyBlock = '';

  if (auth.activeRole === 'athlete') {
    if (myApplication) {
      applyBlock = '<div class="notice" style="margin-bottom:16px">Ваша заявка: ' + statusBadge(myApplication.status) +
        (myApplication.rejectReason ? ' <span class="small">Причина: ' + esc(myApplication.rejectReason) + '</span>' : '') +
        '</div>';
    } else if (canApplyAthlete) {
      applyBlock = '<div class="form-actions" style="margin-bottom:16px"><button class="btn btn-primary" data-action="apply">Подать заявку на участие</button></div>';
    } else if (competition.status !== 'applications_open') {
      applyBlock = '<div class="notice warn" style="margin-bottom:16px">Приём заявок на это соревнование закрыт.</div>';
    }
  }

  box.innerHTML =
    '<a class="hint" href="#/competitions" style="display:inline-block;margin-bottom:14px">Назад к соревнованиям</a>' +
    '<div class="page-head">' +
      '<div>' +
        '<h1>' + esc(competition.name) + '</h1>' +
        '<div class="sub" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">' +
          statusBadge(competition.status) +
          '<span class="badge gray plain">' + esc(competition.type) + '</span>' +
          '<span class="badge gray plain">' + esc(competition.level) + '</span>' +
          '<span class="badge gray plain">' + esc(competition.format) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="page-actions">' + actions.join('') + '</div>' +
    '</div>' +

    applyBlock +

    '<section class="card">' +
      '<div class="card-head"><h2>Основные сведения</h2></div>' +
      '<div class="detail-grid">' +
        '<div class="detail-item"><dt>Дисциплина</dt><dd>' + esc(competition.discipline.name) + '</dd></div>' +
        '<div class="detail-item"><dt>Возрастная группа</dt><dd>' + esc(competition.ageGroup.name) + '</dd></div>' +
        '<div class="detail-item"><dt>Даты</dt><dd>' + esc(fmtPeriod(competition.dateStart, competition.dateEnd)) + '</dd></div>' +
        '<div class="detail-item"><dt>Место</dt><dd>' + esc(competition.place || '-') + '</dd></div>' +
        '<div class="detail-item"><dt>Приём заявок до</dt><dd>' + esc(fmtDate(competition.applicationsDeadline)) + '</dd></div>' +
        '<div class="detail-item"><dt>Календарный план</dt><dd>' + esc(competition.calendarPlan || '-') + '</dd></div>' +
        '<div class="detail-item"><dt>Номер в плане</dt><dd>' + esc(competition.calendarNumber || '-') + '</dd></div>' +
        '<div class="detail-item"><dt>Положение</dt><dd>' +
          (competition.regulationPath
            ? '<a href="/api/competitions/' + esc(competition.id) + '/regulation" target="_blank" rel="noopener">Скачать файл</a>'
            : competition.regulationUrl
              ? '<a href="' + esc(competition.regulationUrl) + '" target="_blank" rel="noopener">Открыть регламент</a>'
              : '-') +
        '</dd></div>' +
        '<div class="detail-item"><dt>ID соревнования</dt><dd>' + esc(competition.id) + '</dd></div>' +
      '</div>' +
    '</section>' +

    (isFederation
      ? '<section class="card">' +
          '<div class="card-head">' +
            '<div><h2>Положение соревнования</h2><div class="sub">PDF или DOCX, до 10 МБ</div></div>' +
          '</div>' +
          '<form id="regulation-form" novalidate>' +
            '<label class="field">Файл положения' +
              '<input type="file" name="file" accept=".pdf,.docx">' +
              '<span class="hint">При повторной загрузке старый файл заменяется.</span>' +
            '</label>' +
            '<div class="form-error" id="regulation-error" hidden></div>' +
            '<div class="form-actions"><button class="btn btn-primary" type="submit">Загрузить положение</button></div>' +
          '</form>' +
        '</section>'
      : '') +

    '<section class="card">' +
      '<div class="card-head">' +
        '<div><h2>Результаты</h2><div class="sub">Итоговые места участников</div></div>' +
        (results.length ? '<button class="btn btn-ghost btn-sm" data-action="protocol">Скачать протокол</button>' : '') +
      '</div>' +
      (results.length ? resultsTable(results) : emptyBlock('Результатов пока нет', 'Их вносит федерация после закрытия приёма заявок.')) +
    '</section>';

  /* --- Обработчики --- */

  var regulationForm = box.querySelector('#regulation-form');
  if (regulationForm) {
    regulationForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      var input = regulationForm.querySelector('[name="file"]');
      var errorBox = box.querySelector('#regulation-error');
      var file = input.files && input.files[0];

      errorBox.hidden = true;

      if (!file) {
        setFieldError(input, 'Выберите файл положения');
        return;
      }

      var ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (ext !== '.pdf' && ext !== '.docx') {
        setFieldError(input, 'Разрешены только PDF и DOCX');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setFieldError(input, 'Файл больше 10 МБ');
        return;
      }

      var submit = regulationForm.querySelector('button[type="submit"]');
      submit.disabled = true;

      var formData = new FormData();
      formData.append('file', file);

      try {
        await apiUpload('/competitions/' + competition.id + '/regulation', formData);
        toast('Положение загружено.', 'success');
        renderCompetition(el, competitionId);
      } catch (error) {
        if (error.fields) showServerFieldErrors(regulationForm, error.fields);
        else {
          errorBox.textContent = error.message;
          errorBox.hidden = false;
        }
        submit.disabled = false;
      }
    });
  }

  box.querySelectorAll('[data-action="protocol"]').forEach(function (button) {
    button.addEventListener('click', async function () {
      try {
        await downloadFile('/reports/protocol/' + competition.id, 'protocol_' + competition.id + '.docx');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  var publishButton = box.querySelector('[data-action="publish"]');
  if (publishButton) {
    publishButton.addEventListener('click', async function () {
      publishButton.disabled = true;
      try {
        await api('POST', '/competitions/' + competition.id + '/publish');
        toast('Соревнование опубликовано, приём заявок открыт.', 'success');
        renderCompetition(el, competitionId);
      } catch (error) {
        toast(error.message, 'error');
        publishButton.disabled = false;
      }
    });
  }

  var closeButton = box.querySelector('[data-action="close"]');
  if (closeButton) {
    closeButton.addEventListener('click', async function () {
      if (!confirm('Закрыть приём заявок? Новые заявки подать будет нельзя.')) return;
      closeButton.disabled = true;
      try {
        await api('POST', '/competitions/' + competition.id + '/close-applications');
        toast('Приём заявок закрыт.', 'success');
        renderCompetition(el, competitionId);
      } catch (error) {
        toast(error.message, 'error');
        closeButton.disabled = false;
      }
    });
  }

  var applyButton = box.querySelector('[data-action="apply"]');
  if (applyButton) {
    applyButton.addEventListener('click', async function () {
      applyButton.disabled = true;
      applyButton.textContent = 'Отправляем...';
      try {
        await api('POST', '/applications', { competitionId: Number(competition.id) });
        toast('Заявка подана и ожидает рассмотрения.', 'success');
        renderCompetition(el, competitionId);
      } catch (error) {
        toast(error.message, 'error');
        applyButton.disabled = false;
        applyButton.textContent = 'Подать заявку на участие';
      }
    });
  }

  var coachApplyButton = box.querySelector('[data-action="apply-coach"]');
  if (coachApplyButton) {
    coachApplyButton.addEventListener('click', async function () {
      var select = box.querySelector('#apply-athlete');
      var athleteId = select && select.value;

      if (!athleteId) {
        toast('Выберите спортсмена.', 'warn');
        return;
      }

      coachApplyButton.disabled = true;
      try {
        await api('POST', '/applications', {
          competitionId: Number(competition.id),
          athleteId: Number(athleteId)
        });
        toast('Заявка за спортсмена подана.', 'success');
        renderCompetition(el, competitionId);
      } catch (error) {
        toast(error.message, 'error');
        coachApplyButton.disabled = false;
      }
    });
  }
}

function resultsTable(results) {
  return '<div class="table-wrap"><table class="table">' +
    '<thead><tr><th>Место</th><th>Спортсмен</th><th>Баллы</th></tr></thead>' +
    '<tbody>' +
      results.map(function (result) {
        return '<tr>' +
          '<td><span class="rating-place' + (result.place && result.place <= 3 ? ' top-' + result.place : '') + '">' +
            esc(result.place || '-') + '</span></td>' +
          '<td class="strong">' + esc(result.athleteFio) + '</td>' +
          '<td class="num">' + esc(result.points === null || result.points === undefined ? '-' : result.points) + '</td>' +
        '</tr>';
      }).join('') +
    '</tbody>' +
  '</table></div>';
}
