# Техническое задание (ТЗ) + SRS
## Web-портал «Учебная платформа» с аутентификацией и авторизацией по OAuth 2.1 + OpenID Connect

**Версия 1.0 · Дата: 03.11.2026 · Статус: на согласование**

**Система:** Веб-портал (Relying Party / RP) для обучающихся (студентов) и учителей.
Портал **не реализует** AS/OP — он использует внешний AS/OP (чёрный ящик, описан
Use Case UC-01..18) как сервис аутентификации/авторизации. ТЗ описывает
**только ФТ, НФТ и бизнес-логику Портала** — не AS/OP.

**Артефакты-основы (фактические, по подсчёту файлов):**
- `Source` — 29 источников (3 итерации, критерий стопа достигнут).
- `Dataset` — 29 секций (1:1 с Source).
- `Best_practice/` — 19 блоков (A..S), самодостаточные реализации.
- `Use_case/` — 18 детализированных UC (AS/OP), 105 тест-кейсов
  (18 MSS + 87 из расширений) в `Use_case/06_test_cases_from_extensions.md`.

**Допущения:**
- AS/OP — внешний сервис (не в scope разработки по ТЗ); Портал = RP + RS.
- Портал — web-приложение (браузер), не CLI/мобильное.
- 2 роли: **Обучающийся (студент)** и **Учитель**. Третьих ролей нет.
- Токены — JWT (self-contained, RFC 9068) + (опц.) introspection (RFC 7662).
- Аутентификация — Authorization Code + PKCE (S256), без Implicit/ROPC.

---

## 1. Общие сведения

### 1.1 Назначение
Портал предоставляет студентам и учителям защищённый доступ к учебным
ресурсам (задания, оценки, работы) через AS/OP (OAuth 2.1 + OIDC).

### 1.2 Границы системы
- **Внутри Портала (RP + RS):** обработка login/callback, валидация ID/Access
  token, ролевая модель, scope-матрица, бизнес-операции (сдача/оценка/чтение),
  logout, refresh.
- **Вне Портала (AS/OP, описан UC-01..18):** /authorize, /token, /userinfo,
  JWKS, /revoke, /introspect, discovery, logout (back-channel).

### 1.3 Сокращения
- AS/OP = Authorization Server / OpenID Provider (внешний).
- RP = Relying Party (Портал как клиент OAuth).
- RS = Resource Server (Портал как защищённый ресурс).
- AT = Access Token, RT = Refresh Token, IDT = ID Token.
- UC = Use Case (из `Use_case/`), TC = Test Case (из `Use_case/06_...`).

---

## 2. Роли и акторы

### 2.1 Роли пользователей (ровно 2)
| Роль | Код (role claim) | Кто |
|------|------------------|-----|
| Обучающийся (студент) | `student` | студент, смотрит свои задания/оценки, сдаёт работы |
| Учитель | `teacher` | учитель, управляет заданиями, оценивает работы, видит список студентов |

### 2.2 Акторы Портала
| Актор | Тип | Роль в Портале |
|-------|-----|----------------|
| Обучающийся (студент) | человек | основной пользователь, scope `student:*` |
| Учитель | человек | основной пользователь, scope `teacher:*` |
| AS/OP | внешний сервис | аутентификация, IDT/AT/RT, discovery |
| (Портал = RP+RS) | система | валидация токенов, ролевая модель, бизнес-операции |

> Третьих ролей (админ, API-сервис, устройство) **нет** — см. §1.2, допущения.
> М2M / device flow / token exchange — **вне scope Портала** (UC-15, RFC 8693).

---

## 3. Бизнес-логика

### 3.1 Модель ролей
Роль пользователя определяется **claim `role`** в ID Token / UserInfo,
выставляемым AS/OP при аутентификации (напр. `role: "student"` или
`role: "teacher"`). Портал не присваивает роли сам — только читает claim.

> **BLOCKING OQ-2** (см. §8): механизм выставления `role` claim (AS/OP или
> Портал) — влияет на BR-01. До согласования ТЗ предполагает, что AS/OP
> выставляет `role` в IDT/UserInfo.

