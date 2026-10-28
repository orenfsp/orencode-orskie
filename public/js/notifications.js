/* Уведомления: счетчик в шапке и страница со списком событий. */

var NOTIFICATION_TYPES = {
  application_created: 'Заявка',
  application_new: 'Заявка',
  application_approved: 'Заявка',
  application_rejected: 'Заявка',
  result_added: 'Результаты',
  result_updated: 'Результаты',
  protocol_published: 'Результаты',
  rank_requested: 'Разряды',
  rank_request_new: 'Разряды',
  rank_approved: 'Разряды',
  rank_rejected: 'Разряды',
  rank_expiring: 'Сроки',
  category_expiring: 'Сроки',
  judge_assigned: 'Судья',
  judge_category_requested: 'Судья',
  judge_category_new: 'Судья',
  judge_category_approved: 'Судья',
  judge_category_rejected: 'Судья',
  competition_published: 'Календарь',
  deadline_soon: 'Сроки',
  federation_request_new: 'Роли',
  federation_request_sent: 'Роли',
  federation_approved: 'Роли',
  federation_rejected: 'Роли',
  role_added: 'Роли',
  coach_link_requested: 'Тренер',
  coach_link_confirmed: 'Тренер',
  coach_link_paused: 'Тренер',
  coach_link_finished: 'Тренер'
};

function notificationTypeTitle(type) {
  return NOTIFICATION_TYPES[type] || 'Событие';
}

function setNotificationCount(count) {
  var badge = document.getElementById('notif-count');
  if (!badge) return;

  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = !count;
}

async function loadUnreadCount() {
  if (!auth.token) return;

  try {
    var result = await api('GET', '/notifications/unread-count');
    setNotificationCount(result.count || 0);
  } catch (error) {
    setNotificationCount(0);
  }
}

async function renderNotifications(el) {
  var canCheck = auth.activeRole === 'federation';

  el.innerHTML =
    pageHeader('Уведомления', 'События по заявкам, результатам и срокам',
      '<button class="btn btn-ghost" id="notif-read-all">Прочитать все</button>' +
      (canCheck ? '<button class="btn btn-primary" id="notif-check">Проверить сроки</button>' : '')) +
    '<div id="notif-list"></div>';

  var box = el.querySelector('#notif-list');
  showLoading(box, 'Загружаем уведомления...');

  async function load() {
    try {
      var list = await api('GET', '/notifications');

      if (!list.length) {
        box.innerHTML = emptyBlock('Уведомлений нет', 'Здесь появятся события по вашим заявкам, результатам и срокам.');
        await loadUnreadCount();
        return;
      }

      box.innerHTML = '<div class="notif-list">' + list.map(function (item) {
        return '<article class="notif-item' + (item.isRead ? '' : ' unread') + '">' +
          '<div class="notif-head">' +
            '<span class="notif-type">' + esc(notificationTypeTitle(item.type)) + '</span>' +
            '<span class="notif-date">' + esc(fmtDateTime(item.createdAt)) + '</span>' +
          '</div>' +
          '<div class="notif-text">' + esc(item.text) + '</div>' +
          (item.isRead ? '' : '<button class="btn btn-sm btn-ghost" data-read="' + esc(item.id) + '">Прочитать</button>') +
        '</article>';
      }).join('') + '</div>';

      box.querySelectorAll('[data-read]').forEach(function (button) {
        button.addEventListener('click', async function () {
          button.disabled = true;
          try {
            await api('POST', '/notifications/' + button.getAttribute('data-read') + '/read');
            await load();
          } catch (error) {
            toast(error.message, 'error');
            button.disabled = false;
          }
        });
      });

      await loadUnreadCount();
    } catch (error) {
      showError(box, error);
    }
  }

  var readAllButton = el.querySelector('#notif-read-all');
  if (readAllButton) {
    readAllButton.addEventListener('click', async function () {
      try {
        await api('POST', '/notifications/read-all');
        toast('Все уведомления прочитаны.', 'success');
        await load();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  }

  var checkButton = el.querySelector('#notif-check');
  if (checkButton) {
    checkButton.addEventListener('click', async function () {
      checkButton.disabled = true;
      checkButton.textContent = 'Проверяем...';

      try {
        var result = await api('POST', '/notifications/check-deadlines');
        var total = (result.ranks || 0) + (result.categories || 0) + (result.deadlines || 0);
        toast('Проверка сроков выполнена, событий: ' + total + '.', 'success');
        await load();
      } catch (error) {
        toast(error.message, 'error');
      }

      checkButton.disabled = false;
      checkButton.textContent = 'Проверить сроки';
    });
  }

  await load();
}
