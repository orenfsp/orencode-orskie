/*
 * Проверка полей на клиенте. Правила повторяют серверные из validation.js,
 * чтобы ошибки были видны до отправки формы.
 */

var FIELD_RULES = {
  login: {
    pattern: /^[A-Za-z][A-Za-z0-9_]{2,19}$/,
    message: 'Логин: 3-20 символов, латиница, цифры и знак подчеркивания'
  },
  password: {
    pattern: /^\S{6,40}$/,
    message: 'Пароль: от 6 до 40 символов без пробелов'
  },
  fio: {
    message: 'ФИО: 2 или 3 слова, только буквы и дефис'
  },
  email: {
    pattern: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
    message: 'E-mail: например name@mail.ru'
  },
  phone: {
    pattern: /^(\+7|8)[\s-]*\(?\d{3}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}$/,
    message: 'Телефон: +7 900 000-00-00'
  },
  municipality: {
    pattern: /^[А-ЯЁа-яё][А-ЯЁа-яё\s.-]{1,39}$/,
    message: 'Муниципалитет: буквы, пробелы, точка и дефис'
  },
  competitionName: {
    pattern: /^[А-ЯЁа-яёA-Za-z0-9"][А-ЯЁа-яёA-Za-z0-9\s"().,/-]{2,119}$/,
    message: 'Название: от 3 до 120 символов'
  },
  placeText: {
    pattern: /^[А-ЯЁа-яёA-Za-z0-9][А-ЯЁа-яёA-Za-z0-9\s.,-]{0,59}$/,
    message: 'Место: буквы, цифры, пробелы, точка, запятая и дефис'
  },
  calendarPlan: {
    pattern: /^[А-ЯЁа-яёA-Za-z0-9\s-]{2,40}$/,
    message: 'Календарный план: буквы, цифры и дефис'
  },
  calendarNumber: {
    pattern: /^[0-9A-Za-zА-Яа-яЁё/-]{1,20}$/,
    message: 'Номер в плане: буквы, цифры, дефис или слэш'
  },
  orderNumber: {
    pattern: /^[0-9A-Za-zА-Яа-яЁё/-]{1,30}$/,
    message: 'Номер приказа: буквы, цифры, дефис или слэш'
  },
  experience: {
    pattern: /^\d{1,2}$/,
    message: 'Стаж: целое число от 0 до 60 лет'
  },
  experienceYears: {
    pattern: /^\d{1,2}$/,
    message: 'Стаж: целое число от 0 до 60 лет'
  },
  place: {
    pattern: /^[1-9]\d?$/,
    message: 'Место: целое число от 1 до 99'
  },
  points: {
    pattern: /^\d{1,4}$/,
    message: 'Баллы: целое число от 0 до 9999'
  },
  url: {
    pattern: /^https?:\/\/[^\s]+$/,
    message: 'Ссылка: адрес должен начинаться с http:// или https://'
  },
  regulationUrl: {
    pattern: /^https?:\/\/[^\s]+$/,
    message: 'Ссылка на положение: адрес должен начинаться с http:// или https://'
  },
  rusadaUrl: {
    pattern: /^https?:\/\/[^\s]+$/,
    message: 'Ссылка на сертификат: адрес должен начинаться с http:// или https://'
  },
  athleteLogin: {
    pattern: /^[A-Za-z][A-Za-z0-9_]{2,19}$/,
    message: 'Логин: 3-20 символов, латиница, цифры и знак подчеркивания'
  },
  reason: {
    pattern: /^[\s\S]{3,300}$/,
    message: 'Причина: от 3 до 300 символов'
  },
  season: {
    pattern: /^(20[2-9]\d|2100)$/,
    message: 'Сезон: год от 2020 до 2100'
  }
};

/* --- Даты ---------------------------------------------------------------- */

