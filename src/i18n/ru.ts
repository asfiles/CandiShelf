/**
 * Russian UI strings.
 *
 * Typed as `Record<TranslationKey, Entry>`: every key from `en.ts` must be
 * present, so the two dictionaries can never drift apart unnoticed.
 */

import type { TranslationKey } from "./en";
import { ruPlural } from "./plural";
import type { Entry, TParams } from "./types";

export const ru: Record<TranslationKey, Entry> = {
  // ---- Shared ------------------------------------------------------------
  "common.loading": "Загрузка…",
  "common.working": "Обработка…",
  "common.cancel": "Отмена",
  "common.confirm": "Подтвердить",
  "common.close": "Закрыть",
  "common.unknownRole": "Должность не указана",
  "common.recommended": "Рекомендуется",
  "common.none": "—",

  // ---- App shell ---------------------------------------------------------
  "app.subtitle": "Локальное хранилище резюме",
  "app.aboutTitle": "О CandiShelf",
  "nav.candidates": "Кандидаты",
  "nav.import": "Импорт",
  "nav.match": "Подбор под вакансию",
  "nav.settings": "Настройки",
  "nav.about": "О программе",

  // ---- Language switcher -------------------------------------------------
  "language.en": "English",
  "language.ru": "Русский",

  // ---- Home / candidates -------------------------------------------------
  "home.title": "Кандидаты",
  "home.count": (p: TParams) =>
    `${p.count} ${ruPlural(
      Number(p.count),
      "кандидат",
      "кандидата",
      "кандидатов",
    )} в вашем локальном хранилище`,
  "home.shortlisted": (p: TParams) => `${p.count} в шортлисте`,
  "home.exportShortlist": "Экспорт шортлиста",
  "home.matchToJob": "Подобрать под вакансию",
  "home.addResumes": "Добавить резюме",
  "home.searchPlaceholder":
    "Поиск по ФИО, e-mail, телефону или описание кандидата",
  "home.search": "Искать",
  "home.filterLocation": "Фильтр по локации",
  "home.anyExperience": "Любой опыт",
  "home.anyMax": "Без ограничения",
  "home.minYears": (p: TParams) =>
    `от ${p.count} ${ruPlural(Number(p.count), "года", "лет", "лет")}`,
  "home.maxYears": (p: TParams) =>
    `до ${p.count} ${ruPlural(Number(p.count), "года", "лет", "лет")}`,
  "home.filters": (p: TParams) =>
    Number(p.count) > 0 ? `Фильтры (${p.count})` : "Фильтры",
  "home.clearFilters": "Сбросить фильтры",
  "home.filterTitle": "Должность",
  "home.filterSkillsAll": "Навыки — все, через запятую",
  "home.filterSkillsExclude": "Исключить навыки",
  "home.filterLanguages": "Языки, через запятую",
  "home.filterShortlistOnly": "Только шортлист",
  "home.filterExcludeDuplicates": "Скрыть дубликаты",
  "home.searchFailed": "Ошибка поиска: {error}",
  "home.exported": "Шортлист экспортирован в {path}",
  "home.exportFailed": "Ошибка экспорта: {error}",
  "home.addShortlist": "Добавить в шортлист",
  "home.removeShortlist": "Убрать из шортлиста",
  "home.noMatches": "Ничего не найдено",
  "home.noMatchesHint": "Попробуйте переформулировать запрос обычными словами.",
  "home.emptyTitle": "Ваше хранилище пусто",
  "home.emptyHint":
    "Импортируйте резюме в формате PDF, DOCX или TXT, чтобы сформировать локальную базу кандидатов.",

  // ---- Search match kinds ------------------------------------------------
  "search.match.email": "Точное совпадение по e-mail",
  "search.match.phone": "Точное совпадение по телефону",
  "search.match.linkedin": "Точное совпадение по LinkedIn",
  "search.match.name": "Совпадение по ФИО",
  "search.match.semantic": "Смысловое совпадение",

  // ---- Import ------------------------------------------------------------
  "import.title": "Импорт резюме",
  "import.subtitle":
    "Добавьте документы PDF, DOCX или TXT в локальное хранилище.",
  "import.back": "Назад к кандидатам",
  "import.dropTitle": "Перетащите резюме сюда",
  "import.dropHint": "Файлы обрабатываются локально. Ничего не загружается в интернет.",
  "import.chooseFiles": "Выбрать файлы",
  "import.chooseFolder": "Выбрать папку",
  "import.fileFilter": "Резюме",
  "import.processing": "Обработка документов…",
  "import.extractingFile": "Извлечение текста: {file}…",
  "import.extracting":
    "Извлечение текста, разбор полей и построение эмбеддингов локально.",
  "import.found": "Найдено документов",
  "import.processed": "Успешно обработано",
  "import.failed": "С ошибками",
  "import.viewCandidates": "Показать кандидатов",
  "import.doneAll": (p: TParams) =>
    `Импортировано ${p.processed} из ${p.found} ${ruPlural(
      Number(p.found),
      "документа",
      "документов",
      "документов",
    )}.`,
  "import.donePartial": (p: TParams) =>
    `Импортировано ${p.processed}, с ошибками: ${p.failed}.`,
  "import.failedToast": "Ошибка импорта: {error}",
  "import.noPaths": "Не удалось получить пути перетащенных файлов.",

  // ---- Match to job ------------------------------------------------------
  "match.title": "Подбор под вакансию",
  "match.subtitle":
    "Вставьте описание вакансии. CandiShelf выделит требования и упорядочит кандидатов — это рекомендация для вас, а не автоматическое решение.",
  "match.jobLabel": "Описание вакансии",
  "match.jobPlaceholder": "Вставьте сюда полный текст вакансии…",
  "match.analyse": "Анализ…",
  "match.find": "Найти подходящих кандидатов",
  "match.sample": "Использовать пример вакансии",
  "match.sampleText": `Senior DevOps инженер

Ищем DevOps-инженера с уверенным опытом работы с Kubernetes, AWS и Terraform.
Опыт в финтехе будет плюсом. Вы будете отвечать за наши CI/CD-пайплайны
и облачную инфраструктуру.`,
  "match.requirements": "Найденные требования",
  "match.noRequirements":
    "Конкретные требования не найдены. Попробуйте более подробное описание вакансии.",
  "match.ranked": "Кандидаты по релевантности",
  "match.needText": "Сначала вставьте описание вакансии.",
  "match.failed": "Ошибка подбора: {error}",

  // ---- Settings ----------------------------------------------------------
  "settings.title": "Настройки",
  "settings.subtitle": "Управление хранилищем, моделями и данными.",
  "settings.language": "Язык",
  "settings.languageHint":
    "Язык интерфейса. По умолчанию определяется по системе; изменить можно здесь в любой момент.",
  "settings.dataDir": "Каталог данных",
  "settings.dataDirHint":
    "Здесь хранятся база данных, эмбеддинги, модели и настройки.",
  "settings.change": "Изменить",
  "settings.copyOriginals":
    "Копировать исходные файлы резюме в хранилище приложения (чтобы они оставались доступными, даже если оригиналы переместить)",
  "settings.models": "AI-модели",
  "settings.modelsHint":
    "Поиск и подбор под вакансию выполняются на активной локальной модели. При смене или повторном скачивании модели существующие кандидаты переиндексируются, чтобы оставаться доступными для поиска в пространстве новой модели.",
  "settings.active": "Активна",
  "settings.downloaded": "Скачана",
  "settings.notDownloaded": "Не скачана",
  "settings.use": "Использовать",
  "settings.redownload": "Перекачать",
  "settings.remove": "Удалить",
  "settings.download": "Скачать",
  "settings.reembedding": "Переиндексация кандидатов…",
  "settings.updates": "Обновления и состояние",
  "settings.version": "Версия {v}",
  "settings.checkUpdates": "Проверить обновления",
  "settings.danger": "Опасная зона",
  "settings.clearTitle": "Удалить все данные",
  "settings.clearHint":
    "Удаляет всех кандидатов и их эмбеддинги. Модели сохраняются.",
  "settings.clearButton": "Очистить базу",
  "settings.clearConfirmTitle": "Очистить всю базу данных?",
  "settings.clearConfirmMsg":
    "Это безвозвратно удалит всех кандидатов, извлечённый текст и эмбеддинги. Действие необратимо.",
  "settings.clearConfirmLabel": "Удалить всё",
  "settings.tDirPicker": "Выбор каталога доступен только в настольном приложении.",
  "settings.tDirUpdated": "Каталог данных обновлён.",
  "settings.tDownloaded": "{name} скачана и активирована.",
  "settings.tDownloadFailed": "Ошибка скачивания: {error}",
  "settings.tRedownloaded": "{name} скачана заново и активирована.",
  "settings.tSwitched": "Активная модель: {name}.",
  "settings.tOpFailed": "Ошибка операции: {error}",
  "settings.tRemoved": "{name} удалена.",
  "settings.tCleared": "Все данные удалены.",
  "settings.tClearFailed": "Не удалось очистить: {error}",
  "settings.tUpdateFailed": "Ошибка проверки обновлений: {error}",
  "settings.tUpdateMsg":
    "У вас версия {v}. Новые версии публикуются в GitHub Releases; для обновления скачайте последний переносимый файл.",
  "settings.switchTitle": "Переключиться на {name}?",
  "settings.reDownloadTitle": "Скачать {name} заново?",
  "settings.switchMsgRe": "Текущая копия будет удалена и скачана заново.",
  "settings.switchMsgActive":
    "Эта модель станет активной для поиска и подбора под вакансию.",
  "settings.switchImpact": (p: TParams) =>
    `Затем CandiShelf переиндексирует ${p.count} ${ruPlural(
      Number(p.count),
      "кандидата",
      "кандидатов",
      "кандидатов",
    )}, чтобы они были доступны в пространстве новой модели. Кандидаты сохраняются; пересчитываются только эмбеддинги. Для больших баз это может занять некоторое время.`,
  "settings.switchImpactNone":
    "База кандидатов пуста, поэтому переиндексация не требуется.",
  "settings.switchConfirm": "Сменить модель",
  "settings.reDownloadConfirm": "Скачать заново",

  // ---- About -------------------------------------------------------------
  "about.title": "О программе",
  "about.subtitle": "Информация о приложении.",
  "about.tagline": "Локальное офлайн-хранилище резюме",
  "about.details": "Сведения",
  "about.version": "Версия",
  "about.build": "(сборка {v})",
  "about.author": "Автор",
  "about.homepage": "Домашняя страница",
  "about.license": "Лицензия",
  "about.privacy": "Конфиденциальность и безопасность",
  "about.privacy1":
    "Всё работает локально. Резюме и данные кандидатов не покидают это устройство.",
  "about.privacy2":
    "Содержимое файлов только читается как текст — никогда не исполняется и не отображается. Извлечённый текст очищается, SQL полностью параметризован, загрузки проверяются по контрольной сумме.",
  "about.privacy3":
    "Сборка защищена от атак на цепочку поставок npm: скрипты установки зависимостей отключены, версии жёстко зафиксированы, зависимости проверяются в CI.",
  "about.data": "Данные",
  "about.dataText":
    "База данных, эмбеддинги, скачанные модели и настройки хранятся в каталоге данных пользователя (см. «Настройки»).",
  "about.infoFailed": "Не удалось загрузить сведения о приложении: {error}",
  "about.openFailed": "Не удалось открыть ссылку: {error}",

  // ---- First run ---------------------------------------------------------
  "firstrun.welcome": "Добро пожаловать в CandiShelf",
  "firstrun.language": "Язык",
  "firstrun.intro":
    "CandiShelf находит кандидатов с помощью локальной AI-модели — поиск и подбор под вакансию полностью выполняются языковыми моделями на устройстве, поэтому ни одно резюме не покидает ваш компьютер. Выберите модель и скачайте её один раз; дальше всё работает офлайн.",
  "firstrun.chooseModel": "Выберите модель эмбеддингов",
  "firstrun.downloadingVerify": "Скачивание и проверка…",
  "firstrun.downloading": "Скачивание…",
  "firstrun.downloadSelected": "Скачать выбранную модель",
  "firstrun.note":
    "Загрузки проверяются по контрольной сумме. Модели можно сменить или скачать заново позже в «Настройках».",
  "firstrun.tDownloaded": "Модель скачана и проверена.",
  "firstrun.tDownloadFailed": "Ошибка скачивания: {error}",
  "firstrun.available": "Установлена",
  "firstrun.useSelected": "Использовать выбранную модель",
  "firstrun.tActivated": "Модель активирована.",
  "firstrun.tActivateFailed": "Не удалось активировать модель: {error}",

  // ---- Manual model install ---------------------------------------------
  "model.manualTitle": "Нет интернета? Установите модель вручную",
  "model.manualHint":
    "CandiShelf читает модель с диска — скачивание это единственный выход в сеть, и он необязателен. Скачайте файлы любым способом (браузер, curl, wget) и положите их в папку ниже. CandiShelf распознает модель и ничего скачивать не будет.",
  "model.manualFolder": "Положите файлы в эту папку:",
  "model.manualFiles": "Нужные файлы:",
  "model.manualDetected":
    "Файлы уже найдены — модель можно использовать без скачивания.",

  // ---- Candidate drawer --------------------------------------------------
  "drawer.loading": "Загрузка…",
  "drawer.possibleDuplicate":
    "⚠ Возможный дубликат кандидата #{ids} (совпадают email, телефон или LinkedIn).",
  "drawer.openOriginal": "Открыть оригинал",
  "drawer.save": "Сохранить изменения",
  "drawer.edit": "Редактировать",
  "drawer.reprocess": "Обработать заново",
  "drawer.delete": "Удалить",
  "drawer.toggleShortlist": "Шортлист",
  "drawer.contact": "Контакты",
  "drawer.email": "Эл. почта",
  "drawer.phone": "Телефон",
  "drawer.linkedin": "LinkedIn",
  "drawer.location": "Локация",
  "drawer.fieldExperience": "Опыт",
  "drawer.skills": "Навыки",
  "drawer.languages": "Языки",
  "drawer.education": "Образование",
  "drawer.workExperience": "Опыт работы",
  "drawer.sourceFile": "Исходный файл",
  "drawer.extractedText": "Извлечённый текст",
  "drawer.noText": "Текст не извлечён.",
  "drawer.deleteTitle": "Удалить кандидата?",
  "drawer.deleteMsg":
    "Это безвозвратно удалит профиль, извлечённый текст, эмбеддинги и любую скопированную копию оригинала.",
  "drawer.deleteConfirm": "Удалить навсегда",
  "drawer.tUpdated": "Кандидат обновлён.",
  "drawer.tUpdateFailed": "Ошибка обновления: {error}",
  "drawer.tDeleted": "Кандидат и все связанные данные удалены.",
  "drawer.tDeleteFailed": "Ошибка удаления: {error}",
  "drawer.tReprocessed": "Резюме обработано заново.",
  "drawer.tReprocessFailed": "Ошибка повторной обработки: {error}",

  // ---- Candidate row -----------------------------------------------------
  "row.shortlist": "Шортлист",
  "row.duplicate": "Дубликат",
  "row.duplicateTitle": "Возможный дубликат резюме",

  // ---- Experience label --------------------------------------------------
  "exp.lessThanOne": "<1 года",
  "exp.years": (p: TParams) =>
    `${p.count} ${ruPlural(Number(p.count), "год", "года", "лет")}`,
};