### 3.2 Матрица прав (role ↔ scope)
| Операция | scope | student | teacher |
|----------|-------|:-------:|:-------:|
| Аутентификация, свой профиль | `openid profile email` | ✓ | ✓ |
| Чтение своих заданий/оценок | `student:read` | ✓ | — |
| Сдача работы | `student:submit` | ✓ | — |
| Чтение списка студентов | `teacher:read` | — | ✓ |
| Оценка работы | `teacher:grade` | — | ✓ (step-up) |
| Управление заданиями (CRUD) | `teacher:manage` | — | ✓ (step-up) |

- Scope запрашивается RP в `/authorize` согласно роли (Портал знает роль по
  сессии; при первом входе — `openid profile email`, дальше — по роли).
- RS (Портал) проверяет `aud` (себя), `scope`, `role` перед каждой операцией.

### 3.3 Бизнес-правила (BR)
| ID | Правило | Основание |
|----|---------|-----------|
| BR-01 | Роль берётся из `role` claim IDT/UserInfo (AS/OP); Портал не меняет role | Dataset §7, §26; OQ-2 |
| BR-02 | Каждая операция проверяет `scope` в AT + `role` (матрица §3.2); без scope → 403 | RFC 6749 §5, RFC 9068 |
| BR-03 | AT валидируется локально (JWT, UC-13): подпись JWKS, iss, aud, exp, nbf, jti; (опц.) introspection (UC-12) | RFC 9068, RFC 8725; UC-13 |
| BR-04 | AT передаётся только в `Authorization: Bearer` header; не в URL/fragment; `Cache-Control: no-store` на ответах с токенами | RFC 6750, RFC 9700 §2.5 |
| BR-05 | PKCE S256 обязателен на `/authorize`; redirect_uri — точное совпадение | RFC 7636, RFC 9700 §2.1 |
| BR-06 | RT rotation: новый RT на каждый refresh; старый аннулируется; reuse detection → отзыв связанных (UC-06) | RFC 9700 §2.1.2; UC-06/4a |
| BR-07 | Step-up (MFA) для чувствительных операций учителя (оценка, удаление задания): `/authorize?step_up_auth=true&acr=urn:mfa&max_age=300` (UC-17) | RFC 9470; UC-17 |
| BR-08 | Logout: Портал завершает локальную сессию + RP-Initiated Logout (UC-16); (опц.) Back-Channel Logout от AS/OP при смене пароля/отзыве | OIDC RP-Logout, Back-Channel; UC-16 |
| BR-09 | Чувствительные данные (оценки, работы) — только по HTTPS; не кэшировать; аудит операций | НФТ §6 |
| BR-10 | `sub` из IDT — первичный ключ пользователя в БД Портала; `sid` — привязка сессии | OIDC Core §7, §26 |

### 3.4 Жизненный цикл сессии
1. Студент/учитель → «Войти» → Портал редиректит на `/authorize` (scope по
   роли, `state`, `code_challenge`).
2. AS/OP: login + consent → callback с `code`+`state`.
3. Портал (RP): `/token` (code + `code_verifier`) → IDT + AT + RT.
4. Портал валидирует IDT (подпись/iss/aud/exp/nonce) → `sub`, `role`.
5. Портал создаёт локальную сессию (httpOnly cookie, `sid`).
6. Операции: AT в `Authorization` header → RS проверяет scope/role (BR-02/03).
7. AT истёк → refresh (BR-06). Чувствительная операция → step-up (BR-07).
8. «Выйти» → локальный сброс + RP-Initiated Logout (BR-08).

---

## 4. Функциональные требования (ФТ)

> Приоритет: **MUST** / **SHOULD** / **MAY**. Трассировка — на UC (AS/OP) и TC
> (из `Use_case/06_test_cases_from_extensions.md`, коды дословно).
> ФТ Портала (RP+RS) опираются на UC AS/OP как внешнюю зависимость.

