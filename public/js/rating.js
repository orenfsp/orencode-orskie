/* ==========================================================================
   Рейтинг, сборная, реестр спортсменов и отчёты.
   ========================================================================== */

/* --- Рейтинг ------------------------------------------------------------- */

async function renderRating(el) {
  el.innerHTML =
    pageHeader('Рейтинг и сборная', 'Сезонный рейтинг по дисциплинам и формирование состава') +
    '<div id="rating-page"></div>';

  var box = el.querySelector('#rating-page');
  showLoading(box);

  var catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    catalog = { disciplines: [], ageGroups: [], organizations: [] };
  }

  var isFederation = auth.activeRole === 'federation';
  var currentYear = new Date().getFullYear();

  box.innerHTML =
    '<div class="filters">' +
      '<label class="field"><span>Дисциплина</span><select id="rating-discipline">' +
        optionsHtml(catalog.disciplines, null, 'Все дисциплины') +
      '</select></label>' +
      '<label class="field"><span>Возрастная группа</span><select id="rating-age">' +
        optionsHtml(catalog.ageGroups, null, 'Все группы') +
      '</select></label>' +
    '</div>' +
    '<div id="rating-table"></div>' +
    (isFederation ? teamCard(catalog, currentYear) : '');

  var disciplineSelect = box.querySelector('#rating-discipline');
  var ageSelect = box.querySelector('#rating-age');
  var tableBox = box.querySelector('#rating-table');

  async function load() {
    showLoading(tableBox, 'Считаем рейтинг...');

    var query = [];
    if (disciplineSelect.value) query.push('disciplineId=' + encodeURIComponent(disciplineSelect.value));
    if (ageSelect.value) query.push('ageGroupId=' + encodeURIComponent(ageSelect.value));

    try {
      var list = await api('GET', '/rating' + (query.length ? '?' + query.join('&') : ''));

      if (!list.length) {
        tableBox.innerHTML = emptyBlock(
          'Рейтинг пуст',
          'Рейтинг считается по завершённым соревнованиям и призовым местам (1-3).'
        );
        return;
      }

      tableBox.innerHTML = ratingTable(list, isFederation);

      tableBox.querySelectorAll('[data-breakdown]').forEach(function (button) {
        button.addEventListener('click', function () {
          showBreakdown(button.getAttribute('data-breakdown'));
        });
      });
    } catch (error) {
      showError(tableBox, error);
    }
  }

  async function showBreakdown(athleteUserId) {
    var data;
    try {
      data = await api('GET', '/rating/' + athleteUserId);
    } catch (error) {
      toast(error.message, 'error');
      return;
    }

    var rows = data.breakdown.map(function (item) {
      return '<div class="breakdown-row">' +
        '<span>' + esc(item.competitionName) + ' <span class="muted small">- ' + esc(item.level) + ', ' + esc(item.place) + ' место</span></span>' +
        '<b>' + esc(item.basePoints) + '</b>' +
      '</div>';
    }).join('');

    var html =
      '<div class="breakdown">' + rows + '</div>' +
      '<div class="notice" style="margin-top:14px">' +
        'Сумма баллов: <b>' + esc(Math.round(data.total / data.stabilityCoefficient)) + '</b> - ' +
        'коэффициент стабильности: <b>x' + esc(data.stabilityCoefficient) + '</b> - ' +
        'итого: <b>' + esc(data.total) + '</b>' +
      '</div>';

    await openModal({
      title: 'Расшифровка рейтинга',
      body: html,
      submitText: 'Закрыть',
      cancelText: 'Назад'
    });
  }

  disciplineSelect.addEventListener('change', load);
  ageSelect.addEventListener('change', load);

  await load();

  if (isFederation) setupTeamCard(box, catalog);
}

