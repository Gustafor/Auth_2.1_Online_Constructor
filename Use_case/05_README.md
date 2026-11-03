# README — Use Case для Authorization Server / OpenID Provider (AS/OP)

Система (чёрный ящик): **AS/OP**. Portal (RP с ролями Обучающийся/Учитель)
описывается в ТЗ (шаг 3), НЕ Use Case.

## Файлы
| Файл | Содержание |
|------|------------|
| `00_actor_goal_list.md` | Scope, акторы (5), Actor–Goal List (18 UC), coverage check |
| `01_usecase_diagram.md` | PlantUML-диаграмма (18 UC, связи include/extend) + проверки |
| `02_usecases_core_flows.md` | Детально: UC-01..05 (discovery, registration, login, ID/Access token) + их таблицы тест-кейсов |
| `03_usecases_security_extensions.md` | Детально: UC-06..11 (refresh, PAR, PKCE, JWT-client, mTLS, DPoP) + их таблицы тест-кейсов |
| `04_usecases_rs_device_logout_keys.md` | Детально: UC-12..18 (introspect, validate, revoke, device, logout, step-up, keys) + их таблицы тест-кейсов |
| `05_README.md` | Индекс (этот файл), проверки целостности |
| `06_test_cases_from_extensions.md` | Сводная таблица тест-кейсов (105 строк) + итоговая статистика (ПО ФАКТИЧЕСКИМ строкам) |

## Количество Use Case (фактическое, по файлам 02/03/04)
**Всего детализированных UC: 18** (UC-01 .. UC-18, сквозная нумерация).

## UC вне scope Портала (помечены в AGL)
- UC-15 (Complete Device Authorization) — устройства без browser; Портал = web app.
- UC-18 (Rotate Signing Keys) — внутреннее управление ключами AS.
- Brief-level (не детализируется, вне scope Портала): Token Exchange (RFC 8693) —
  M2M / делегирование; Портал не выполняет обмен токенов.

## Связи include/extend (≤ 2 уровня)
- UC-05 (Issue Access Token) **include** UC-03 (login), UC-08 (PKCE), UC-09 (JWT client).
- UC-04 (Issue ID Token) **include** в UC-05.
- UC-07 (PAR) **include/extend** UC-05.
- UC-10 (mTLS) **extend** UC-09 (альтернатива client auth).
- UC-11 (DPoP) **extend** UC-05.
- UC-17 (Step-Up) **include** UC-03.
- UC-06 (Refresh), UC-12 (Introspect), UC-13 (Validate) **include** UC-09/10 (client auth).

## Правила целостности (проверено)
- (a) AGL ↔ детали: 18 детализированных UC ↔ 18 строк AGL (соответствие).
- (b) 06 — единый сводный источник итогов: 105 строк TC пересчитано скриптом
      ПО ФАКТИЧЕСКИМ строкам 06 (18 MSS + 87 расширений).
- (c) Количество UC в заголовках/индексе = фактическому (18).
- (d) Суффиксы расширений — только латиница (a, b, c); кириллица не смешивается.
