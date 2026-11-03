# Детальные Use Case — Группа A: discovery, регистрация, аутентификация, токенизация

Терминология: RP = Релиинг-Партей (Relying Party / клиент OAuth),
AS/OP = Authorization Server / OpenID Provider (чёрный ящик),
RS = Ресурс-Сервер (Resource Server), End-User = Пользователь.

---

## USE CASE 01 | Discover Authorization Server
| Поле | Содержание |
|------|------------|
| **Описание** | RP автоматически определяет endpoint'ы и возможности AS/OP, читая discovery-документ. |
| **Используется в** | N/A |
| **Предусловия** | AS/OP опубликовал AS Metadata (RFC 8414) и/или OIDC Discovery (OIDC Discovery 1.0) по well-known URI; доступ по TLS. |
| **Условие успешного завершения** | RP получил JSON-метаданные с issuer, authorization_endpoint, token_endpoint, jwks_uri и поддерживаемыми grant/alg; готов к построению authorize/token request. |
| **Условие завершения с ошибкой** | RP не получил валидные метаданные (HTTP ≠ 200 / JSON не распарсился / issuer не совпадает с ожидаемым); метаданные не сохраняются; RP не инициирует авторизацию. |
| **Акторы** | RP (первичный), AS/OP (вторичный — публикует метаданные). |
| **Стимул** | RP при старте конфигурации запрашивает discovery-документ. |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | RP формирует GET запрос на `<issuer>/.well-known/openid-configuration`. |
| 2 | AS/OP проверяет запрос и возвращает JSON-метаданные (200). |
| 3 | RP проверяет, что `issuer` в ответе совпадает с ожидаемым. |
| 4 | RP извлекает endpoint'ы (authorization/token/jwks_uri) и поддерживаемые grant_types / id_token_signing_alg. |
| 5 | RP сохраняет конфигурацию для последующих запросов. |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 3a | Issuer в ответе не совпадает с ожидаемым (или HTTPS отсутствует) → RP завершает с ошибкой, запрос метаданных отклонён (Failed End). |
| 4a | Ожидаемый grant_type (authorization_code) отсутствует в `grant_types_supported` → RP завершает с ошибкой конфигурации (Failed End). |
| 2a | HTTP-ошибка (404/5xx) при запросе well-known → RP повторяет запрос ≤ 1 раз; при повторной ошибке → Failed End. |

**ВАРИАЦИИ**
- К шагу 1: OIDC Discovery (`/.well-known/openid-configuration`) или RFC 8414 AS Metadata (`/.well-known/oauth-authorization-server`) — один результат (конфигурация AS/OP).

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-01-00 | Основной поток: discovery успешен | 1-5 | RP запрашивает и получает метаданные, сохраняет | GET openid-configuration, ожидаемый issuer | JSON сохранён, endpoint'ы извлечены | UC-01 |
| TC-01-3a | Issuer не совпадает | 3 | Issuer в ответе ≠ ожидаемому | metadata.issuer = https://evil.com | Завершение с ошибкой, конфиг не сохранён | UC-01/3a |
| TC-01-4a | grant_type не поддерживается | 4 | authorization_code отсутствует | grant_types_supported=["client_credentials"] | Ошибка конфигурации | UC-01/4a |
| TC-01-2a | HTTP 500, ретрай | 2 | AS/OP вернул 500 | response=500 | 1 ретрай; при повторной ошибке — Failed End | UC-01/2a |

---

