# Best_practice — атомарные реализации кода (с пояснениями) по OAuth 2.1 + OIDC
Папка: C:\Users\u108\Desktop\Промт-задания\Auth-2.1\Best_practice
Каждый блок — самодостаточная часть из соответствующего источника в `../Source`.

======================================================================
## A. PKCE — генерация code_verifier и code_challenge (метод S256)
Источник: RFC 7636 / RFC 9700 / draft-ietf-oauth-v2-1 (PKCE обязателен для всех клиентов)
Пояснение: code_verifier — случайная строка 43–128 символов (unreserved charset).
code_challenge = BASE64URL(SHA256(code_verifier)) без padding. Метод только S256
(метод plain отменён).

// JavaScript (Node 16+, Web Crypto)
async function generatePKCE() {
  // 1) Случайный code_verifier (32 байта -> base64url, длина ~43)
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64UrlEncode(Buffer.from(verifierBytes));

  // 2) code_challenge = BASE64URL( SHA256( code_verifier ) )
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier)
  );
  const codeChallenge = base64UrlEncode(Buffer.from(digest));

  return { codeVerifier, codeChallenge, codeChallengeMethod: 'S256' };
}

function base64UrlEncode(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// Авторизационный запрос (GET /authorize):
//   response_type=code
//   &client_id=<id>
//   &redirect_uri=<exact registered URI>
//   &state=<random>            // защита от CSRF
//   &nonce=<random>            // защита от replay (OIDC)
//   &scope=openid profile email
//   &code_challenge=<codeChallenge>
//   &code_challenge_method=S256
// КЛИЕНТ ОБЯЗАН сохранить codeVerifier до вызова /token.

======================================================================
## B. Обмен authorization code на токены (POST /token)
Источник: draft-ietf-oauth-v2-1 §4.1, RFC 9700; PKCE-верификация (RFC 7636)
Пояснение: server-to-server; AS пересчитывает SHA256(code_verifier) и сравнивает
с ранее присланным code_challenge. Код одноразовый и короткоживущий.
Публичный клиент: client_auth = none (PKCE вместо секрета).
Конфиденциальный: client_secret_basic (HTTP Basic) или private_key_jwt/mTLS.

// Node fetch — confidential client (client_secret_basic)
async function exchangeCodeForTokens({ code, redirectUri, codeVerifier }) {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,                 // ТОЧНО как в /authorize
    code_verifier: codeVerifier,               // то же самое, что хешилось в A
  });

  const res = await fetch(`${AS_HOST}/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${data.error}: ${data.error_description ?? ''}`);
  }
  return data; // { access_token, token_type:"Bearer", expires_in, id_token, scope, refresh_token? }
}

// Ответ AS (успех) — draft-ietf-oauth-v2-1 §3.2.3:
//   HTTP/1.1 200 OK
//   Content-Type: application/json
//   Cache-Control: no-store
//   { "access_token":"...", "token_type":"Bearer",
//     "expires_in":3600, "id_token":"...", "scope":"openid profile email" }

======================================================================
## C. Валидация ID Token (OIDC) — обязательные проверки
Источник: OIDC Core 1.0; RFC 9700 (требует PKCE и верификацию)
Пояснение: Пропуск любого шага = дыра.
  1) Верифицировать подпись JWT по JWKS (jwks_uri, alg из header, обычно RS256).
  2) iss  ===  issuer из discovery.
  3) aud  содержит client_id (для RP: aud==client_id; при делегировании — azp).
  4) exp / iat — токены не истёкшие (с допустимым clock skew).
  5) nonce из запроса авторизации == claim `nonce` в ID Token (защита от replay).
  6) Использовать `sub` как уникальный ID (email mutable — НЕ primary key).

// Pseudocode (jsonwebtoken / jose)
async function validateIdToken(idToken, { issuer, clientId, expectedNonce }) {
  const decoded = await jwtVerify(idToken, createRemoteJWKSet(jwksUri));
  const p = decoded.payload;

  if (p.iss !== issuer)             throw new Error('iss mismatch');
  if (!p.aud.includes(clientId))    throw new Error('aud mismatch');
  if (p.exp < now() - CLOCK_SKEW)   throw new Error('token expired');
  if (expectedNonce && p.nonce !== expectedNonce)
                                    throw new Error('nonce mismatch (replay)');

  return { sub: p.sub, email: p.email, emailVerified: p.email_verified };
}

