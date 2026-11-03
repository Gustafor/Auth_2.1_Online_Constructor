# Сводная таблица тест-кейсов из расширений Use Case (трассировка)

Формат: 7 колонок — «Код сценария», «Наименование сценария», «Номер шага»,
«Описание шага», «Входящие данные», «Результат шага», «Примечание».
Трассировка: `UC-NN/расширение`. MSS = TC-NN-00; расширение = TC-NN-<шаг><буква>.

ЭТО ЕДИНСТВЕННЫЙ сводный источник итогов. При любом изменении UC —
обязательно пересчитать и обновить этот файл (правило целостности 4b).

Источники: `02_usecases_core_flows.md` (UC-01..05), `03_usecases_security_extensions.md` (UC-06..11),
`04_usecases_rs_device_logout_keys.md` (UC-12..18).

---

## UC-01 — тест-кейсы (4)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-01-00 | Основной поток: discovery успешен | 1-5 | RP запрашивает и получает метаданные, сохраняет | GET openid-configuration, ожидаемый issuer | JSON сохранён, endpoint'ы извлечены | UC-01 |
| TC-01-2a | HTTP 500, ретрай | 2 | AS/OP вернул 500 | response=500 | 1 ретрай; при повторной ошибке — Failed End | UC-01/2a |
| TC-01-3a | Issuer не совпадает | 3 | Issuer в ответе ≠ ожидаемому | metadata.issuer = https://evil.com | Завершение с ошибкой, конфиг не сохранён | UC-01/3a |
| TC-01-4a | grant_type не поддерживается | 4 | authorization_code отсутствует | grant_types_supported=["client_credentials"] | Ошибка конфигурации | UC-01/4a |

## UC-02 — тест-кейсы (5)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-02-00 | Основной поток: регистрация успешна | 1-5 | RP регистрирует клиента | client metadata, redirect_uris HTTPS | client_id (+secret) выдан, клиент активен | UC-02 |
| TC-02-2a | Источник не авторизован | 2 | без регистрации источника | без регистрации источника | 401/403 | UC-02/2a |
| TC-02-3a | redirect_uri не HTTPS / wildcard | 3 | redirect_uris=["http://x"] | redirect_uris=["http://x"] | 400 invalid_redirect_uri, клиент не создан | UC-02/3a |
| TC-02-3b | grant_type не поддерживается | 3 | grant_types=["implicit"] | grant_types=["implicit"] | 400 unsupported | UC-02/3b |
| TC-02-4a | Повторная регистрация (идемпотентность) | 4 | те же метаданные повторно | те же метаданные повторно | существующий client_id | UC-02/4a |

## UC-03 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-03-00 | Основной поток: login + consent, code выдан | 1-8 | End-User входит, даёт consent | валидные креденшелы, consent=yes | authorization code в редиректе, state совпадает | UC-03 |
| TC-03-2a | redirect_uri не совпадает | 2 | redirect_uri с wildcard | redirect_uri с wildcard | error=invalid_request | UC-03/2a |
| TC-03-2b | Неподдерживаемый scope | 2 | scope="secret" | scope="secret" | error=invalid_scope | UC-03/2b |
| TC-03-4a | Неверные креденшелы / блокировка | 4 | 5 неверных попыток | 5 неверных попыток | блокировка | UC-03/4a |
| TC-03-6a | Отказ в consent | 6 | consent=no | consent=no | error=access_denied | UC-03/6a |
| TC-03-7a | Code истёк до обмена | 7 | TTL code истёк | TTL code истёк | (в UC-05) error=expired_token | UC-03/7a |

## UC-04 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-04-00 | Основной поток: ID Token выдан и подписан | 1-6 | Exchange code с openid | валидный code, code_verifier | id_token (JWT, подписан), claims полны | UC-04 |
| TC-04-2a | code replay / истёк | 2 | повторно использованный code | повторно использованный code | error=invalid_grant, id_token нет | UC-04/2a |
| TC-04-3a | PKCE mismatch | 3 | code_verifier не соответствует | code_verifier не соответствует | error=invalid_grant | UC-04/3a |
| TC-04-4a | nonce не привязан (session expired) | 4 | session истёк | session истёк | error=invalid_request | UC-04/4a |
| TC-04-5a | Сбой подписи | 5 | недоступен ключ | недоступен ключ | error=server_error | UC-04/5a |
| TC-04-6a | scope без openid | 6 | scope="profile" | scope="profile" | access_token, id_token отсутствует | UC-04/6a |