## USE CASE 02 | Register Client
| Поле | Содержание |
|------|------------|
| **Описание** | RP регистрируется в AS/OP (static или dynamic) и получает client_id и параметры клиента. |
| **Используется в** | N/A |
| **Предусловия** | AS/OP поддерживает client registration (RFC 8414 `registration_endpoint` / OIDC Dynamic Client Registration RFC 7591); RP имеет набор заявленных параметров (redirect_uris, grant_types, token_endpoint_auth_methods). |
| **Условие успешного завершения** | AS/OP создал запись клиента, вернул `client_id` (и опц. `client_secret`); клиент доступен для authorize/token. |
| **Условие завершения с ошибкой** | Клиент не зарегистрирован (ошибка валидации / отсутствие регистрации / конфликт); `client_id` не выдан; authorize/token с этим клиентом невозможны. |
| **Акторы** | RP (первичный), AS/OP (вторичный). |
| **Стимул** | RP передаёт запрос регистрации на `registration_endpoint`. |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | RP формирует POST на `registration_endpoint` с client metadata (redirect_uris, grant_types, response_types, token_endpoint_auth_methods_supported). |
| 2 | AS/OP аутентифицирует источник регистрации (по политике AS/OP). |
| 3 | AS/OP валидирует client metadata (redirect_uris — HTTPS, точные; grant/response_types поддерживаются). |
| 4 | AS/OP создаёт запись клиента, генерирует уникальный `client_id` (и `client_secret` для confidential). |
| 5 | AS/OP возвращает JSON с client metadata + client_id (+ client_secret). |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 3a | redirect_uri не HTTPS или содержит wildcard / не совпадает с разрешёнными политиками → AS/OP отклоняет регистрацию (400), клиент не создан. |
| 3b | Запрошенный grant_type / response_type не поддерживается AS/OP → AS/OP отклоняет (400 unsupported). |
| 2a | Источник регистрации не авторизован (по политике AS/OP) → AS/OP отклоняет (401/403). |
| 4a | Конфликт (повторная регистрация с теми же метаданными) → AS/OP возвращает существующий `client_id` (идемпотентно) или отклоняет. |

**ВАРИАЦИИ**
- К шагу 1: static registration (вручную администратором AS/OP) или dynamic (RFC 7591) — один результат (запись клиента с client_id).

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-02-00 | Основной поток: регистрация успешна | 1-5 | RP регистрирует клиента | client metadata, redirect_uris HTTPS | client_id (+secret) выдан, клиент активен | UC-02 |
| TC-02-3a | redirect_uri не HTTPS / wildcard | 3 | redirect_uris=["http://x"] | redirect_uris=["http://x"] | 400 invalid_redirect_uri, клиент не создан | UC-02/3a |
| TC-02-3b | grant_type не поддерживается | 3 | grant_types=["implicit"] | grant_types=["implicit"] | 400 unsupported | UC-02/3b |
| TC-02-2a | Источник не авторизован | 2 | без регистрации источника | без регистрации источника | 401/403 | UC-02/2a |
| TC-02-4a | Повторная регистрация (идемпотентность) | 4 | те же метаданные повторно | те же метаданные повторно | существующий client_id | UC-02/4a |

---

## USE CASE 03 | Authenticate End-User
| Поле | Содержание |
|------|------------|
| **Описание** | End-User проходит аутентификацию (login) в AS/OP и даёт/подтверждает consent на выдачу токенов запрошенным scope. |
| **Используется в** | N/A (включается в UC-05, UC-17) |
| **Предусловия** | RP зарегистрирован (есть client_id); authorize request с response_type=code, scope=openid, state, (code_challenge); End-User имеет учётную запись в AS/OP. |
| **Условие успешного завершения** | AS/OP подтвердил идентичность End-User, зафиксировал consent, сформировал и вернул RP authorization code (в редирект на redirect_uri c state). |
| **Условие завершения с ошибкой** | Аутентификация не пройдена (неверный логин/пароль, отказ в consent, timeout); authorization code не выдаётся; RP получает редирект с `error` (access_denied / login_required); состояние AS/OP не изменено (consent не сохранён). |
| **Акторы** | End-User (первичный), RP (вторичный — инициирует), AS/OP (система). |
| **Стимул** | End-User переходит на authorize endpoint (редирект от RP). |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | AS/OP принимает authorize request (response_type=code, client_id, redirect_uri, scope, state, code_challenge). |
| 2 | AS/OP валидирует параметры (client_id существует, redirect_uri точное совпадение, scope поддерживаем). |
| 3 | AS/OP запрашивает у End-User учётные данные (login page). |
| 4 | AS/OP проверяет учётные данные и устанавливает сессию End-User. |
| 5 | AS/OP показывает страницу consent на запрошенный scope. |
| 6 | End-User подтверждает consent. |
| 7 | AS/OP генерирует одноразовый authorization code, связанный с End-User + client + scope + (code_challenge) + state. |
| 8 | AS/OP выполняет редирект на redirect_uri с `code` и `state`. |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 2a | redirect_uri не совпадает точно с зарегистрированным (или wildcard) → AS/OP завершает редирект с `error=invalid_request` (Failed End). |
| 2b | scope содержит неподдерживаемое значение → AS/OP завершает с `error=invalid_scope`. |
| 4a | Учётные данные неверны (несколько попыток) → AS/OP возвращает на login page; при превышении лимита попыток — блокировка (Failed End). |
| 6a | End-User отклоняет consent → AS/OP редиректит с `error=access_denied` (Failed End). |
| 7a | Authorization code истёк (TTL) до обмена → UC-05 завершится с `error=expired_token` (Failed End UC-05). |