======================================================================
## D. OIDC Discovery — получение конфигурации OP
Источник: OpenID Connect Discovery 1.0
Пояснение: один запрос возвращает все endpoint'ы и alg; хардкод не нужен.

const cfg = await fetch('https://auth.example.com/.well-known/openid-configuration')
                .then(r => r.json());
// {
//   "issuer": "https://auth.example.com",
//   "authorization_endpoint": ".../authorize",
//   "token_endpoint": ".../token",
//   "userinfo_endpoint": ".../userinfo",
//   "jwks_uri": ".../.well-known/jwks.json",
//   "response_types_supported": ["code"],
//   "id_token_signing_alg_values_supported": ["RS256"]
// }

======================================================================
## E. Защищённый ресурс: передача access token в запросе (Bearer)
Источник: draft-ietf-oauth-v2-1 §5.1 (Bearer); RFC 9700
Пояснение: ОБЯЗАТЕЛЬНО — в заголовке Authorization, НЕ в URL query string.

fetch('https://api.example.com/orders', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
// НЕДОПУСТИМО: https://api.example.com/orders?access_token=...
//   (утечка через history, Referer, логи)

======================================================================
## F. Protected Resource Metadata discovery (RFC 9728)
Источник: RFC 9728 «OAuth 2.0 Protected Resource Metadata»
Пояснение: защищённый ресурс указывает authorization server; клиент по issuer
получает AS Metadata (RFC 8414). TLS cert check (RFC 9525) обязателен.

// 1) Защищённый ресурс публикует:
//    GET /.well-known/oauth-protected-resource  ->
//    { "resource": "https://api.example.com",
//      "authorization_servers": ["https://auth.example.com"] }
// 2) Клиент берёт issuer -> /.well-known/oauth-authorization-server (RFC 8414)

======================================================================
## G. Clickjacking-защита authorization endpoint (CSP)
Источник: draft-ietf-oauth-v2-1 §7.11
Пояснение: AS SHOULD использовать CSP на /authorize и login-страницах.

// В ответе authorization/login страницы:
//   Content-Security-Policy: frame-ancestors 'none'
//   Content-Security-Policy: script-src 'self'
//   X-Frame-Options: DENY

======================================================================
# ИТЕРАЦИЯ 2 — блоки расширений OAuth 2.1 (PAR, DPoP, Device, mTLS,
# JWT AT, private_key_jwt, logout, JWKS)
======================================================================

## H. PAR — Pushed Authorization Request (RFC 9126)
Источник: RFC 9126 / draft-ietf-oauth-v2-1 (SHOULD для confidential clients)
Пояснение: защита /authorize от CSRF и code injection: все параметры
авторизации сначала шлются POST /par -> AS выдаёт одноразовый request_uri;
дальше GET /authorize несёт только request_uri.

// 1) Получить request_uri (клиент аутентифицирован)
function pushedAuthReq(accessToken, params) {
  const body = new URLSearchParams({
    response_type: "code",
    client_id: "client-abc",
    redirect_uri: "https://portal.example.com/callback",
    scope: "openid profile email",
    state: crypto.randomUUID(),
    code_challenge: "E9Melhoa...",
    code_challenge_method: "S256",
  });
  const res = await fetch("https://as.example.com/par", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  // 201 Created; body JSON: { request_uri, expires_in }
  return res.json(); // { "request_uri":"urn:ietf:params:oauth:request_uri:abc123","expires_in":30 }
}

// 2) Далее редирект — только request_uri (остальные параметры НЕ в URL)
//    Location: https://as.example.com/authorize?request_uri=urn:ietf:params:oauth:request_uri:abc123&client_id=client-abc

## I. DPoP — sender-constrained access token (RFC 9449)
Источник: RFC 9449
Пояснение: токен криптографически привязан к DPoP ключу клиента: каждый
запрос несёт fresh DPoP proof (JWT, typ: dpop+jwt); на /token proof содержит
ath=sha256(authorization_code); access token несёт cnf.dpop_jkt (thumbprint
публичного DPoP ключа). RS проверяет proof + совпадение jkt -> anti-replay.

// 1) DPoP proof для запроса (ES256)
async function makeDpopProof(dpopPrivateKey, method, url, extra = {}) {
  const payload = {
    jti: crypto.randomUUID(),
    htm: method,               // HTTP method
    htu: url,                  // HTTP target URI
    iat: Math.floor(Date.now() / 1000),
    ...extra,                  // напр. { ath: b64url(sha256(code)) } на /token
  };
  const jwt = await signJWT(payload, dpopPrivateKey,
      { alg: "ES256", typ: "dpop+jwt" });
  return jwt;
}

// 2) Запрос /token с DPoP (атрибутирует proof к code через ath)
const proof = await makeDpopProof(dpopKey, "POST",
    "https://as.example.com/token",
    { ath: b64url(sha256(authzCode)) });
const res = await fetch("https://as.example.com/token", {
  method: "POST",
  headers: {
    "DPoP": proof,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: authzCode,
    redirect_uri: "https://portal.example.com/callback",
    code_verifier: codeVerifier,
    client_id: "client-abc",
  }),
});
// Ответ: token_type: "dpop", access_token несёт claim cnf.dpop_jkt = thumbprint

// 3) Использование у RS: header "Authorization: DPoP <token>" + fresh "DPoP: <proof>"
//    proof без ath, htu/htm = фактический запрос

## J. Device Authorization Grant — device flow (RFC 8628)
Источник: RFC 8628
Пояснение: аутентификация для limited-input устройств (ТВ, CLI, IoT) без
browser: устройство получает user_code + verification_uri, пользователь
подтверждает на другом устройстве, устройство поллит /token по interval.

// 1) Device authorization (client auth)
const devRes = await fetch("https://as.example.com/device_authorization", {
  method: "POST",
  headers: { "Authorization": "Basic <base64(client_id:client_secret)>",
             "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: "tv-app", scope: "openid profile" }),
});
const dev = await devRes.json();
// { device_code, user_code: "ABCD-EFGH", verification_uri: "https://as.example.com/activate",
//   verification_uri_complete, expires_in: 600, interval: 5 }

// 2) Показываем пользователю: "Введите код ABCD-EFGH на as.example.com/activate"

// 3) Поллинг /token по interval (анти brute-force), до подтверждения
async function pollDeviceCode(deviceCode) {
  while (Date.now() < deadline) {
    const r = await fetch("https://as.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: "tv-app",
      }),
    });
    if (r.ok) return r.json();                    // успех: access_token
    const err = await r.json();
    if (err.error === "authorization_pending") {  // ещё не подтверждено
      await sleep(dev.interval * 1000);           // ждём interval сек
      continue;
    }
    if (err.error === "slow_down") {              // поллим слишком часто
      dev.interval += 5;
      continue;
    }
    throw err;  // user_denied / expired_token -> ошибка
  }
}