function dateToTime(value) {
  var parts = String(value || '').split('-');
  if (parts.length !== 3) return NaN;
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (date.getFullYear() !== Number(parts[0])) return NaN;
  if (date.getMonth() !== Number(parts[1]) - 1) return NaN;
  if (date.getDate() !== Number(parts[2])) return NaN;
  return date.getTime();
}

function calcAgeFromDate(value) {
  var time = dateToTime(value);
  if (isNaN(time)) return null;
  var birth = new Date(time);
  var now = new Date();
  var age = now.getFullYear() - birth.getFullYear();
  var month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function checkBirthDate(value) {
  if (!value) return 'Укажите дату рождения';
  var time = dateToTime(value);
  if (isNaN(time)) return 'Дата рождения: некорректная дата';
  if (time > Date.now()) return 'Дата рождения не может быть в будущем';
  var age = calcAgeFromDate(value);
  if (age < 6 || age > 90) return 'Дата рождения: возраст от 6 до 90 лет';
  return '';
}

function checkStartYear(value, required) {
  if (!value) return required ? 'Укажите год начала занятий' : '';
  if (!/^\d{4}$/.test(value)) return 'Год: четыре цифры';
  var year = Number(value);
  var current = new Date().getFullYear();
  if (year < 1950 || year > current) return 'Год начала занятий: от 1950 до ' + current;
  return '';
}

function checkFio(value) {
  var parts = String(value || '').trim().split(/\s+/);
  if (!value) return 'Укажите ФИО';
  if (parts.length < 2 || parts.length > 3) return FIELD_RULES.fio.message;
  for (var i = 0; i < parts.length; i++) {
    if (!/^[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*$/.test(parts[i]) || parts[i].length < 2) {
      return FIELD_RULES.fio.message;
    }
  }
  return '';
}

/* Проверка одного значения по имени правила. */
function validateValue(name, value, options) {
  options = options || {};
  var text = String(value === null || value === undefined ? '' : value).trim();
  var rule = options.pattern
    ? { pattern: options.pattern, message: options.message }
    : FIELD_RULES[name];

  if (!text) {
    return options.required ? (options.emptyMessage || 'Заполните поле') : '';
  }

  if (name === 'fio') {
    var fioError = checkFio(text);
    if (fioError) return options.message || fioError;
  }

  if (name === 'birthDate') {
    var birthError = checkBirthDate(text);
    if (birthError) return options.message || birthError;
  }

  if (name === 'startYear') {
    var yearError = checkStartYear(text, true);
    if (yearError) return options.message || yearError;
  }

  if (name === 'experience' || name === 'experienceYears') {
    if (Number(text) > 60) return options.message || FIELD_RULES.experience.message;
  }

  if (name === 'points' && Number(text) > 9999) {
    return options.message || FIELD_RULES.points.message;
  }

  if (!options.plain && rule && rule.pattern && !rule.pattern.test(text)) {
    return options.message || rule.message;
  }

  if (options.min && text.length < options.min) {
    return options.message || ('Минимум ' + options.min + ' символов');
  }

  if (options.max && text.length > options.max) {
    return options.message || ('Максимум ' + options.max + ' символов');
  }

  if (options.custom) {
    return options.custom(text) || '';
  }

  return '';
}

/* --- Показ ошибок у полей ------------------------------------------------ */

function fieldBox(input) {
  return input ? input.closest('.field') : null;
}

function setFieldError(input, message) {
  if (!input) return;

  var field = fieldBox(input);
  var holder = field || input.closest('.check-line');

  if (!holder) {
    input.classList.toggle('invalid', !!message);
    input.title = message || '';
    return;
  }

  var box;

  if (field) {
    box = field.querySelector('.field-error');
  } else {
    box = holder.nextElementSibling && holder.nextElementSibling.classList.contains('field-error')
      ? holder.nextElementSibling
      : null;
  }

  if (!box) {
    box = document.createElement('div');
    box.className = 'field-error';
    box.setAttribute('role', 'alert');

    if (field) field.appendChild(box);
    else holder.insertAdjacentElement('afterend', box);
  }

  box.textContent = message || '';
  holder.classList.toggle('has-error', !!message);
  input.classList.toggle('invalid', !!message);
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function clearFieldErrors(root) {
  var scope = root || document;
  scope.querySelectorAll('.field-error').forEach(function (box) {
    box.textContent = '';
  });
  scope.querySelectorAll('.has-error').forEach(function (field) {
    field.classList.remove('has-error');
  });
  scope.querySelectorAll('.invalid').forEach(function (input) {
    input.classList.remove('invalid');
    input.removeAttribute('aria-invalid');
  });
}

/* Показывает ошибки, которые вернул сервер: { поле: текст }. */
function showServerFieldErrors(form, fields) {
  if (!form || !fields) return;
  Object.keys(fields).forEach(function (name) {
    var input = form.elements[name];

    if (!input || !input.closest) {
      input = form.querySelector('[name="' + name + '"]');
    }

    if (!input) {
      toast(fields[name], 'error');
      return;
    }

    setFieldError(input, fields[name]);
  });

  var first = form.querySelector('.field.has-error input, .field.has-error select, .field.has-error textarea, .check-line.has-error input');
  if (first) {
    if (first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    first.focus();
  }
}

/* --- Проверка всей формы ------------------------------------------------- */

function validateForm(form, rules) {
  var first = null;

  rules.forEach(function (rule) {
    var input = form.elements[rule.name];
    if (!input) return;

    var message = '';

    if (rule.checked) {
      message = input.checked ? '' : (rule.message || 'Отметьте поле');
    } else {
      var value = rule.getValue ? rule.getValue(input, form) : input.value;
      message = validateValue(rule.name, value, rule);
    }

    setFieldError(input, message);
    if (message && !first) first = input;
  });

  if (first) {
    if (first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (first.focus) first.focus();
    return false;
  }

  return true;
}

function bindValidation(form, rules) {
  rules.forEach(function (rule) {
    var input = form.elements[rule.name];
    if (!input) return;

    function check() {
      if (rule.checked) {
        if (input.checked) setFieldError(input, '');
        return;
      }

      var field = fieldBox(input);
      if (!field || field.classList.contains('has-error')) {
        setFieldError(input, validateValue(rule.name, input.value, rule));
      } else if (input.value) {
        setFieldError(input, '');
      }
    }

    input.addEventListener('blur', check);
    input.addEventListener('change', check);
    input.addEventListener('input', check);
  });
}

/* Проверка группы чекбоксов (дисциплины). */
function checkDisciplineGroup(form, required) {
  var boxes = form.querySelectorAll('[name="disciplines"]');
  if (!boxes.length) return '';
  var checked = Array.prototype.filter.call(boxes, function (box) { return box.checked; });
  if (required && !checked.length) return 'Выберите хотя бы одну дисциплину';
  return '';
}

function setGroupError(form, name, message) {
  var first = form.querySelector('[name="' + name + '"]');
  if (!first) return false;

  var field = first.closest('.field');
  if (field) {
    var box = field.querySelector('.field-error');
    if (!box) {
      box = document.createElement('div');
      box.className = 'field-error';
      box.setAttribute('role', 'alert');
      field.appendChild(box);
    }
    box.textContent = message || '';
    field.classList.toggle('has-error', !!message);
  }

  return true;
}

/*
 * Проставляет таблицам data-label по заголовкам.
 * На телефоне строки превращаются в карточки, и подпись берется отсюда.
 */
function decorateTables(root) {
  var scope = root || document;

  scope.querySelectorAll('table.table').forEach(function (table) {
    var headers = Array.prototype.map.call(table.querySelectorAll('thead th'), function (cell) {
      return cell.textContent.trim();
    });

    table.querySelectorAll('tbody tr').forEach(function (row) {
      Array.prototype.forEach.call(row.children, function (cell, index) {
        if (cell.hasAttribute('data-label')) return;
        cell.setAttribute('data-label', headers[index] || '');
      });
    });
  });
}