**ВАРИАЦИИ**
- К шагу 3: локальный пароль, MFA (см. UC-17), SSO — один результат (установленная сессия End-User).

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-03-00 | Основной поток: login + consent, code выдан | 1-8 | End-User входит, даёт consent | валидные креденшелы, consent=yes | authorization code в редиректе, state совпадает | UC-03 |
| TC-03-2a | redirect_uri не совпадает | 2 | redirect_uri с wildcard | redirect_uri с wildcard | error=invalid_request | UC-03/2a |
| TC-03-2b | Неподдерживаемый scope | 2 | scope="secret" | scope="secret" | error=invalid_scope | UC-03/2b |
| TC-03-4a | Неверные креденшелы / блокировка | 4 | 5 неверных попыток | 5 неверных попыток | блокировка | UC-03/4a |
| TC-03-6a | Отказ в consent | 6 | consent=no | consent=no | error=access_denied | UC-03/6a |
| TC-03-7a | Code истёк до обмена | 7 | TTL code истёк | TTL code истёк | (в UC-05) error=expired_token | UC-03/7a |

---

## USE CASE 04 | Issue ID Token
| Поле | Содержание |
|------|------------|
| **Описание** | AS/OP формирует и возвращает RP подписанный ID Token (JWT) с claims об End-User при обмене authorization code. |
| **Используется в** | Issue Access Token (use case 05) |
| **Предусловия** | Authorization code получен (UC-03), scope содержит openid; ключ подписи AS/OP опубликован в JWKS. |
| **Условие успешного завершения** | AS/OP вернул RP подписанный ID Token (JWT) с claims iss, sub, aud, exp, iat, nonce, auth_time, (sid, azp); RP может валидировать его по JWKS. |
| **Условие завершения с ошибкой** | ID Token не сформирован (code невалиден/истёк, nonce mismatch, ошибка подписи); в ответе `error`; предыдущие state/токены не изменяются. |
| **Акторы** | RP (первичный), AS/OP (система), End-User (сущность, описываемая в claims). |
| **Стимул** | RP выполняет обмен authorization code на /token (scope=openid). |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | AS/OP получает /token request (grant_type=authorization_code, code, redirect_uri, code_verifier, client_id). |
| 2 | AS/OP валидирует authorization code (существует, не использован, не истёк, redirect_uri совпадает). |
| 3 | AS/OP проверяет PKCE: BASE64URL(SHA256(code_verifier)) == сохранённый code_challenge. |
| 4 | AS/OP собирает claims ID Token: iss, sub, aud, exp, iat, nonce, auth_time, azp. |
| 5 | AS/OP подписывает ID Token ключом (kid в header), typ=id_token+jwt. |
| 6 | AS/OP возвращает RP: id_token + access_token + token_type + expires_in (+ refresh_token). |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 2a | Authorization code не существует / уже использован (replay) / истёк → AS/OP вернет `error=invalid_grant`, ID Token не выдан (Failed End). |
| 3a | PKCE не пройден (code_verifier не соответствует code_challenge) → `error=invalid_grant`. |
| 4a | В исходном authorize request был nonce, но AS/OP не может привязать (session expired) → `error=invalid_request`. |
| 5a | Ошибка подписи (недоступен ключ / сбой) → AS/OP возвращает `error=server_error`, ID Token не выдан. |
| 6a | Запрошен scope без openid → AS/OP возвращает access_token БЕЗ id_token (валидная вариация, не ошибка). |