## K. mTLS client authentication + certificate-bound AT (RFC 8705)
Источник: RFC 8705 / RFC 9525 (верификация X.509 SAN)
Пояснение: клиент аутентифицируется на /token по X.509 сертификату через
взаимный TLS (client_auth_method=tls_client_certificate) — без client_secret.
AS может выдать certificate-bound AT с claim cnf.x5t#S256 (SHA-256 thumbprint
leaf-сертификата, base64url); RS проверяет предъявленный сертификат по claim.

// Клиент: mTLS handshake с клиентским сертификатом (TLS-уровень, не код)
const https = require("https");
const fs = require("fs");
const opts = {
  host: "as.example.com", path: "/token", method: "POST",
  key:  fs.readFileSync("./client.key"),        // приватный ключ клиента
  cert: fs.readFileSync("./client.crt"),        // X.509 cert (SAN обязателен)
  ca:   fs.readFileSync("./as-ca.crt"),         // доверенный CA AS
  // mTLS: сервер запрашивает клиентский cert
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
};
const body = new URLSearchParams({
  grant_type: "authorization_code", code: authzCode,
  redirect_uri: "https://portal.example.com/callback",
  client_id: "client-abc",
});
// Ответ: access_token с claim  cnf: { "x5t#S256": "<b64url sha256 cert>" }

// RS: проверка certificate-bound AT
function verifyCertBoundAt(atClaims, clientCert) {
  const expected = atClaims.cnf && atClaims.cnf["x5t#S256"];
  const actual   = b64url(sha256(clientCert.raw)); // thumbprint предъявлённого cert
  return expected === actual;
}

## L. private_key_jwt — client authentication (RFC 7523)
Источник: RFC 7523
Пояснение: клиент аутентифицируется на /token через JWT assertion,
подписанный его приватным ключом (без shared client_secret). Claims:
iss=sub=client_id, aud=token endpoint, exp<10min, jti (anti-replay).
Ключ публикуется в client metadata (jwks_uri / jwks).