## UC-05 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-05-00 | Основной поток: access token выдан | 1-7 | Exchange code, PKCE, client auth | валидный code, верный client | access_token + refresh_token, scope | UC-05 |
| TC-05-2a | Клиент не аутентифицирован | 2 | неверный client_secret | неверный client_secret | error=invalid_client | UC-05/2a |
| TC-05-3a | PKCE не пройден | 3 | верный code, чужой verifier | верный code, чужой verifier | error=invalid_grant | UC-05/3a |
| TC-05-4a | code невалиден/чужой client | 4 | code другого клиента | code другого клиента | error=invalid_grant | UC-05/4a |
| TC-05-4b | redirect_uri mismatch | 4 | redirect_uri иной | redirect_uri иной | error=invalid_grant | UC-05/4b |
| TC-05-7a | DPoP token | 7 | DPoP proof с ath | DPoP proof с ath | token_type=DPoP, cnf.dpop_jkt | UC-05/7a |

## UC-06 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-06-00 | Основной поток: refresh, rotation | 1-7 | RP обновляет access token | валидный refresh_token, client auth | новый access + новый refresh, старый аннулирован | UC-06 |
| TC-06-2a | Клиент не аутентифицирован | 2 | неверный client | неверный client | error=invalid_client | UC-06/2a |
| TC-06-3a | Refresh не существует | 3 | чужой refresh | чужой refresh | error=invalid_grant | UC-06/3a |
| TC-06-3b | Refresh истёк | 3 | TTL refresh истёк | TTL refresh истёк | error=expired_token | UC-06/3b |
| TC-06-4a | Reuse detection (реюз старого refresh) | 4 | старый refresh повторно | старый refresh повторно | отзыв всех токенов, error=invalid_grant, аудит | UC-06/4a |
| TC-06-6a | Запрошенный scope шире | 6 | scope="read+admin" | scope="read+admin" | access token в исходном scope | UC-06/6a |

## UC-07 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-07-00 | Основной поток: PAR, code получен | 1-6 | /par -> request_uri -> /authorize | валидные параметры, client auth | request_uri выдан, code получен | UC-07 |
| TC-07-2a | Клиент не аутентифицирован | 2 | без client auth на /par | без client auth на /par | 401, request_uri нет | UC-07/2a |
| TC-07-2b | redirect_uri/scope невалидны | 2 | wildcard redirect | wildcard redirect | 400 | UC-07/2b |
| TC-07-5a | request_uri истёк | 5 | > expires_in | > expires_in | invalid_request, повтор UC-07 | UC-07/5a |
| TC-07-5b | request_uri reused | 5 | повторное использование | повторное использование | отклонено | UC-07/5b |
| TC-07-5c | Чужой client_id | 5 | client_id не совпал | client_id не совпал | отклонено | UC-07/5c |

## UC-08 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-08-00 | Основной поток: PKCE S256 пройден | 1-7 | верный verifier/challenge | challenge=S256, верный verifier | токен выдан | UC-08 |
| TC-08-3a | Нет code_challenge | 3 | без challenge | без challenge | invalid_request | UC-08/3a |
| TC-08-3b | method=plain | 3 | code_challenge_method=plain | code_challenge_method=plain | отклонено (plain запрещён) | UC-08/3b |
| TC-08-3c | Недопустимая длина verifier | 3 | verifier 30 символов | verifier 30 символов | invalid_request | UC-08/3c |
| TC-08-6a | Verifier не соответствует | 6 | чужой verifier | чужой verifier | invalid_grant (code injection закрыт) | UC-08/6a |
| TC-08-6b | Нет verifier в /token | 6 | без code_verifier | без code_verifier | invalid_request | UC-08/6b |

## UC-09 — тест-кейсы (7)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-09-00 | Основной поток: private_key_jwt принят | 1-7 | валидный assertion | верный ключ, claims, jti новый | клиент аутентифицирован | UC-09 |
| TC-09-3a | Ключ недоступен (jwks_uri 404) | 3 | jwks_uri 404 | jwks_uri 404 | invalid_client | UC-09/3a |
| TC-09-4a | Неверная подпись | 4 | чужой ключ | чужой ключ | invalid_client | UC-09/4a |
| TC-09-5a | iss/sub != client_id | 5 | поддельный iss | поддельный iss | invalid_client | UC-09/5a |
| TC-09-5b | aud != token endpoint | 5 | aud=https://other | aud=https://other | invalid_client | UC-09/5b |
| TC-09-5c | JWT истёк | 5 | exp в прошлом | exp в прошлом | invalid_client | UC-09/5c |
| TC-09-6a | jti replay | 6 | повторный jti | повторный jti | invalid_client (anti-replay) | UC-09/6a |