**ВАРИАЦИИ**
- К шагу 5: alg ES256 или RS256 (из `id_token_signing_alg_values_supported`) — один результат (подписанный ID Token).

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-04-00 | Основной поток: ID Token выдан и подписан | 1-6 | Exchange code с openid | валидный code, code_verifier | id_token (JWT, подписан), claims полны | UC-04 |
| TC-04-2a | code replay / истёк | 2 | повторно использованный code | повторно использованный code | error=invalid_grant, id_token нет | UC-04/2a |
| TC-04-3a | PKCE mismatch | 3 | code_verifier не соответствует | code_verifier не соответствует | error=invalid_grant | UC-04/3a |
| TC-04-4a | nonce не привязан (session expired) | 4 | session истёк | session истёк | error=invalid_request | UC-04/4a |
| TC-04-5a | Сбой подписи | 5 | недоступен ключ | недоступен ключ | error=server_error | UC-04/5a |
| TC-04-6a | scope без openid | 6 | scope="profile" | scope="profile" | access_token, id_token отсутствует | UC-04/6a |

---

## USE CASE 05 | Issue Access Token
| Поле | Содержание |
|------|------------|
| **Описание** | AS/OP выдаёт RP access token (и refresh token) при успешном обмене authorization code; access token даёт доступ к RS на заявленный scope. |
| **Используется в** | N/A (включает UC-03, UC-04, UC-08) |
| **Предусловия** | Client зарегистрирован; authorization code получен от End-User; PKCE (code_challenge) в authorize request. |
| **Условие успешного завершения** | AS/OP вернул RP access_token (+ refresh_token), token_type=Bearer (или DPoP), expires_in, scope; access token валиден у RS. |
| **Условие завершения с ошибкой** | Токены не выданы (code невалиден, PKCE не пройден, client не аутентифицирован); `error`-ответ; состояние AS/OP неизменно (code не помечен использованным при ошибке). |
| **Акторы** | RP (первичный), AS/OP (система), RS (потребитель токена — вторичный). |
| **Стимул** | RP передаёт /token request с authorization code. |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | RP формирует POST /token (grant_type=authorization_code, code, redirect_uri, code_verifier) + client authentication. |
| 2 | AS/OP аутентифицирует клиента (include: UC-09 JWT / UC-10 mTLS). |
| 3 | AS/OP проверяет PKCE (include: UC-08) — code_verifier ↔ code_challenge. |
| 4 | AS/OP валидирует authorization code (существует, не использован, не истёк, client_id совпадает). |
| 5 | AS/OP помечает authorization code использованным (single-use). |
| 6 | AS/OP формирует access token (scope, aud=RS, exp) и refresh token (rotation-готовый). |
| 7 | AS/OP возвращает RP: access_token, token_type, expires_in, refresh_token, scope (+ id_token, см. UC-04). |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 2a | Клиент не аутентифицирован (bad client_secret / неверный JWT / mTLS cert не совпал) → `error=invalid_client`. |
| 3a | PKCE не пройден → `error=invalid_grant`. |
| 4a | Authorization code невалиден/истёк/чужой client → `error=invalid_grant`. |
| 4b | redirect_uri в /token не совпадает с redirect_uri в /authorize → `error=invalid_grant`. |
| 6a | Access token формируется как JWT (RFC 9068) вместо opaque → валидная вариация (см. UC-13). |
| 7a | Клиент использует DPoP (include UC-11) → token_type=DPoP, access token с cnf.dpop_jkt. |

**ВАРИАЦИИ**
- К шагу 6: access token opaque (проверка через introspection UC-12) или JWT (локальная валидация UC-13) — один результат (валидный access token).

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-05-00 | Основной поток: access token выдан | 1-7 | Exchange code, PKCE, client auth | валидный code, верный client | access_token + refresh_token, scope | UC-05 |
| TC-05-2a | Клиент не аутентифицирован | 2 | неверный client_secret | неверный client_secret | error=invalid_client | UC-05/2a |
| TC-05-3a | PKCE не пройден | 3 | верный code, чужой verifier | верный code, чужой verifier | error=invalid_grant | UC-05/3a |
| TC-05-4a | code невалиден/чужой client | 4 | code другого клиента | code другого клиента | error=invalid_grant | UC-05/4a |
| TC-05-4b | redirect_uri mismatch | 4 | redirect_uri иной | redirect_uri иной | error=invalid_grant | UC-05/4b |
| TC-05-7a | DPoP token | 7 | DPoP proof с ath | DPoP proof с ath | token_type=DPoP, cnf.dpop_jkt | UC-05/7a |
