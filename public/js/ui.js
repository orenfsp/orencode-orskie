/* ==========================================================================
   Общие элементы интерфейса: форматирование, бейджи, уведомления, модальные
   окна, проверка роли и состояния загрузки.
   ========================================================================== */

/* --- Экранирование HTML -------------------------------------------------- */

function esc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* --- Даты ---------------------------------------------------------------- */

function fmtDate(value) {
  if (!value) return '-';
  var parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return String(value);
  return parts[2] + '.' + parts[1] + '.' + parts[0];
}

function fmtPeriod(start, end) {
  if (!start && !end) return '-';
  if (!end || end === start) return fmtDate(start);
  return fmtDate(start) + ' - ' + fmtDate(end);
}

function fmtDateTime(value) {
  if (!value) return '-';
  var date = fmtDate(value);
  var time = String(value).slice(11, 16);
  return time ? date + ' ' + time : date;
}

/* --- Статусы ------------------------------------------------------------- */

var STATUS_INFO = {
  draft: ['Черновик', 'gray'],
  applications_open: ['Приём заявок', 'green'],
  closed: ['Приём закрыт', 'yellow'],
  finished: ['Завершено', 'blue'],
  pending: ['На рассмотрении', 'yellow'],
  approved: ['Одобрено', 'green'],
  rejected: ['Отклонено', 'red'],
  active: ['Активна', 'green'],
  paused: ['Приостановлена', 'yellow']
};

function statusBadge(status) {
  var info = STATUS_INFO[status] || [status || '-', 'gray'];
  return '<span class="badge ' + info[1] + '">' + esc(info[0]) + '</span>';
}

function roleBadge(role) {
  return '<span class="badge blue plain">' + esc(ROLE_TITLES[role] || role) + '</span>';
}

function initial(fio) {
  var text = String(fio || '?').trim();
  return text ? text.charAt(0).toUpperCase() : '?';
}

function shortFio(fio) {
  var parts = String(fio || '').trim().split(/\s+/);
  if (parts.length < 2) return fio || '-';
  return parts[0] + ' ' + parts[1].charAt(0) + '.' + (parts[2] ? ' ' + parts[2].charAt(0) + '.' : '');
}

/* --- Уведомления --------------------------------------------------------- */

function toast(message, type) {
  var root = document.getElementById('toasts');
  if (!root) return;

  var node = document.createElement('div');
  node.className = 'toast ' + (type || '');
  node.textContent = message;
  root.appendChild(node);

  setTimeout(function () {
    node.style.opacity = '0';
    node.style.transition = 'opacity 0.2s ease';
    setTimeout(function () { node.remove(); }, 220);
  }, 4200);
}

/* --- Модальное окно с формой -------------------------------------------- */

function openModal(options) {
  return new Promise(function (resolve) {
    var root = document.getElementById('modal-root');

    root.innerHTML =
      '<div class="modal-overlay">' +
        '<div class="modal" role="dialog" aria-modal="true">' +
          '<div class="modal-head">' +
            '<h3>' + esc(options.title || '') + '</h3>' +
            '<button type="button" class="icon-btn" data-close aria-label="Закрыть">x</button>' +
          '</div>' +
          '<form class="modal-body" novalidate>' +
            (options.body || '') +
            '<div class="modal-actions">' +
              '<button type="button" class="btn btn-ghost" data-close>' + esc(options.cancelText || 'Отмена') + '</button>' +
              '<button type="submit" class="btn btn-primary">' + esc(options.submitText || 'Сохранить') + '</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';

    var form = root.querySelector('form');

    function close(value) {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      resolve(value);
    }

    function onKey(event) {
      if (event.key === 'Escape') close(null);
    }

    root.querySelectorAll('[data-close]').forEach(function (button) {
      button.addEventListener('click', function () { close(null); });
    });

    var overlay = root.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (event) {
        if (event.target === event.currentTarget) close(null);
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var values = {};
      new FormData(form).forEach(function (value, key) { values[key] = value; });

      if (options.validate) {
        var fields = options.validate(values);
        if (fields && Object.keys(fields).length) {
          showServerFieldErrors(form, fields);
          return;
        }
      }

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      close(values);
    });

    document.addEventListener('keydown', onKey);

    var first = form.querySelector('input, select, textarea');
    if (first) first.focus();
  });
}

/* --- Служебные блоки ----------------------------------------------------- */

function showLoading(container, text) {
  container.innerHTML = '<div class="loading">' + esc(text || 'Загрузка данных...') + '</div>';
}

function showError(container, error) {
  var message = error && error.message ? error.message : 'Что-то пошло не так';
  container.innerHTML =
    '<div class="card">' +
      '<div class="notice bad">' + esc(message) + '</div>' +
      '<div class="form-actions">' +
        '<button class="btn btn-ghost" id="retry-button">Повторить</button>' +
        '<a class="btn btn-ghost" href="#/dashboard">На главную</a>' +
      '</div>' +
    '</div>';

  var retry = container.querySelector('#retry-button');
  if (retry) retry.addEventListener('click', function () { renderRoute(); });
}

function emptyBlock(title, text) {
  return '<div class="empty"><strong>' + esc(title) + '</strong>' + esc(text || '') + '</div>';
}

function optionsHtml(items, selected, placeholder) {
  var html = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
  items.forEach(function (item) {
    var value = item.value === undefined ? item.id : item.value;
    var label = item.label === undefined ? item.name : item.label;
    var isSelected = selected !== undefined && selected !== null && String(selected) === String(value);
    html += '<option value="' + esc(value) + '"' + (isSelected ? ' selected' : '') + '>' + esc(label) + '</option>';
  });
  return html;
}

/* --- Проверка активного кабинета ---------------------------------------- */

function ensureActiveRole(container, role) {
  if (auth.roles.indexOf(role) === -1) {
    container.innerHTML =
      '<div class="card">' +
        '<div class="empty"><strong>Нет доступа</strong>Раздел доступен только роли "' + esc(ROLE_TITLES[role] || role) + '".</div>' +
        '<div class="form-actions"><a class="btn btn-ghost" href="#/dashboard">На главную</a></div>' +
      '</div>';
    return false;
  }

  if (auth.activeRole !== role) {
    container.innerHTML =
      '<div class="card">' +
        '<div class="empty"><strong>Нужен другой кабинет</strong>Этот раздел открывается в кабинете "' + esc(ROLE_TITLES[role] || role) + '".</div>' +
        '<div class="form-actions"><button class="btn btn-primary" id="switch-role-button">Переключиться на "' + esc(ROLE_TITLES[role] || role) + '"</button></div>' +
      '</div>';

    var switchButton = container.querySelector('#switch-role-button');
    if (switchButton) {
      switchButton.addEventListener('click', function () {
        switchToRole(role);
      });
    }
    return false;
  }

  return true;
}

/* --- Хлебные крошки / заголовок страницы --------------------------------- */

function pageHeader(title, subtitle, actionsHtml) {
  return '<div class="page-head">' +
    '<div>' +
      '<h1>' + esc(title) + '</h1>' +
      (subtitle ? '<div class="sub">' + esc(subtitle) + '</div>' : '') +
    '</div>' +
    (actionsHtml ? '<div class="page-actions">' + actionsHtml + '</div>' : '') +
  '</div>';
}
