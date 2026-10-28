# API платформы ФСП

Базовый URL: `http://localhost:3000/api` (в dev). В проде - тот же домен, что у фронта.

Общение - JSON. Поля в camelCase, даты в ISO (`2026-12-01`).

## Как авторизоваться

Логин:

    POST /api/auth/login
    Content-Type: application/json
    { "login": "athlete", "password": "123" }

Ответ:

    {
      "token": "eyJhbGci...",
      "user": { "id": 2, "fio": "Иванов Иван Иванович" },
      "roles": ["athlete"],
      "roleDetails": [{ "role": "athlete", "title": "Спортсмен" }],
      "activeRole": "athlete",
      "profile": { "id": 2, "fio": "Иванов Иван Иванович" }
    }

Токен живёт 24 часа. Дальше на всех запросах два заголовка:

    Authorization: Bearer <token>
    X-Role: athlete

X-Role - это активный кабинет. У одного аккаунта может быть несколько ролей, переключается без перелогина. Если прислать роль, которой у юзера нет - сервер ответит 403.

Тестовые аккаунты (пароль у всех 123):

| логин | роли |
|---|---|
| fed | federation |
| athlete | athlete |
| coach | coach |
| judge | judge |
| both | athlete, coach |

## Ошибки

Всегда одинаковый JSON:

    { "error": { "code": "FORBIDDEN", "message": "доступ запрещён" } }

Коды: UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), BAD_REQUEST (400), VALIDATION_ERROR (400), CONFLICT (409), INTERNAL (500).

При ошибке проверки полей в ответе есть разбор по полям:

    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "проверьте заполнение полей",
        "fields": { "phone": "Телефон: +7 900 000-00-00", "email": "E-mail: например name@mail.ru" }
      }
    }

Фронт: 401 - на страницу логина, 403 - "нет прав", 400 и 409 - показать message и подсветить поля из error.fields.

## Справочники

    GET /api/catalog/disciplines    -> [{ id, name }] - 6 дисциплин
    GET /api/catalog/age-groups     -> [{ id, name, ageFrom, ageTo }]
    GET /api/catalog/organizations  -> [{ id, name, type }]

Авторизация не нужна.

## Соревнования

Список:

    GET /api/competitions?discipline=1&ageGroup=3&status=applications_open

Ответ - массив:

    [{
      "id": 1,
      "name": "Чемпионат области 2026",
      "discipline": { "id": 1, "name": "программирование алгоритмическое" },
      "ageGroup": { "id": 3, "name": "Мужчины и женщины 22+" },
      "type": "Чемпионат",
      "level": "Региональные",
      "format": "очный",
      "status": "applications_open",
      "dateStart": "2026-11-15",
      "dateEnd": "2026-11-16",
      "place": "Оренбург",
      "applicationsDeadline": "2026-11-01"
    }]

Статусы: draft -> applications_open -> closed -> finished.

Создать (только federation):

    POST /api/competitions
    X-Role: federation
    {
      "name": "Тест",
      "disciplineId": 1,
      "ageGroupId": 3,
      "type": "Чемпионат",
      "level": "Региональные",
      "format": "очный",
      "dateStart": "2026-12-01",
      "dateEnd": "2026-12-02",
      "place": "Оренбург",
      "applicationsDeadline": "2026-11-20",
      "calendarPlan": "Региональный",
      "calendarNumber": "5-Р",
      "regulationUrl": "https://fsp56.ru/regulations/2027.pdf"
    }

Ответ: `{ "id": 7 }`.

Опубликовать (открыть приём заявок):

    POST /api/competitions/:id/publish

Закрыть приём:

    POST /api/competitions/:id/close-applications

## Заявки

Подать (спортсмен или тренер):

    POST /api/applications
    X-Role: athlete
    { "competitionId": 1 }

Тренер за подопечного:

    POST /api/applications
    X-Role: coach
    { "competitionId": 1, "athleteId": 5 }

Ответ: `{ "id": 15, "status": "pending" }`.

Что проверяет сервер: приём заявок открыт, возраст подходит, заявки ещё нет. Если что-то не так - вернёт 400 или 409 с текстом.

Мои заявки (спортсмен):

    GET /api/applications/my

Заявки подопечных (тренер):

    GET /api/applications/my-athletes

Все заявки с фильтрами (federation):

    GET /api/applications?competitionId=1&status=pending

Модерация:

    POST /api/applications/:id/approve
    POST /api/applications/:id/reject
    { "reason": "не подходит по возрасту" }

## Результаты

Внести (только federation):

    POST /api/results
    X-Role: federation
    { "competitionId": 1, "athleteUserId": 2, "place": 1, "points": 100 }

