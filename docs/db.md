# Данные платформы ФСП

Что хранится в базе, кто записывает и кто читает.

Все данные в SQLite (`db.sqlite`). Файлы (PDF, DOCX) лежат в `uploads/`, в базе только путь. Пароли в виде хеша (bcrypt), JWT-токены не хранятся.

---

## users - пользователи

Одна таблица для всех: спортсмены, тренеры, судьи, федерация. Роли хранятся отдельно, в таблице `user_roles` (связь многие-ко-многим). Поле `roles` - строка-кэш для обратной совместимости.

| Поле | Что хранит |
|---|---|
| id | номер |
| login | логин (уникальный) |
| password_hash | хеш пароля |
| fio | ФИО |
| roles | кэш ролей через запятую: `athlete,coach` (источник - `user_roles`) |
| email | почта |
| phone | телефон |
| consent_pd | 1 если согласие на обработку ПД есть |
| legal_representative | ФИО представителя (для детей) |
| birth_date | дата рождения `2005-05-15` |
| municipality | город |
| organization_id | ссылка на organizations |
| start_year | год начала занятий |
| disciplines | id дисциплин через запятую: `1,3` |
| rank_type | разряд `I`, `II`, `КМС` |
| rank_until | разряд действует до `2027-01-01` |
| category | судейская категория |
| category_until | категория действует до |
| rusada_date | дата курса РУСАДА |
| rusada_url | ссылка на сертификат РУСАДА |

**Пишет:** пользователь (свой профиль), федерация (создает, меняет разряды), новый пользователь через регистрацию.

**Читает:** свой - сам, все - федерация, подопечных - тренер.

```
GET /api/auth/me
{ "id": 2, "fio": "Иванов Иван Иванович", "roles": ["athlete","coach"] }
```

### Регистрация

Пользователь сам создаёт аккаунт через `POST /api/auth/register`. Роли распределяются так:

- `athlete`, `coach`, `judge` - выдаются сразу, аккаунт активен.
- `federation` - аккаунт создаётся с пустым `roles`, роль не выдаётся. Одновременно в таблицу `requests` пишется заявка со статусом `pending`. Действующая федерация рассматривает её вручную.

Для роли `athlete` обязательны `birth_date`, `municipality` и хотя бы одна дисциплина, а если возраст меньше 18 - `legal_representative` (ФИО законного представителя). Для тренера обязателен стаж `experienceYears`, для судьи - категория `judgeCategory`.

Согласие на обработку ПД (`consent_pd = 1`) обязательно для любой регистрации, иначе сервер вернёт 400. Ошибки приходят по полям: `error.fields.phone` и так далее.

Что создаётся при регистрации:

```
POST /api/auth/register
{
  "login": "new_athlete",
  "password": "qwerty123",
  "fio": "Новиков Пётр Сергеевич",
  "role": "athlete",
  "consentPd": true,
  "birthDate": "2008-04-12",
  "municipality": "Оренбург",
  "organizationId": 1,
  "startYear": 2020,
  "disciplines": [1, 3],
  "legalRepresentative": "Новикова Анна Ивановна"
}
```

Ответ: `{ token, user, roles: ["athlete"], pendingFederation: false }`.

При регистрации на роль `federation`:

```
POST /api/auth/register
{
  "login": "new_fed",
  "password": "qwerty123",
  "fio": "Сидорова Мария Ивановна",
  "role": "federation",
  "consentPd": true
}
```

Ответ: `{ token, user, roles: [], pendingFederation: true }`. Пользователь может залогиниться, но доступен только `/api/auth/me` и `/api/auth/my-federation-request`. Остальные эндпоинты вернут 403, пока федерация не одобрит заявку.

---

## Справочники

Три простые таблицы, меняются редко, читаются без авторизации.

**disciplines** - 6 дисциплин
| id | name |
|---|---|
| 1 | программирование алгоритмическое |
| 2 | программирование продуктовое |
| 3 | программирование систем информационной безопасности |
| 4 | программирование систем искусственного интеллекта |
| 5 | программирование робототехники |
| 6 | программирование беспилотных авиационных систем |

**organizations**
| Поле | Что хранит |
|---|---|
| id | номер |
| name | СШОР №2, ОГУ |
| type | спортивная школа, вуз, школа, клуб |

**age_groups**
| Поле | Что хранит |
|---|---|
| id | номер |
| name | Юноши 14-17 |
| age_from | 14 |
| age_to | 17 |

```
GET /api/catalog/disciplines
GET /api/catalog/organizations
GET /api/catalog/age-groups
```

---

## competitions - соревнования

| Поле | Что хранит |
|---|---|
| id | номер |
| name | Чемпионат области 2026 |
| discipline_id | ссылка на дисциплину |
| age_group_id | ссылка на возрастную группу |
| type | Чемпионат, Первенство, Кубок |
| level | Региональные, Межрегиональные, Чемпионат России |
| format | очный, онлайн, смешанный |
| status | draft, applications_open, closed, finished |
| date_start | дата начала |
| date_end | дата окончания |
| place | Оренбург |
| calendar_plan | ЕКП или Региональный |
| calendar_number | номер в плане `5-Р` |
| applications_deadline | до какого числа заявки |
| regulation_path | путь к файлу положения |

