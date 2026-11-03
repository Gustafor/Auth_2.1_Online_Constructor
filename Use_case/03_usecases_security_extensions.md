# Детальные Use Case — Группа B: продление токенов, PKCE, PAR, аутентификация клиента, DPoP

Терминология: RP = Релиинг-Партей, AS/OP = Authorization Server / OpenID
Provider, RS = Ресурс-Сервер, End-User = Пользователь.

---

## USE CASE 06 | Refresh Access Token
| Поле | Содержание |
|------|------------|
| **Описание** | RP получает новый access token по refresh token без повторной аутентификации End-User (rotation refresh token). |
| **Используется в** | N/A |
| **Предусловия** | RP ранее получил refresh token (UC-05); refresh token не истёк и не отозван; client аутентифицирован. |
| **Условие успешного завершения** | AS/OP вернул новый access token (и новый refresh token, rotation); старый refresh token аннулирован; access token валиден у RS. |
| **Условие завершения с ошибкой** | Refresh token недействителен / истёк / отозван / реюзд-детект; новый access token не выдан; при reuse-detected — AS/OP отзывает связанные токены; состояние согласовано (access token не выдан, refresh отозван). |
| **Акторы** | RP (первичный), AS/OP (система), RS (потребитель). |
| **Стимул** | Access token RP истёк или близок к истечению. |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | RP формирует POST /token (grant_type=refresh_token, refresh_token, (scope)) + client authentication. |
| 2 | AS/OP аутентифицирует клиента (include: UC-09/UC-10). |
| 3 | AS/OP валидирует refresh token (существует, не истёк, не отозван, привязан к client). |
| 4 | AS/OP проверяет, не отозван ли refresh token по reuse (rotation check). |
| 5 | AS/OP аннулирует текущий refresh token и выпускает новый (rotation). |
| 6 | AS/OP формирует новый access token (scope, exp). |
| 7 | AS/OP возвращает RP: access_token + refresh_token (новый) + token_type + expires_in. |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 2a | Клиент не аутентифицирован → `error=invalid_client`. |
| 3a | Refresh token не существует / чужой client → `error=invalid_grant`. |
| 3b | Refresh token истёк → `error=expired_token`; RP должен пройти новый UC-05 (login). |
| 4a | Обнаружен повторное использование старого (реюз) refresh token (reuse detection) → AS/OP отзывает ВСЕ связанные токены клиента, `error=invalid_grant`; рассматривается как компрометация (Failed End + аудит). |
| 6a | Запрошенный scope шире выданного ранее → AS/OP возвращает access token в рамках исходного scope (сужение не запрещено, расширение — нет). |

**ВАРИАЦИИ**
- К шагу 5: rotation (новый refresh каждый раз) или фиксированный refresh (если AS/OP так настроен) — один результат (новый access token).

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-06-00 | Основной поток: refresh, rotation | 1-7 | RP обновляет access token | валидный refresh_token, client auth | новый access + новый refresh, старый аннулирован | UC-06 |
| TC-06-2a | Клиент не аутентифицирован | 2 | неверный client | неверный client | error=invalid_client | UC-06/2a |
| TC-06-3a | Refresh не существует | 3 | чужой refresh | чужой refresh | error=invalid_grant | UC-06/3a |
| TC-06-3b | Refresh истёк | 3 | TTL refresh истёк | TTL refresh истёк | error=expired_token | UC-06/3b |
| TC-06-4a | Reuse detection (реюз старого refresh) | 4 | старый refresh повторно | старый refresh повторно | отзыв всех токенов, error=invalid_grant, аудит | UC-06/4a |
| TC-06-6a | Запрошенный scope шире | 6 | scope="read+admin" | scope="read+admin" | access token в исходном scope | UC-06/6a |

---