### 4.1 Аутентификация и сессия
| ФТ | Требование | Приоритет | Трассировка (UC / TC) |
|----|------------|:---------:|------------------------|
| ФТ-01 | Портал инициализирует OAuth 2.1 Authorization Code flow: редирект на `/authorize` с `response_type=code`, `scope=openid profile email` (+ scope по роли), `state`, `code_challenge` (S256) | MUST | UC-03, UC-05 / TC-03-00, TC-05-00 |
| ФТ-02 | Портал проверяет `state` в callback на совпадение (CSRF) | MUST | UC-03 / TC-03-00 |
| ФТ-03 | Портал выполняет обмен `code`+`code_verifier` на `/token` → IDT+AT+RT | MUST | UC-05 / TC-05-00 |
| ФТ-04 | Портал валидирует IDT: подпись (JWKS), iss, aud, exp, iat, nonce; извлекает `sub`, `role`, `sid` | MUST | UC-04 / TC-04-00, TC-04-2a, TC-04-3a, TC-04-4a |
| ФТ-05 | Портал создаёт локальную сессию (httpOnly+Secure+SameSite=Strict cookie) по `sub`+`sid` | MUST | UC-16, §26 / TC-16-00 |
| ФТ-06 | Портал обновляет AT по RT (rotation); при `expired_token` — новый login | MUST | UC-06 / TC-06-00, TC-06-3b, TC-06-4a |
| ФТ-07 | Портал завершает сессию: локальный сброс + RP-Initiated Logout на `/end-session` (id_token_hint, post_logout_redirect_uri, state) | MUST | UC-16 / TC-16-00, TC-16-4a |
| ФТ-08 | Портал обрабатывает Back-Channel Logout (logout token: подпись/iss/aud/exp/jti) → сброс локальных сессий по sub+sid | SHOULD | UC-16 / TC-16-6a, TC-16-6b |
| ФТ-09 | Портал при `max_age` (сессия старше порога) инициирует повторную аутентификацию | SHOULD | UC-17 / TC-17-00, TC-17-2a |

### 4.2 Авторизация (RS) и ролевая модель
| ФТ | Требование | Приоритет | Трассировка (UC / TC) |
|----|------------|:---------:|------------------------|
| ФТ-10 | RS валидирует AT (JWT): подпись JWKS, alg≠none, iss, aud, exp/nbf, jti; при kid miss — update JWKS | MUST | UC-13 / TC-13-00, TC-13-3a, TC-13-3b, TC-13-4a, TC-13-5a, TC-13-5b, TC-13-5c, TC-13-6a |
| ФТ-11 | RS проверяет `scope` в AT + `role` по матрице §3.2; нехватка → 403 | MUST | BR-02, UC-13 / TC-13-5b |
| ФТ-12 | RS принимает AT только в `Authorization: Bearer` header; не в URL | MUST | BR-04, RFC 6750 / (НФТ) |
| ФТ-13 | RS (опц.) introspection AT у AS/OP при opaque/revocation (RFC 7662): `active:true/false` | MAY | UC-12 / TC-12-00, TC-12-3a, TC-12-4a, TC-12-4b |
| ФТ-14 | RS отзывает AT/RT у AS/OP (`/revoke`, RFC 7009) при компрометации/смене пароля | SHOULD | UC-14 / TC-14-00, TC-14-4a |
| ФТ-15 | При reuse detection RT (AS/OP отзывает связанные) Портал завершает все сессии пользователя | MUST | UC-06 / TC-06-4a |

### 4.3 Функции роли «Обучающийся (студент)»
| ФТ | Требование | Приоритет | Трассировка (UC / TC) |
|----|------------|:---------:|------------------------|
| ФТ-20 | Студент видит свои задания (scope `student:read`) | MUST | BR-02, UC-13 / TC-13-00 |
| ФТ-21 | Студент видит свои оценки (scope `student:read`) | MUST | BR-02, UC-13 / TC-13-00 |
| ФТ-22 | Студент сдаёт работу (scope `student:submit`); RS фиксирует `sub`+id задания+время | MUST | BR-02, UC-13 / TC-13-00 |
| ФТ-23 | Студент не имеет доступа к операциям `teacher:*` (матрица); запрос → 403 | MUST | BR-02, §3.2 / TC-13-5b |
| ФТ-24 | Студент видит только СВОИ данные (фильтр по `sub`); чужие → 404/403 | MUST | BR-02, BR-10 / TC-13-5b |