**Пишет:** федерация. **Читает:** все (публично).

Создать:
```
POST /api/competitions
X-Role: federation
{ "name": "Чемпионат 2027", "disciplineId": 1, "ageGroupId": 3,
  "type": "Чемпионат", "level": "Региональные", "format": "очный",
  "dateStart": "2027-03-15", "dateEnd": "2027-03-16",
  "applicationsDeadline": "2027-03-01" }
```

Список:
```
GET /api/competitions?discipline=1&status=applications_open
```

Управление статусом:
```
POST /api/competitions/:id/publish
POST /api/competitions/:id/close-applications
```

---

## applications - заявки на соревнования

| Поле | Что хранит |
|---|---|
| id | номер |
| competition_id | на какое соревнование |
| athlete_user_id | кто подал |
| status | pending, approved, rejected |
| reject_reason | причина отказа |
| created_at | когда подана |

Ограничение: одна заявка от одного спортсмена на одно соревнование.

**Пишет:** спортсмен (свою), тренер (за подопечного), федерация (меняет статус).

**Читает:** свои - спортсмен, подопечных - тренер, все - федерация.

Подать:
```
POST /api/applications
X-Role: athlete
{ "competitionId": 5 }
```

Сервер проверит: приём открыт, возраст подходит, дубликата нет.

Модерация:
```
POST /api/applications/:id/approve
POST /api/applications/:id/reject  { "reason": "..." }
```

---

## results - результаты

| Поле | Что хранит |
|---|---|
| id | номер |
| competition_id | на каком соревновании |
| athlete_user_id | кто |
| place | место |
| points | баллы |
| created_at | когда внесли |

**Пишет:** федерация. **Читает:** все авторизованные.

Сервер проверит: у спортсмена есть одобренная заявка.

```
POST /api/results
X-Role: federation
{ "competitionId": 5, "athleteUserId": 2, "place": 1, "points": 100 }
```

История спортсмена:
```
GET /api/results/athlete/2
```

---

## coach_athlete - связь тренера и спортсмена

| Поле | Что хранит |
|---|---|
| id | номер |
| coach_user_id | тренер |
| athlete_user_id | спортсмен |
| discipline_id | по какой дисциплине |
| status | pending, active, paused, finished |

Один спортсмен может иметь разных тренеров по разным дисциплинам.

**Пишет:** тренер (запрос), спортсмен (подтверждение).

```
POST /api/coach-athlete/request   { "athleteLogin": "athlete", "disciplineId": 1 }
POST /api/coach-athlete/:id/confirm
POST /api/coach-athlete/:id/pause
POST /api/coach-athlete/:id/finish
```

---

## judge_assignments - назначения судей

| Поле | Что хранит |
|---|---|
| id | номер |
| competition_id | на какое соревнование |
| judge_user_id | какой судья |
| position | главный судья, судья |

**Пишет:** федерация. **Читает:** судья (свои), федерация (все).

```
POST /api/judges/assignments
X-Role: federation
{ "competitionId": 5, "judgeUserId": 4, "position": "главный судья" }
```

---

## requests - заявки: разряд, категория, федерация

Одна таблица для трёх типов, поле `type`:

- `rank` - заявка на разряд или подтверждение разряда;
- `judge_category` - заявка на судейскую категорию;
- `federation` - заявка на роль федерации (оформляется при регистрации).

| Поле | Что хранит |
|---|---|
| id | номер |
| type | rank, judge_category, federation |
| user_id | кому присваивают (или кто подал на федерацию) |
| competition_id | на основании какого соревнования (для rank) |
| result_id | на основании какого результата (для rank) |
| requested_type | какой разряд просят или какая роль запрашивается |
| status | pending, approved, rejected |
| assigned_date | когда присвоили |
| order_number | номер приказа |
| assigned_until | до какого числа действует |
| reject_reason | причина отказа |
| created_at | когда подана |

**Пишет:** спортсмен или тренер (на разряд), судья (на категорию), новый пользователь (на федерацию через регистрацию), федерация (присвоение или отказ).

### Заявка на разряд

```
POST /api/ranks/request
X-Role: athlete
{ "athleteUserId": 2, "competitionId": 5, "resultId": 10, "rankType": "I" }
```

Присвоить:

```
POST /api/ranks/:id/approve
X-Role: federation
{ "assignedDate": "2026-11-15", "orderNumber": "123-од", "assignedUntil": "2028-11-15" }
```

После одобрения обновляются поля `rank_type` и `rank_until` в таблице `users`.

### Заявка на роль федерации

Создаётся автоматически при регистрации с `role=federation` (см. раздел про регистрацию).