function ratingTable(list, withCheckbox) {
  return '<div class="table-wrap"><table class="table">' +
    '<thead><tr>' +
      (withCheckbox ? '<th style="width:34px"></th>' : '') +
      '<th>#</th><th>Спортсмен</th><th>Баллы</th><th>Призовых</th><th>Коэф.</th><th></th>' +
    '</tr></thead>' +
    '<tbody>' +
      list.map(function (athlete, index) {
        var place = index + 1;
        var placeClass = place <= 3 ? ' top-' + place : '';

        return '<tr>' +
          (withCheckbox
            ? '<td><input type="checkbox" class="team-check" value="' + esc(athlete.athleteUserId) + '"></td>'
            : '') +
          '<td><span class="rating-place' + placeClass + '">' + place + '</span></td>' +
          '<td class="strong">' + esc(athlete.fio) + '</td>' +
          '<td class="num"><span class="score">' + esc(athlete.total) + '</span></td>' +
          '<td class="num">' + esc(athlete.prizes) + '</td>' +
          '<td class="num">x' + esc(athlete.stabilityCoefficient) + '</td>' +
          '<td><button class="btn btn-sm btn-ghost" data-breakdown="' + esc(athlete.athleteUserId) + '">Расшифровка</button></td>' +
        '</tr>';
      }).join('') +
    '</tbody>' +
  '</table></div>';
}

function teamCard(catalog, year) {
  return '<section class="card" id="team-card">' +
    '<div class="card-head">' +
      '<div><h2>Сборная</h2><div class="sub">Отметьте спортсменов в таблице рейтинга и сохраните состав</div></div>' +
    '</div>' +
    '<div class="form-row">' +
      '<label class="field">Сезон<input id="team-season" type="number" min="2020" max="2100" value="' + esc(year) + '"></label>' +
      '<label class="field">Дисциплина<select id="team-discipline">' +
        optionsHtml(catalog.disciplines, null, 'Выберите дисциплину') +
      '</select></label>' +
    '</div>' +
    '<div class="form-actions">' +
      '<button class="btn btn-primary" id="team-save">Сохранить состав</button>' +
      '<button class="btn btn-ghost" id="team-order">Скачать приказ (.docx)</button>' +
    '</div>' +
    '<div id="team-list" style="margin-top:18px"></div>' +
  '</section>';
}