## UC-10 — тест-кейсы (5)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-10-00 | Основной поток: mTLS, client-bound token | 1-7 | валидный cert | верный cert, SAN, CA | клиент аутентифицирован, cnf.x5t#S256 | UC-10 |
| TC-10-2a | Протухший сертификат | 2 | cert exp истёк | cert exp истёк | invalid_client | UC-10/2a |
| TC-10-2b | Cert в списке отзыва | 2 | OCSP revoked | OCSP revoked | отклонён | UC-10/2b |
| TC-10-3a | Cert не совпадает с client | 3 | новый cert, без ротации | новый cert, без ротации | invalid_client | UC-10/3a |
| TC-10-6a | Без certificate-bound | 6 | metadata off | metadata off | обычный access token | UC-10/6a |

## UC-11 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-11-00 | Основной поток: DPoP token выдан | 1-7 | валидный proof с ath | proof (ES256), верный ath | token_type=DPoP, cnf.dpop_jkt | UC-11 |
| TC-11-3a | Proof невалиден (htu/htm) | 3 | htu не /token | htu не /token | invalid_proof | UC-11/3a |
| TC-11-3b | Alg не поддерживается | 3 | alg=HS256 | alg=HS256 | invalid_alg | UC-11/3b |
| TC-11-4a | ath не соответствует code | 4 | подмена code | подмена code | invalid_proof | UC-11/4a |
| TC-11-5a | jti replay | 5 | повторный jti | повторный jti | invalid_proof | UC-11/5a |
| TC-11-7a | Refresh тоже DPoP-bound | 7 | DPoP refresh | DPoP refresh | refresh с cnf.dpop_jkt | UC-11/7a |

## UC-12 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-12-00 | Основной поток: активный токен | 1-5 | валидный opaque AT | активный token, client auth | { active:true, scope, sub, exp } | UC-12 |
| TC-12-1a | token_type не поддерживается | 1 | token_type_hint=xyz | token_type_hint=xyz | 400 | UC-12/1a |
| TC-12-2a | RS не аутентифицирован | 2 | без client auth | без client auth | 401 | UC-12/2a |
| TC-12-3a | Токен неизвестен | 3 | случайный token | случайный token | { active:false } (не 4xx) | UC-12/3a |
| TC-12-4a | Токен истёк | 4 | exp истёк | exp истёк | { active:false } | UC-12/4a |
| TC-12-4b | Токен отозван | 4 | отозван (UC-14) | отозван (UC-14) | { active:false } | UC-12/4b |

## UC-13 — тест-кейсы (9)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-13-00 | Основной поток: JWT AT валиден | 1-7 | верный AT (JWT) | верный AT, JWKS | доступ разрешён (200) | UC-13 |
| TC-13-2a | JWT не распарсился | 2 | битый JWT | битый JWT | 401 invalid_token | UC-13/2a |
| TC-13-3a | alg=none | 3 | header alg=none | header alg=none | 401 (запрещено) | UC-13/3a |
| TC-13-3b | kid нет в JWKS | 3 | новый kid | новый kid | 401 (после update) | UC-13/3b |
| TC-13-4a | Подпись неверна | 4 | чужой ключ | чужой ключ | 401 | UC-13/4a |
| TC-13-5a | iss неверный | 5 | iss=https://evil | iss=https://evil | 401 | UC-13/5a |
| TC-13-5b | aud не содержит RS | 5 | aud=other | aud=other | 401 | UC-13/5b |
| TC-13-5c | exp истёк | 5 | exp в прошлом | exp в прошлом | 401 | UC-13/5c |
| TC-13-6a | jti replay | 6 | повторный jti | повторный jti | 401 | UC-13/6a |

## UC-14 — тест-кейсы (5)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-14-00 | Основной поток: токен отозван | 1-5 | отзыв access token | токен, client auth | 200, токен недействителен | UC-14 |
| TC-14-1a | token_type не поддерживается | 1 | token_type_hint=jwt | token_type_hint=jwt | 400 unsupported | UC-14/1a |
| TC-14-2a | Нет client auth | 2 | без auth | без auth | 400/401 | UC-14/2a |
| TC-14-3a | Токен неизвестен | 3 | случайный token | случайный token | 200 (без раскрытия) | UC-14/3a |
| TC-14-4a | Каскадный отзыв refresh | 4 | отзыв refresh | отзыв refresh | 200, связанные отозваны | UC-14/4a |