async function privateKeyJwtAssertion(clientId, tokenEndpoint, privKey) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: tokenEndpoint,
    iat: now,
    exp: now + 300,              // < 10 минут
    jti: crypto.randomUUID(),    // anti-replay
  };
  return signJWT(payload, privKey, { alg: "RS256", typ: "JWT", kid: "client-key-1" });
}

// Запрос /token:
// body += client_assertion_type=
//   urn:ietf:params:oauth:client-assertion-type:jwt-bearer
//        & client_assertion=<JWT>
// (вместо client_secret)

======================================================================
# ИТЕРАЦИЯ 3 — блоки JWT-стек, сессии/выход, Step-Up
======================================================================

## M. JWT Access Token — локальная валидация на RS (RFC 9068 + RFC 8725)
Источник: RFC 9068 / RFC 7519 / RFC 8725
Пояснение: access token как self-contained JWT (typ: at+jwt) — RS проверяет
подпись по JWKS AS локально (без round-trip к AS), проверяет iss/aud/exp/nbf/
jti. trade-off: revocation требует introspection или короткого TTL.

async function validateJwtAt(at, rsAudience, expectedIss, jwks) {
  const { header, payload } = decodeJwt(at);          // decode БЕЗ проверки
  if (header.alg === "none") throw new Error("alg=none запрещён (RFC 8725)");
  const key = jwks.byKid(header.kid);                 // из JWKS AS
  if (!verifySignature(at, key, header.alg)) throw new Error("подпись");
  const now = Math.floor(Date.now() / 1000);
  const skew = 30;                                    // clock skew
  if (payload.iss  !== expectedIss)   throw new Error("iss");
  if (!Array.isArray(payload.aud) ? payload.aud !== rsAudience
                                  : !payload.aud.includes(rsAudience))
       throw new Error("aud");
  if (payload.exp && payload.exp + skew < now) throw new Error("exp");
  if (payload.nbf && payload.nbf - skew > now) throw new Error("nbf");
  // jti + короткий TTL -> anti-replay
  return payload;
}

// JWKS: GET https://as.example.com/.well-known/jwks.json  -> { "keys":[ ... ] }

## N. JWK / JWKS — ротация ключей подписи (RFC 7517 + RFC 8725)
Источник: RFC 7517 / RFC 7518 / RFC 8725
Пояснение: AS публикует публичные ключи в JWKS (GET /jwks.json); подпись —
RS256/ES256 (предпочитать по RFC 8725), один alg per key, kid для
идентификации. Ротация: publish new key -> sign with new -> retire old после
истечения TTL токенов.

// JWKS (AS публикует)
{
  "keys": [
    { "kty":"RSA","use":"sig","alg":"RS256","kid":"key-2","n":"...","e":"AQAB" },
    { "kty":"RSA","use":"sig","alg":"RS256","kid":"key-1","n":"...","e":"AQAB" }
  ]
}

// Клиент/RS кэширует JWKS, обновляет по kid miss или по TTL:
async function getSigningKey(jwksUri, kid) {
  let keys = cache.get(jwksUri);
  if (!keys) keys = cache.set(jwksUri, (await fetch(jwksUri).then(r=>r.json())).keys);
  let key = keys.find(k => k.kid === kid);
  if (!key) {                                          // новый kid -> refresh
    keys = (await fetch(jwksUri).then(r=>r.json())).keys;
    key = keys.find(k => k.kid === kid);
    cache.set(jwksUri, keys);
  }
  return key;
}

## O. JWE — шифрование чувствительных claims (RFC 7515 + RFC 8725)
Источник: RFC 7515 / RFC 7518 / RFC 8725
Пояснение: когда payload JWT содержит конфиденциальные данные (userinfo,
чувствительные claims) — JWT не шифрует (только подпись); JWE шифрует.
Compact Serialization: Protected Header . Encrypted Key . IV . Ciphertext .
Auth Tag. Только AEAD (GCM) по RFC 8725, не CBC отдельно.

// JWE (RSA-OAEP key mgmt + A128GCM content enc)
const jwe = await encryptJWE(
  JSON.stringify(userClaims),                 // plaintext
  recipientPublicKey,                          // публичный ключ получателя
  { alg: "RSA-OAEP", enc: "A128GCM", typ: "JWT", cty: "JWT" },
);
// Результат: eyJ...base64url . encKey . iv . ciphertext . tag
// Расшифровка приватным ключом получателя -> payload (конфиденциально)