### 4.4 Функции роли «Учитель»
| ФТ | Требование | Приоритет | Трассировка (UC / TC) |
|----|------------|:---------:|------------------------|
| ФТ-30 | Учитель видит список студентов (scope `teacher:read`) | MUST | BR-02, UC-13 / TC-13-00 |
| ФТ-31 | Учитель видит работы студентов (scope `teacher:read`) | MUST | BR-02, UC-13 / TC-13-00 |
| ФТ-32 | Учитель оценивает работу (scope `teacher:grade`); **требует step-up** (MFA) перед операцией | MUST | BR-07, UC-17 / TC-17-00, TC-17-3a, TC-17-4a |
| ФТ-33 | Учитель создаёт/редактирует/удаляет задание (scope `teacher:manage`); **требует step-up** | MUST | BR-07, UC-17 / TC-17-00, TC-17-5a |
| ФТ-34 | Учитель не имеет доступа к операциям `student:*` (матрица); запрос → 403 | MUST | BR-02, §3.2 / TC-13-5b |
| ФТ-35 | При step-up: Портал вызывает `/authorize?step_up_auth=true&acr=urn:mfa&max_age=300`; при `access_denied` — операция отклонена, сессия базовая сохраняется | MUST | UC-17 / TC-17-00, TC-17-4a |

### 4.5 Интеграция с AS/OP (RP)
| ФТ | Требование | Приоритет | Трассировка (UC / TC) |
|----|------------|:---------:|------------------------|
| ФТ-40 | Портал выполняет discovery AS/OP (OIDC Configuration / AS Metadata) при старте; проверяет issuer | MUST | UC-01 / TC-01-00, TC-01-3a |
| ФТ-41 | Портал использует `end_session_endpoint` (RP-Logout), `jwks_uri` из discovery | MUST | UC-01, UC-16 / TC-01-00 |
| ФТ-42 | Портал использует PKCE S256 на всех `/authorize` (вкл. step-up) | MUST | UC-08 / TC-08-00, TC-08-3a, TC-08-6a |
| ФТ-43 | Портал хранит RT в httpOnly cookie (не localStorage); RT не логируется | MUST | BR-06, НФТ-05 / (НФТ) |
| ФТ-44 | (опц.) Портал поддерживает DPoP / private_key_jwt для confidential client-аутентификации | MAY | UC-11, UC-09 / TC-11-00, TC-09-00 |

---

## 5. Нефункциональные требования (НФТ)

| НФТ | Требование | Приоритет | Основание |
|-----|------------|:---------:|-----------|
| НФТ-01 | TLS 1.2+ (SHOULD 1.3) на всех endpoint'ах; MUST NOT TLS 1.0/1.1, MD5, SHA-1, RSA<2048 | MUST | RFC 9325, RFC 9700 §2.6 |
| НФТ-02 | PKCE S256 на всех `/authorize` (вкл. confidential) | MUST | RFC 7636, RFC 9700 §2.1.1 |
| НФТ-03 | redirect_uri — точное совпадение, только HTTPS, без wildcard | MUST | RFC 9700 §2.4 |
| НФТ-04 | AT — только в `Authorization: Bearer` header; не в URL/fragment/body | MUST | RFC 6750, RFC 9700 §2.5 |
| НФТ-05 | `Cache-Control: no-store` на всех ответах с токенами; AT/RT не в localStorage | MUST | RFC 9700, RFC 8725 |
| НФТ-06 | JWKS AS/OP кэшируется; при kid miss — update; ключи не логируются | MUST | UC-18, RFC 7517 |
| НФТ-07 | JWT: alg≠none; один alg per key; ES256/PS256 предпочтительно; exp/nbf с clock skew ≤ 30s | MUST | RFC 8725, RFC 7518 |
| НФТ-08 | Производительность: TTFB валидации AT ≤ 50 мс (JWT, локальная); RPS ≥ 100 (P95) | SHOULD | BR-03 |
| НФТ-09 | Доступность: Портал — 99.9%; AS/OP — внешний SLA (OQ) | SHOULD | — |
| НФТ-10 | Аудит: логирование login/logout/step-up/403/refresh/revoke (кто, что, когда, IP); не логируются AT/RT/IDT/пароли | MUST | BR-09, НФТ-05 |
| НФТ-11 | Приватность: PII (оценки, работы) только по HTTPS; маскирование в логах; retention по политике | MUST | BR-09 |
| НФТ-12 | Совместимость: современные браузеры (Chrome/FF/Safari/Edge, последние 2 версии); httpOnly+Secure+SameSite cookie | SHOULD | — |
| НФТ-13 | Целостность: idempotency logout/refresh (повтор → тот же результат); single-use code/request_uri | MUST | UC-16/2a, UC-07/5b |