Сервер проверит, что у спортсмена есть одобренная заявка, что приём заявок уже закрыт, что место от 1 до 99 и не занято другим участником. Баллы необязательны.

Список результатов соревнования:

    GET /api/results?competitionId=1

История спортсмена:

    GET /api/results/athlete/:id

## Разряды

Мой разряд (спортсмен):

    GET /api/ranks/my
    -> { "rankType": "I", "rankUntil": "2027-01-01", "expiringSoon": false }

Разряды подопечных (тренер):

    GET /api/ranks/my-athletes

Все разряды (federation):

    GET /api/ranks

Подать заявку на присвоение (спортсмен или тренер):

    POST /api/ranks/request
    {
      "athleteUserId": 2,
      "competitionId": 1,
      "resultId": 10,
      "rankType": "I"
    }

Присвоить (federation):

    POST /api/ranks/:id/approve
    {
      "assignedDate": "2026-11-15",
      "orderNumber": "123-од",
      "assignedUntil": "2028-11-15"
    }

Отклонить:

    POST /api/ranks/:id/reject
    { "reason": "нет оснований" }

Список заявок на разряд (federation):

    GET /api/ranks/requests

## Судьи

Мои назначения (судья):

    GET /api/judges/my

Моя категория (судья):

    GET /api/judges/category/my
    -> { "category": "первая", "categoryUntil": "2027-06-01", "expiringSoon": false }

Заявка на категорию:

    POST /api/judges/category/request
    { "category": "высшая" }

Назначить судью (federation):

    POST /api/judges/assignments
    { "competitionId": 1, "judgeUserId": 4, "position": "главный судья" }

Коллегия соревнования:

    GET /api/judges/assignments?competitionId=1

Список судей для назначения (federation):

    GET /api/judges/list

Заявки на судейскую категорию (federation):

    GET  /api/judges/category/requests
    POST /api/judges/category/requests/:id/approve
    { "category": "высшая", "assignedUntil": "2029-01-01" }
    POST /api/judges/category/requests/:id/reject
    { "reason": "не хватает стажа" }

## Тренер <-> спортсмен

Мои подопечные:

    GET /api/coach-athlete

Запрос на привязку (тренер):

    POST /api/coach-athlete/request
    { "athleteLogin": "athlete", "disciplineId": 1 }

Подтвердить (спортсмен):

    POST /api/coach-athlete/:id/confirm

Приостановить / завершить (тренер):

    POST /api/coach-athlete/:id/pause
    POST /api/coach-athlete/:id/finish

## Рейтинг и сборная

Рейтинг за сезон:

    GET /api/rating?disciplineId=1&ageGroupId=3

Ответ:

    [{
      "athleteUserId": 2,
      "fio": "Иванов Иван Иванович",
      "total": 132,
      "prizes": 3,
      "stabilityCoefficient": 1.2,
      "results": [
        { "level": "Региональные", "place": 1, "basePoints": 40 },
        { "level": "Региональные", "place": 2, "basePoints": 30 }
      ]
    }]

Прозрачность: по каждому спортсмену видно, из чего сложился балл.

Расшифровка по одному:

    GET /api/rating/:athleteUserId
    -> { "breakdown": [...], "stabilityCoefficient": 1.2, "total": 132 }

Собрать сборную (federation):

    POST /api/rating/team/select
    {
      "season": 2026,
      "disciplineId": 1,
      "athleteIds": [2, 7, 9]
    }

Текущий состав:

    GET /api/rating/team/:season/:disciplineId

## Реестр и отчёты

Реестр спортсменов:

    GET /api/registry/athletes

Отчёт о численности (.xlsx):

    GET /api/reports/registry
    -> файл registry.xlsx (Content-Disposition: attachment)

Протокол соревнования (.docx):

    GET /api/reports/protocol/:competitionId
    -> файл protocol_1.docx

Отчёт по спортсмену (.docx):

    GET /api/reports/athlete/:id

Список сборной + приказ (.docx):

    GET /api/reports/team/:season/:disciplineId

