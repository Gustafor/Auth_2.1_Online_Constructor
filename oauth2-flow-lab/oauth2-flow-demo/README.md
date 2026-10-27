# OAuth 2.0 Flow Lab

Интерактивная учебная симуляция OAuth 2.0 Authorization Code Flow с PKCE.

## Запуск
1. Распакуйте архив.
2. Откройте `index.html` в современном браузере.
3. Измените входные параметры и нажмите «Запустить flow».
4. Используйте «Следующий шаг» или «Проиграть весь flow».
5. Выбирайте сообщения в списке и переключайте вкладки «Сообщение», «Поля и параметры», «Результат».

Если браузер ограничивает Web Crypto при открытии `file://`, запустите локальный сервер из каталога проекта:
- Python: `python -m http.server 8000`
- затем откройте `http://localhost:8000`

## Что демонстрируется
- authorization request с `client_id`, `redirect_uri`, `scope`, `state`
- PKCE: `code_verifier`, `code_challenge`, `code_challenge_method`
- возврат authorization code
- POST на token endpoint
- ответ с access token / refresh token
- вызов API с `Authorization: Bearer ...`
- ответ защищённого ресурса

## Важно
Это не OAuth-клиент и не реализация сервера. Все endpoints (`example.test`) и токены вымышлены. Пароль из формы не отправляется и не включается в трассу. Проект предназначен только для обучения и демонстрации протокола.