## USE CASE 07 | Use Pushed Authorization Request
| Поле | Содержание |
|------|------------|
| **Описание** | RP использует PAR: параметры авторизации передаются AS/OP POST /par (не в URL), AS/OP выдаёт одноразовый request_uri, по которому выполняется /authorize. |
| **Используется в** | N/A (обёртка поверх authorize) |
| **Предусловия** | AS/OP поддерживает PAR (RFC 9126, `require_pushed_authorization_requests=true` или опц.); RP confidential (аутентификация на /par). |
| **Условие успешного завершения** | AS/OP вернул RP одноразовый `request_uri` (с expires_in); RP выполнил /authorize?request_uri=... и получил authorization code. |
| **Условие завершения с ошибкой** | request_uri не выдан (клиент не аутентифицирован, параметры невалидны) или /authorize с request_uri невалиден (истёк, уже использован, чужой client); authorization code не получен. |
| **Акторы** | RP (первичный), AS/OP (система). |
| **Стимул** | RP инициирует авторизацию (confidential client, high-security / FAPI). |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | RP формирует POST /par со ВСЕМИ параметрами авторизации (response_type, client_id, redirect_uri, scope, state, code_challenge) + client auth. |
| 2 | AS/OP аутентифицирует клиента и валидирует параметры. |
| 3 | AS/OP генерирует одноразовый request_uri (привязан к client, expires_in < 5 мин). |
| 4 | AS/OP возвращает RP: request_uri + expires_in (201 Created). |
| 5 | RP выполняет GET /authorize?request_uri=<...>&client_id=... (остальные параметры НЕ в URL). |
| 6 | AS/OP извлекает параметры по request_uri и продолжает UC-03 (login + consent) и выдачу code. |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 2a | Клиент не аутентифицирован на /par → AS/OP вернёт 401, request_uri не выдан (Failed End). |
| 2b | redirect_uri / scope невалидны → 400, request_uri не выдан. |
| 5a | request_uri истёк (expires_in) до /authorize → AS/OP завершает с `error=server_error`/`invalid_request` (Failed End); RP повторяет UC-07. |
| 5b | request_uri повторно использован (single-use) → AS/OP отклоняет (Failed End). |
| 5c | request_uri предъявлен не тем client (client_id не совпадает) → AS/OP отклоняет. |

**ВАРИАЦИИ**
- К шагу 4: response как JSON body или HTTP header `Location: urn:ietf:params:oauth:request_uri:...` — один результат (request_uri).

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-07-00 | Основной поток: PAR, code получен | 1-6 | /par -> request_uri -> /authorize | валидные параметры, client auth | request_uri выдан, code получен | UC-07 |
| TC-07-2a | Клиент не аутентифицирован | 2 | без client auth на /par | без client auth на /par | 401, request_uri нет | UC-07/2a |
| TC-07-2b | redirect_uri/scope невалидны | 2 | wildcard redirect | wildcard redirect | 400 | UC-07/2b |
| TC-07-5a | request_uri истёк | 5 | > expires_in | > expires_in | invalid_request, повтор UC-07 | UC-07/5a |
| TC-07-5b | request_uri reused | 5 | повторное использование | повторное использование | отклонено | UC-07/5b |
| TC-07-5c | Чужой client_id | 5 | client_id не совпал | client_id не совпал | отклонено | UC-07/5c |

---

## USE CASE 08 | Enforce PKCE
| Поле | Содержание |
|------|------------|
| **Описание** | AS/OP обеспечивает PKCE: требует code_challenge в /authorize и проверяет code_verifier в /token — защита от code injection/interception. |
| **Используется в** | Issue Access Token (use case 05) |
| **Предусловия** | Клиент (public или confidential) формирует code_verifier (43–128, [A-Za-z0-9-._~]) и code_challenge=BASE64URL(SHA256(verifier)). |
| **Условие успешного завершения** | AS/OP принял code_challenge (метод S256), сохранил его с сессией, и на /token верифицировал code_verifier (SHA256(verifier)==challenge). |
| **Условие завершения с ошибкой** | PKCE не пройден: нет code_challenge, метод ≠ S256, или verifier не соответствует challenge; authorization code / access token не выдаются; `error=invalid_grant`. |
| **Акторы** | RP (первичный), AS/OP (система). |
| **Стимул** | RP формирует authorize request с code_challenge. |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | RP генерирует code_verifier и code_challenge=S256(verifier). |
| 2 | RP передаёт /authorize: code_challenge + code_challenge_method=S256 (+ state, scope, redirect_uri). |
| 3 | AS/OP проверяет наличие code_challenge и method=S256; сохраняет challenge, привязанный к сессии/client. |
| 4 | (после login/consent) AS/OP выдаёт authorization code. |
| 5 | RP передаёт /token: code_verifier (+ code, redirect_uri). |
| 6 | AS/OP вычисляет BASE64URL(SHA256(code_verifier)) и сравнивает с сохранённым challenge. |
| 7 | При совпадении AS/OP продолжает выдачу токенов (UC-04/05). |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 3a | Нет code_challenge (client не передал) → AS/OP отклоняет /authorize `error=invalid_request` (OAuth 2.1: PKCE обязателен). |
| 3b | code_challenge_method != S256 (напр. plain) → AS/OP отклоняет (OAuth 2.1 запрещает plain). |
| 3c | Длина code_verifier вне 43–128 или недопустимые символы → AS/OP отклоняет. |
| 6a | SHA256(verifier) != challenge (code injection / MITM) → `error=invalid_grant`, токен не выдан (Failed End). |
| 6b | code_verifier отсутствует в /token → `error=invalid_request`. |