Как качать файлы во фронте - либо `window.open(url)`, либо `fetch` + `blob`:

    const r = await fetch('/api/reports/protocol/1', {
      headers: { Authorization: `Bearer ${token}`, 'X-Role': 'federation' }
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'protocol.docx';
    a.click();

### Регистрация

```
POST /api/auth/register
Content-Type: application/json
```

Для ролей athlete, coach, judge аккаунт создаётся сразу. Пример:

```json
{
  "login": "new_athlete",
  "password": "qwerty123",
  "fio": "Новиков Пётр Сергеевич",
  "role": "athlete",
  "consentPd": true,
  "email": "new@example.ru",
  "birthDate": "2008-04-12",
  "municipality": "Оренбург",
  "organizationId": 1,
  "startYear": 2020,
  "disciplines": [1, 3],
  "legalRepresentative": "Новикова Анна Ивановна"
}
```

Ответ (201):

```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 13, "fio": "Новиков Пётр Сергеевич" },
  "roles": ["athlete"],
  "pendingFederation": false
}
```

Для роли federation аккаунт создаётся без ролей, а заявка уходит действующей федерации:

```json
{
  "login": "new_fed",
  "password": "qwerty123",
  "fio": "Сидорова Мария Ивановна",
  "role": "federation",
  "consentPd": true,
  "email": "fed2@example.ru"
}
```

Ответ (201):

```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 14, "fio": "Сидорова Мария Ивановна" },
  "roles": [],
  "pendingFederation": true
}
```

Токен выдаётся, но ролей нет. Доступны только `/api/auth/me` и `/api/auth/my-federation-request`, остальное вернёт 403, пока федерация не одобрит заявку.

Общие обязательные поля: `login`, `password`, `fio`, `role`, `consentPd`. У каждой роли свои обязательные поля:

- athlete: `birthDate`, `municipality`, `disciplines` (минимум одна), при возрасте меньше 18 - `legalRepresentative`;
- coach: `experienceYears` (стаж), `disciplines`;
- judge: `judgeCategory`;
- federation: дополнительных полей нет, создаётся заявка.

Формат проверяется регулярными выражениями на сервере и на клиенте. Ошибки приходят в `error.fields`.

### Роли и профиль

Добавить роль к существующему аккаунту:

    POST /api/auth/roles
    X-Role: athlete
    { "role": "coach", "experienceYears": 5, "disciplines": [1, 2] }

Ответ (201): `{ "roles": ["athlete","coach"], "roleDetails": [...], "activeRole": "coach" }`.
Повторная выдача роли вернёт 409, неизвестная роль - 400.

Профиль:

    GET   /api/auth/profile
    PATCH /api/auth/profile
    {
      "fio": "Иванов Иван Иванович",
      "phone": "+7 900 000-00-00",
      "email": "ivanov@example.ru",
      "municipality": "Оренбург",
      "organizationId": 1,
      "startYear": 2015,
      "disciplines": [1, 2],
      "rusadaDate": "2025-02-10",
      "rusadaUrl": "https://rusada.ru/education/online-course/"
    }

### Заявки на роль федерации

```
GET  /api/auth/federation-requests             список (только federation)
POST /api/auth/federation-requests/:id/approve одобрить
POST /api/auth/federation-requests/:id/reject  { "reason": "..." }
GET  /api/auth/my-federation-request           своя заявка
```

При одобрении пользователю добавляется роль federation к существующим, заявка получает статус approved. При отказе сохраняется причина и статус rejected. Пользователь видит статус через `/api/auth/my-federation-request`.

## Проверка полей

Регулярные выражения лежат в `validation.js` (сервер) и `public/js/validate.js` (клиент).

| Поле | Правило |
|---|---|
| login | `^[A-Za-z][A-Za-z0-9_]{2,19}$` |
| password | `^\S{6,40}$` |
| fio | 2-3 слова, кириллица, дефис |
| email | `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$` |
| phone | `^(\+7|8)[\s-]*\(?\d{3}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}$` |
| birthDate | ISO-дата, реальная, не в будущем, возраст 6-90 |
| startYear | четыре цифры, от 1950 до текущего года |
| experienceYears | целое 0-60 |
| place | целое 1-99 |
| points | целое 0-9999 |
| calendarNumber / orderNumber | буквы, цифры, дефис, слэш |
| url | `^https?://` и домен с точкой |
| reason | 3-300 символов |

Форма не отправляется, пока есть ошибки. Ошибка показывается рядом с полем (блок `.field-error`), поле подсвечивается классом `.has-error`. Сервер повторяет проверку: клиентскую валидацию можно обойти запросом напрямую.


## Уведомления

    GET  /api/notifications                последние 50 уведомлений
    GET  /api/notifications/unread-count   { "count": 3 }
    POST /api/notifications/:id/read       отметить одно прочитанным
    POST /api/notifications/read-all       отметить все прочитанными
    POST /api/notifications/check-deadlines  ручная проверка сроков (federation)

Уведомление содержит type, text, isRead и createdAt.
Одинаковые уведомления за день не дублируются.

## Положения соревнований

    POST /api/competitions/:id/regulation   загрузка файла (federation)
    GET  /api/competitions/:id/regulation   скачивание файла

Загрузка принимает multipart/form-data с полем file. Разрешены PDF и DOCX до 10 МБ.
При повторной загрузке старый файл заменяется, путь хранится в competitions.regulation_path.
