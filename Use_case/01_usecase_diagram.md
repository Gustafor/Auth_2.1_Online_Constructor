# Use Case Diagram — Authorization Server / OpenID Provider (AS/OP)

Система (чёрный ящик): AS/OP. Актеры: Релиинг-Партей (RP), Пользователь
(End-User), Ресурс-Сервер (RS), Таймер (Time).

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle

actor "Релиинг-Партей (RP)" as RP
actor "Пользователь (End-User)" as User
actor "Ресурс-Сервер (RS)" as RS
actor "Таймер (Time)" as Time

rectangle "Authorization Server / OpenID Provider (AS/OP)" {
  usecase "Discover Authorization Server\n(UC-01)" as UC01
  usecase "Register Client\n(UC-02)" as UC02
  usecase "Authenticate End-User\n(UC-03)" as UC03
  usecase "Issue ID Token\n(UC-04)" as UC04
  usecase "Issue Access Token\n(UC-05)" as UC05
  usecase "Refresh Access Token\n(UC-06)" as UC06
  usecase "Use Pushed Authorization Request\n(UC-07)" as UC07
  usecase "Enforce PKCE\n(UC-08)" as UC08
  usecase "Authenticate Client by JWT\n(UC-09)" as UC09
  usecase "Authenticate Client by mTLS\n(UC-10)" as UC10
  usecase "Issue DPoP Token\n(UC-11)" as UC11
  usecase "Introspect Token\n(UC-12)" as UC12
  usecase "Validate Access Token\n(UC-13)" as UC13
  usecase "Revoke Token\n(UC-14)" as UC14
  usecase "Complete Device Authorization\n(UC-15)" as UC15
  usecase "Initiate Logout\n(UC-16)" as UC16
  usecase "Step-Up Authentication\n(UC-17)" as UC17
  usecase "Rotate Signing Keys\n(UC-18)" as UC18
}

' Ассоциации (actor <-> UC)
RP  ..> UC01
RP  ..> UC02
RP  ..> UC04
RP  ..> UC05
RP  ..> UC06
RP  ..> UC07
RP  ..> UC08
RP  ..> UC09
RP  ..> UC10
RP  ..> UC11
RS  ..> UC12
RS  ..> UC13
RS  ..> UC14
RP  ..> UC14
RP  ..> UC16
User ..> UC03
User ..> UC15
User ..> UC17
RP  ..> UC17
Time ..> UC16
Time ..> UC17
RP  ..> UC18

' include (включение): UC-05 включает UC-03, UC-08, и авторизацию клиента
UC05 ..> UC03 : <<include>>
UC05 ..> UC08 : <<include>>
UC07 ..> UC05 : <<include>>
UC04 ..> UC05 : <<include>>
UC06 ..> UC09 : <<include>>
UC05 ..> UC09 : <<include>>
UC12 ..> UC09 : <<include>>
UC13 ..> UC09 : <<include>>
UC11 ..> UC05 : <<include>>
UC17 ..> UC03 : <<include>>

' extend (расширение)
UC10 ..> UC09 : <<extend>> : mTLS вместо JWT
UC07 ..> UC05 : <<extend>> : confidential
UC11 ..> UC05 : <<extend>> : high-security
UC16 ..> UC04 : <<extend>> : sid
@enduml
```

## Проверки диаграммы
- [x] каждый актор связан ≥ 1 UC: RP (13 UC), End-User (UC-03/15/17),
      RS (UC-12/13/14), Таймер (UC-16/17), AS/OP/UC-18 (внутренний).
- [x] граница системы совпадает с scope (AS/OP чёрный ящик).
- [x] направление include/extend корректно (стрелка — к включаемому/базовому).
- [x] 18 UC — допустимо (упаковано в один пакет; при необходимости делить
      по подсистемам: discovery / токенизация / logout / keys).