## P. Session Management — sid, привязка сессии (OIDC Session Mgmt 1.0)
Источник: OpenID Connect Session Management 1.0
Пояснение: claim sid в ID Token/UserInfo — session ID, уникальный на
пользователя+OP; RP хранит для привязки локальной сессии и для logout.
auth_time — время последней аутентификации.

// При login (из ID Token):
const idToken = decodeJwt(response.id_token);
sessionStore.set(sessionToken, {
  sub: idToken.sub,
  sid: idToken.sid,            // привязка локальной сессии к сессии OP
  authTime: idToken.auth_time,
});

// Проверка, не устарела ли сессия (max_age):
function sessionStale(idToken, maxAge) {
  return (Date.now()/1000) - idToken.auth_time > maxAge;
}

## Q. RP-Initiated Logout — клиент инициирует выход (OIDC RP-Initiated Logout 1.0)
Источник: OpenID Connect RP-Initiated Logout 1.0
Пояснение: клиент завершает локальную сессию ДО redirect, затем редиректит
на /end-session OP с id_token_hint + post_logout_redirect_uri + state (CSRF).
OP проверяет id_token_hint, завершает сессию, редиректит обратно.

function rpInitiatedLogout(idToken, endSessionEndpoint, redirectBack, state) {
  clearLocalSession();            // 1) удалить локальную сессию (cookie/storage)
  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: redirectBack,   // зарегистрирован заранее
    state: state,                              // CSRF, сверить в callback
  });
  // 2) redirect на OP:
  window.location.href = `${endSessionEndpoint}?${params}`;
}
// OP: проверяет id_token_hint (подпись, aud, iss) -> завершает сессию ->
//     GET <post_logout_redirect_uri>?state=...

## R. Back-Channel Logout — серверный logout от OP (OIDC Back-Channel Logout 1.0)
Источник: OpenID Connect Back-Channel Logout 1.0
Пояснение: OP шлёт RP POST logout token (JWT) на backchannel_logout_uri при
завершении сессии пользователя в OP (смена пароля, отзыв, logout, компро-
метация). RP проверяет подпись/iss/aud/exp/jti и завершает локальную сессию
по sub + sid.

// RP: endpoint-обработчик back-channel logout
async function handleBackchannelLogout(req) {
  const token = req.body["logout_token"];
  const claims = decodeJwt(token);
  // Проверки:
  if (claims.iss  !== AS_ISSUER) throw 400;
  if (claims.aud  !== CLIENT_ID) throw 400;
  if (claims.exp  < now())       throw 400;
  if (claims.jti  in seenJti)    throw 400;   // anti-replay
  verifySignature(token, asJwks);              // подпись OP
  const events = claims.events || [];
  if (events.includes("http://events.openid.net/authenticated/logout")) {
    sessionStore.deleteBy(claims.sub, claims.sid);  // завершить локальную сессию
  }
  return 200;  // обязательно 200 (без body)
}
// Client metadata: backchannel_logout_uri, backchannel_logout_session_support
// Logout token payload:
// { "iss","aud","sub","iat","jti","sid",
//   "events":["http://events.openid.net/authenticated/logout"] }

## S. Step-Up Authentication — повторная аутентификация / MFA (RFC 9470)
Источник: RFC 9470 / OIDC (acr, amr claims)
Пояснение: для чувствительных операций клиент запрашивает повышенный уровень
аутентификации (acr=urn:mfa, max_age) на /authorize; AS сравнивает текущий
уровень (acr) с требуемым и при необходимости запрашивает повторный login с
MFA. Ответ — ID token с acr=urn:mfa, amr=[password,otp], auth_time=now.

// Клиент: запрос step-up для чувствительной операции
const params = new URLSearchParams({
  response_type: "code",
  client_id: "client-abc",
  redirect_uri: "https://portal.example.com/callback",
  scope: "openid",
  state: crypto.randomUUID(),
  code_challenge: codeChallenge,
  code_challenge_method: "S256",
  step_up_auth: "true",          // запрос повышенной аутентификации
  acr: "urn:mfa",                 // требуемый уровень (MFA)
  max_age: 300,                   // если сессия старше 300 c -> step-up
  amr: "otp",                     // требуемый метод
});
// Если уровень ниже -> AS: повторный login + MFA;
// иначе -> обычный code flow.
// RS/Портал: по claims acr/amr/auth_time принимает policy-based решение:
//   if (idToken.acr === "urn:mfa" &&
//       (Date.now()/1000 - idToken.auth_time) <= 300) allowSensitiveOp();