**ВАРИАЦИИ**
- К шагу 3: метод всегда S256 (plain запрещён) — единственный допустимый вариант в OAuth 2.1.

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-08-00 | Основной поток: PKCE S256 пройден | 1-7 | верный verifier/challenge | challenge=S256, верный verifier | токен выдан | UC-08 |
| TC-08-3a | Нет code_challenge | 3 | без challenge | без challenge | invalid_request | UC-08/3a |
| TC-08-3b | method=plain | 3 | code_challenge_method=plain | code_challenge_method=plain | отклонено (plain запрещён) | UC-08/3b |
| TC-08-3c | Недопустимая длина verifier | 3 | verifier 30 символов | verifier 30 символов | invalid_request | UC-08/3c |
| TC-08-6a | Verifier не соответствует | 6 | чужой verifier | чужой verifier | invalid_grant (code injection закрыт) | UC-08/6a |
| TC-08-6b | Нет verifier в /token | 6 | без code_verifier | без code_verifier | invalid_request | UC-08/6b |

---

## USE CASE 09 | Authenticate Client by JWT
| Поле | Содержание |
|------|------------|
| **Описание** | AS/OP аутентифицирует confidential клиента через JWT assertion (private_key_jwt) — без shared client_secret. |
| **Используется в** | Issue Access Token (use case 05), Refresh (use case 06), Introspect (use case 12) |
| **Предусловия** | Клиент зарегистрирован с token_endpoint_auth_method=private_key_jwt; публичный ключ клиента опубликован (client metadata jwks_uri / jwks); клиент владеет приватным ключом. |
| **Условие успешного завершения** | AS/OP валидировал JWT assertion (подпись, iss=sub=client_id, aud=token endpoint, exp, jti) и признал клиента; /token продолжается. |
| **Условие завершения с ошибкой** | JWT assertion невалиден (подпись, claims, exp, jti replay, client не найден); `error=invalid_client`; /token не продолжается. |
| **Акторы** | RP (первичный), AS/OP (система). |
| **Стимул** | RP выполняет /token (или /introspect) с client_assertion. |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | RP формирует JWT assertion: iss=sub=client_id, aud=<token endpoint>, iat, exp(<10 мин), jti (random), подписанный приватным ключом клиента. |
| 2 | RP передаёт /token: client_assertion_type=jwt-bearer + client_assertion=<JWT> (вместо client_secret). |
| 3 | AS/OP извлекает публичный ключ клиента (jwks_uri / jwks из client metadata). |
| 4 | AS/OP проверяет подпись JWT ключом клиента. |
| 5 | AS/OP проверяет claims: iss=sub=client_id, aud=token endpoint, exp (не истёк), iat. |
| 6 | AS/OP проверяет jti (не использован ранее — anti-replay). |
| 7 | AS/OP признаёт клиента аутентифицированным и продолжает обработку запроса. |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 4a | Подпись JWT не верна (чужой/отозванный ключ) → `error=invalid_client` (Failed End). |
| 5a | iss/sub != зарегистрированный client_id → `error=invalid_client`. |
| 5b | aud != token endpoint URL → `error=invalid_client`. |
| 5c | JWT exp истёк (или > 10 мин) → `error=invalid_client`. |
| 6a | jti уже использован (replay) → `error=invalid_client`; рассматривается как повторное использование. |
| 3a | Ключ клиента недоступен/не опубликован (jwks_uri 404) → AS/OP не может верифицировать → `error=invalid_client`. |

