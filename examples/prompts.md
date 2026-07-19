# Примеры промптов для sbis-mcp

## Входящие документы за период

Покажи входящие документы типа «Реализация» за последнюю неделю через `sbis_list_documents_by_event` (registryType=Входящие).

## Карточка документа и вложение

1. `sbis_read_document` по documentId
2. `sbis_get_attachment` по url из `Документ.Вложение[].Файл.Ссылка` с includeContent=true

## Контрагент по ИНН

Найди контрагента ИНН 7700000000 через `sbis_list_counterparties`.