---

## 6. Контракты интерфейсов (Портал ↔ AS/OP, пользователь ↔ Портал)

### 6.1 Портал (RP) → AS/OP
| Взаимодействие | Метод | Трассировка |
|----------------|-------|-------------|
| Discovery | GET `/.well-known/openid-configuration` | UC-01 / TC-01-00 |
| Authorize (login+consent) | GET `/authorize` (code, state, code_challenge) | UC-03 / TC-03-00 |
| Step-up authorize | GET `/authorize?...&step_up_auth=true&acr=urn:mfa&max_age=300` | UC-17 / TC-17-00 |
| Token (code exchange) | POST `/token` (code, code_verifier, client auth) | UC-05 / TC-05-00 |
| Refresh | POST `/token` (refresh_token) | UC-06 / TC-06-00 |
| Revoke | POST `/revoke` | UC-14 / TC-14-00 |
| Introspection (опц.) | POST `/introspect` | UC-12 / TC-12-00 |
| RP-Logout | GET `/end-session` (id_token_hint, post_logout_redirect_uri, state) | UC-16 / TC-16-00 |
| Back-Channel Logout (входящий) | POST `backchannel_logout_uri` (logout token) | UC-16 / TC-16-6a |
| JWKS | GET `/jwks.json` | UC-18 / TC-18-00 |

### 6.2 Пользователь (студент/учитель) → Портал (RS)
| Операция | Роль / scope | Требование |
|----------|--------------|------------|
| Войти / Выйти | любая | ФТ-01..07 |
| Мои задания / оценки | student / `student:read` | ФТ-20, ФТ-21 |
| Сдать работу | student / `student:submit` | ФТ-22 |
| Список студентов / работы | teacher / `teacher:read` | ФТ-30, ФТ-31 |
| Оценить работу | teacher / `teacher:grade` + step-up | ФТ-32, ФТ-35 |
| CRUD заданий | teacher / `teacher:manage` + step-up | ФТ-33, ФТ-35 |

---

## 7. Трассировка ФТ → UC → TC
Каждое ФТ (§4) ссылается на UC (AS/OP) и TC (коды дословно из
`Use_case/06_test_cases_from_extensions.md`). ФТ без прямого UC/TC —
обоснованы BR/источником:
- ФТ-12, ФТ-43 — обоснованы BR-04 / НФТ-04/05 (RFC 6750, RFC 8725) — это
  требования к передаче/хранению, не отдельный UC AS/OP.
- ФТ-23, ФТ-34 (403 на чужой scope) — обоснованы BR-02 + TC-13-5b (aud/scope
  check из UC-13).
- ФТ-24 (только свои данные) — обоснованы BR-10 (sub как ключ) + BR-02.

**Полное покрытие ролей:**
- Обучающийся (студент): ФТ-01..09 (общие) + ФТ-20..24.
- Учитель: ФТ-01..09 (общие) + ФТ-30..35.
- Общие (RP+RS): ФТ-10..15, ФТ-40..44.

**Связь с Use Case (AS/OP):** UC-15 (Device) и UC-18 (Rotate Keys) — вне scope
Портала (помечены в AGL); UC-18 проявляется в НФТ-06 (JWKS), UC-15 не
используется Порталом (web app, не device).

---