**ВАРИАЦИИ**
- К шагу 4: alg RS256 или ES256 (из client metadata) — один результат (валидированный клиент).

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-09-00 | Основной поток: private_key_jwt принят | 1-7 | валидный assertion | верный ключ, claims, jti новый | клиент аутентифицирован | UC-09 |
| TC-09-4a | Неверная подпись | 4 | чужой ключ | чужой ключ | invalid_client | UC-09/4a |
| TC-09-5a | iss/sub != client_id | 5 | поддельный iss | поддельный iss | invalid_client | UC-09/5a |
| TC-09-5b | aud != token endpoint | 5 | aud=https://other | aud=https://other | invalid_client | UC-09/5b |
| TC-09-5c | JWT истёк | 5 | exp в прошлом | exp в прошлом | invalid_client | UC-09/5c |
| TC-09-6a | jti replay | 6 | повторный jti | повторный jti | invalid_client (anti-replay) | UC-09/6a |
| TC-09-3a | Ключ недоступен (jwks_uri 404) | 3 | jwks_uri 404 | jwks_uri 404 | invalid_client | UC-09/3a |

---

## USE CASE 10 | Authenticate Client by mTLS
| Поле | Содержание |
|------|------------|
| **Описание** | AS/OP аутентифицирует клиента по X.509 сертификату через взаимный TLS (mTLS) вместо секретов; может выдать certificate-bound access token. |
| **Используется в** | Issue Access Token (use case 05) |
| **Предусловия** | Клиент зарегистрирован с client_auth_method=tls_client_certificate; клиент обладает X.509 cert (SAN) + приватным ключом; AS/OP настроен на mTLS (CA trust). |
| **Условие успешного завершения** | AS/OP верифицировал клиентский сертификат (цепочка до CA, SAN, срок), сопоставил с client (thumbprint / issuer+serial), клиент аутентифицирован; (опц.) access token certificate-bound (cnf.x5t#S256). |
| **Условие завершения с ошибкой** | Сертификат невалиден (цепочка/SAN/срок), не совпадает с зарегистрированным, mTLS handshake не пройден; `error=invalid_client`; токен не выдан. |
| **Акторы** | RP (первичный), AS/OP (система). |
| **Стимул** | RP выполняет mTLS handshake к /token с клиентским cert. |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | RP устанавливает TLS-соединение к AS/OP и предъявляет клиентский X.509 сертификат (mTLS). |
| 2 | AS/OP проверяет сертификат: цепочка до доверенного CA, срок действия, SAN (RFC 9525, не CN). |
| 3 | AS/OP извлекает идентификатор клиента из cert (thumbprint / issuer+serial). |
| 4 | AS/OP сопоставляет с зарегистрированным client (client metadata tls_client_certificate_bound_access_tokens). |
| 5 | AS/OP признаёт клиента аутентифицированным. |
| 6 | (опц.) AS/OP формирует access token с claim cnf.x5t#S256 (thumbprint leaf cert). |
| 7 | AS/OP продолжает выдачу токенов (UC-05). |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 2a | Сертификат невалиден (протух, неизвестный CA, не SAN) → mTLS handshake завершён ошибкой / `error=invalid_client` (Failed End). |
| 3a | Cert не совпадает с зарегистрированным client (новый cert без ротации) → `error=invalid_client`. |
| 2b | Сертификат в списке отзыва (CRL/OCSP) → отклонён. |
| 6a | Клиент не запросил certificate-bound token (metadata off) → access token обычный (валидная вариация). |

**ВАРИАЦИИ**
- К шагу 3: идентификация по thumbprint или по issuer+serial — один результат (аутентифицированный клиент).

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-10-00 | Основной поток: mTLS, client-bound token | 1-7 | валидный cert | верный cert, SAN, CA | клиент аутентифицирован, cnf.x5t#S256 | UC-10 |
| TC-10-2a | Протухший сертификат | 2 | cert exp истёк | cert exp истёк | invalid_client | UC-10/2a |
| TC-10-3a | Cert не совпадает с client | 3 | новый cert, без ротации | новый cert, без ротации | invalid_client | UC-10/3a |
| TC-10-2b | Cert в списке отзыва | 2 | OCSP revoked | OCSP revoked | отклонён | UC-10/2b |
| TC-10-6a | Без certificate-bound | 6 | metadata off | metadata off | обычный access token | UC-10/6a |

---

## USE CASE 11 | Issue DPoP Token
| Поле | Содержание |
|------|------------|
| **Описание** | AS/OP выдаёт RP sender-constrained access token (DPoP), криптографически привязанный к DPoP ключу клиента, с anti-replay. |
| **Используется в** | Issue Access Token (use case 05) |
| **Предусловия** | Клиент использует DPoP (RFC 9449), владеет DPoP key pair (EC/RSA); AS/OP поддерживает dpop_signing_alg_values_supported. |
| **Условие успешного завершения** | AS/OP вернул access token с token_type=DPoP и claim cnf.dpop_jkt (thumbprint DPoP публичного ключа); токен валиден только с fresh DPoP proof. |
| **Условие завершения с ошибкой** | DPoP proof невалиден (подпись, htu/htm, jti replay, ath не соответствует code); токен DPoP не выдан; `error=invalid_proof`. |
| **Акторы** | RP (первичный), AS/OP (система). |
| **Стимул** | RP выполняет /token с DPoP proof (header DPoP + ath). |

**ОСНОВНОЙ ПОТОК**
| Шаг | Действие |
|-----|----------|
| 1 | RP генерирует DPoP proof (JWT, typ=dpop+jwt, alg=ES256): jti, htu=/token, htm=POST, iat, ath=BASE64URL(SHA256(code)). |
| 2 | RP передаёт /token: header `DPoP: <proof>` + body (grant_type=code, code, code_verifier, client_id). |
| 3 | AS/OP валидирует DPoP proof: подпись DPoP ключом, htu/htm соответствуют запросу, iat в допустимом окне. |
| 4 | AS/OP проверяет ath = BASE64URL(SHA256(authorization_code)) — привязка proof к code. |
| 5 | AS/OP проверяет jti proof (не использован ранее — anti-replay). |
| 6 | AS/OP извлекает DPoP публичный ключ из proof, вычисляет thumbprint (RFC 7638). |
| 7 | AS/OP формирует access token: token_type=DPoP, cnf.dpop_jkt=<thumbprint>; возвращает RP. |

**РАСШИРЕНИЯ**
| Шаг | Ветвление |
|-----|-----------|
| 3a | DPoP proof невалиден (подпись/htu/htm/iat вне окна) → `error=invalid_proof` (Failed End). |
| 3b | Алгоритм proof не поддерживается (не в dpop_signing_alg_values_supported) → `error=invalid_alg`. |
| 4a | ath не соответствует code (подмена code) → `error=invalid_proof`. |
| 5a | jti proof уже использован (replay) → `error=invalid_proof`. |
| 7a | Клиент уже использовал DPoP для refresh → refresh token тоже sender-constrained (cnf.dpop_jkt), валидная вариация. |

**ВАРИАЦИИ**
- К шагу 1: alg ES256 или (опц.) RS256 из dpop_signing_alg_values_supported — один результат (DPoP access token).

### Таблица тест-кейсов из расширений
| Код сценария | Наименование сценария | Номер шага | Описание шага | Входящие данные | Результат шага | Примечание |
|---|---|---|---|---|---|---|
| TC-11-00 | Основной поток: DPoP token выдан | 1-7 | валидный proof с ath | proof (ES256), верный ath | token_type=DPoP, cnf.dpop_jkt | UC-11 |
| TC-11-3a | Proof невалиден (htu/htm) | 3 | htu не /token | htu не /token | invalid_proof | UC-11/3a |
| TC-11-3b | Alg не поддерживается | 3 | alg=HS256 | alg=HS256 | invalid_alg | UC-11/3b |
| TC-11-4a | ath не соответствует code | 4 | подмена code | подмена code | invalid_proof | UC-11/4a |
| TC-11-5a | jti replay | 5 | повторный jti | повторный jti | invalid_proof | UC-11/5a |
| TC-11-7a | Refresh тоже DPoP-bound | 7 | DPoP refresh | DPoP refresh | refresh с cnf.dpop_jkt | UC-11/7a |