Действующая федерация видит список:

```
GET /api/auth/federation-requests
X-Role: federation
-> [{
  "id": 5,
  "userId": 14,
  "fio": "Сидорова Мария Ивановна",
  "login": "new_fed",
  "email": "fed2@example.ru",
  "phone": null,
  "status": "pending",
  "rejectReason": null,
  "createdAt": "2026-10-26 22:30:00"
}]
```

Одобрение:

```
POST /api/auth/federation-requests/:id/approve
X-Role: federation
```

Что происходит: у пользователя в `users.roles` добавляется `federation` к существующим (если их не было - становится `federation`), в `requests.status` устанавливается `approved`. Пользователь теперь может войти в кабинет федерации.

Отклонение:

```
POST /api/auth/federation-requests/:id/reject
X-Role: federation
{ "reason": "нет оснований" }
```

Статус становится `rejected`, причина сохраняется в `reject_reason`. Пользователь видит её через `GET /api/auth/my-federation-request`.

---

## team_members - сборная

| Поле | Что хранит |
|---|---|
| id | номер |
| season | год |
| discipline_id | дисциплина |
| athlete_user_id | спортсмен |

**Пишет:** федерация (вручную из рейтинга).

```
POST /api/rating/team/select
X-Role: federation
{ "season": 2026, "disciplineId": 1, "athleteIds": [2, 7, 9] }
```

---

## audit_log - журнал действий

| Поле | Что хранит |
|---|---|
| id | номер |
| user_id | кто сделал |
| action | create, update, delete, approve |
| entity | над чем: competition, application, result |
| entity_id | id объекта |
| created_at | когда |

**Пишет:** сервер автоматически. **Читает:** федерация.

---

## Что не в базе

- Файлы (PDF, DOCX) - на диске в `uploads/`, в базе только путь
- Пароли в открытом виде - только хеши
- JWT-токены - не хранятся, проверяются по подписи

## Что считается каждый раз

- Рейтинг - из результатов с учётом уровня и коэффициента 1.2
- Протокол - из одобренных заявок и результатов
- Отчёт о численности - из профилей спортсменов
- `expiringSoon` - из срока действия, порог 30 дней

## Кто что видит

| Роль | Читает | Пишет |
|---|---|---|
| federation | всё | соревнования, результаты, модерация, разряды, сборная, заявки на роль федерации |
| athlete | свой профиль, заявки, результаты, разряд | профиль, заявки, заявки на разряд |
| coach | подопечных и их данные | запрос привязки, заявки за подопечных |
| judge | свои назначения и категорию | заявку на категорию |
| пользователь без ролей | только `/api/auth/me` и `/api/auth/my-federation-request` | - |
| без входа | справочники, календарь, регистрация | регистрация |

## Роли (user_roles)

Один аккаунт может иметь несколько ролей. Каждая роль регистрируется отдельно и хранится строкой в `user_roles`.

| Поле | Что хранит |
|---|---|
| id | номер |
| user_id | ссылка на users |
| role | код роли: `athlete`, `coach`, `judge`, `federation` |
| experience_years | стаж тренера (для роли coach) |
| judge_category | судейская категория (для роли judge) |
| disciplines | дисциплины роли через запятую |
| created_at | когда роль добавлена |

Пара `(user_id, role)` уникальна: повторно одну роль выдать нельзя. Справочник `roles` хранит коды и названия ролей.

Добавление роли к существующему аккаунту:

```
POST /api/auth/roles
X-Role: athlete
{ "role": "coach", "experienceYears": 5, "disciplines": [1, 2] }
```

Сервер проверит обязательные поля именно этой роли (тренер - стаж и дисциплина, судья - категория, спортсмен - дата рождения, муниципалитет и дисциплина) и вернёт 400 с ошибками по полям. При успехе в ответе придут все роли аккаунта и `activeRole`.

Профиль:

```
GET   /api/auth/profile   полные данные и роли
PATCH /api/auth/profile   ФИО, контакты, муниципалитет, дисциплины, РУСАДА
```

`PATCH` проверяет те же регулярные выражения, что и регистрация: телефон, e-mail, ФИО, год, ссылку.

При старте приложение переносит старые роли из `users.roles` в `user_roles`, поэтому база прежней версии продолжает работать.


## notifications - уведомления

| Поле | Что хранит |
|---|---|
| id | номер |
| user_id | получатель, ссылка на users |
| type | тип события, например application_approved |
| text | текст уведомления |
| is_read | 1, если прочитано |
| created_at | дата создания |

Пишет модуль notifications/ при событиях в API и cron. Читает сам пользователь через
/api/notifications. Дубли одинаковых уведомлений за день отсекаются запросом.
Внешний канал - файл logs/emails.log.

## competitions.regulation_path

Путь к загруженному положению соревнования относительно uploads/.
Файл создается через POST /api/competitions/:id/regulation, скачивается через
GET /api/competitions/:id/regulation.