## 8. Ограничения и открытые вопросы (OQ)

> Классификация: **BLOCKING** — блокирует старт разработки (от ответа зависит
> формулировка ФТ/бизнес-правила); **DEFERRED** — решается на этапе
> проектирования. BLOCKING — в начало.

### BLOCKING
| ID | Вопрос | Влияние на ТЗ |
|----|--------|---------------|
| OQ-2 [BLOCKING] | Кто выставляет `role` claim (AS/OP в IDT/UserInfo или Портал маппит `sub`→role локально)? | BR-01, ФТ-04, матрица §3.2. Если Портал маппит — нужен справочник sub↔role + ФТ на его поддержку. |
| OQ-1 [BLOCKING] | Какой алгоритм подписи IDT/AT (RS256/ES256) и один ли ключ? | НФТ-07, ФТ-04/10 (JWKS-валидатор), НФТ-06. |
| OQ-3 [BLOCKING] | Step-up для ВСЕХ операций учителя или только оценка/удаление задания? | ФТ-32/33/35, BR-07, `max_age`/`acr`. |

### DEFERRED
| ID | Вопрос | Примечание |
|----|--------|------------|
| OQ-4 [DEFERRED] | Нужен ли PAR (RFC 9126)? | Web RP, не FAPI; MAY (UC-07). Решается на проектировании. |
| OQ-5 [DEFERRED] | Нужен ли DPoP (RFC 9449) / private_key_jwt? | Web RP; MAY (ФТ-44, UC-11/09). По уровню безопасности. |
| OQ-6 [DEFERRED] | Нужен ли Back-Channel Logout (кроме RP-Initiated)? | ФТ-08 (SHOULD); зависит от сценариев смена пароля/отзыв. |
| OQ-7 [DEFERRED] | AT — JWT (локальная валидация) или opaque (introspection)? | ФТ-10 vs ФТ-13; влияет на производительность (НФТ-08). |
| OQ-8 [DEFERRED] | SLA/доступность внешнего AS/OP? | НФТ-09; внешний сервис. |
| OQ-9 [DEFERRED] | Retention-политика PII (оценки, работы)? | НФТ-11. |

---

## 9. Критерии приёмки

| № | Утверждение | Ссылка на ФТ/НФТ |
|---|-------------|------------------|
| К1 | Студент, прошедший login, видит свои задания и оценки; его запрос к `teacher:*` ресурсам получает HTTP 403. | ФТ-01, ФТ-20, ФТ-21, ФТ-23 |
| К2 | Учитель, прошедший step-up (MFA), может выставить оценку; без step-up операция отклонена (403/redirect на MFA). | ФТ-32, ФТ-35, BR-07 |
| К3 | Access token валидируется RS локально (подпись JWKS + iss/aud/exp/audience); поддельный/чужой AT отклонён (401). | ФТ-10, НФТ-07, BR-03 |
| К4 | Refresh token rotation: после refresh старый RT недействителен; повторное использование старого RT вызывает отзыв связанных сессий. | ФТ-06, ФТ-15, BR-06 |
| К5 | После logout локальная сессия Портала сброшена и AS/OP завершил сессию (RP-Initiated); повторный вход требует аутентификации. | ФТ-07, BR-08 |
| К6 | Все endpoint'ах Портала — TLS 1.2+; AT передаётся только в `Authorization: Bearer` header (не в URL); ответы с токенами несут `Cache-Control: no-store`. | НФТ-01, НФТ-04, НФТ-05, BR-04 |
| К7 | PKCE S256 применяется на каждом `/authorize` (вкл. step-up); отсутствие code_verifier в `/token` → 400. | НФТ-02, ФТ-42, BR-05 |

---

## 10. Критерии выхода (опционально, для приёмки релиза)
- 100% ФТ MUST покрыты тест-кейсами (см. §4, трассировка).
- Все BLOCKING OQ (OQ-1, OQ-2, OQ-3) разрешены.
- Аудит-логи пишутся для login/logout/step-up/403/revoke (НФТ-10).
- Нет AT/RT/IDT/паролей в логах (НФТ-05, НФТ-10, НФТ-11).