function setupTeamCard(box) {
  var seasonInput = box.querySelector('#team-season');
  var disciplineSelect = box.querySelector('#team-discipline');
  var listBox = box.querySelector('#team-list');
  var saveButton = box.querySelector('#team-save');
  var orderButton = box.querySelector('#team-order');

  async function loadTeam() {
    if (!seasonInput.value || !disciplineSelect.value) {
      listBox.innerHTML = emptyBlock('Выберите сезон и дисциплину', '');
      return;
    }

    listBox.innerHTML = '<div class="loading">Загружаем состав...</div>';

    try {
      var team = await api('GET', '/rating/team/' + seasonInput.value + '/' + disciplineSelect.value);

      if (!team.length) {
        listBox.innerHTML = emptyBlock('Состав не сформирован', 'Отметьте спортсменов и нажмите "Сохранить состав".');
        return;
      }

      listBox.innerHTML =
        '<div class="table-wrap"><table class="table">' +
          '<thead><tr><th>#</th><th>Спортсмен</th></tr></thead>' +
          '<tbody>' +
            team.map(function (member, index) {
              return '<tr><td class="num">' + (index + 1) + '</td><td class="strong">' + esc(member.athleteFio) + '</td></tr>';
            }).join('') +
          '</tbody>' +
        '</table></div>';
    } catch (error) {
      listBox.innerHTML = '<div class="notice bad">' + esc(error.message) + '</div>';
    }
  }

  saveButton.addEventListener('click', async function () {
    var seasonError = validateValue('season', seasonInput.value, {
      required: true,
      emptyMessage: 'Укажите сезон'
    });
    setFieldError(seasonInput, seasonError);

    if (!disciplineSelect.value) {
      setFieldError(disciplineSelect, 'Выберите дисциплину');
    } else {
      setFieldError(disciplineSelect, '');
    }

    if (seasonError || !disciplineSelect.value) return;

    var ids = [];
    box.querySelectorAll('.team-check:checked').forEach(function (checkbox) {
      ids.push(Number(checkbox.value));
    });

    if (!ids.length && !confirm('Ни один спортсмен не отмечен. Очистить состав сборной?')) return;

    saveButton.disabled = true;

    try {
      await api('POST', '/rating/team/select', {
        season: Number(seasonInput.value),
        disciplineId: Number(disciplineSelect.value),
        athleteIds: ids
      });
      toast('Состав сборной сохранён.', 'success');
      loadTeam();
    } catch (error) {
      if (error.fields) {
        Object.keys(error.fields).forEach(function (name) {
          toast(error.fields[name], 'error');
        });
      } else {
        toast(error.message, 'error');
      }
    }

    saveButton.disabled = false;
  });

  orderButton.addEventListener('click', async function () {
    var seasonError = validateValue('season', seasonInput.value, {
      required: true,
      emptyMessage: 'Укажите сезон'
    });
    setFieldError(seasonInput, seasonError);

    if (!disciplineSelect.value) {
      setFieldError(disciplineSelect, 'Выберите дисциплину');
      return;
    }

    if (seasonError) return;

    try {
      await downloadFile(
        '/reports/team/' + seasonInput.value + '/' + disciplineSelect.value,
        'team_order_' + seasonInput.value + '_' + disciplineSelect.value + '.docx'
      );
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  seasonInput.addEventListener('input', function () { setFieldError(seasonInput, ''); });
  disciplineSelect.addEventListener('change', function () { setFieldError(disciplineSelect, ''); });

  seasonInput.addEventListener('change', loadTeam);
  disciplineSelect.addEventListener('change', loadTeam);

  loadTeam();
}

/* --- Реестр спортсменов -------------------------------------------------- */

async function renderRegistry(el) {
  if (!ensureActiveRole(el, 'federation')) return;

  el.innerHTML =
    pageHeader('Реестр спортсменов', 'Учёт спортсменов регионального отделения',
      '<button class="btn btn-primary" id="registry-download">Скачать отчёт (.xlsx)</button>') +
    '<div id="registry-table"></div>';

  var box = el.querySelector('#registry-table');
  showLoading(box);

  try {
    await loadCatalog();
  } catch (error) {
    /* справочники нужны только для названий дисциплин */
  }

  var athletes;
  try {
    athletes = await api('GET', '/registry/athletes');
  } catch (error) {
    showError(box, error);
    return;
  }

  var downloadButton = el.querySelector('#registry-download');
  if (downloadButton) {
    downloadButton.addEventListener('click', async function () {
      try {
        await downloadFile('/reports/registry', 'registry.xlsx');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  }

  if (!athletes.length) {
    box.innerHTML = emptyBlock('Реестр пуст', '');
    return;
  }

  box.innerHTML = '<div class="table-wrap"><table class="table">' +
    '<thead><tr><th>ФИО</th><th>Логин</th><th>Дата рождения</th><th>Муниципалитет</th><th>Организация</th><th>Дисциплины</th><th>Разряд</th><th>До</th></tr></thead>' +
    '<tbody>' +
      athletes.map(function (athlete) {
        return '<tr>' +
          '<td class="strong">' + esc(athlete.fio) + '</td>' +
          '<td class="mono muted">' + esc(athlete.login) + '</td>' +
          '<td class="num">' + esc(fmtDate(athlete.birthDate)) + '</td>' +
          '<td class="muted">' + esc(athlete.municipality || '-') + '</td>' +
          '<td class="muted">' + esc(athlete.organization || '-') + '</td>' +
          '<td class="muted">' + esc(disciplinesLabel(athlete.disciplines)) + '</td>' +
          '<td>' + (athlete.rankType ? '<span class="badge blue plain">' + esc(athlete.rankType) + '</span>' : '<span class="muted">-</span>') + '</td>' +
          '<td class="num">' + esc(fmtDate(athlete.rankUntil)) + '</td>' +
        '</tr>';
      }).join('') +
    '</tbody>' +
  '</table></div>';
}

/* --- Отчёты -------------------------------------------------------------- */

async function renderReports(el) {
  if (!ensureActiveRole(el, 'federation')) return;

  el.innerHTML = pageHeader('Отчёты', 'Документы для печати и выгрузки') + '<div id="reports-page"></div>';
  var box = el.querySelector('#reports-page');
  showLoading(box);

  var competitions = [];
  var athletes = [];
  var catalog;

  try {
    catalog = await loadCatalog();
  } catch (error) {
    catalog = { disciplines: [], ageGroups: [], organizations: [] };
  }

  try {
    var loaded = await Promise.all([
      api('GET', '/competitions'),
      api('GET', '/registry/athletes')
    ]);
    competitions = loaded[0];
    athletes = loaded[1];
  } catch (error) {
    showError(box, error);
    return;
  }

  box.innerHTML =
    '<div class="grid cols-2">' +
      '<section class="card">' +
        '<div class="card-head"><h2>Реестр спортсменов</h2></div>' +
        '<p class="muted small" style="margin-bottom:14px">Отчёт о численности с разрезами по годам, организациям и дисциплинам.</p>' +
        '<button class="btn btn-primary" id="report-registry">Скачать registry.xlsx</button>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h2>Протокол соревнования</h2></div>' +
        '<label class="field">Соревнование<select id="report-competition">' +
          optionsHtml(competitions.map(function (item) { return { value: item.id, label: item.name }; }), null, 'Выберите соревнование') +
        '</select></label>' +
        '<div class="form-actions"><button class="btn btn-ghost" id="report-protocol">Скачать протокол</button></div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h2>Отчёт по спортсмену</h2></div>' +
        '<label class="field">Спортсмен<select id="report-athlete">' +
          optionsHtml(athletes.map(function (item) { return { value: item.id, label: item.fio }; }), null, 'Выберите спортсмена') +
        '</select></label>' +
        '<div class="form-actions"><button class="btn btn-ghost" id="report-athlete-button">Скачать отчёт</button></div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h2>Сборная и приказ</h2></div>' +
        '<div class="form-row">' +
          '<label class="field">Сезон<input id="report-season" type="number" min="2020" max="2100" value="' + esc(new Date().getFullYear()) + '"></label>' +
          '<label class="field">Дисциплина<select id="report-discipline">' +
            optionsHtml(catalog.disciplines, null, 'Выберите дисциплину') +
          '</select></label>' +
        '</div>' +
        '<div class="form-actions"><button class="btn btn-ghost" id="report-team">Список сборной и приказ</button></div>' +
      '</section>' +
    '</div>';

  async function runDownload(url, filename) {
    try {
      await downloadFile(url, filename);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  var registryButton = box.querySelector('#report-registry');
  if (registryButton) {
    registryButton.addEventListener('click', function () {
      runDownload('/reports/registry', 'registry.xlsx');
    });
  }

  var protocolButton = box.querySelector('#report-protocol');
  if (protocolButton) {
    protocolButton.addEventListener('click', function () {
      var competitionSelect = box.querySelector('#report-competition');
      var competitionId = competitionSelect ? competitionSelect.value : '';
      if (!competitionId) {
        toast('Выберите соревнование.', 'warn');
        return;
      }
      runDownload('/reports/protocol/' + competitionId, 'protocol_' + competitionId + '.docx');
    });
  }

  var athleteButton = box.querySelector('#report-athlete-button');
  if (athleteButton) {
    athleteButton.addEventListener('click', function () {
      var athleteSelect = box.querySelector('#report-athlete');
      var athleteId = athleteSelect ? athleteSelect.value : '';
      if (!athleteId) {
        toast('Выберите спортсмена.', 'warn');
        return;
      }
      runDownload('/reports/athlete/' + athleteId, 'athlete_' + athleteId + '.docx');
    });
  }

  var teamButton = box.querySelector('#report-team');
  if (teamButton) {
    teamButton.addEventListener('click', function () {
      var seasonInput = box.querySelector('#report-season');
      var disciplineSelect = box.querySelector('#report-discipline');
      var season = seasonInput ? seasonInput.value : '';
      var disciplineId = disciplineSelect ? disciplineSelect.value : '';

      if (!season || !disciplineId) {
        toast('Выберите сезон и дисциплину.', 'warn');
        return;
      }

      runDownload('/reports/team/' + season + '/' + disciplineId, 'team_order_' + season + '_' + disciplineId + '.docx');
    });
  }
}