## UC-15 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-15-00 | Основной поток: device flow успешен | 1-7 | End-User подтвердил | device_code, user_code, confirmation | access token | UC-15 |
| TC-15-2a | Scope невалиден | 2 | scope="secret" | scope="secret" | 400 | UC-15/2a |
| TC-15-5a | End-User отклонил | 5 | без подтверждения | без подтверждения | error=user_denied | UC-15/5a |
| TC-15-6a | device_code истёк | 6 | > expires_in | > expires_in | error=expired_token | UC-15/6a |
| TC-15-6b | Быстрый polling | 6 | чаще interval | чаще interval | error=slow_down | UC-15/6b |
| TC-15-6c | device_code reused | 6 | повторный code | повторный code | ошибка (single-use) | UC-15/6c |

## UC-16 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-16-00 | Основной поток: полный logout | 1-7 | End-User выходит | активная сессия, id_token_hint | сессия AS/OP + RP завершены | UC-16 |
| TC-16-2a | Локальной сессии нет | 2 | идемпотентность | идемпотентность | продолжение | UC-16/2a |
| TC-16-4a | id_token_hint невалиден | 4 | поддельный hint | поддельный hint | локальная сессия сброшена (мин. гарантия) | UC-16/4a |
| TC-16-5a | Только RP-Initiated | 5 | backchannel off | backchannel off | сессия завершена (RP-Initiated) | UC-16/5a |
| TC-16-6a | Logout token невалиден | 6 | подпись не верна | подпись не верна | локальная сессия завершена по событию | UC-16/6a |
| TC-16-6b | jti logout replay | 6 | повторный jti | повторный jti | отклонено | UC-16/6b |

## UC-17 — тест-кейсы (6)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-17-00 | Основной поток: step-up MFA пройден | 1-7 | MFA подтверждён | acr=urn:mfa, верный otp | ID token acr=urn:mfa, операция разрешена | UC-17 |
| TC-17-2a | Уровень уже достаточен | 2 | acr уже mfa, свежая сессия | acr уже mfa, свежая сессия | быстрый путь (без повторного MFA) | UC-17/2a |
| TC-17-3a | Неверный otp / блокировка | 3 | 5 неверных otp | 5 неверных otp | interaction_required / отказ | UC-17/3a |
| TC-17-4a | End-User отклонил MFA | 4 | отказ | отказ | access_denied | UC-17/4a |
| TC-17-5a | MFA не настроен | 5 | нет otp | нет otp | отказ (step-up невозможен) | UC-17/5a |
| TC-17-7a | acr выше выданного | 7 | RP требует acr=urn:2fa+ | RP требует acr=urn:2fa+ | операция не разрешена (policy RP) | UC-17/7a |

## UC-18 — тест-кейсы (4)

| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-18-00 | Основной поток: ротация успешна | 1-5 | смена ключей | срок ротации | новые токены новым kid, старые ключи до TTL | UC-18 |
| TC-18-2a | Сбой публикации JWKS | 2 | ошибка storage | ошибка storage | откат, валидация не прерывается | UC-18/2a |
| TC-18-4a | Валидация старого токена (overlap) | 4 | старый kid в JWKS | старый kid в JWKS | валидация успешна | UC-18/4a |
| TC-18-5a | Раннее удаление старых ключей | 5 | TTL не истёк | TTL не истёк | временный сбой валидации (дефект) | UC-18/5a |

---
## Итоговая статистика
_(подсчёт ПО ФАКТИЧЕСКИМ строкам TC этого файла, скриптом)_

| Метрика | Значение |
|---|---|
| Всего детализированных UC | 18 |
| Всего тест-кейсов (строк) | 105 |
| Базовых (MSS, TC-NN-00) | 18 |
| Из расширений (TC-NN-<шаг><буква>) | 87 |

По UC:
| UC | MSS | Расширений | Итого |
|---|---|---|---|
| UC-01 | 1 | 3 | 4 |
| UC-02 | 1 | 4 | 5 |
| UC-03 | 1 | 5 | 6 |
| UC-04 | 1 | 5 | 6 |
| UC-05 | 1 | 5 | 6 |
| UC-06 | 1 | 5 | 6 |
| UC-07 | 1 | 5 | 6 |
| UC-08 | 1 | 5 | 6 |
| UC-09 | 1 | 6 | 7 |
| UC-10 | 1 | 4 | 5 |
| UC-11 | 1 | 5 | 6 |
| UC-12 | 1 | 5 | 6 |
| UC-13 | 1 | 8 | 9 |
| UC-14 | 1 | 4 | 5 |
| UC-15 | 1 | 5 | 6 |
| UC-16 | 1 | 5 | 6 |
| UC-17 | 1 | 5 | 6 |
| UC-18 | 1 | 3 | 4 |