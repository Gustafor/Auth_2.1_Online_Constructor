# Actor–Goal List — Authorization Server / OpenID Provider (AS/OP)

## ФИКСАЦИЯ СИСТЕМЫ (scope)
Система, описываемая Use Case: **Authorization Server / OpenID Provider
(AS/OP)** — чёрный ящик. Границы:
- ВНУТРИ: регистрация клиентов, аутентификация + consent, выдача
  access / ID / refresh токенов, расширения OAuth 2.1 (PAR, PKCE, DPoP, mTLS,
  Device Flow), discovery-метаданные (AS Metadata), JWKS, валидация /
  продление / отзыв токенов, logout, step-up.
- ВНЕ: Ресурс-Сервер (RS) как реализация (сервит protected resource metadata,
  принимает токены); Портал (Relying Party с ролями Обучающийся / Учитель) —
  описывается в ТЗ (шаг 3), НЕ Use Case.

Входящие/исходящие события через границу: authorization request (/authorize),
token request (/token), refresh, revoke, introspection, login+consent от
End-User, logout (RP/Back-Channel), discovery (AS Metadata, JWKS),
PAR (/par), device authorization.

## Актеры (Actors)
| Актор | Тип | Роль |
|-------|-----|------|
| Релиинг-Партей (RP) | система (клиент OAuth) | получает access/ID/refresh токены, discovery, registration, revoke, logout |
| Пользователь (End-User) | человек | аутентификация, consent, device authorization, step-up |
| Ресурс-Сервер (RS) | система | валидация / introspection / отзыв токенов |
| Таймер (Time) | временной | истечение access token, шаг max_age (step-up) |
| AS/OP (Система) | чёрный ящик | выполняет все UC |

## Actor–Goal List (Precision Level 1)
Каждая строка = функциональное требование уровня 1.

| № | Актор | Цель (Goal, EN verb+noun) | UC | В scope Портала? |
|---|-------|---------------------------|----|------------------|
| 01 | RP | Discover Authorization Server | UC-01 | да |
| 02 | RP | Register Client | UC-02 | да |
| 03 | End-User | Authenticate End-User (login + consent) | UC-03 | да |
| 04 | RP | Issue ID Token (OIDC) | UC-04 | да |
| 05 | RP | Issue Access Token (code exchange) | UC-05 | да |
| 06 | RP | Refresh Access Token (rotation) | UC-06 | да |
| 07 | RP | Use Pushed Authorization Request (PAR) | UC-07 | да (confidential) |
| 08 | RP | Enforce PKCE | UC-08 | да (public/SPa) |
| 09 | RP | Authenticate Client by JWT (private_key_jwt) | UC-09 | да (confidential) |
| 10 | RP | Authenticate Client by mTLS | UC-10 | частично (high-security) |
| 11 | RP | Issue DPoP Token (sender-constrained) | UC-11 | частично (high-security) |
| 12 | RS | Introspect Token | UC-12 | да |
| 13 | RS | Validate Access Token (JWT) | UC-13 | да |
| 14 | RP / RS | Revoke Token | UC-14 | да |
| 15 | End-User | Complete Device Authorization | UC-15 | НЕТ — вне scope Портала (устройства без browser; Портал = web app) |
| 16 | RP / AS | Initiate Logout (RP + Back-Channel) | UC-16 | да |
| 17 | End-User / RP | Step-Up Authentication | UC-17 | да (чувствительные операции) |
| 18 | AS/OP | Rotate Signing Keys (JWKS) | UC-18 | НЕТ — вне scope Портала (внутреннее управление ключами AS) |

Brief-level (не детализируются, вне scope AS/OP/Портала):
- **Exchange Token (Token Exchange, RFC 8693)** — вне scope Портала (M2M /
  делегирование on-behalf-of; Портал не выполняет обмен токенов).

## Coverage check
- [x] каждый актор ≥ 1 UC: RP (01,02,04,05,06,07,08,09,10,11,14,16,17),
      End-User (03,15,17), RS (12,13,14), Таймер (16 max_age, 17 step-up),
      AS/OP (18).
- [x] каждый UC имеет trigger и success end condition (см. детализацию 02/03/04).
- [x] каждый детализированный UC имеет preconditions + failed end condition.
- [x] include/extend ≤ 2 уровня.
- [x] UC вне scope Портала помечены с причиной (15, 18).
