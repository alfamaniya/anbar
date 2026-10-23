
    // اتصال‌های ثابت DOM؛ شناسه‌ها باید با index.html هماهنگ بمانند.
    const sectionLinks = document.querySelectorAll('.nav-link');
    const sectionCards = document.querySelectorAll('.section-card');
    const inventoryGrid = document.getElementById('inventory-grid');
    const inventorySearchInput = document.getElementById('inventory-search');
    const inventoryEmpty = document.getElementById('inventory-empty');
    const inventoryCount = document.getElementById('inventory-count');
    const inventoryFeedback = document.getElementById('inventory-feedback');
    const selectAllItems = document.getElementById('select-all-items');
    const deleteSelectedItemsButton = document.getElementById('delete-selected-items');
    const openShipmentDialogButton = document.getElementById('open-shipment-dialog');
    const shipmentDialog = document.getElementById('shipment-dialog');
    const shipmentForm = document.getElementById('shipment-form');
    const shipmentItemsContainer = document.getElementById('shipment-items');
    const shipmentLocationInput = document.getElementById('shipment-location');
    const shipmentSublocationInput = document.getElementById('shipment-sublocation');
    const shipmentSublocationGroup = document.getElementById('shipment-sublocation-group');
    // کلیدهای پایدار localStorage؛ تغییر نام آن‌ها بدون مهاجرت می‌تواند داده‌های قبلی را از دسترس خارج کند.
    const LOCATION_KEY = 'anbar.shipment-locations.v1';
    const shipmentVoucherInput = document.getElementById('shipment-voucher');
    const shipmentExitInput = document.getElementById('shipment-exit-number');
    const shipmentFeedback = document.getElementById('shipment-feedback');
    const SHIPMENT_KEY = 'anbar.shipments.v1';
    const selectedItemCodes = new Set();
    const inputFeedback = document.getElementById('input-feedback');
    let inventorySort = { key: 'code', direction: 'asc' };
    let currentConsumptionReportRows = [];
    const itemFormInputs = {
      code: document.getElementById('supply-code'),
      description: document.getElementById('item-description'),
      stock: document.getElementById('item-stock')
    };
    // گروه کالا اختیاری است؛ رکوردهای قدیمی بدون گروه باقی می‌مانند و گروه حدسی تولید نمی‌شود.
    const manualCategoryGroup = document.createElement('div');
    manualCategoryGroup.className = 'field-group inventory-category-form-group';
    const manualCategoryLabel = document.createElement('label');
    manualCategoryLabel.htmlFor = 'item-category';
    manualCategoryLabel.textContent = 'گروه کالا (اختیاری)';
    const manualCategoryInput = document.createElement('input');
    manualCategoryInput.id = 'item-category';
    manualCategoryInput.name = 'item-category';
    manualCategoryInput.type = 'text';
    manualCategoryInput.maxLength = 80;
    manualCategoryInput.autocomplete = 'off';
    manualCategoryInput.placeholder = 'مثلاً اداری، بهداشتی یا فنی';
    manualCategoryInput.setAttribute('aria-describedby', 'item-category-hint');
    const manualCategoryHint = document.createElement('span');
    manualCategoryHint.id = 'item-category-hint';
    manualCategoryHint.className = 'field-hint';
    manualCategoryHint.textContent = 'گروه فقط در صورت ثبت واقعی در اطلاعات کالا وارد گزارش مصرف می‌شود.';
    manualCategoryGroup.append(manualCategoryLabel, manualCategoryInput, manualCategoryHint);
    const manualDescriptionGroup = itemFormInputs.description?.closest('.field-group');
    if (manualDescriptionGroup) manualDescriptionGroup.insertAdjacentElement('afterend', manualCategoryGroup);
    // کلیدهای اصلی داده و وضعیت صفحه‌بندی گزارش‌ها.
    const STORAGE_KEY = 'anbar.inventory.v1';
    const ACTIVITY_KEY = 'anbar.activity-log.v1'; // برای سازگاری با فایل‌های بکاپ قدیمی نگه داشته شده است.
    const ENTRY_HISTORY_KEY = 'anbar.entry-history.v1';
    const ENTRY_PAGE_SIZE = 10;
    let entryHistoryPage = 0;
    let entryHistorySort = { key: 'entryNumber', direction: 'desc' };
    let shipmentHistoryPage = 0;
    let shipmentHistorySort = { key: 'date', direction: 'desc' };

    /**
     * هدف: خواندن لاگ فعالیت از localStorage و کنارگذاشتن رکوردهای نامعتبر.
     * ورودی: پارامتر ندارد.
     * خروجی: آرایه رخدادهای معتبر؛ هنگام خطا آرایه خالی.
     */
    function loadActivityLog() {
      try {
        const records = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
        return Array.isArray(records)
          ? records.filter(record => record && typeof record === 'object' && !Array.isArray(record))
          : [];
      } catch (error) {
        return [];
      }
    }

    /**
     * هدف: خواندن تاریخچه ورود و نرمال‌سازی timestamp رکوردها.
     * ورودی: پارامتر ندارد.
     * خروجی: آرایه سوابق با زمان معتبر یا مقدار خالی.
     */
    function loadEntryHistory() {
      try {
        const records = JSON.parse(localStorage.getItem(ENTRY_HISTORY_KEY) || '[]');
        if (!Array.isArray(records)) return [];
        return records
          .filter(record => record && typeof record === 'object' && !Array.isArray(record))
          .map(record => ({
            ...record,
            timestamp: typeof record.timestamp === 'string' && Number.isFinite(Date.parse(record.timestamp))
              ? record.timestamp
              : ''
          }));
      } catch (error) {
        return [];
      }
    }

    /**
     * هدف: ذخیره حداکثر ۱۰۰۰ سابقه ورود و گزارش شکست ذخیره‌سازی.
     * ورودی: records: آرایه سوابق ورود.
     * خروجی: true در موفقیت یا false در شکست.
     */
    function saveEntryHistory(records) {
      const preservesEntryRecord = record =>
        Boolean(record && typeof record === 'object' && !Array.isArray(record)) &&
        (record.timestamp === undefined || record.timestamp === '' ||
          (typeof record.timestamp === 'string' && Number.isFinite(Date.parse(record.timestamp))));
      if (!canSafelyRewriteStoredArray(ENTRY_HISTORY_KEY, 'تاریخچه ورود', inventoryFeedback, preservesEntryRecord)) {
        return false;
      }
      try {
        localStorage.setItem(ENTRY_HISTORY_KEY, JSON.stringify(records.slice(0, 1000)));
        renderDataQualityReport();
        return true;
      } catch (error) {
        inventoryFeedback.textContent = 'ذخیره تاریخچه ورود ممکن نشد؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.';
        return false;
      }
    }

    /**
     * هدف: ساخت شناسه ورود با تاریخ شمسی و بخش میلی‌ثانیه.
     * ورودی: date: زمان مبنا از نوع Date؛ به‌صورت پیش‌فرض زمان جاری.
     * خروجی: رشته شناسه ورود.
     */
    function makeEntryNumber(date = new Date()) {
      const parts = solarDateTime(date).label
        .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
        .replace(/[^0-9]/g, '-');
      return 'ورود-' + parts + '-' + String(date.getMilliseconds()).padStart(3, '0');
    }

    /**
     * هدف: ساخت شناسه پایدار و کم‌احتمال‌تکرار برای سندها و ردیف‌های گردش کالا.
     * ورودی: prefix نوع شناسه و timestamp زمان مبنا.
     * خروجی: رشته شناسه؛ در مرورگرهای پشتیبان از UUID و در غیر این صورت مقدار تصادفی محلی استفاده می‌شود.
     */
    function makeUniqueRecordId(prefix, timestamp = Date.now()) {
      const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8);
      return String(prefix) + '-' + String(timestamp) + '-' + randomPart;
    }

    /**
     * هدف: ثبت سابقه تجمیعی برای ورود موفق کالاها و درج جزئیات آن در لاگ فعالیت.
     * ورودی: items: کالاهای ثبت‌شده در این نوبت.
     * خروجی: بدون مقدار بازگشتی؛ برای فهرست خالی عملیات نمی‌کند.
     */
    function recordIncomingEntry(items) {
      if (!items.length) return true;
      const now = new Date();
      const dateTime = solarDateTime(now);
      const record = {
        id: makeUniqueRecordId('entry', now.getTime()),
        entryNumber: makeEntryNumber(now),
        timestamp: now.toISOString(),
        date: dateTime.date,
        time: dateTime.time,
        itemCount: items.length,
        pieceCount: items.reduce((total, item) => total + item.stock, 0),
        // تصویر جزئیات قلم‌ها نگهداری می‌شود تا تاریخچه ورود فقط به شمار کلی محدود نباشد.
        items: items.map((item, index) => ({
          id: makeUniqueRecordId('entry-line', now.getTime() + index),
          itemId: item.id || ('item-' + dataQualityKey(item.code)),
          code: item.code,
          description: item.description,
          category: typeof item.category === 'string' ? item.category : '',
          quantity: Number(item.stock)
        }))
      };
      const records = loadEntryHistory();
      records.unshift(record);
      if (!saveEntryHistory(records)) return false;
      renderEntryHistory();
      const itemDetails = items.map(item =>
        String(item.code || 'بدون کد') + ' (' + String(item.description || 'بدون شرح') + '): ' + toEnglishDigits(item.stock)
      ).join('؛ ');
      recordActivity('ثبت ورود کالا', {
        'شماره ورود': record.entryNumber, 'تاریخ و ساعت': record.date + ' ' + record.time,
        'تعداد اقلام': items.length, 'تعداد کل قطعه': record.pieceCount, 'اقلام (کد، شرح، تعداد)': itemDetails
      });
      return true;
    }

    /**
     * هدف: ساخت جدول تاریخچه ورود با مرتب‌سازی، صفحه‌بندی و وضعیت دکمه‌های پیمایش.
     * ورودی: پارامتر ندارد؛ داده‌ها از ذخیره‌سازی محلی خوانده می‌شوند.
     * خروجی: DOM تاریخچه ورود به‌روزرسانی می‌شود.
     */
    function renderEntryHistory() {
      const body = document.getElementById('entry-history-body');
      const pageLabel = document.getElementById('entry-history-page');
      const previousButton = document.getElementById('entry-history-prev');
      const nextButton = document.getElementById('entry-history-next');
      if (!body || !pageLabel || !previousButton || !nextButton) return;

      const records = loadEntryHistory();
      const { key, direction } = entryHistorySort;
      records.sort((a, b) => {
        let comparison;
        if (key === 'entryNumber') comparison = String(a.entryNumber || '').localeCompare(String(b.entryNumber || ''), 'fa');
        else if (key === 'date') comparison = String(a.timestamp || a.date || '').localeCompare(String(b.timestamp || b.date || ''), 'fa');
        else comparison = (Number(a[key]) || 0) - (Number(b[key]) || 0);
        return direction === 'asc' ? comparison : -comparison;
      });

      const pageCount = Math.max(1, Math.ceil(records.length / ENTRY_PAGE_SIZE));
      entryHistoryPage = Math.min(entryHistoryPage, pageCount - 1);
      const start = entryHistoryPage * ENTRY_PAGE_SIZE;
      const pageRecords = records.slice(start, start + ENTRY_PAGE_SIZE);
      body.replaceChildren();

      if (!pageRecords.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.className = 'preview-empty';
        cell.textContent = 'هنوز ورودی ثبت نشده است.';
        row.append(cell);
        body.append(row);
      } else {
        pageRecords.forEach(record => {
          const row = document.createElement('tr');
          const numberCell = document.createElement('td');
          numberCell.className = 'entry-history-number';
          numberCell.textContent = record.entryNumber;
          const dateCell = document.createElement('td');
          dateCell.className = 'date-time-cell';
          const dateText = document.createElement('span');
          dateText.className = 'date-part';
          dateText.textContent = record.date || '—';
          dateCell.append(dateText);
          if (record.time) {
            const timeText = document.createElement('span');
            timeText.className = 'time-part';
            timeText.textContent = record.time;
            dateCell.append(timeText);
          }
          const itemCell = document.createElement('td');
          itemCell.textContent = toEnglishDigits(record.itemCount);
          const pieceCell = document.createElement('td');
          pieceCell.textContent = toEnglishDigits(record.pieceCount);
          row.append(numberCell, dateCell, itemCell, pieceCell);
          body.append(row);
        });
      }

      pageLabel.textContent = 'صفحه ' + toEnglishDigits(entryHistoryPage + 1) + ' از ' + toEnglishDigits(pageCount) +
        ' — ' + toEnglishDigits(records.length) + ' ورود';
      previousButton.disabled = entryHistoryPage === 0;
      nextButton.disabled = entryHistoryPage >= pageCount - 1;
      updateReportsOverview();
      document.querySelectorAll('[data-entry-sort]').forEach(button => {
        const active = button.dataset.entrySort === key;
        const marker = button.querySelector('span');
        if (marker) marker.textContent = active ? (direction === 'asc' ? '↑' : '↓') : '↕';
        button.setAttribute('aria-sort', active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
      });
    }

    document.querySelectorAll('[data-entry-sort]').forEach(button => {
      // رویداد «کلیک» برای دکمه‌های مرتب‌سازی/صفحه‌بندی تاریخچه ورود؛ تغییر ترتیب ردیف‌ها و نشانگر مرتب‌سازی.
      button.addEventListener('click', () => {
        const key = button.dataset.entrySort;
        if (entryHistorySort.key === key) {
          entryHistorySort.direction = entryHistorySort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          entryHistorySort = { key, direction: key === 'entryNumber' ? 'desc' : 'asc' };
        }
        entryHistoryPage = 0;
        renderEntryHistory();
      });
    });

    // رویداد «کلیک» برای دکمه صفحه قبلی تاریخچه ورود؛ نمایش صفحه قبلی.
    document.getElementById('entry-history-prev').addEventListener('click', () => {
      if (entryHistoryPage > 0) { entryHistoryPage -= 1; renderEntryHistory(); }
    });
    // رویداد «کلیک» برای دکمه صفحه بعدی تاریخچه ورود؛ نمایش صفحه بعدی.
    document.getElementById('entry-history-next').addEventListener('click', () => {
      if ((entryHistoryPage + 1) * ENTRY_PAGE_SIZE < loadEntryHistory().length) {
        entryHistoryPage += 1;
        renderEntryHistory();
      }
    });

    /**
     * هدف: به‌روزرسانی کارت‌های خلاصه افزوده‌شده در بخش گزارش‌ها.
     * ورودی: ندارد؛ داده‌ها از تاریخچه‌های موجود خوانده می‌شوند.
     * خروجی: تعداد ورود/ارسال و زمان آخرین ارسال نمایش داده می‌شود؛ داده اصلی تغییر نمی‌کند.
     */
    function updateReportsOverview() {
      const shipmentCount = document.getElementById('reports-total-shipments');
      const entryCount = document.getElementById('reports-total-entries');
      const latestShipment = document.getElementById('reports-latest-shipment');
      if (!shipmentCount || !entryCount || !latestShipment) return;
      const shipments = loadShipments();
      const entries = loadEntryHistory();
      shipmentCount.textContent = toEnglishDigits(shipments.length);
      entryCount.textContent = toEnglishDigits(entries.length);
      const latest = shipments.reduce((best, item) => {
        const candidate = String(item.timestamp || item.date || '');
        return candidate > best ? candidate : best;
      }, '');
      latestShipment.textContent = latest || '—';
    }

    /**
     * هدف: ایجاد پنل گزارش مصرف از ردیف‌های واقعی تاریخچه ارسال.
     * فیلترها بر اساس تاریخ سند، محل ارسال و گروه ثبت‌شده هر قلم هستند.
     */
    function ensureConsumptionReportPanel() {
      const existing = document.getElementById('consumption-report-panel');
      if (existing) return existing;
      const overview = document.querySelector('.reports-overview');
      if (!overview) return null;
      const panel = document.createElement('article');
      panel.id = 'consumption-report-panel';
      panel.className = 'settings-box reports-consumption-panel';
      const heading = document.createElement('h4');
      heading.textContent = 'گزارش تفصیلی مصرف';
      const description = document.createElement('p');
      description.textContent = 'گزارش از سوابق واقعی ارسال ساخته می‌شود. بازه تاریخ بر اساس تقویم خورشیدی است؛ سوابق قدیمی بدون گروه با عنوان «بدون گروه ثبت‌شده» نمایش داده می‌شوند.';
      const filters = document.createElement('div');
      filters.className = 'report-filter-grid';
      const makeField = (labelText, id, type) => {
        const group = document.createElement('div');
        group.className = 'field-group report-filter-field';
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = labelText;
        const input = document.createElement(type === 'select' ? 'select' : 'input');
        input.id = id;
        if (type === 'date') {
          input.type = 'text';
          input.className = 'solar-date-input';
          input.inputMode = 'numeric';
          input.autocomplete = 'off';
          input.placeholder = '۱۴۰۵/۰۱/۰۱';
          input.setAttribute('aria-haspopup', 'dialog');
          input.setAttribute('aria-expanded', 'false');
        } else if (type !== 'select') {
          input.type = type;
        }
        group.append(label, input);
        filters.append(group);
        return input;
      };
      makeField('از تاریخ (خورشیدی)', 'consumption-report-start-date', 'date');
      makeField('تا تاریخ (خورشیدی)', 'consumption-report-end-date', 'date');
      makeField('محل ارسال', 'consumption-report-location', 'select');
      makeField('گروه کالا', 'consumption-report-category', 'select');
      const summary = document.createElement('div');
      summary.className = 'reports-overview report-filter-summary';
      [['consumption-report-line-count', 'ردیف‌های مصرف'], ['consumption-report-total-quantity', 'مجموع تعداد مصرف'], ['consumption-report-document-count', 'تعداد اسناد']].forEach(([id, labelText]) => {
        const metric = document.createElement('article');
        metric.className = 'report-metric';
        const label = document.createElement('span');
        label.textContent = labelText;
        const value = document.createElement('strong');
        value.id = id;
        value.textContent = '۰';
        metric.append(label, value);
        summary.append(metric);
      });
      const actions = document.createElement('div');
      actions.className = 'report-filter-actions';
      const exportButton = document.createElement('button');
      exportButton.id = 'export-consumption-report';
      exportButton.type = 'button';
      exportButton.className = 'action-button';
      exportButton.textContent = 'خروجی CSV برای Excel';
      exportButton.addEventListener('click', exportConsumptionReport);
      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'action-button secondary';
      resetButton.textContent = 'پاک‌کردن فیلترها';
      resetButton.addEventListener('click', () => {
        ['consumption-report-start-date', 'consumption-report-end-date'].forEach(id => {
          const input = document.getElementById(id);
          input.value = '';
          delete input.dataset.isoDate;
          input.removeAttribute('aria-invalid');
          input.title = '';
        });
        document.getElementById('consumption-report-location').value = 'all';
        document.getElementById('consumption-report-category').value = 'all';
        renderConsumptionReport();
      });
      actions.append(exportButton, resetButton);
      const tableWrap = document.createElement('div');
      tableWrap.className = 'entry-history-table-wrap report-table-wrap';
      const tableParts = createDataTable(['تاریخ و ساعت', 'شماره حواله', 'شماره خروج', 'محل ارسال', 'گروه کالا', 'کد کالا', 'شرح کالا', 'تعداد'], 'consumption-report-table');
      tableParts.table.setAttribute('aria-label', 'گزارش تفصیلی مصرف بر اساس تاریخ، محل و گروه');
      tableParts.tbody.id = 'consumption-report-body';
      tableWrap.append(tableParts.table);
      const feedback = document.createElement('p');
      feedback.id = 'consumption-report-feedback';
      feedback.className = 'feedback';
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-live', 'polite');
      panel.append(heading, description, filters, summary, actions, tableWrap, feedback);
      overview.insertAdjacentElement('afterend', panel);
      initializeSolarDateInputs();
      [
        document.getElementById('consumption-report-start-date'),
        document.getElementById('consumption-report-end-date'),
        document.getElementById('consumption-report-location'),
        document.getElementById('consumption-report-category')
      ].forEach(control => control.addEventListener('change', renderConsumptionReport));
      return panel;
    }

    /** هدف: تبدیل اسناد ارسال به ردیف‌های گزارش؛ داده ساختگی یا گروه حدسی به گزارش اضافه نمی‌شود. */
    function getConsumptionReportData() {
      const rows = [];
      let invalidLines = 0;
      let missingTimestamps = 0;
      loadShipments().forEach(shipment => {
        if (!shipment || typeof shipment !== 'object' || !Array.isArray(shipment.items)) return;
        shipment.items.forEach(line => {
          if (!line || typeof line !== 'object') { invalidLines += 1; return; }
          const quantity = normalizeStock(line.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0 || typeof line.code !== 'string' || !line.code.trim()) {
            invalidLines += 1;
            return;
          }
          const timestamp = typeof shipment.timestamp === 'string' && Number.isFinite(Date.parse(shipment.timestamp))
            ? shipment.timestamp : '';
          if (!timestamp) missingTimestamps += 1;
          const parsed = timestamp ? new Date(timestamp) : null;
          const localDate = parsed
            ? parsed.getFullYear() + '-' + String(parsed.getMonth() + 1).padStart(2, '0') + '-' + String(parsed.getDate()).padStart(2, '0')
            : '';
          rows.push({
            timestamp,
            localDate,
            dateLabel: String(shipment.date || '—') + (shipment.time ? ' ' + String(shipment.time) : ''),
            documentId: String(shipment.id || (shipment.voucherNumber || '') + '|' + (shipment.exitNumber || '') + '|' + timestamp),
            voucherNumber: String(shipment.voucherNumber || '—'),
            exitNumber: String(shipment.exitNumber || '—'),
            locationName: String(shipment.location || ''),
            location: String(shipment.location || '—') + (shipment.sublocation ? ' / ' + String(shipment.sublocation) : ''),
            category: typeof line.category === 'string' ? line.category.trim() : '',
            code: line.code,
            description: typeof line.description === 'string' ? line.description : '',
            quantity
          });
        });
      });
      rows.sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
      return { rows, invalidLines, missingTimestamps };
    }

    /** هدف: به‌روزرسانی جمع‌ها و جدول گزارش بر اساس فیلترهای انتخاب‌شده. */
    function renderConsumptionReport() {
      if (!ensureConsumptionReportPanel()) return;
      const data = getConsumptionReportData();
      const locationSelect = document.getElementById('consumption-report-location');
      const categorySelect = document.getElementById('consumption-report-category');
      const setOptions = (select, values, allText) => {
        const previous = select.value;
        select.replaceChildren();
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = allText;
        select.append(all);
        values.forEach(value => {
          const option = document.createElement('option');
          option.value = value.value;
          option.textContent = value.label;
          select.append(option);
        });
        select.value = [...select.options].some(option => option.value === previous) ? previous : 'all';
      };
      const locations = [...new Set(data.rows.map(row => row.locationName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fa'));
      setOptions(locationSelect, locations.map(value => ({ value, label: value })), 'همه محل‌ها');
      const categories = [...new Set(data.rows.map(row => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fa'));
      setOptions(categorySelect, [
        ...categories.map(value => ({ value, label: value })),
        { value: '__uncategorized__', label: 'بدون گروه ثبت‌شده' }
      ], 'همه گروه‌ها');
      const startInput = document.getElementById('consumption-report-start-date');
      const endInput = document.getElementById('consumption-report-end-date');
      const start = startInput.dataset.isoDate || '';
      const end = endInput.dataset.isoDate || '';
      const locationFilter = locationSelect.value;
      const categoryFilter = categorySelect.value;
      const invalidRange = startInput.getAttribute('aria-invalid') === 'true' || endInput.getAttribute('aria-invalid') === 'true' || Boolean(start && end && start > end);
      const rows = invalidRange ? [] : data.rows.filter(row => {
        if (start && (!row.localDate || row.localDate < start)) return false;
        if (end && (!row.localDate || row.localDate > end)) return false;
        if (locationFilter !== 'all' && row.locationName !== locationFilter) return false;
        if (categoryFilter === '__uncategorized__' && row.category) return false;
        if (categoryFilter !== 'all' && categoryFilter !== '__uncategorized__' && row.category !== categoryFilter) return false;
        return true;
      });
      currentConsumptionReportRows = rows;
      document.getElementById('consumption-report-line-count').textContent = toEnglishDigits(rows.length);
      document.getElementById('consumption-report-total-quantity').textContent = toEnglishDigits(rows.reduce((sum, row) => sum + row.quantity, 0));
      document.getElementById('consumption-report-document-count').textContent = toEnglishDigits(new Set(rows.map(row => row.documentId)).size);
      const body = document.getElementById('consumption-report-body');
      body.replaceChildren();
      if (!rows.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 8;
        td.className = 'preview-empty';
        td.textContent = startInput.getAttribute('aria-invalid') === 'true' || endInput.getAttribute('aria-invalid') === 'true'
          ? 'قالب تاریخ خورشیدی معتبر نیست؛ تاریخ را به شکل ۱۴۰۵/۰۱/۰۱ وارد کنید.'
          : invalidRange ? 'تاریخ شروع باید قبل از تاریخ پایان باشد.' : 'برای فیلترهای انتخاب‌شده سابقه مصرفی پیدا نشد.';
        tr.append(td);
        body.append(tr);
      } else {
        rows.forEach(reportRow => {
          const tr = document.createElement('tr');
          [reportRow.dateLabel, reportRow.voucherNumber, reportRow.exitNumber, reportRow.location,
            reportRow.category || 'بدون گروه ثبت‌شده', reportRow.code, reportRow.description, toEnglishDigits(reportRow.quantity)]
            .forEach(value => { const td = document.createElement('td'); td.textContent = String(value); tr.append(td); });
          body.append(tr);
        });
      }
      const feedback = document.getElementById('consumption-report-feedback');
      feedback.textContent = 'بر اساس ' + toEnglishDigits(rows.length) + ' ردیف واقعی تاریخچه ارسال محاسبه شد.';
      if (invalidRange) feedback.textContent = 'بازه زمانی نامعتبر است؛ تاریخ شروع را اصلاح کنید.';
      if (data.invalidLines) feedback.textContent += ' ' + toEnglishDigits(data.invalidLines) + ' ردیف نامعتبر از جمع کنار گذاشته شد؛ گزارش کیفیت داده را بررسی کنید.';
      if ((start || end) && data.missingTimestamps) feedback.textContent += ' ' + toEnglishDigits(data.missingTimestamps) + ' ردیف فاقد زمان ماشینی است و در فیلتر تاریخ منظور نمی‌شود.';
      const exportButton = document.getElementById('export-consumption-report');
      if (exportButton) exportButton.disabled = rows.length === 0;
    }

    /**
     * هدف: نقل‌قول‌گذاری سلول CSV و جلوگیری از تفسیر متن واردشده به‌عنوان فرمول صفحه‌گسترده.
     * ورودی: مقدار یک سلول CSV.
     * خروجی: سلول نقل‌قول‌گذاری‌شده؛ پیشوندهای خطرناک با آپاستروف خنثی می‌شوند.
     */
    function escapeCsvCell(value) {
      let text = String(value ?? '');
      // Excel ممکن است متن آغازشده با =، +، - یا @ را فرمول بداند؛ trimStart فاصله و نویسه‌های سفید ابتدایی را هم پوشش می‌دهد.
      const firstSignificant = text.trimStart().charAt(0);
      if (['=', '+', '-', '@'].includes(firstSignificant)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }

    /** هدف: خروجی CSV با BOM برای سازگاری بهتر با Excel و حفظ متن فارسی. */
    function exportConsumptionReport() {
      if (!currentConsumptionReportRows.length) return;
      const headers = ['تاریخ و ساعت', 'شماره حواله', 'شماره خروج', 'محل ارسال', 'گروه کالا', 'کد کالا', 'شرح کالا', 'تعداد'];
      const csvValue = escapeCsvCell;
      const csv = '\uFEFF' + [headers, ...currentConsumptionReportRows.map(row => [row.dateLabel, row.voucherNumber,
        row.exitNumber, row.location, row.category || 'بدون گروه ثبت‌شده', row.code, row.description, row.quantity])]
        .map(row => row.map(csvValue).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'گزارش-مصرف-' + new Date().toISOString().slice(0, 10) + '.csv';
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * هدف: خواندن تاریخچه ارسال و کنترل آرایه بودن داده اصلی.
     * ورودی: پارامتر ندارد.
     * خروجی: آرایه ارسال‌ها؛ هنگام خطا آرایه خالی.
     */
    function loadShipments() {
      try { const records = JSON.parse(localStorage.getItem(SHIPMENT_KEY) || '[]'); return Array.isArray(records) ? records : []; }
      catch (error) { return []; }
    }
    /**
     * هدف: ذخیره آرایه سوابق ارسال و نمایش پیام خطا در صورت شکست.
     * ورودی: records: فهرست نهایی ارسال‌ها.
     * خروجی: true یا false بر اساس نتیجه ذخیره.
     */
    function saveShipments(records) {
      if (!canSafelyRewriteStoredArray(SHIPMENT_KEY, 'تاریخچه ارسال', shipmentFeedback)) return false;
      try { localStorage.setItem(SHIPMENT_KEY, JSON.stringify(records)); renderDataQualityReport(); return true; }
      catch (error) { shipmentFeedback.textContent = 'ذخیره تاریخچه ارسال انجام نشد؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.'; return false; }
    }

    /**
     * هدف: ساخت جدول تاریخچه ارسال با مرتب‌سازی و صفحه‌بندی.
     * ورودی: پارامتر ندارد.
     * خروجی: DOM تاریخچه ارسال و وضعیت صفحه به‌روزرسانی می‌شود.
     */
    function renderShipmentHistory() {
      const body = document.getElementById('shipment-history-body');
      const pageLabel = document.getElementById('shipment-history-page');
      const previousButton = document.getElementById('shipment-history-prev');
      const nextButton = document.getElementById('shipment-history-next');
      if (!body || !pageLabel || !previousButton || !nextButton) return;

      const records = loadShipments();
      const { key, direction } = shipmentHistorySort;
      records.sort((a, b) => {
        let left, right, comparison;
        if (key === 'itemCount') {
          left = Array.isArray(a.items) ? a.items.length : 0;
          right = Array.isArray(b.items) ? b.items.length : 0;
          comparison = left - right;
        } else if (key === 'pieceCount') {
          left = (a.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          right = (b.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          comparison = left - right;
        } else if (key === 'date') {
          comparison = String(a.timestamp || a.date || '').localeCompare(String(b.timestamp || b.date || ''), 'fa');
        } else {
          comparison = String(a[key] || '').localeCompare(String(b[key] || ''), 'fa', { numeric: true });
        }
        return direction === 'asc' ? comparison : -comparison;
      });

      const pageCount = Math.max(1, Math.ceil(records.length / ENTRY_PAGE_SIZE));
      shipmentHistoryPage = Math.min(shipmentHistoryPage, pageCount - 1);
      const pageRecords = records.slice(shipmentHistoryPage * ENTRY_PAGE_SIZE, (shipmentHistoryPage + 1) * ENTRY_PAGE_SIZE);
      body.replaceChildren();
      if (!pageRecords.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 6;
        cell.className = 'preview-empty';
        cell.textContent = 'هنوز ارسالی ثبت نشده است.';
        row.append(cell);
        body.append(row);
      } else {
        pageRecords.forEach(record => {
          const row = document.createElement('tr');
          const values = [
            record.voucherNumber || '—',
            record.exitNumber || '—',
            { date: record.date || '—', time: record.time || '' },
            (record.location || '—') + (record.sublocation ? ' / ' + record.sublocation : ''),
            Array.isArray(record.items) ? record.items.length : 0,
            (record.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
          ];
          values.forEach((value, index) => {
            const cell = document.createElement('td');
            if (index === 0) {
              cell.className = 'entry-history-number shipment-document-cell';
              const numberText = document.createElement('span');
              numberText.textContent = String(value);
              cell.append(numberText);
              if (record.id) cell.title = 'شناسه سند: ' + record.id;
              const details = document.createElement('details');
              const summary = document.createElement('summary');
              summary.textContent = 'جزئیات اقلام (' + toEnglishDigits(Array.isArray(record.items) ? record.items.length : 0) + ')';
              const list = document.createElement('ul');
              (Array.isArray(record.items) ? record.items : []).forEach(line => {
                const detail = document.createElement('li');
                detail.textContent = 'کد: ' + String(line.code || '—') +
                  '؛ شرح: ' + String(line.description || '—') +
                  '؛ تعداد: ' + toEnglishDigits(line.quantity ?? '—') +
                  '؛ شناسه قلم: ' + String(line.itemId || 'قدیمی/ثبت‌نشده') +
                  '؛ شناسه ردیف: ' + String(line.id || 'قدیمی/ثبت‌نشده');
                list.append(detail);
              });
              details.append(summary, list);
              cell.append(details);
            } else if (index === 2 && value && typeof value === 'object') {
              cell.className = 'date-time-cell';
              const dateText = document.createElement('span');
              dateText.className = 'date-part';
              dateText.textContent = value.date;
              cell.append(dateText);
              if (value.time) {
                const timeText = document.createElement('span');
                timeText.className = 'time-part';
                timeText.textContent = value.time;
                cell.append(timeText);
              }
            } else {
              cell.textContent = index >= 4 ? toEnglishDigits(value) : String(value);
            }
            if (index < 2) cell.className = 'entry-history-number';
            row.append(cell);
          });
          body.append(row);
        });
      }
      pageLabel.textContent = 'صفحه ' + toEnglishDigits(shipmentHistoryPage + 1) + ' از ' + toEnglishDigits(pageCount) + ' — ' + toEnglishDigits(records.length) + ' ارسال';
      previousButton.disabled = shipmentHistoryPage === 0;
      nextButton.disabled = shipmentHistoryPage >= pageCount - 1;
      updateReportsOverview();
      renderConsumptionReport();
      document.querySelectorAll('[data-shipment-sort]').forEach(button => {
        const active = button.dataset.shipmentSort === key;
        const marker = button.querySelector('span');
        if (marker) marker.textContent = active ? (direction === 'asc' ? '↑' : '↓') : '↕';
        const heading = button.closest('th');
        if (heading) heading.setAttribute('aria-sort', active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
        const label = button.textContent.replace(/[↑↓↕]/g, '').trim();
        button.setAttribute('aria-label', 'مرتب‌سازی بر اساس ' + label + (active ? (direction === 'asc' ? '، صعودی' : '، نزولی') : ''));
      });
    }

    /**
     * ساخت ممیزی کاردکس از روی سوابق ذخیره‌شده.
     * داده‌های قدیمی یا ناقص حذف/اصلاح نمی‌شوند؛ موارد مسئله‌دار فقط گزارش می‌شوند.
     * تکراری بودن فقط با شناسه پایدار سند و ردیف در همان نوع گردش تشخیص داده می‌شود.
     */
    function getKardexAudit() {
      const rows = [];
      const issues = { missingItems: 0, invalidLines: 0, missingCode: 0, invalidQuantity: 0,
        missingTimestamp: 0, duplicateLines: 0, legacyLines: 0 };
      const seen = new Set();

      const addLines = (records, type) => {
        (Array.isArray(records) ? records : []).forEach(record => {
          if (!record || typeof record !== 'object') return;
          if (!Array.isArray(record.items)) {
            issues.missingItems += 1;
            return;
          }
          const incoming = type === 'entry';
          const rawTimestamp = record.timestamp;
          const parsedTimestamp = typeof rawTimestamp === 'number' && Number.isFinite(rawTimestamp)
            ? rawTimestamp
            : (typeof rawTimestamp === 'string' && rawTimestamp.trim() && Number.isFinite(Date.parse(rawTimestamp))
              ? Date.parse(rawTimestamp) : NaN);
          const timestampValid = Number.isFinite(parsedTimestamp) && parsedTimestamp > 0;
          if (!timestampValid) issues.missingTimestamp += 1;
          record.items.forEach(line => {
            if (!line || typeof line !== 'object') {
              issues.invalidLines += 1;
              return;
            }
            if (!line.id || !record.id) issues.legacyLines += 1;
            if (line.id && record.id) {
              const identity = type + ':' + String(record.id) + ':' + String(line.id);
              if (seen.has(identity)) {
                issues.duplicateLines += 1;
                return;
              }
              seen.add(identity);
            }
            const code = typeof line.code === 'string' ? line.code.trim() : '';
            const quantity = Number(line.quantity);
            let valid = true;
            if (!code) { issues.missingCode += 1; valid = false; }
            if (!Number.isFinite(quantity) || quantity <= 0) { issues.invalidQuantity += 1; valid = false; }
            if (!valid) {
              issues.invalidLines += 1;
              return;
            }
            rows.push({
              timestamp: timestampValid ? parsedTimestamp : null,
              date: String(record.date || '—') + (record.time ? ' ' + String(record.time) : ''),
              dateKey: timestampValid ? parsedTimestamp : null,
              type,
              document: String(incoming ? record.entryNumber || '—' : record.voucherNumber || record.exitNumber || '—'),
              documentId: String(record.id || ''),
              lineId: String(line.id || ''),
              code,
              description: typeof line.description === 'string' ? line.description : '',
              location: incoming ? '—' : String(record.location || '—') + (record.sublocation ? ' / ' + String(record.sublocation) : ''),
              incoming: incoming ? quantity : 0,
              outgoing: incoming ? 0 : quantity
            });
          });
        });
      };

      addLines(loadEntryHistory(), 'entry');
      addLines(loadShipments(), 'shipment');

      // محاسبه مانده نسبی هر کد کالا از قدیمی به جدید؛ زمان نامعتبر در انتهای توالی قرار می‌گیرد.
      const chronological = [...rows].sort((a, b) => {
        if (a.timestamp === null && b.timestamp !== null) return 1;
        if (a.timestamp !== null && b.timestamp === null) return -1;
        return (a.timestamp || 0) - (b.timestamp || 0);
      });
      const balances = new Map();
      chronological.forEach(row => {
        const balance = (balances.get(row.code) || 0) + row.incoming - row.outgoing;
        balances.set(row.code, balance);
        row.balance = balance;
      });
      rows.sort((a, b) => {
        if (a.timestamp === null && b.timestamp !== null) return 1;
        if (a.timestamp !== null && b.timestamp === null) return -1;
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
      return { rows, issues };
    }

    function getKardexRows() {
      return getKardexAudit().rows;
    }

    // نام ماه‌های تقویم خورشیدی برای انتخاب‌گر داخلی؛ بدون وابستگی به اینترنت.
    const SOLAR_MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const SOLAR_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const SOLAR_DATE_FORMATTER = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
      year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC'
    });

    /** تبدیل تاریخ میلادی UTC به اجزای عددی تاریخ خورشیدی. */
    function getSolarDateParts(date) {
      const parts = SOLAR_DATE_FORMATTER.formatToParts(date).reduce((result, part) => {
        if (part.type !== 'literal') result[part.type] = Number(part.value);
        return result;
      }, {});
      return { year: parts.year, month: parts.month, day: parts.day };
    }

    /**
     * تبدیل تاریخ خورشیدی به روز میلادی با جست‌وجوی محدود در حوالی سال متناظر.
     * استفاده از UTC مانع جابه‌جایی روز در مناطق زمانی مختلف می‌شود.
     */
    function findGregorianDateForSolar(year, month, day) {
      if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) ||
          year < 1200 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 31) return null;
      const start = Date.UTC(year + 621, 2, 15, 12);
      const end = Date.UTC(year + 622, 3, 10, 12);
      for (let time = start; time <= end; time += 86400000) {
        const date = new Date(time);
        const parts = getSolarDateParts(date);
        if (parts.year === year && parts.month === month && parts.day === day) return date;
      }
      return null;
    }

    /** تولید تاریخ میلادی ISO برای مقایسه فیلترها، بدون تغییر تاریخ ذخیره‌شده سوابق. */
    function solarDateToIso(year, month, day) {
      const date = findGregorianDateForSolar(year, month, day);
      if (!date) return '';
      const gregorian = new Date(date.getTime());
      return String(gregorian.getUTCFullYear()).padStart(4, '0') + '-' +
        String(gregorian.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(gregorian.getUTCDate()).padStart(2, '0');
    }

    /** نمایش تاریخ خورشیدی با ارقام فارسی. */
    function formatSolarDate(date) {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC'
      }).format(date);
    }

    /** ساخت تقویم خورشیدی برای یک ماه؛ ورودی و خروجی فیلتر به ISO میلادی متصل می‌ماند. */
    function renderSolarCalendar(input, panel, year, month) {
      if (month < 1) { year -= 1; month = 12; }
      if (month > 12) { year += 1; month = 1; }
      const firstDay = findGregorianDateForSolar(year, month, 1);
      if (!firstDay) {
        panel.hidden = true;
        return;
      }
      const weekdayOffset = (firstDay.getUTCDay() + 1) % 7; // شروع هفته: شنبه
      let daysInMonth = 0;
      for (let day = 1; day <= 31; day += 1) {
        const candidate = new Date(firstDay.getTime() + (day - 1) * 86400000);
        const parts = getSolarDateParts(candidate);
        if (parts.year !== year || parts.month !== month || parts.day !== day) break;
        daysInMonth = day;
      }
      const selectedIso = input.dataset.isoDate || '';
      const today = getSolarDateParts(new Date());
      let dayButtons = '';
      for (let blank = 0; blank < weekdayOffset; blank += 1) dayButtons += '<span class="solar-calendar-empty" aria-hidden="true"></span>';
      for (let day = 1; day <= daysInMonth; day += 1) {
        const gregorian = new Date(firstDay.getTime() + (day - 1) * 86400000);
        const iso = String(gregorian.getUTCFullYear()).padStart(4, '0') + '-' +
          String(gregorian.getUTCMonth() + 1).padStart(2, '0') + '-' +
          String(gregorian.getUTCDate()).padStart(2, '0');
        const selected = iso === selectedIso ? ' is-selected' : '';
        const current = today.year === year && today.month === month && today.day === day ? ' is-today' : '';
        dayButtons += '<button type="button" class="solar-calendar-day' + selected + current +
          '" data-solar-day="' + day + '" aria-label="' + day + ' ' + SOLAR_MONTH_NAMES[month - 1] + ' ' + year + '">' +
          toEnglishDigits(day).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]) + '</button>';
      }
      panel.innerHTML = '<div class="solar-calendar-heading">' +
        '<button type="button" class="solar-calendar-nav" data-solar-nav="-1" aria-label="ماه قبل">‹</button>' +
        '<strong>' + SOLAR_MONTH_NAMES[month - 1] + ' ' + toEnglishDigits(year).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]) + '</strong>' +
        '<button type="button" class="solar-calendar-nav" data-solar-nav="1" aria-label="ماه بعد">›</button></div>' +
        '<div class="solar-calendar-grid solar-calendar-weekdays">' +
        SOLAR_WEEKDAYS.map(day => '<span>' + day + '</span>').join('') + '</div>' +
        '<div class="solar-calendar-grid solar-calendar-days">' + dayButtons + '</div>';
      panel.dataset.viewYear = String(year);
      panel.dataset.viewMonth = String(month);
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    /** اتصال ورودی‌های تاریخ به انتخاب‌گر خورشیدی، با پشتیبانی از تایپ دستی و صفحه‌کلید. */
    function initializeSolarDateInputs() {
      const inputs = Array.from(document.querySelectorAll('.solar-date-input'));
      inputs.forEach(input => {
        if (input.closest('.solar-date-control')) return;
        const control = document.createElement('div');
        control.className = 'solar-date-control';
        input.parentNode.insertBefore(control, input);
        control.append(input);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'solar-date-toggle';
        toggle.textContent = 'تقویم';
        toggle.setAttribute('aria-label', 'بازکردن تقویم خورشیدی');
        toggle.setAttribute('aria-expanded', 'false');
        const panel = document.createElement('div');
        panel.className = 'solar-date-panel';
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'انتخاب تاریخ خورشیدی');
        control.append(toggle, panel);

        const openCalendar = () => {
          const entered = toEnglishDigits((input.value || '').trim());
          const match = entered.match(/^(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})$/);
          const today = getSolarDateParts(new Date());
          const year = match ? Number(toEnglishDigits(match[1])) : today.year;
          const month = match ? Number(toEnglishDigits(match[2])) : today.month;
          renderSolarCalendar(input, panel, year, month);
          toggle.setAttribute('aria-expanded', String(!panel.hidden));
        };
        input.addEventListener('focus', openCalendar);
        input.addEventListener('click', openCalendar);
        toggle.addEventListener('click', () => {
          if (panel.hidden) openCalendar();
          else {
            panel.hidden = true;
            input.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-expanded', 'false');
          }
        });
        input.addEventListener('input', () => {
          delete input.dataset.isoDate;
          input.removeAttribute('aria-invalid');
        });
        input.addEventListener('change', () => {
          const normalizedValue = toEnglishDigits(input.value.trim());
          const match = normalizedValue.match(/^(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})$/);
          const iso = match
            ? solarDateToIso(Number(toEnglishDigits(match[1])), Number(toEnglishDigits(match[2])), Number(toEnglishDigits(match[3])))
            : '';
          if (input.value.trim() && !iso) {
            input.setAttribute('aria-invalid', 'true');
            input.title = 'تاریخ خورشیدی معتبر نیست؛ قالب نمونه: ۱۴۰۵/۰۱/۰۱';
          } else {
            input.removeAttribute('aria-invalid');
            input.title = '';
            if (iso) input.dataset.isoDate = iso;
            else delete input.dataset.isoDate;
          }
        });
        panel.addEventListener('click', event => {
          const navigation = event.target.closest('[data-solar-nav]');
          if (navigation) {
            renderSolarCalendar(input, panel, Number(panel.dataset.viewYear), Number(panel.dataset.viewMonth) + Number(navigation.dataset.solarNav));
            toggle.setAttribute('aria-expanded', String(!panel.hidden));
            return;
          }
          const dayButton = event.target.closest('[data-solar-day]');
          if (!dayButton) return;
          const year = Number(panel.dataset.viewYear);
          const month = Number(panel.dataset.viewMonth);
          const day = Number(dayButton.dataset.solarDay);
          const iso = solarDateToIso(year, month, day);
          if (!iso) return;
          input.dataset.isoDate = iso;
          input.value = formatSolarDate(findGregorianDateForSolar(year, month, day));
          input.removeAttribute('aria-invalid');
          input.title = '';
          panel.hidden = true;
          input.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-expanded', 'false');
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
      document.addEventListener('click', event => {
        inputs.forEach(input => {
          const control = input.closest('.solar-date-control');
          if (control && !control.contains(event.target)) {
            const panel = control.querySelector('.solar-date-panel');
            const toggle = control.querySelector('.solar-date-toggle');
            if (panel) panel.hidden = true;
            input.setAttribute('aria-expanded', 'false');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
          }
        });
      });
    }

    function renderKardex() {
      const body = document.getElementById('kardex-body');
      const search = document.getElementById('kardex-search');
      const movementFilter = document.getElementById('kardex-movement-filter');
      if (!body || !search || !movementFilter) return;

      const audit = getKardexAudit();
      const searchTerm = toEnglishDigits(search.value).trim().toLocaleLowerCase('fa');
      const fromDate = document.getElementById('kardex-date-from')?.dataset.isoDate || '';
      const toDate = document.getElementById('kardex-date-to')?.dataset.isoDate || '';
      const rows = audit.rows.filter(row => {
        if (movementFilter.value !== 'all' && row.type !== movementFilter.value) return false;
        if (searchTerm && !toEnglishDigits([
          row.code, row.description, row.document, row.location, row.documentId, row.lineId
        ].join(' ')).toLocaleLowerCase('fa').includes(searchTerm)) return false;
        // تاریخ انتخاب‌شده خورشیدی به ISO میلادی تبدیل می‌شود؛ زمان ذخیره‌شده سوابق دست‌نخورده می‌ماند.
        if ((fromDate || toDate) && row.timestamp === null) return false;
        if (fromDate && row.timestamp < Date.parse(fromDate + 'T00:00:00')) return false;
        if (toDate && row.timestamp > Date.parse(toDate + 'T23:59:59.999')) return false;
        return true;
      });
      const count = document.getElementById('kardex-row-count');
      const incomingTotal = document.getElementById('kardex-incoming-total');
      const outgoingTotal = document.getElementById('kardex-outgoing-total');
      if (count) count.textContent = toEnglishDigits(rows.length);
      if (incomingTotal) incomingTotal.textContent = toEnglishDigits(rows.reduce((sum, row) => sum + row.incoming, 0));
      if (outgoingTotal) outgoingTotal.textContent = toEnglishDigits(rows.reduce((sum, row) => sum + row.outgoing, 0));

      const issueSummary = document.getElementById('kardex-audit-summary');
      if (issueSummary) {
        const issueCount = audit.issues.missingItems + audit.issues.invalidLines + audit.issues.missingTimestamp + audit.issues.duplicateLines;
        issueSummary.textContent = issueCount
          ? 'هشدار ممیزی: ' + toEnglishDigits(issueCount) + ' مورد نیازمند بررسی است؛ سوابق ذخیره‌شده تغییر نکرده‌اند.'
          : 'ممیزی اولیه: مورد ساختاری مشکوکی در سوابق قابل‌بررسی شناسایی نشد.';
        issueSummary.dataset.status = issueCount ? 'warning' : 'ok';
        issueSummary.title = [
          'سند بدون آرایه اقلام: ' + audit.issues.missingItems,
          'ردیف نامعتبر: ' + audit.issues.invalidLines,
          'کد کالا خالی: ' + audit.issues.missingCode,
          'تعداد نامعتبر: ' + audit.issues.invalidQuantity,
          'زمان نامعتبر/ثبت‌نشده: ' + audit.issues.missingTimestamp,
          'شناسه قدیمی/ثبت‌نشده: ' + audit.issues.legacyLines,
          'ردیف تکراری با شناسه پایدار: ' + audit.issues.duplicateLines
        ].join('\n');
      }

      body.replaceChildren();
      if (!rows.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 9;
        cell.className = 'preview-empty';
        cell.textContent = 'برای این جست‌وجو یا فیلتر، ردیفی پیدا نشد.';
        row.append(cell);
        body.append(row);
        return;
      }
      rows.forEach(item => {
        const row = document.createElement('tr');
        if (item.timestamp === null) row.classList.add('kardex-row-undated');
        const values = [item.date, item.type === 'entry' ? 'ورود' : 'خروج', item.document, item.code,
          item.description || '—', item.location, item.incoming ? toEnglishDigits(item.incoming) : '—',
          item.outgoing ? toEnglishDigits(item.outgoing) : '—', toEnglishDigits(item.balance)];
        values.forEach((value, index) => {
          const cell = document.createElement('td');
          cell.textContent = String(value);
          if (index === 3) cell.className = 'kardex-code-cell';
          if (index >= 6) cell.className = 'kardex-number-cell';
          if (index === 2 && (item.documentId || item.lineId)) {
            cell.title = 'شناسه سند: ' + (item.documentId || 'ثبت‌نشده') + '\nشناسه ردیف: ' + (item.lineId || 'ثبت‌نشده');
          }
          row.append(cell);
        });
        body.append(row);
      });
    }

    initializeSolarDateInputs();
    document.getElementById('kardex-search')?.addEventListener('input', renderKardex);
    document.getElementById('kardex-movement-filter')?.addEventListener('change', renderKardex);
    document.getElementById('kardex-date-from')?.addEventListener('change', renderKardex);
    document.getElementById('kardex-date-to')?.addEventListener('change', renderKardex);
    document.getElementById('kardex-date-reset')?.addEventListener('click', () => {
      const from = document.getElementById('kardex-date-from');
      const to = document.getElementById('kardex-date-to');
      if (from) { from.value = ''; delete from.dataset.isoDate; from.removeAttribute('aria-invalid'); from.title = ''; }
      if (to) { to.value = ''; delete to.dataset.isoDate; to.removeAttribute('aria-invalid'); to.title = ''; }
      renderKardex();
    });

    document.querySelectorAll('[data-shipment-sort]').forEach(button => {
      // رویداد «کلیک» برای دکمه‌های مرتب‌سازی/صفحه‌بندی تاریخچه ارسال؛ تغییر ترتیب ردیف‌ها و نشانگر مرتب‌سازی.
      button.addEventListener('click', () => {
        const key = button.dataset.shipmentSort;
        if (shipmentHistorySort.key === key) {
          shipmentHistorySort.direction = shipmentHistorySort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          shipmentHistorySort = { key, direction: key === 'date' ? 'desc' : 'asc' };
        }
        shipmentHistoryPage = 0;
        renderShipmentHistory();
      });
    });
    // رویداد «کلیک» برای دکمه صفحه قبلی تاریخچه ارسال؛ نمایش صفحه قبلی.
    document.getElementById('shipment-history-prev').addEventListener('click', () => {
      if (shipmentHistoryPage > 0) { shipmentHistoryPage -= 1; renderShipmentHistory(); }
    });
    // رویداد «کلیک» برای دکمه صفحه بعدی تاریخچه ارسال؛ نمایش صفحه بعدی.
    document.getElementById('shipment-history-next').addEventListener('click', () => {
      if ((shipmentHistoryPage + 1) * ENTRY_PAGE_SIZE < loadShipments().length) {
        shipmentHistoryPage += 1;
        renderShipmentHistory();
      }
    });
    /**
     * هدف: تبدیل زمان به تاریخ و ساعت شمسی برای نمایش فارسی.
     * ورودی: date: شیء Date معتبر.
     * خروجی: شیء اجزای تاریخ و ساعت مورد استفاده رابط.
     */
    function solarDateTime(date = new Date()) {
      const datePart = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
      const timePart = new Intl.DateTimeFormat('fa-IR', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
      return {date:datePart,time:timePart,label:datePart+' '+timePart};
    }
    /**
     * هدف: ساخت شماره پیش‌فرض حواله یا خروج با پیشوند و زمان.
     * ورودی: prefix: نوع شماره؛ date: زمان مبنا؛ epoch: مقدار زمانی برای یکتاسازی.
     * خروجی: رشته شماره تولیدشده.
     */
    function makeShipmentNumber(prefix, date, epoch) {
      // قالب خودکار: AUTO-YYYYMMDD-HHmmss؛ تاریخ شمسی و ساعت ۲۴ساعته، با پسوند زمانی برای جلوگیری از تکرار.
      const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).formatToParts(date).reduce((result, part) => {
        if (part.type !== 'literal') result[part.type] = part.value;
        return result;
      }, {});
      const datePart = String(parts.year).padStart(4, '0') +
        String(parts.month).padStart(2, '0') + String(parts.day).padStart(2, '0');
      const clockPart = String(parts.hour).padStart(2, '0') +
        String(parts.minute).padStart(2, '0') + String(parts.second).padStart(2, '0');
      return (prefix ? prefix + '-' : '') + 'AUTO-' + datePart + '-' + clockPart + '-' + String(epoch).slice(-4);
    }
    /**
     * هدف: ساخت ورودی جدول ارسال با برچسب، مقدار و نوع مشخص.
     * ورودی: labelText: عنوان؛ value: مقدار اولیه؛ type: نوع کنترل.
     * خروجی: عنصر DOM ورودی.
     */
    function createShipmentField(labelText, value, type='text') {
      const group=document.createElement('div'); group.className='field-group';
      const label=document.createElement('label'); label.textContent=labelText;
      const input=document.createElement('input'); input.type=type; input.value=value; input.required=true; input.className='shipment-quantity-input';
      if(type==='number'){input.min='0.0000001';input.step='any';input.inputMode='decimal';}
      else input.readOnly=true;
      input.id='shipment-field-'+Math.random().toString(36).slice(2); label.htmlFor=input.id;
      group.append(label,input); return {group,input};
    }
    /**
     * هدف: آماده‌سازی پنجره ارسال برای کالاهای انتخاب‌شده و نمایش مقدارهای قابل ویرایش.
     * ورودی: پارامتر ندارد؛ از موجودی و انتخاب‌های جاری استفاده می‌کند.
     * خروجی: پنجره ارسال نمایش داده می‌شود یا پیام مناسبی نشان داده می‌شود.
     */
    function openShipmentDialog() {
      const candidates = inventoryItems.filter(item => {
        const quantity = item.sendQuantity === '' ? 0 : Number(item.sendQuantity);
        return Number.isFinite(quantity) && quantity > 0;
      });
      if (!candidates.length) {
        inventoryFeedback.textContent = 'ابتدا در فیلد «تعداد برای ارسال» برای حداقل یک کالا عددی بزرگ‌تر از صفر وارد کنید.';
        return;
      }
      shipmentItemsContainer.replaceChildren();
      shipmentFeedback.textContent = '';
      const wrapper = document.createElement('div'); wrapper.className = 'preview-table-wrap';
      const { table, tbody } = createDataTable(['کد تدارکاتی', 'شرح کالا', 'موجودی فعلی', 'تعداد ارسالی'], 'shipment-items-table');
      candidates.forEach(item => {
        const row = document.createElement('tr'); row.dataset.code = item.code;
        const codeCell = document.createElement('td'); codeCell.textContent = item.code;
        const descriptionCell = document.createElement('td'); descriptionCell.textContent = item.description;
        const stockCell = document.createElement('td'); stockCell.textContent = toEnglishDigits(item.stock);
        const quantityCell = document.createElement('td');
        const input = document.createElement('input'); input.type = 'number'; input.min = '0.0000001'; input.step = 'any';
        input.inputMode = 'decimal'; input.required = true; input.className = 'shipment-quantity';
        input.value = String(item.sendQuantity); input.dataset.code = item.code; input.max = String(item.stock);
        input.setAttribute('aria-label', 'تعداد ارسالی برای ' + item.code);
        quantityCell.append(input); row.append(codeCell, descriptionCell, stockCell, quantityCell); tbody.append(row);
      });
      wrapper.append(table); shipmentItemsContainer.append(wrapper);
      enableTableSorting(table, { defaultColumn: 0, defaultDirection: 'asc' });
      shipmentLocationInput.value = ''; shipmentSublocationInput.value = ''; shipmentSublocationGroup.hidden = false; shipmentVoucherInput.value = ''; shipmentExitInput.value = ''; renderShipmentLocationOptions();
      if (typeof shipmentDialog.showModal === 'function') shipmentDialog.showModal();
      else shipmentDialog.setAttribute('open', '');
    }
    /**
     * هدف: بستن پنجره ارسال با مسیر جایگزین برای مرورگرهای فاقد close.
     * ورودی: پارامتر ندارد.
     * خروجی: بدون مقدار بازگشتی.
     */
    function closeShipmentDialog() {
      if(typeof shipmentDialog.close==='function'&&shipmentDialog.open)shipmentDialog.close();else shipmentDialog.removeAttribute('open');
    }
    /**
     * هدف: اعتبارسنجی و ثبت ارسال؛ کنترل شماره‌های تکراری، به‌روزرسانی موجودی و بازگردانی تغییرات در شکست ذخیره.
     * ورودی: event: رویداد submit فرم.
     * خروجی: بدون مقدار بازگشتی؛ نتیجه با پیام رابط و داده ذخیره‌شده مشخص می‌شود.
     */
    function commitShipment(event) {
      event.preventDefault();
      shipmentFeedback.textContent = '';

      const location = shipmentLocationInput.value.trim();
      const sublocation = shipmentSublocationInput.value.trim();
      if (!location) {
        shipmentFeedback.textContent = 'لطفاً محل ارسال را وارد کنید.';
        shipmentLocationInput.focus();
        return;
      }

      const quantities = [];
      const quantitiesByCode = new Map();
      for (const input of shipmentItemsContainer.querySelectorAll('.shipment-quantity')) {
        const matchingItems = inventoryItems.filter(candidate => candidate.code === input.dataset.code);
        if (matchingItems.length !== 1) {
          shipmentFeedback.textContent = 'کد کالای این ردیف در موجودی تکراری یا نامعتبر است؛ ارسال ثبت نشد. ابتدا رکوردهای دارای کد تکراری را بررسی و اصلاح کنید.';
          input.focus();
          return;
        }
        const item = matchingItems[0];
        const quantity = normalizeStock(input.value);
        const totalForCode = (quantitiesByCode.get(item.code) || 0) + quantity;
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > item.stock || totalForCode > item.stock) {
          shipmentFeedback.textContent = 'مجموع تعداد ارسالی هر کالا باید بیشتر از صفر و حداکثر برابر موجودی فعلی همان کالا باشد. مقدار ردیف مشخص‌شده را اصلاح کنید.';
          input.focus();
          return;
        }
        quantitiesByCode.set(item.code, totalForCode);
        quantities.push({ item, quantity });
      }
      if (!quantities.length) {
        shipmentFeedback.textContent = 'هیچ کالایی برای ارسال وجود ندارد.';
        return;
      }

      const now = new Date();
      const generatedAt = solarDateTime(now);
      const epoch = now.getTime();
      const existingShipments = loadShipments();
      const voucher = shipmentVoucherInput.value.trim() || makeShipmentNumber('V', now, epoch);
      const exitNumber = shipmentExitInput.value.trim() || makeShipmentNumber('X', now, epoch + 1);

      if (existingShipments.some(record => record.voucherNumber === voucher)) {
        shipmentFeedback.textContent = 'این شماره حواله قبلاً ثبت شده است. شماره دیگری وارد کنید.';
        shipmentVoucherInput.focus();
        return;
      }
      if (existingShipments.some(record => record.exitNumber === exitNumber)) {
        shipmentFeedback.textContent = 'این شماره خروج قبلاً ثبت شده است. شماره دیگری وارد کنید.';
        shipmentExitInput.focus();
        return;
      }

      const previousLocations = loadShipmentLocations();
      const previousStoredValues = {
        [LOCATION_KEY]: localStorage.getItem(LOCATION_KEY),
        [SHIPMENT_KEY]: localStorage.getItem(SHIPMENT_KEY),
        [STORAGE_KEY]: localStorage.getItem(STORAGE_KEY)
      };
      const previousInventoryItems = inventoryItems.map(item => ({ ...item }));
      const nextLocations = previousLocations.map(item => ({
        name: item.name,
        sublocations: [...item.sublocations]
      }));
      let locationRecord = nextLocations.find(item => normLocation(item.name) === normLocation(location));
      const isNewLocation = !locationRecord;
      if (!locationRecord) {
        locationRecord = { name: location, sublocations: [] };
        nextLocations.push(locationRecord);
      }

      if (locationRecord.sublocations.length && !sublocation) {
        shipmentFeedback.textContent = 'برای این محل، زیرمجموعه را انتخاب یا وارد کنید.';
        shipmentSublocationInput.focus();
        return;
      }
      const isNewSublocation = Boolean(sublocation) &&
        !locationRecord.sublocations.some(item => normLocation(item) === normLocation(sublocation));
      if (isNewSublocation) locationRecord.sublocations.push(sublocation);
      if (!saveShipmentLocations(nextLocations)) {
        const rollbackSucceeded = restoreLocalStorageValue(LOCATION_KEY, previousStoredValues[LOCATION_KEY]);
        shipmentFeedback.textContent = rollbackSucceeded
          ? 'ذخیره محل ارسال ممکن نشد؛ ارسال ثبت نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید.'
          : 'ذخیره محل ارسال ناموفق بود و بازگردانی مقدار قبلی کامل نشد؛ داده‌ها را بررسی کنید.';
        return;
      }

      const shipmentId = makeUniqueRecordId('shipment', epoch);
      const shipment = {
        id: shipmentId,
        date: generatedAt.date,
        time: generatedAt.time,
        timestamp: now.toISOString(),
        location,
        sublocation,
        voucherNumber: voucher,
        exitNumber,
        items: quantities.map(({ item, quantity }, index) => ({
          id: makeUniqueRecordId('shipment-line', epoch + index),
          shipmentId,
          itemId: item.id || ('item-' + dataQualityKey(item.code)),
          code: item.code,
          description: item.description,
          category: typeof item.category === 'string' ? item.category : '',
          quantity
        }))
      };

      if (!saveShipments([shipment, ...existingShipments])) {
        const rollbackSucceeded = [
          restoreLocalStorageValue(SHIPMENT_KEY, previousStoredValues[SHIPMENT_KEY]),
          restoreLocalStorageValue(LOCATION_KEY, previousStoredValues[LOCATION_KEY])
        ].every(Boolean);
        shipmentFeedback.textContent = rollbackSucceeded
          ? 'ذخیره تاریخچه ارسال انجام نشد؛ ارسال ثبت نشد و اطلاعات قبلی حفظ شد.'
          : 'ذخیره تاریخچه ارسال انجام نشد و بازگردانی همه مقادیر قبلی کامل نشد؛ داده‌ها را بررسی کنید.';
        return;
      }

      quantities.forEach(({ item, quantity }) => {
        item.stock = Number((item.stock - quantity).toFixed(8));
        item.sendQuantity = '';
      });

      if (!saveInventory()) {
        inventoryItems.splice(0, inventoryItems.length, ...previousInventoryItems);
        const rollbackSucceeded = [
          restoreLocalStorageValue(STORAGE_KEY, previousStoredValues[STORAGE_KEY]),
          restoreLocalStorageValue(SHIPMENT_KEY, previousStoredValues[SHIPMENT_KEY]),
          restoreLocalStorageValue(LOCATION_KEY, previousStoredValues[LOCATION_KEY])
        ].every(Boolean);
        renderShipmentLocationOptions();
        renderLocationManager();
        renderInventory();
        shipmentFeedback.textContent = rollbackSucceeded
          ? 'ذخیره موجودی انجام نشد؛ ارسال ثبت نشد و داده‌های قبلی بازیابی شدند. دوباره تلاش کنید.'
          : 'ذخیره موجودی ناموفق بود و بازگردانی همه داده‌های قبلی کامل نشد؛ موجودی، تاریخچه ارسال و فایل بکاپ را بررسی کنید.';
        return;
      }

      const itemDetails = quantities.map(({ item, quantity }) =>
        item.code + ' (' + item.description + '): ' + toEnglishDigits(quantity)
      ).join('؛ ');
      if (isNewLocation || isNewSublocation) {
        recordActivity(isNewLocation ? 'ثبت خودکار محل ارسال' : 'افزودن زیرمجموعه محل ارسال',
          'محل: «' + location + '»؛ زیرمجموعه: «' + (sublocation || 'ندارد') + '»؛ محل در جریان ارسال ذخیره شد.');
      }
      recordActivity('ثبت ارسال کالا', {
        'شماره حواله': voucher, 'شماره خروج': exitNumber,
        'تاریخ و ساعت': generatedAt.date + ' ' + generatedAt.time,
        'محل ارسال': location, 'زیرمجموعه': sublocation || 'ندارد',
        'تعداد ردیف کالا': quantities.length, 'اقلام (کد، شرح، تعداد)': itemDetails
      });

      renderShipmentLocationOptions();
      renderLocationManager();
      selectedItemCodes.clear();
      renderInventory();
      renderShipmentHistory();
      closeShipmentDialog();
      inventoryFeedback.textContent = 'ارسال با موفقیت ثبت شد. شماره حواله: ' + voucher + '؛ شماره خروج: ' + exitNumber;

    }

    /**
     * هدف: افزودن رخداد به ابتدای لاگ همراه زمان و محدودکردن اندازه جزئیات.
     * ورودی: action: عنوان عملیات؛ details: شرح رخداد.
     * خروجی: بدون مقدار بازگشتی؛ خطای ثبت لاگ مانع عملیات اصلی نمی‌شود.
     */
    function recordActivity() {
      // لاگ سایت بنا به درخواست حذف شده؛ این تابع موقتاً برای سازگاری فراخوانی‌های موجود بی‌اثر است.
    }

    /**
     * هدف: ساخت جدول رخدادها با textContent برای جلوگیری از اجرای متن به‌عنوان HTML.
     * ورودی: target: ظرف نمایشی؛ logs: رخدادها؛ emptyText: پیام حالت خالی.
     * خروجی: DOM گزارش فعالیت به‌روزرسانی می‌شود.
     */


    const bulkPreview = document.getElementById('bulk-preview');
    const excelPreview = document.getElementById('excel-preview');
    const singlePreview = document.getElementById('single-preview');
    const importPreviewButton = document.getElementById('confirm-all-imports');
    const confirmExcelImportButton = document.getElementById('confirm-all-imports');
    document.getElementById('reset-shared-preview').addEventListener('click', () => {
      if (!window.confirm('پیش‌نمایش و ورودی‌های موقت تخلیه شوند؟ اطلاعات ثبت‌شده قبلی حذف نمی‌شوند.')) return;
      pendingExcelRows = []; pendingClipboardRows = [];
      itemFormInputs.code.value = ''; itemFormInputs.description.value = ''; itemFormInputs.stock.value = ''; manualCategoryInput.value = '';
      if (typeof pastedDataInput !== 'undefined' && pastedDataInput) pastedDataInput.value = '';
      const fileInput = document.querySelector('input[type="file"][accept*=".csv"], input[type="file"][accept*=".xlsx"]');
      if (fileInput) fileInput.value = '';
      renderSharedInputPreview();
      document.getElementById('input-feedback').textContent = 'پیش‌نمایش و ورودی‌های موقت تخلیه شدند؛ داده‌های ثبت‌شده حفظ شدند.';
    });
    const pastedDataInput = document.getElementById('pasted-data');
    const excelFeedback = document.getElementById('excel-feedback');
    const singleFeedback = document.getElementById('single-feedback');
    const duplicateDialog = document.getElementById('duplicate-dialog');
    const duplicateDialogDetails = document.getElementById('duplicate-dialog-details');
    let pendingClipboardRows = [];
    let pendingExcelRows = [];

    /**
     * هدف: خواندن آرایه ذخیره‌شده بدون حذف یا نرمال‌سازی داده خام.
     * خروجی: وضعیت وجود کلید، مقدار خام تجزیه‌شده و خطای ساختار/خواندن.
     */
    function readStoredArrayState(key, label) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return { exists: false, raw: null, records: [], error: '' };
        let records;
        try { records = JSON.parse(raw); }
        catch (error) {
          return { exists: true, raw, records: null, error: label + ': متن ذخیره‌شده JSON معتبر نیست.' };
        }
        if (!Array.isArray(records)) {
          return { exists: true, raw, records: null, error: label + ': مقدار ذخیره‌شده آرایه نیست.' };
        }
        return { exists: true, raw, records, error: '' };
      } catch (error) {
        return { exists: true, raw: null, records: null, error: label + ': خواندن حافظه محلی ممکن نشد.' };
      }
    }

    /**
     * هدف: جلوگیری از بازنویسی کلیدهایی که خواندن عادی آن‌ها بخشی از داده را حذف یا تغییر می‌دهد.
     */
    function canSafelyRewriteStoredArray(key, label, feedbackTarget, preservesRecord = () => true) {
      const state = readStoredArrayState(key, label);
      let reason = state.error;
      if (!reason && state.exists) {
        const unsafeIndex = state.records.findIndex(record => !preservesRecord(record));
        if (unsafeIndex >= 0) {
          reason = label + '، رکورد ' + (unsafeIndex + 1) +
            ' هنگام بازخوانی معمول از دست می‌رود یا تغییر می‌کند.';
        }
      }
      if (!reason) return true;
      if (feedbackTarget) {
        feedbackTarget.textContent = reason +
          ' برای جلوگیری از حذف ناخواسته، ذخیره متوقف شد. ابتدا از داده خام نسخه جداگانه تهیه و رکورد ناسازگار را بررسی کنید؛ هیچ رکوردی خودکار حذف نشده است.';
      }
      return false;
    }

    /** نرمال‌سازی کلید متنی برای کشف تکرار بدون تغییر مقدار ذخیره‌شده. */
    function dataQualityKey(value) {
      return normalizeArabicLetters(toEnglishDigits(String(value ?? '')))
        .trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa');
    }

    /**
     * هدف: ممیزی غیرمخرب داده‌های واقعاً ذخیره‌شده و اعلام رکوردهای مشکوک در داشبورد.
     * این گزارش فقط می‌خواند؛ هیچ رکوردی را حذف، اصلاح یا ذخیره نمی‌کند.
     */
    function inspectStoredDataQuality() {
      const findings = [];
      const read = (key, label) => {
        const state = readStoredArrayState(key, label);
        if (state.error) findings.push(state.error);
        return state.error ? [] : state.records;
      };
      const inventory = read(STORAGE_KEY, 'موجودی');
      const entries = read(ENTRY_HISTORY_KEY, 'تاریخچه ورود');
      const shipments = read(SHIPMENT_KEY, 'تاریخچه ارسال');
      const locations = read(LOCATION_KEY, 'محل‌های ارسال');

      const inventoryCodes = new Set();
      const inventoryIds = new Set();
      inventory.forEach((item, index) => {
        const row = index + 1;
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          findings.push('موجودی، رکورد ' + row + ' شیء معتبر نیست.');
          return;
        }
        const id = typeof item.id === 'string' ? dataQualityKey(item.id) : '';
        if (item.id !== undefined && !id) findings.push('موجودی، رکورد ' + row + ' شناسه کالا نامعتبر دارد.');
        else if (id && inventoryIds.has(id)) findings.push('شناسه کالای تکراری در موجودی: «' + String(item.id).slice(0, 60) + '».');
        if (id) inventoryIds.add(id);
        const code = typeof item.code === 'string' ? dataQualityKey(item.code) : '';
        if (!code) findings.push('موجودی، رکورد ' + row + ' کد خالی یا نامعتبر دارد.');
        else {
          if (!/^(?:\d{8}|\d{10})$/.test(toEnglishDigits(code))) {
            findings.push('موجودی، کد «' + String(item.code).slice(0, 40) + '» الگوی ۸ یا ۱۰ رقمی ندارد.');
          }
          if (inventoryCodes.has(code)) findings.push('کد کالای تکراری در موجودی: «' + String(item.code).slice(0, 40) + '».');
          inventoryCodes.add(code);
        }
        if (typeof item.description !== 'string' || !item.description.trim()) {
          findings.push('موجودی، رکورد ' + row + ' شرح کالا خالی دارد.');
        }
        if (item.category !== undefined && typeof item.category !== 'string') findings.push('موجودی، رکورد ' + row + ' گروه کالا نامعتبر دارد.');
        const stock = Number(item.stock);
        if ((typeof item.stock !== 'number' && typeof item.stock !== 'string') ||
            (typeof item.stock === 'string' && !item.stock.trim()) ||
            !Number.isFinite(stock) || stock < 0) {
          findings.push('موجودی، رکورد ' + row + ' مقدار موجودی نامعتبر دارد.');
        }
        if (item.entryTimestamp !== undefined && item.entryTimestamp !== '' &&
            !(typeof item.entryTimestamp === 'string' && Number.isFinite(Date.parse(item.entryTimestamp)))) {
          findings.push('موجودی، رکورد ' + row + ' زمان ورود نامعتبر دارد.');
        }
        const minimumStock = item.minimumStock === undefined || item.minimumStock === '' || item.minimumStock === null
          ? 0 : Number(item.minimumStock);
        if (item.minimumStock !== undefined && item.minimumStock !== '' && item.minimumStock !== null &&
            (!Number.isFinite(minimumStock) || minimumStock < 0)) {
          findings.push('موجودی، رکورد ' + row + ' حداقل موجودی نامعتبر دارد.');
        }
        if (Object.keys(item).some(key => !['id', 'code', 'description', 'category', 'stock', 'minimumStock', 'sendQuantity', 'entryTimestamp'].includes(key))) {
          findings.push('موجودی، رکورد ' + row + ' فیلد اضافی دارد که نسخه جاری هنگام ذخیره حفظ نمی‌کند.');
        }
        if (item.sendQuantity !== undefined && item.sendQuantity !== '' && item.sendQuantity !== null) {
          const quantity = Number(item.sendQuantity);
          if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(stock) || quantity > stock) {
            findings.push('موجودی، رکورد ' + row + ' مقدار آماده‌ارسال خارج از محدوده دارد.');
          }
        }
      });

      const entryNumbers = new Set();
      const entryIds = new Set();
      const entryLineIds = new Set();
      entries.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          findings.push('تاریخچه ورود، رکورد ' + (index + 1) + ' شیء معتبر نیست.');
          return;
        }
        const entryId = typeof entry.id === 'string' ? dataQualityKey(entry.id) : '';
        if (entry.id !== undefined && !entryId) findings.push('تاریخچه ورود، رکورد ' + (index + 1) + ' شناسه سند نامعتبر دارد.');
        else if (entryId && entryIds.has(entryId)) findings.push('شناسه سند ورود تکراری است: «' + String(entry.id).slice(0, 60) + '».');
        if (entryId) entryIds.add(entryId);
        if (entry.items !== undefined && !Array.isArray(entry.items)) findings.push('تاریخچه ورود، رکورد ' + (index + 1) + ' فهرست اقلام معتبر ندارد.');
        if (Array.isArray(entry.items)) entry.items.forEach((line, lineIndex) => {
          if (!line || typeof line !== 'object' || Array.isArray(line) || typeof line.code !== 'string' || !line.code.trim()) {
            findings.push('ورود ' + (index + 1) + '، ردیف ' + (lineIndex + 1) + ' کد کالا ندارد.');
            return;
          }
          const lineId = typeof line.id === 'string' ? dataQualityKey(line.id) : '';
          if (line.id !== undefined && !lineId) findings.push('ورود ' + (index + 1) + '، ردیف ' + (lineIndex + 1) + ' شناسه ردیف نامعتبر دارد.');
          else if (lineId && entryLineIds.has(lineId)) findings.push('شناسه ردیف ورود تکراری است: «' + String(line.id).slice(0, 60) + '».');
          if (lineId) entryLineIds.add(lineId);
          if (line.itemId !== undefined && (typeof line.itemId !== 'string' || !line.itemId.trim())) findings.push('ورود ' + (index + 1) + '، ردیف ' + (lineIndex + 1) + ' شناسه قلم نامعتبر دارد.');
          const quantity = Number(line.quantity);
          if (line.quantity !== undefined && (!Number.isFinite(quantity) || quantity < 0)) findings.push('ورود ' + (index + 1) + '، ردیف ' + (lineIndex + 1) + ' تعداد نامعتبر دارد.');
        });
        const number = typeof entry.entryNumber === 'string' ? dataQualityKey(entry.entryNumber) : '';
        if (!number) findings.push('تاریخچه ورود، رکورد ' + (index + 1) + ' شماره ورود ندارد.');
        else if (entryNumbers.has(number)) findings.push('شماره ورود تکراری: «' + String(entry.entryNumber).slice(0, 60) + '».');
        if (number) entryNumbers.add(number);
        if (entry.timestamp !== undefined && entry.timestamp !== '' &&
            !(typeof entry.timestamp === 'string' && Number.isFinite(Date.parse(entry.timestamp)))) {
          findings.push('تاریخچه ورود، رکورد ' + (index + 1) + ' زمان نامعتبر دارد.');
        }
        ['itemCount', 'pieceCount'].forEach(field => {
          if (entry[field] !== undefined &&
              (typeof entry[field] !== 'number' || !Number.isFinite(entry[field]) || entry[field] < 0)) {
            findings.push('تاریخچه ورود، رکورد ' + (index + 1) + ' مقدار «' + field + '» نامعتبر دارد.');
          }
        });
      });

      const voucherNumbers = new Set();
      const exitNumbers = new Set();
      const shipmentIds = new Set();
      const shipmentLineIds = new Set();
      shipments.forEach((shipment, index) => {
        if (!shipment || typeof shipment !== 'object' || Array.isArray(shipment)) {
          findings.push('تاریخچه ارسال، رکورد ' + (index + 1) + ' شیء معتبر نیست.');
          return;
        }
        const shipmentId = typeof shipment.id === 'string' ? dataQualityKey(shipment.id) : '';
        if (shipment.id !== undefined && !shipmentId) findings.push('تاریخچه ارسال، رکورد ' + (index + 1) + ' شناسه سند نامعتبر دارد.');
        else if (shipmentId && shipmentIds.has(shipmentId)) findings.push('شناسه سند ارسال تکراری است: «' + String(shipment.id).slice(0, 60) + '».');
        if (shipmentId) shipmentIds.add(shipmentId);
        [['voucherNumber', voucherNumbers, 'شماره حواله'], ['exitNumber', exitNumbers, 'شماره خروج']].forEach(([field, set, label]) => {
          const value = typeof shipment[field] === 'string' ? dataQualityKey(shipment[field]) : '';
          if (value && set.has(value)) findings.push(label + ' تکراری: «' + String(shipment[field]).slice(0, 60) + '».');
          if (value) set.add(value);
        });
        if (!Array.isArray(shipment.items)) {
          findings.push('تاریخچه ارسال، رکورد ' + (index + 1) + ' فهرست اقلام معتبر ندارد.');
          return;
        }
        shipment.items.forEach((line, lineIndex) => {
          if (!line || typeof line !== 'object' || Array.isArray(line) ||
              typeof line.code !== 'string' || !line.code.trim()) {
            findings.push('ارسال ' + (index + 1) + '، ردیف ' + (lineIndex + 1) + ' کد کالای معتبر ندارد.');
            return;
          }
          const lineId = typeof line.id === 'string' ? dataQualityKey(line.id) : '';
          if (line.id !== undefined && !lineId) findings.push('ارسال ' + (index + 1) + '، ردیف ' + (lineIndex + 1) + ' شناسه ردیف نامعتبر دارد.');
          else if (lineId && shipmentLineIds.has(lineId)) findings.push('شناسه ردیف ارسال تکراری است: «' + String(line.id).slice(0, 60) + '».');
          if (lineId) shipmentLineIds.add(lineId);
          if (line.itemId !== undefined && (typeof line.itemId !== 'string' || !line.itemId.trim())) findings.push('ارسال ' + (index + 1) + '، ردیف ' + (lineIndex + 1) + ' شناسه قلم نامعتبر دارد.');
          const quantity = typeof line.quantity === 'number' ? line.quantity : normalizeStock(line.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            findings.push('ارسال ' + (index + 1) + '، ردیف ' + (lineIndex + 1) + ' تعداد نامعتبر دارد.');
          }
        });
      });

      const locationNames = new Set();
      locations.forEach((location, index) => {
        if (!location || typeof location !== 'object' || Array.isArray(location) ||
            typeof location.name !== 'string' || !location.name.trim()) {
          findings.push('محل ارسال، رکورد ' + (index + 1) + ' نام معتبر ندارد.');
          return;
        }
        const name = dataQualityKey(location.name);
        if (locationNames.has(name)) findings.push('نام محل ارسال تکراری: «' + location.name.slice(0, 60) + '».');
        locationNames.add(name);
        if (Object.keys(location).some(key => key !== 'name' && key !== 'sublocations')) {
          findings.push('محل «' + location.name.slice(0, 40) + '» فیلد اضافی دارد که نسخه جاری حفظ نمی‌کند.');
        }
        if (location.sublocations !== undefined &&
            (!Array.isArray(location.sublocations) ||
             !location.sublocations.every(value => typeof value === 'string' && value.trim()))) {
          findings.push('محل «' + location.name.slice(0, 40) + '» زیرمجموعه نامعتبر دارد.');
        } else if (Array.isArray(location.sublocations)) {
          const subs = new Set();
          location.sublocations.forEach(sub => {
            const key = dataQualityKey(sub);
            if (subs.has(key)) findings.push('زیرمجموعه تکراری برای محل «' + location.name.slice(0, 40) + '».');
            subs.add(key);
          });
        }
      });
      return findings;
    }

    /** هدف: نمایش نتیجه ممیزی غیرمخرب داده‌های ذخیره‌شده در بخش داشبورد. */
    function renderDataQualityReport() {
      const anchor = document.querySelector('.dashboard-note');
      if (!anchor) return;
      let report = document.getElementById('dashboard-data-quality-report');
      if (!report) {
        report = document.createElement('p');
        report.id = 'dashboard-data-quality-report';
        report.className = 'dashboard-note';
        report.setAttribute('role', 'status');
        report.setAttribute('aria-live', 'polite');
        anchor.insertAdjacentElement('afterend', report);
      }
      const findings = inspectStoredDataQuality();
      if (findings.length) {
        report.className = 'dashboard-note feedback';
        report.textContent = 'هشدار کیفیت داده: ' + findings.length + ' مورد مشکوک شناسایی شد؛ هیچ داده‌ای خودکار حذف یا اصلاح نشده است. ' +
          findings.slice(0, 3).join(' ');
        if (findings.length > 3) report.textContent += ' و ' + (findings.length - 3) + ' مورد دیگر؛ برای جزئیات بیشتر نسخه پشتیبان خام تهیه و سوابق را بررسی کنید.';
      } else {
        report.className = 'dashboard-note';
        report.textContent = 'کنترل کیفیت داده‌های ذخیره‌شده: ناسازگاری ساختاری، مقدار نامعتبر یا شناسه تکراری قابل تشخیص پیدا نشد.';
      }
    }

    /**
     * هدف: خواندن موجودی و پالایش کد، شرح، موجودی، مقدار آماده‌ارسال و زمان ورود.
     * ورودی: پارامتر ندارد.
     * خروجی: آرایه کالاهای نرمال‌شده؛ در خطا آرایه خالی.
     */
    function loadInventory() {
      try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) return [];
        const parsedData = JSON.parse(savedData);
        if (!Array.isArray(parsedData)) return [];

        return parsedData
          .filter(item =>
            item &&
            typeof item.code === 'string' &&
            typeof item.description === 'string' &&
            Number.isFinite(Number(item.stock)) &&
            Number(item.stock) >= 0
          )
          .map(item => {
            const stock = Number(item.stock);
            const requestedQuantity = item.sendQuantity === '' || item.sendQuantity === null || item.sendQuantity === undefined
              ? NaN
              : Number(item.sendQuantity);
            return {
              // برای داده‌های قدیمی، شناسه قابل تکرار از کد کالا ساخته می‌شود تا بارگذاری به ذخیره فوری وابسته نباشد.
              id: typeof item.id === 'string' && item.id.trim() ? item.id : 'item-' + dataQualityKey(item.code),
              code: item.code,
              description: item.description,
              category: typeof item.category === 'string' ? item.category : '',
              stock,
              // رکوردهای قدیمی حداقل موجودی ندارند؛ مقدار صفر یعنی آستانه اختصاصی هنوز تنظیم نشده است.
              minimumStock: item.minimumStock === undefined || item.minimumStock === '' || item.minimumStock === null
                ? 0
                : (Number.isFinite(Number(item.minimumStock)) && Number(item.minimumStock) >= 0 ? Number(item.minimumStock) : 0),
              // مقدار موقت ارسال فقط در صورتی معتبر است که عددی مثبت و در محدوده موجودی باشد.
              sendQuantity: Number.isFinite(requestedQuantity) && requestedQuantity > 0 && requestedQuantity <= stock
                ? requestedQuantity
                : '',
              entryTimestamp: typeof item.entryTimestamp === 'string' && Number.isFinite(Date.parse(item.entryTimestamp))
                ? item.entryTimestamp
                : ''
            };
          });
      } catch (error) {
        return [];
      }
    }

    const inventoryItems = loadInventory();

    /**
     * هدف: ذخیره موجودی جاری و ثبت خلاصه تغییر در لاگ فعالیت.
     * ورودی: پارامتر ندارد؛ از inventoryItems استفاده می‌شود.
     * خروجی: true در ذخیره موفق و false در شکست.
     */
    function saveInventory() {
      const inventoryFields = new Set(['id', 'code', 'description', 'category', 'stock', 'minimumStock', 'sendQuantity', 'entryTimestamp']);
      const preservesInventoryRecord = item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
        const stockTypeValid = typeof item.stock === 'number' ||
          (typeof item.stock === 'string' && item.stock.trim() !== '');
        if (item.id !== undefined && (typeof item.id !== 'string' || !item.id.trim())) return false;
        if (typeof item.code !== 'string' || typeof item.description !== 'string' ||
            (item.category !== undefined && typeof item.category !== 'string') ||
            !stockTypeValid || !Number.isFinite(Number(item.stock)) || Number(item.stock) < 0 ||
            Object.keys(item).some(key => !inventoryFields.has(key))) return false;
        if (item.minimumStock !== undefined && item.minimumStock !== '' && item.minimumStock !== null &&
            ((typeof item.minimumStock !== 'number' && typeof item.minimumStock !== 'string') ||
              !Number.isFinite(Number(item.minimumStock)) || Number(item.minimumStock) < 0)) return false;
        const quantity = item.sendQuantity === '' || item.sendQuantity === null || item.sendQuantity === undefined
          ? NaN : Number(item.sendQuantity);
        if (item.sendQuantity !== '' && item.sendQuantity !== null && item.sendQuantity !== undefined &&
            (!Number.isFinite(quantity) || quantity < 0 || quantity > Number(item.stock))) return false;
        return item.entryTimestamp === undefined || item.entryTimestamp === '' ||
          (typeof item.entryTimestamp === 'string' && Number.isFinite(Date.parse(item.entryTimestamp)));
      };
      if (!canSafelyRewriteStoredArray(STORAGE_KEY, 'موجودی', inventoryFeedback, preservesInventoryRecord)) {
        return false;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inventoryItems));
        recordActivity('ذخیره / تغییر موجودی', 'تعداد اقلام فعلی: ' + toEnglishDigits(inventoryItems.length));
        renderDataQualityReport();
        return true;
      } catch (error) {
        inventoryFeedback.textContent = 'ذخیره‌سازی در مرورگر انجام نشد؛ ممکن است حافظه مرورگر محدود یا غیرفعال باشد.';
        return false;
      }
    }

    /**
     * هدف: نمایش سکشن منتخب و تنظیم aria-current پیوند ناوبری متناظر.
     * ورودی: sectionId: شناسه سکشن مقصد.
     * خروجی: نمایش رابط به‌روزرسانی می‌شود.
     */
    function openSection(sectionId) {
      sectionCards.forEach((section) => {
        const isSelected = section.id === sectionId;
        section.classList.toggle('is-active', isSelected);
        section.hidden = !isSelected;
      });

      sectionLinks.forEach((link) => {
        const isSelected = link.getAttribute('href') === '#' + sectionId;
        if (isSelected) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    sectionLinks.forEach((link) => {
      // رویداد «کلیک» برای پیوند ناوبری؛ بازکردن بخش مقصد بدون بارگذاری دوباره صفحه.
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openSection(link.getAttribute('href').slice(1));
      });
    });

    /**
     * هدف: قالب‌بندی شاخص داشبورد با رقم‌های فارسی و محافظت از مقدار عددی نامعتبر.
     * ورودی: value: مقداری که باید به عدد تبدیل شود.
     * خروجی: رشته عدد قالب‌بندی‌شده.
     */
    function formatDashboardNumber(value) {
      const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
      return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(safeValue);
    }

    /**
     * هدف: محاسبه شاخص‌های داشبورد از داده واقعی ذخیره‌شده، بدون افزودن آمار نمونه.
     * ورودی: پارامتر ندارد.
     * خروجی: مقادیر عناصر داشبورد به‌روزرسانی می‌شوند.
     */
    function updateDashboardSummary() {
      const setMetric = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = formatDashboardNumber(value);
      };
      try {
        const inventoryData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const entryData = JSON.parse(localStorage.getItem(ENTRY_HISTORY_KEY) || '[]');
        const shipmentData = JSON.parse(localStorage.getItem(SHIPMENT_KEY) || '[]');
        const inventory = Array.isArray(inventoryData) ? inventoryData.filter(item =>
          item && typeof item === 'object' && !Array.isArray(item)) : [];
        const entries = Array.isArray(entryData) ? entryData : [];
        const shipments = Array.isArray(shipmentData) ? shipmentData : [];
        const totalStock = inventory.reduce((total, item) => {
          const quantity = Number(item.stock);
          return total + (Number.isFinite(quantity) ? quantity : 0);
        }, 0);
        const zeroStockCount = inventory.filter(item => {
          const quantity = Number(item.stock);
          return Number.isFinite(quantity) && quantity <= 0;
        }).length;
        setMetric('dashboard-item-count', inventory.length);
        setMetric('dashboard-stock-total', totalStock);
        setMetric('dashboard-entry-count', entries.length);
        setMetric('dashboard-shipment-count', shipments.length);
        setMetric('dashboard-zero-stock-count', zeroStockCount);
      } catch (error) {
        ['dashboard-item-count', 'dashboard-stock-total', 'dashboard-entry-count',
          'dashboard-shipment-count', 'dashboard-zero-stock-count'].forEach(id => setMetric(id, 0));
      }
      renderDataQualityReport();
    }

    /**
     * هدف: اتصال میان‌برهای داشبورد و همگام‌سازی شاخص‌ها پس از تغییر داده یا DOM.
     * ورودی: پارامتر ندارد.
     * خروجی: رویدادها و مشاهده‌گرهای داشبورد فعال می‌شوند.
     */
    function setupDashboard() {
      document.querySelectorAll('[data-section-target]').forEach(link => {
        // رویداد «کلیک» برای پیوند ناوبری؛ بازکردن بخش مقصد بدون بارگذاری دوباره صفحه.
        link.addEventListener('click', event => {
          event.preventDefault();
          const sectionId = link.getAttribute('data-section-target');
          if (sectionId && document.getElementById(sectionId)) openSection(sectionId);
        });
      });
      updateDashboardSummary();
      // رویداد «تغییر ذخیره‌سازی در زبانه دیگر» برای عنصر رابط کاربری؛ همگام‌سازی شاخص‌ها با تغییر داده در زبانه دیگر.
      window.addEventListener('storage', updateDashboardSummary);
      if (typeof MutationObserver === 'function') {
        ['inventory-grid', 'entry-history-body', 'shipment-history-body'].forEach(id => {
          const target = document.getElementById(id);
          if (!target) return;
          const observer = new MutationObserver(updateDashboardSummary);
          observer.observe(target, { childList: true, subtree: true, characterData: true });
        });
      }
    }

    /**
     * هدف: یکسان‌سازی شکل‌های عربی و فارسی برخی حروف در متن ورودی.
     * ورودی: value: متن یا مقدار ورودی.
     * خروجی: رشته نرمال‌شده.
     */
    function normalizeArabicLetters(value) {
      return String(value ?? '')
        .replace(/[يى]/g, 'ی')
        .replace(/ك/g, 'ک');
    }

    /**
     * هدف: تبدیل رقم‌های فارسی و عربی به رقم‌های لاتین جهت مقایسه و اعتبارسنجی.
     * ورودی: value: متن یا مقدار ورودی.
     * خروجی: رشته با رقم‌های لاتین.
     */
    function toEnglishDigits(value) {
      return String(value ?? '')
        .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    }

    /**
     * هدف: تبدیل متن موجودی به عدد و پشتیبانی از جداکننده‌های عددی رایج.
     * ورودی: value: مقدار متنی.
     * خروجی: عدد یا NaN برای مقدار خالی/نامعتبر.
     */
    function normalizeStock(value) {
      const normalized = toEnglishDigits(value)
        .replace(/[٬,]/g, '')
        .replace(/٫/g, '.')
        .trim();
      if (normalized === '') return NaN;
      return Number(normalized);
    }

    /**
     * هدف: تجزیه CSV یا متن جدولی با رعایت جداکننده و کوتیشن سلول‌ها.
     * ورودی: text: متن خام فایل یا کلیپ‌بورد.
     * خروجی: آرایه دوبعدی ردیف‌ها و سلول‌ها.
     */
    function parseDelimitedText(text) {
      const trimmed = String(text || '').trim();
      if (!trimmed) return [];

      const firstLine = trimmed.split(/\r?\n/, 1)[0];
      const delimiter = firstLine.includes('\t')
        ? '\t'
        : (firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',');

      const rows = [];
      let row = [];
      let cell = '';
      let inQuotes = false;

      for (let index = 0; index < trimmed.length; index += 1) {
        const character = trimmed[index];

        if (character === '"') {
          if (inQuotes && trimmed[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (character === delimiter && !inQuotes) {
          row.push(cell.trim());
          cell = '';
        } else if ((character === '\n' || character === '\r') && !inQuotes) {
          if (character === '\r' && trimmed[index + 1] === '\n') index += 1;
          row.push(cell.trim());
          if (row.some(value => value !== '')) rows.push(row);
          row = [];
          cell = '';
        } else {
          cell += character;
        }
      }

      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      return rows;
    }

    /**
     * هدف: استانداردسازی عنوان ستون برای تشخیص نام ستون‌ها.
     * ورودی: value: عنوان خام.
     * خروجی: رشته عنوان نرمال‌شده.
     */
    function normalizeHeader(value) {
      return String(value ?? '').toLowerCase().replace(/[\s_\-()\[\]]+/g, '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
    }
    /**
     * هدف: شناسایی موقعیت ستون‌های کد، شرح و موجودی از روی سرستون.
     * ورودی: row: ردیف سرستون.
     * خروجی: نگاشت فیلدها به شماره ستون یا نتیجه عدم تشخیص.
     */
    function getHeaderMap(row) {
      const aliases = {
        code: ['کدتدارکاتی','کدکالا','کد','کدمحصول','itemcode','productcode','code'],
        description: ['شرحکالا','نامکالا','شرح','عنوانکالا','ناممحصول','itemname','description','productname','نام'],
        stock: ['موجودی','تعدادموجودی','تعداد','مقدار','quantity','stock','inventory'],
        category: ['گروهکالا','دستهکالا','گروه','دسته','category','group','productcategory']
      };
      const values = row.map(normalizeHeader);
      const map = {};
      Object.keys(aliases).forEach(field => { map[field] = values.findIndex(value => aliases[field].includes(value)); });
      return Object.values(map).filter(index => index >= 0).length >= 2 ? map : null;
    }
    /**
     * هدف: بررسی اینکه یک ردیف به‌احتمال زیاد سرستون است یا داده کالا.
     * ورودی: row: سلول‌های ردیف.
     * خروجی: مقدار بولی.
     */
    function isHeaderRow(row) { return Boolean(getHeaderMap(row)); }
    /**
     * هدف: پالایش ردیف‌های فایل/کلیپ‌بورد و هماهنگ‌سازی ستون‌ها در صورت وجود سرستون.
     * ورودی: rows: آرایه دوبعدی داده خام.
     * خروجی: آرایه ردیف‌های آماده پیش‌نمایش و اعتبارسنجی.
     */
    function prepareImportRows(rows) {
      const source = Array.isArray(rows) ? rows : [];
      let headerIndex = -1, headerMap = null;
      for (let i = 0; i < Math.min(source.length, 30); i++) {
        if (!Array.isArray(source[i])) continue;
        const map = getHeaderMap(source[i]);
        if (map) { headerIndex = i; headerMap = map; break; }
      }
      return source.map((row, index) => {
        if (!Array.isArray(row) || index === headerIndex || row.every(value => String(value ?? '').trim() === '')) return null;
        const mapped = headerMap ? [
          headerMap.code >= 0 ? row[headerMap.code] : row[0],
          headerMap.description >= 0 ? row[headerMap.description] : row[1],
          headerMap.stock >= 0 ? row[headerMap.stock] : row[2],
          headerMap.category >= 0 ? row[headerMap.category] : ''
        ] : row.slice(0,4);
        mapped._sourceRow = index + 1;
        return mapped;
      }).filter(Boolean);
    }
    /**
     * هدف: اعتبارسنجی کد، شرح و موجودی و تولید پیام خطا برای یک ردیف.
     * ورودی: row: سلول‌های ورودی کالا.
     * خروجی: رشته خطاها؛ رشته خالی یعنی داده معتبر است.
     */
    function getRowError(row) {
      const code = toEnglishDigits(String(row?.[0] ?? '').trim());
      const description = normalizeArabicLetters(String(row?.[1] ?? '')).trim();
      const stockText = toEnglishDigits(String(row?.[2] ?? '').trim()).replace(/[٬,]/g, '').replace(/٫/g, '.');
      const errors = [];
      if (!/^(?:\d{8}|\d{10})$/.test(code)) errors.push('کد تدارکاتی باید ۸ یا ۱۰ رقم باشد');
      if (!description) errors.push('شرح کالا خالی است');
      const stock = normalizeStock(stockText);
      if (!/^\d+(?:\.\d+)?$/.test(stockText) || !Number.isFinite(stock) || stock < 0) errors.push('موجودی باید عدد صفر یا مثبت باشد');
      return errors.join('؛ ');
    }

        /**
         * هدف: تبدیل ردیف معتبر به شیء کالا با کد، شرح و موجودی استاندارد.
         * ورودی: row: سلول‌های کالا.
         * خروجی: شیء کالا یا null در صورت نامعتبر بودن.
         */
        function normalizeRow(row) {
      const code = toEnglishDigits(String(row[0] ?? '').trim());
      const description = normalizeArabicLetters(String(row[1] ?? '')).trim();
      // همان نرمال‌سازی getRowError: جداکننده هزارگان و ممیز فارسی را پیش از اعتبارسنجی یکسان کن.
      const stockText = toEnglishDigits(String(row[2] ?? '').trim())
        .replace(/[٬,]/g, '')
        .replace(/٫/g, '.');
      const stock = normalizeStock(stockText);
      if (!/^(?:\d{8}|\d{10})$/.test(code) || !description || !/^\d+(?:\.\d+)?$/.test(stockText) ||
          !Number.isFinite(stock) || stock < 0) return null;
      const category = normalizeArabicLetters(String(row[3] ?? '')).trim().slice(0, 80);
      return { code, description, stock, category };
    }

    /**
     * هدف: افزودن کنترل‌های مرتب‌سازی دسترس‌پذیر به سرستون‌های جدول.
     * ورودی: table: جدول DOM؛ options: تنظیم ستون و جهت اولیه.
     * خروجی: رویدادها و نشانگرهای مرتب‌سازی روی جدول فعال می‌شوند.
     */
    function enableTableSorting(table, options = {}) {
      if (!table || table.dataset.sortingReady === 'true') return;
      const head = table.tHead;
      const body = table.tBodies[0];
      if (!head || !body || !head.rows.length) return;
      table.dataset.sortingReady = 'true';
      table.classList.add('sortable-data-table');
      const headers = [...head.rows[0].cells];
      let sortState = { column: Number.isInteger(options.defaultColumn) ? options.defaultColumn : 0, direction: options.defaultDirection || 'asc' };

      headers.forEach((cell, column) => {
        const label = cell.textContent.trim();
        cell.setAttribute('scope', 'col');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'table-sort-button';
        button.dataset.sortColumn = String(column);
        const title = document.createElement('span');
        title.textContent = label;
        const marker = document.createElement('span');
        marker.className = 'table-sort-marker';
        marker.setAttribute('aria-hidden', 'true');
        marker.textContent = column === sortState.column ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕';
        button.append(title, marker);
        button.setAttribute('aria-label', 'مرتب‌سازی بر اساس ' + label);
        cell.replaceChildren(button);
      });

      /**
       * هدف: به‌روزرسانی فلش‌ها و نام دسترس‌پذیر کنترل‌های مرتب‌سازی.
       * ورودی: پارامتر ندارد؛ وضعیت تابع پیرامونی استفاده می‌شود.
       * خروجی: نشانگرهای جدول به‌روزرسانی می‌شوند.
       */
      function updateMarkers() {
        headers.forEach((cell, column) => {
          const button = cell.querySelector('button[data-sort-column]');
          if (!button) return;
          const marker = button.querySelector('.table-sort-marker');
          const active = column === sortState.column;
          if (marker) marker.textContent = active ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕';
          cell.setAttribute('aria-sort', active ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');
          const label = button.querySelector('span')?.textContent || '';
          button.setAttribute('aria-label', 'مرتب‌سازی بر اساس ' + label + (active ? (sortState.direction === 'asc' ? '، صعودی' : '، نزولی') : ''));
        });
      }

      headers.forEach((cell, column) => {
        // رویداد «کلیک» برای دکمه مرتب‌سازی ستون جدول؛ تغییر ترتیب ردیف‌ها و نشانگر مرتب‌سازی.
        cell.querySelector('button[data-sort-column]').addEventListener('click', () => {
          if (sortState.column === column) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
          else sortState = { column, direction: 'asc' };
          const rows = [...body.rows].filter(row => !row.dataset.emptyRow);
          const sign = sortState.direction === 'asc' ? 1 : -1;
          rows.sort((first, second) => {
            const aCell = first.cells[column], bCell = second.cells[column];
            const a = aCell?.dataset.sortValue ?? aCell?.textContent.trim() ?? '';
            const b = bCell?.dataset.sortValue ?? bCell?.textContent.trim() ?? '';
            const aNum = Number(String(a).replace(/[٬,]/g, '').replace(/٫/g, '.'));
            const bNum = Number(String(b).replace(/[٬,]/g, '').replace(/٫/g, '.'));
            const numeric = a !== '' && b !== '' && Number.isFinite(aNum) && Number.isFinite(bNum);
            const comparison = numeric ? aNum - bNum : String(a).localeCompare(String(b), 'fa', { numeric: true, sensitivity: 'base' });
            return comparison * sign;
          });
          rows.forEach(row => body.append(row));
          updateMarkers();
        });
      });
      updateMarkers();
    }

    /**
     * هدف: ساخت جدول عمومی با سرستون‌ها و کلاس CSS تعیین‌شده.
     * ورودی: headers: عنوان ستون‌ها؛ className: کلاس اختیاری.
     * خروجی: شیء شامل table و tbody.
     */
    function createDataTable(headers, className = '') {
      const table = document.createElement('table');
      table.className = 'preview-table sortable-data-table ' + className;
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headers.forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        headerRow.append(th);
      });
      thead.append(headerRow);
      const tbody = document.createElement('tbody');
      table.append(thead, tbody);
      return { table, tbody };
    }

    /**
     * هدف: ترکیب ردیف‌های موقت ورود دستی، Excel و کلیپ‌بورد برای پردازش یکپارچه.
     * ورودی: پارامتر ندارد.
     * خروجی: آرایه ورودی‌ها همراه اطلاعات منبع.
     */
    function getCombinedPendingRows() {
      const combined = [];
      pendingExcelRows.forEach(row => combined.push({ row, source: 'Excel/CSV' }));
      pendingClipboardRows.forEach(row => combined.push({ row, source: 'کلیپ‌بورد' }));
      const manualRow = [itemFormInputs.code.value.trim(), itemFormInputs.description.value.trim(), itemFormInputs.stock.value.trim(), manualCategoryInput.value.trim()];
      if (manualRow.some(value => value !== '')) combined.push({ row: manualRow, source: 'ورود دستی' });
      return combined;
    }

    /**
     * هدف: به‌روزرسانی پیش‌نمایش مشترک بر اساس ردیف‌های موقت همه روش‌های ورود.
     * ورودی: پارامتر ندارد.
     * خروجی: بخش پیش‌نمایش بازسازی می‌شود.
     */
    function renderSharedInputPreview() {
      const shared = document.getElementById('shared-input-preview');
      const confirmButton = document.getElementById('confirm-all-imports');
      if (!shared) return;
      const combined = getCombinedPendingRows();
      shared.replaceChildren();
      const heading = document.createElement('h5');
      heading.textContent = 'پیش‌نمایش مشترک اطلاعات ورودی';
      const message = document.createElement('p');
      message.className = 'preview-message';
      message.textContent = 'کل ردیف‌ها: ' + toEnglishDigits(combined.length) + '؛ معتبر: ' +
        toEnglishDigits(combined.filter(item => normalizeRow(item.row)).length) + '؛ دارای خطا: ' +
        toEnglishDigits(combined.filter(item => !normalizeRow(item.row)).length);
      shared.append(heading, message);
      if (!combined.length) {
        const empty = document.createElement('p');
        empty.className = 'preview-empty';
        empty.textContent = 'هنوز اطلاعاتی برای پیش‌نمایش وجود ندارد.';
        shared.append(empty);
        if (confirmButton) confirmButton.disabled = true;
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'preview-table-wrap bulk-preview-scroll';
      const { table, tbody } = createDataTable(['منبع ورودی', 'کد تدارکاتی', 'شرح کالا', 'موجودی', 'گروه کالا', 'وضعیت']);
      combined.forEach(({row, source}) => {
        const error = getRowError(row);
        const tr = document.createElement('tr');
        if (error) tr.className = 'import-invalid-row';
        [source, toEnglishDigits(row[0] ?? ''), normalizeArabicLetters(row[1] ?? ''), toEnglishDigits(row[2] ?? ''), normalizeArabicLetters(row[3] ?? '') || '—', error || 'معتبر'].forEach(value => {
          const td = document.createElement('td'); td.textContent = String(value); tr.append(td);
        });
        tbody.append(tr);
      });
      wrapper.append(table); shared.append(wrapper);
      enableTableSorting(table, { defaultColumn: 1, defaultDirection: 'asc' });
      if (confirmButton) confirmButton.disabled = !combined.some(item => normalizeRow(item.row));
    }

    /**
     * هدف: نمایش پیش‌نمایش چندردیفی و وضعیت اعتبار هر ردیف.
     * ورودی: rows: داده‌ها؛ sourceLabel: نام منبع؛ previewTarget: ظرف مقصد.
     * خروجی: DOM پیش‌نمایش ساخته یا به‌روزرسانی می‌شود.
     */
    function renderBulkPreview(rows, sourceLabel, previewTarget) {
      const previewRows = (Array.isArray(rows) ? rows : []).filter(row => Array.isArray(row) && row.some(value => String(value ?? '').trim() !== ''));
      previewTarget.replaceChildren();
      const heading = document.createElement('h5');
      heading.textContent = 'پیش‌نمایش ورودی: ' + sourceLabel;
      const validCount = previewRows.filter(row => normalizeRow(row)).length;
      const message = document.createElement('p');
      message.className = 'preview-message';
      message.textContent = 'تعداد ردیف‌ها: ' + toEnglishDigits(previewRows.length) + '؛ معتبر: ' + toEnglishDigits(validCount) + '؛ دارای خطا: ' + toEnglishDigits(previewRows.length - validCount) + '. برای مرتب‌سازی روی عنوان ستون بزنید.';
      previewTarget.append(heading, message);
      if (!previewRows.length) {
        const empty = document.createElement('p'); empty.className = 'preview-empty'; empty.textContent = 'ردیفی برای نمایش پیدا نشد.';
        previewTarget.append(empty);
        renderSharedInputPreview();
        return;
      }
      const wrapper = document.createElement('div'); wrapper.className = 'preview-table-wrap bulk-preview-scroll';
      const { table, tbody } = createDataTable(['کد تدارکاتی', 'شرح کالا', 'موجودی', 'گروه کالا', 'وضعیت']);
      previewRows.forEach(row => {
        const error = getRowError(row);
        const tr = document.createElement('tr');
        if (error) tr.className = 'import-invalid-row';
        [toEnglishDigits(row[0] ?? ''), normalizeArabicLetters(row[1] ?? ''), toEnglishDigits(row[2] ?? ''), normalizeArabicLetters(row[3] ?? '') || '—', error || 'معتبر'].forEach(value => {
          const td = document.createElement('td'); td.textContent = String(value); tr.append(td);
        });
        tbody.append(tr);
      });
      wrapper.append(table); previewTarget.append(wrapper);
      enableTableSorting(table, { defaultColumn: 0, defaultDirection: 'asc' });
      renderSharedInputPreview();
    }

    /**
     * هدف: ساخت پیش‌نمایش ورود دستی بر اساس مقدارهای فرم جاری.
     * ورودی: پارامتر ندارد.
     * خروجی: DOM پیش‌نمایش ورود دستی به‌روزرسانی می‌شود.
     */
    function renderSinglePreview() {
      const row = [itemFormInputs.code.value.trim(), itemFormInputs.description.value.trim(), itemFormInputs.stock.value.trim(), manualCategoryInput.value.trim()];
      const item = normalizeRow(row);
      singlePreview.replaceChildren();
      const heading = document.createElement('h5'); heading.textContent = 'پیش‌نمایش کالای تکی'; singlePreview.append(heading);
      if (!row.some(value => value !== '')) {
        const empty = document.createElement('p'); empty.className = 'preview-empty';
        empty.textContent = 'با وارد کردن کد، شرح و موجودی، پیش‌نمایش اینجا نمایش داده می‌شود.';
        singlePreview.append(empty);
        renderSharedInputPreview();
        return;
      }
      const wrapper = document.createElement('div'); wrapper.className = 'preview-table-wrap';
      const { table, tbody } = createDataTable(['کد تدارکاتی', 'شرح کالا', 'موجودی', 'گروه کالا']);
      const tr = document.createElement('tr');
      [row[0], row[1], item ? item.stock : row[2], row[3] || '—'].forEach(value => {
        const td = document.createElement('td'); td.textContent = value === '' ? '—' : String(value); tr.append(td);
      });
      tbody.append(tr); wrapper.append(table); singlePreview.append(wrapper);
      enableTableSorting(table);
      const status = document.createElement('p'); status.className = item ? 'preview-message' : 'feedback';
      status.textContent = item
        ? 'اطلاعات معتبر است: کد تدارکاتی ۸ یا ۱۰ رقم و موجودی عددی است.'
        : 'کد تدارکاتی باید ۸ یا ۱۰ رقم باشد؛ شرح کالا نباید خالی باشد و موجودی فقط عدد صفر یا مثبت باشد.';
      singlePreview.append(status);
      renderSharedInputPreview();
    }

    /**
     * هدف: تشخیص کدهای تکراری در مجموعه ورودی پیش از ذخیره.
     * ورودی: rows: ردیف‌های ورودی.
     * خروجی: گروه‌های کد تکراری.
     */
    function findIncomingDuplicates(rows) {
      const rowsByCode = new Map();
      let firstDataRowChecked = false;

      rows.forEach((row, index) => {
        if (!Array.isArray(row) || row.every(value => String(value ?? '').trim() === '')) return;

        if (!firstDataRowChecked) {
          firstDataRowChecked = true;
          if (isHeaderRow(row)) return;
        }

        const item = normalizeRow(row);
        if (!item) return;

        const key = item.code.trim().toLocaleLowerCase('fa');
        if (!rowsByCode.has(key)) rowsByCode.set(key, []);
        rowsByCode.get(key).push({
          rowNumber: index + 1,
          code: item.code,
          description: item.description,
          stock: item.stock
        });
      });

      return [...rowsByCode.values()].filter(group => group.length > 1);
    }

    const importErrorDialog = document.getElementById('import-error-dialog');
    const importErrorDetails = document.getElementById('import-error-details');
    /**
     * هدف: نمایش ردیف‌های نامعتبر همراه علت خطا.
     * ورودی: rows: داده‌های بررسی‌شده.
     * خروجی: پنجره خطای ورود نمایش داده می‌شود.
     */
    function showImportErrors(rows) {
      const invalid = rows.filter(row => Array.isArray(row) && row.some(value => String(value ?? '').trim() !== '') && !normalizeRow(row));
      if (!invalid.length) return;
      importErrorDetails.replaceChildren();
      const note = document.createElement('p');
      note.textContent = 'ردیف‌های زیر وارد نشدند؛ سایر ردیف‌های معتبر پردازش شده‌اند. برای مرتب‌سازی روی عنوان ستون بزنید.';
      importErrorDetails.append(note);
      const wrapper = document.createElement('div'); wrapper.className = 'preview-table-wrap bulk-preview-scroll';
      const { table, tbody } = createDataTable(['ردیف فایل', 'کد تدارکاتی', 'شرح کالا', 'موجودی', 'خطا']);
      invalid.forEach((row, index) => {
        const tr = document.createElement('tr'); tr.className = 'import-invalid-row';
        [(row._sourceRow || index + 1), toEnglishDigits(row[0] ?? ''), normalizeArabicLetters(row[1] ?? ''), toEnglishDigits(row[2] ?? ''), getRowError(row)].forEach(value => {
          const td = document.createElement('td'); td.textContent = String(value); tr.append(td);
        });
        tbody.append(tr);
      });
      wrapper.append(table); importErrorDetails.append(wrapper);
      enableTableSorting(table, { defaultColumn: 0, defaultDirection: 'asc' });
      if (typeof importErrorDialog.showModal === 'function') importErrorDialog.showModal();
      else window.alert(invalid.map(row => 'ردیف ' + (row._sourceRow || '?') + ': ' + getRowError(row)).join('\n'));
    }
    /**
     * هدف: بستن پنجره خطاهای ورود.
     * ورودی: پارامتر ندارد.
     * خروجی: پنجره بسته می‌شود.
     */
    function closeImportErrorDialog() {
      if (importErrorDialog.open) importErrorDialog.close();
    }
    // رویداد «کلیک» برای دکمه بستن پنجره خطاهای ورود؛ اجرای رفتار متناسب با این کنترل و رویداد.
    document.getElementById('import-error-close').addEventListener('click', closeImportErrorDialog);
    // رویداد «کلیک» برای دکمه تأیید پنجره خطاهای ورود؛ اجرای رفتار متناسب با این کنترل و رویداد.
    document.getElementById('import-error-ok').addEventListener('click', closeImportErrorDialog);

    /**
     * هدف: نمایش کدهای تکراری در ورودی/موجودی جاری و آماده‌سازی تصمیم کاربر.
     * ورودی: duplicateGroups: تکرار در ورودی؛ existingDuplicates: کدهای موجود.
     * خروجی: پنجره تکراری‌ها ساخته می‌شود.
     */
    function showDuplicateError(duplicateGroups, existingDuplicates = []) {
      if (!duplicateGroups.length && !existingDuplicates.length) return;
      duplicateDialogDetails.replaceChildren();
      const summary = document.createElement('p');
      summary.textContent = 'پیش از ثبت، ' + toEnglishDigits(duplicateGroups.length) +
        ' کد تکراری در داده‌های ورودی و ' + toEnglishDigits(existingDuplicates.length) +
        ' کد موجود در انبار شناسایی شد. تا زمانی که «تأیید و ادامه ورود» را نزنید، هیچ موجودی یا اطلاعاتی تغییر نمی‌کند.';
      duplicateDialogDetails.append(summary);
      duplicateGroups.forEach(group => {
        const section = document.createElement('section'); section.className = 'duplicate-group';
        const heading = document.createElement('h4');
        heading.textContent = 'کد تدارکاتی: ' + group[0].code + ' — تعداد تکرار: ' + toEnglishDigits(group.length);
        section.append(heading);
        const wrapper = document.createElement('div'); wrapper.className = 'preview-table-wrap';
        const { table, tbody } = createDataTable(['ردیف فایل', 'کد تدارکاتی', 'شرح کالا', 'موجودی'], 'duplicate-group-table');
        group.forEach(entry => {
          const tr = document.createElement('tr');
          [toEnglishDigits(entry.rowNumber), entry.code, entry.description, toEnglishDigits(entry.stock)].forEach(value => {
            const td = document.createElement('td'); td.textContent = String(value); tr.append(td);
          });
          tbody.append(tr);
        });
        wrapper.append(table); section.append(wrapper); duplicateDialogDetails.append(section);
        enableTableSorting(table, { defaultColumn: 0, defaultDirection: 'asc' });
      });
      if (existingDuplicates.length) {
        const section = document.createElement('section');
        section.className = 'duplicate-group';
        const heading = document.createElement('h4');
        heading.textContent = 'مقایسه موجودی فعلی با اطلاعات ورودی';
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-table-wrap bulk-preview-scroll';
        const { table, tbody } = createDataTable(
          ['کد تدارکاتی', 'شرح فعلی کالا', 'موجودی فعلی', 'شرح ورودی', 'موجودی پیشنهادی'],
          'inventory-discrepancy-table'
        );
        existingDuplicates.forEach(entry => {
          const tr = document.createElement('tr');
          [
            entry.code,
            entry.existing.description,
            toEnglishDigits(entry.existing.stock),
            entry.incoming.description,
            toEnglishDigits(entry.incoming.stock)
          ].forEach(value => {
            const td = document.createElement('td');
            td.textContent = String(value ?? '');
            tr.append(td);
          });
          tbody.append(tr);
        });
        wrapper.append(table);
        section.append(heading, wrapper);
        duplicateDialogDetails.append(section);
        enableTableSorting(table, { defaultColumn: 0, defaultDirection: 'asc' });
      }
      if (typeof duplicateDialog.showModal === 'function') duplicateDialog.showModal();
      else alert(duplicateGroups.map(group =>
        'کد تدارکاتی ' + group[0].code + ': ' +
        group.map(entry => 'ردیف ' + entry.rowNumber + '، ' + entry.description + '، موجودی ' + entry.stock).join(' / ')
      ).join('\n'));
    }

    /**
     * هدف: بستن پنجره تکراری‌ها و پاک‌کردن وضعیت تأیید معلق در مسیر مربوط.
     * ورودی: پارامتر ندارد.
     * خروجی: پنجره بسته می‌شود.
     */
    function closeDuplicateDialog() {
      if (duplicateDialog.open) duplicateDialog.close();
    }

    // رویداد «کلیک» برای دکمه بستن پنجره تکراری‌ها؛ اجرای رفتار متناسب با این کنترل و رویداد.
    document.getElementById('duplicate-dialog-x').addEventListener('click', closeDuplicateDialog);
    let pendingImportConfirmation = null;
    // رویداد «کلیک» برای دکمه انصراف از ورود تکراری‌ها؛ اجرای رفتار متناسب با این کنترل و رویداد.
    document.getElementById('duplicate-import-cancel').addEventListener('click', () => {
      pendingImportConfirmation = null;
      closeDuplicateDialog();
      inputFeedback.textContent = 'ورود لغو شد؛ اطلاعات انبار تغییری نکرد.';
    });
    // رویداد «کلیک» برای دکمه ادامه ورود پس از بررسی تکراری‌ها؛ اجرای رفتار متناسب با این کنترل و رویداد.
    document.getElementById('duplicate-import-confirm').addEventListener('click', () => {
      const confirm = pendingImportConfirmation;
      pendingImportConfirmation = null;
      closeDuplicateDialog();
      if (confirm) confirm();
    });
    // رویداد «کلیک» برای عنصر رابط کاربری؛ اجرای رفتار متناسب با این کنترل و رویداد.
    duplicateDialog.addEventListener('click', event => {
      if (event.target === duplicateDialog) closeDuplicateDialog();
    });

    /**
     * هدف: ثبت داده معتبر و به‌روزرسانی کالاهای موجود؛ تاریخچه فقط پس از ذخیره موفق ثبت می‌شود.
     * ورودی: rows: ردیف‌های ورودی.
     * خروجی: نتیجه شامل شمار افزوده/به‌روزرسانی/ردشده و saved.
     */
    function addOrUpdateItems(rows) {
      let added = 0;
      let updated = 0;
      let skipped = 0;
      const incomingItems = new Map();
      const previousItems = inventoryItems.map(item => ({ ...item }));
      const previousInventoryStorage = localStorage.getItem(STORAGE_KEY);
      const entryTimestamp = new Date().toISOString();

      rows.forEach(row => {
        if (!Array.isArray(row) || row.every(value => String(value ?? '').trim() === '')) return;

        const item = normalizeRow(row);
        if (!item) {
          skipped += 1;
          return;
        }

        incomingItems.set(item.code, item);
        const existing = inventoryItems.find(current => current.code === item.code);
        if (existing) {
          existing.description = item.description;
          existing.stock = item.stock;
          if (item.category) existing.category = item.category;
          // به‌روزرسانی مقدار انبار، آستانه‌ای را که کاربر قبلاً برای این کد تعیین کرده پاک نمی‌کند.
          if (!Number.isFinite(Number(existing.minimumStock)) || Number(existing.minimumStock) < 0) existing.minimumStock = 0;
          const pendingQuantity = existing.sendQuantity === '' || existing.sendQuantity === null || existing.sendQuantity === undefined
            ? NaN
            : normalizeStock(existing.sendQuantity);
          if (!Number.isFinite(pendingQuantity) || pendingQuantity <= 0 || pendingQuantity > item.stock) {
            existing.sendQuantity = '';
          }
          existing.entryTimestamp = entryTimestamp;
          updated += 1;
        } else {
          inventoryItems.push({ ...item, id: 'item-' + dataQualityKey(item.code), category: item.category || '', minimumStock: 0, sendQuantity: '', entryTimestamp });
          added += 1;
        }
      });

      if (!incomingItems.size) {
        renderInventory();
        return { added, updated, skipped, saved: true };
      }

      if (!saveInventory()) {
        inventoryItems.splice(0, inventoryItems.length, ...previousItems);
        renderInventory();
        return { added: 0, updated: 0, skipped, saved: false };
      }

      renderInventory();
      if (!recordIncomingEntry([...incomingItems.values()])) {
        inventoryItems.splice(0, inventoryItems.length, ...previousItems);
        const rollbackSucceeded = restoreLocalStorageValue(STORAGE_KEY, previousInventoryStorage);
        renderInventory();
        return { added: 0, updated: 0, skipped, saved: false, rollbackFailed: !rollbackSucceeded };
      }
      return { added, updated, skipped, saved: true };
    }

    /**
     * هدف: نمایش نتیجه ورود و تفکیک خطای ذخیره از ثبت موفق.
     * ورودی: result: نتیجه پردازش؛ target: عنصر پیام.
     * خروجی: متن نتیجه در رابط نمایش داده می‌شود.
     */
    function showImportResult(result, target) {
      if (result.saved === false) {
        target.textContent = result.rollbackFailed
          ? 'ثبت تاریخچه ورود ناموفق بود و بازگردانی موجودی نیز کامل نشد؛ پیش از ادامه، موجودی و فایل بکاپ را بررسی کنید.'
          : 'ذخیره‌سازی ناموفق بود؛ هیچ تغییری ثبت نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید و دوباره تلاش کنید.';
        return;
      }

      const messages = [];
      if (result.added) messages.push(result.added + ' کالا اضافه شد');
      if (result.updated) messages.push(result.updated + ' کالای دارای کد تکراری به‌روزرسانی شد');
      if (result.skipped) messages.push(result.skipped + ' ردیف نامعتبر نادیده گرفته شد');

      target.textContent = messages.length
        ? messages.join('؛ ') + '.'
        : 'داده معتبر جدیدی برای افزودن پیدا نشد.';
    }

    /**
     * هدف: هماهنگ‌کردن انتخاب همه، شمار انتخاب‌ها و وضعیت دکمه‌های عملیات دسته‌جمعی.
     * ورودی: پارامتر ندارد.
     * خروجی: کنترل‌های انتخاب به‌روزرسانی می‌شوند.
     */
    function updateSelectionControls() {
      const visibleCheckboxes = [...inventoryGrid.querySelectorAll('.item-select-checkbox')];
      const selectedCount = selectedItemCodes.size;
      const visibleSelectedCount = visibleCheckboxes.filter(checkbox => checkbox.checked).length;

      selectAllItems.checked = visibleCheckboxes.length > 0 && visibleSelectedCount === visibleCheckboxes.length;
      selectAllItems.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < visibleCheckboxes.length;
      selectAllItems.disabled = inventoryItems.length === 0;
      deleteSelectedItemsButton.disabled = selectedCount === 0;
      deleteSelectedItemsButton.textContent = 'حذف انتخاب‌شده‌ها (' + toEnglishDigits(selectedCount) + ')';
    }

    // رویداد «تغییر» برای عنصر رابط کاربری؛ به‌روزرسانی داده‌ها و رابط پس از تغییر انتخاب.
    selectAllItems.addEventListener('change', () => {
      if (selectAllItems.checked) {
        inventoryItems.forEach(item => selectedItemCodes.add(item.code));
      } else {
        selectedItemCodes.clear();
      }
      renderInventory();
    });

    // رویداد «کلیک» برای عنصر رابط کاربری؛ اجرای رفتار متناسب با این کنترل و رویداد.
    deleteSelectedItemsButton.addEventListener('click', () => {
      const codesToDelete = new Set(selectedItemCodes);
      if (!codesToDelete.size) {
        inventoryFeedback.textContent = 'ابتدا یک یا چند کالا را انتخاب کنید.';
        return;
      }

      const confirmed = window.confirm(
        'آیا از حذف ' + toEnglishDigits(codesToDelete.size) +
        ' کالای انتخاب‌شده مطمئن هستید؟ این عمل قابل بازگشت نیست.'
      );
      if (!confirmed) return;

      const removedItems = inventoryItems.filter(item => codesToDelete.has(item.code));
      const previousItems = inventoryItems.map(item => ({ ...item }));
      const beforeCount = inventoryItems.length;

      for (let index = inventoryItems.length - 1; index >= 0; index -= 1) {
        if (codesToDelete.has(inventoryItems[index].code)) inventoryItems.splice(index, 1);
      }

      if (!saveInventory()) {
        inventoryItems.splice(0, inventoryItems.length, ...previousItems);
        renderInventory();
        inventoryFeedback.textContent = 'ذخیره‌سازی ناموفق بود؛ کالاها حذف نشدند. فضای ذخیره‌سازی مرورگر را بررسی کنید.';
        return;
      }

      selectedItemCodes.clear();
      recordActivity('حذف کالاهای انتخاب‌شده',
        'تعداد حذف‌شده: ' + toEnglishDigits(beforeCount - inventoryItems.length) +
        '؛ اقلام: ' + removedItems.map(item => item.code + ' (' + item.description + ')؛ موجودی: ' + toEnglishDigits(item.stock)).join('؛ '));
      renderInventory();
      inventoryFeedback.textContent = toEnglishDigits(beforeCount - inventoryItems.length) + ' کالای انتخاب‌شده حذف شد.';
    });

    /**
     * هدف: نرمال‌سازی نام محل برای مقایسه با درنظرگرفتن فاصله و رقم‌ها.
     * ورودی: value: نام محل.
     * خروجی: کلید متنی نرمال‌شده.
     */
    function normLocation(value) {
      return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa');
    }

    /**
     * هدف: خواندن فهرست محل‌ها و زیرمجموعه‌های ذخیره‌شده.
     * ورودی: پارامتر ندارد.
     * خروجی: آرایه محل‌های قابل استفاده.
     */
    function loadShipmentLocations() {
      try {
        const stored = JSON.parse(localStorage.getItem(LOCATION_KEY) || '[]');
        return Array.isArray(stored)
          ? stored.filter(item => item && item.name).map(item => ({
              name: String(item.name),
              sublocations: Array.isArray(item.sublocations) ? item.sublocations.map(String) : []
            }))
          : [];
      } catch (error) {
        return [];
      }
    }

    /**
     * هدف: ذخیره محل‌ها و زیرمجموعه‌های ارسال.
     * ورودی: locations: فهرست جدید محل‌ها.
     * خروجی: true در موفقیت یا false در شکست.
     */
    function saveShipmentLocations(locations) {
      const preservesLocationRecord = location =>
        Boolean(location && typeof location === 'object' && !Array.isArray(location) &&
          typeof location.name === 'string' && location.name.trim()) &&
        (location.sublocations === undefined ||
          (Array.isArray(location.sublocations) &&
           location.sublocations.every(value => typeof value === 'string'))) &&
        Object.keys(location).every(key => key === 'name' || key === 'sublocations');
      if (!canSafelyRewriteStoredArray(LOCATION_KEY, 'محل‌های ارسال', shipmentFeedback, preservesLocationRecord)) {
        return false;
      }
      try {
        localStorage.setItem(LOCATION_KEY, JSON.stringify(locations));
        renderDataQualityReport();
        return true;
      } catch (error) {
        return false;
      }
    }

    /**
     * هدف: ساخت پیشنهادهای محل ارسال در datalist.
     * ورودی: پارامتر ندارد.
     * خروجی: پیشنهادهای فیلد محل به‌روزرسانی می‌شوند.
     */
    function renderShipmentLocationOptions() {
      const list = document.getElementById('shipment-location-options');
      list.replaceChildren();
      loadShipmentLocations().forEach(location => {
        const option = document.createElement('option');
        option.value = location.name;
        list.append(option);
      });
      updateShipmentSublocations();
    }

    /**
     * هدف: فیلتر پیشنهادهای زیرمجموعه براساس محل انتخاب‌شده.
     * ورودی: پارامتر ندارد؛ مقدار فیلد محل خوانده می‌شود.
     * خروجی: پیشنهادهای زیرمجموعه به‌روزرسانی می‌شوند.
     */
    function updateShipmentSublocations() {
      const selectedLocation = loadShipmentLocations().find(item =>
        normLocation(item.name) === normLocation(shipmentLocationInput.value)
      );
      const list = document.getElementById('shipment-sublocation-options');
      list.replaceChildren();
      (selectedLocation ? selectedLocation.sublocations : []).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        list.append(option);
      });
      // ورودی زیرمجموعه همیشه قابل استفاده است؛ فهرست ذخیره‌شده فقط پیشنهادها را فراهم می‌کند.
      shipmentSublocationGroup.hidden = false;
    }

    /**
     * هدف: نمایش فهرست محل‌ها و ساخت کنترل حذف برای هر محل.
     * ورودی: پارامتر ندارد.
     * خروجی: بخش مدیریت محل‌ها بازسازی می‌شود.
     */
    function renderLocationManager() {
      const root = document.getElementById('location-manager-list');
      if (!root) return;
      root.replaceChildren();

      const locations = loadShipmentLocations();
      if (!locations.length) {
        const empty = document.createElement('p');
        empty.className = 'location-list-empty';
        empty.textContent = 'هنوز محل ارسالی ذخیره نشده است.';
        root.append(empty);
        return;
      }

      locations.forEach(location => {
        const row = document.createElement('article');
        row.className = 'location-record';

        const details = document.createElement('div');
        details.className = 'location-record-details';
        const title = document.createElement('h6');
        title.textContent = location.name;
        const sublocations = document.createElement('p');
        sublocations.textContent = 'زیرمجموعه‌ها: ' + (location.sublocations.join('، ') || 'ندارد');
        details.append(title, sublocations);

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'action-button secondary location-edit-button';
        editButton.textContent = 'ویرایش';
        editButton.setAttribute('aria-label', 'ویرایش محل ' + location.name);
        editButton.addEventListener('click', () => {
          const nextName = window.prompt('نام محل ارسال:', location.name);
          if (nextName === null) return;
          const cleanName = nextName.trim();
          if (!cleanName) { window.alert('نام محل نمی‌تواند خالی باشد.'); return; }
          const nextSubsText = window.prompt('زیرمجموعه‌ها را با ویرگول جدا کنید:', location.sublocations.join('، '));
          if (nextSubsText === null) return;
          const nextSubs = [...new Set(nextSubsText.split(/[,،]/).map(value => value.trim()).filter(Boolean))];
          const currentLocations = loadShipmentLocations();
          if (currentLocations.some(item => normLocation(item.name) !== normLocation(location.name) && normLocation(item.name) === normLocation(cleanName))) {
            window.alert('محل دیگری با این نام وجود دارد.'); return;
          }
          const updated = currentLocations.map(item => normLocation(item.name) === normLocation(location.name) ? { name: cleanName, sublocations: nextSubs } : item);
          if (!saveShipmentLocations(updated)) { document.getElementById('location-manager-feedback').textContent = 'ویرایش ذخیره نشد؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.'; return; }
          recordActivity('ویرایش محل ارسال', { 'نام قبلی': location.name, 'نام جدید': cleanName, 'زیرمجموعه‌ها': nextSubs.join('، ') || 'ندارد' });
          document.getElementById('location-manager-feedback').textContent = 'اطلاعات محل ارسال به‌روزرسانی شد.';
          renderLocationManager(); renderShipmentLocationOptions();

        });

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'action-button secondary location-delete-button';
        removeButton.textContent = 'حذف محل';
        removeButton.setAttribute('aria-label', 'حذف محل ' + location.name);
        // رویداد «کلیک» برای دکمه حذف محل ذخیره‌شده؛ انجام حذف پس از بررسی و تأیید لازم.
        removeButton.addEventListener('click', () => {
          if (!window.confirm('محل «' + location.name + '» و زیرمجموعه‌های آن از فهرست محل‌های ذخیره‌شده حذف شود؟ سوابق ارسال قبلی حذف نمی‌شوند.')) return;
          const remainingLocations = loadShipmentLocations().filter(item =>
            normLocation(item.name) !== normLocation(location.name)
          );
          if (!saveShipmentLocations(remainingLocations)) {
            document.getElementById('location-manager-feedback').textContent =
              'حذف محل انجام نشد؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.';
            return;
          }
          recordActivity('حذف محل ارسال', {
            'محل حذف‌شده': location.name, 'زیرمجموعه‌ها': location.sublocations.join('، ') || 'ندارد',
            'سوابق ارسال قبلی': 'حفظ شدند'
          });
          document.getElementById('location-manager-feedback').textContent = 'محل انتخاب‌شده حذف شد.';
          renderLocationManager();
          renderShipmentLocationOptions();

        });

        row.append(details, editButton, removeButton);
        root.append(row);
      });
    }

    // رویداد «ارسال فرم» برای فرم ثبت محل ارسال؛ اعتبارسنجی و مدیریت ارسال فرم در برنامه.
    document.getElementById('location-create-form').addEventListener('submit', event => {
      event.preventDefault();

      const name = document.getElementById('new-location-name').value.trim();
      const sublocations = [...new Set(document.getElementById('new-location-subs').value.split(',').map(value => value.trim()).filter(Boolean))];
      const locations = loadShipmentLocations();
      const feedback = document.getElementById('location-manager-feedback');

      if (!name) {
        feedback.textContent = 'نام محل الزامی است.';
        return;
      }
      if (locations.some(item => normLocation(item.name) === normLocation(name))) {
        feedback.textContent = 'این محل قبلاً ثبت شده است. برای افزودن زیرمجموعه، محل را هنگام ارسال انتخاب کنید.';
        return;
      }

      locations.push({ name, sublocations });
      if (!saveShipmentLocations(locations)) {
        feedback.textContent = 'ذخیره محل انجام نشد؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.';
        return;
      }

      recordActivity('ثبت محل ارسال', {
        'نام محل': name, 'زیرمجموعه‌ها': sublocations.join('، ') || 'ندارد', 'منبع ثبت': 'مدیریت محل‌ها'
      });
      event.target.reset();
      feedback.textContent = 'محل ارسال ذخیره شد و در ارسال‌های بعدی قابل انتخاب است.';
      renderLocationManager();
      renderShipmentLocationOptions();

    });

    renderLocationManager();
    // رویداد «تغییر مقدار ورودی» برای فیلد محل ارسال؛ همگام‌سازی پیش‌نمایش یا وضعیت رابط با مقدار جاری.
    shipmentLocationInput.addEventListener('input',updateShipmentSublocations);shipmentLocationInput.addEventListener('change',updateShipmentSublocations);renderShipmentLocationOptions();
    // رویداد «کلیک» برای عنصر رابط کاربری؛ اجرای رفتار متناسب با این کنترل و رویداد.
    openShipmentDialogButton.addEventListener('click', openShipmentDialog);
    // رویداد «ارسال فرم» برای عنصر رابط کاربری؛ اعتبارسنجی و مدیریت ارسال فرم در برنامه.
    shipmentForm.addEventListener('submit', commitShipment);
    // رویداد «کلیک» برای دکمه بستن پنجره ارسال؛ اجرای رفتار متناسب با این کنترل و رویداد.
    document.getElementById('shipment-dialog-x').addEventListener('click', closeShipmentDialog);
    // رویداد «کلیک» برای دکمه انصراف از ارسال؛ اجرای رفتار متناسب با این کنترل و رویداد.
    document.getElementById('shipment-cancel').addEventListener('click', closeShipmentDialog);

    /**
     * هدف: ساخت جدول موجودی، فیلتر جست‌وجو، مرتب‌سازی، انتخاب کالا و ورودی مقدار ارسال.
     * ورودی: پارامتر ندارد؛ وضعیت جست‌وجو و مرتب‌سازی جاری خوانده می‌شود.
     * خروجی: جدول و کنترل‌های موجودی به‌روزرسانی می‌شوند.
     */
    function isLowStockItem(item) {
      const stock = Number(item && item.stock);
      const minimum = Number(item && item.minimumStock);
      return Number.isFinite(stock) && Number.isFinite(minimum) && minimum > 0 && stock <= minimum;
    }

    /**
     * هدف: ایجاد کنترل‌های فیلتر و ستون حداقل موجودی در همان جدول موجود، بدون وابستگی به HTML جداگانه.
     * ورودی: پارامتر ندارد.
     * خروجی: کنترل‌های فیلتر و حداقل موجودی در صورت نیاز به DOM افزوده می‌شوند.
     */
    function ensureInventoryManagementControls() {
      const headerRow = inventoryGrid.closest('table')?.querySelector('thead tr');
      if (headerRow && !headerRow.querySelector('[data-inventory-sort="category"]')) {
        const heading = document.createElement('th');
        heading.scope = 'col';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'inventory-sort-button';
        button.dataset.inventorySort = 'category';
        button.innerHTML = 'گروه کالا <span class="inventory-sort-marker" aria-hidden="true">↕</span>';
        button.addEventListener('click', () => {
          inventorySort = inventorySort.key === 'category'
            ? { key: 'category', direction: inventorySort.direction === 'asc' ? 'desc' : 'asc' }
            : { key: 'category', direction: 'asc' };
          renderInventory();
        });
        heading.append(button);
        const descriptionHeading = headerRow.querySelector('[data-inventory-sort="description"]')?.closest('th');
        if (descriptionHeading && descriptionHeading.nextSibling) headerRow.insertBefore(heading, descriptionHeading.nextSibling);
        else headerRow.append(heading);
      }

      if (headerRow && !headerRow.querySelector('[data-inventory-sort="minimumStock"]')) {
        const heading = document.createElement('th');
        heading.scope = 'col';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'inventory-sort-button';
        button.dataset.inventorySort = 'minimumStock';
        button.innerHTML = 'حداقل موجودی <span class="inventory-sort-marker" aria-hidden="true">↕</span>';
        button.addEventListener('click', () => {
          inventorySort = inventorySort.key === 'minimumStock'
            ? { key: 'minimumStock', direction: inventorySort.direction === 'asc' ? 'desc' : 'asc' }
            : { key: 'minimumStock', direction: 'asc' };
          renderInventory();
        });
        heading.append(button);
        const stockHeading = headerRow.querySelector('[data-inventory-sort="stock"]')?.closest('th');
        if (stockHeading && stockHeading.nextSibling) headerRow.insertBefore(heading, stockHeading.nextSibling);
        else headerRow.append(heading);
      }
    }

    function renderInventory() {
      ensureInventoryManagementControls();
      const { key, direction } = inventorySort;
      const multiplier = direction === 'desc' ? -1 : 1;
      const searchTerm = toEnglishDigits(inventorySearchInput.value).trim().toLocaleLowerCase('fa');

      const sortedItems = [...inventoryItems].sort((first, second) => {
        if (key === 'entryDate') {
          const firstDate = first.entryTimestamp ? Date.parse(first.entryTimestamp) : NaN;
          const secondDate = second.entryTimestamp ? Date.parse(second.entryTimestamp) : NaN;
          const firstMissing = !Number.isFinite(firstDate);
          const secondMissing = !Number.isFinite(secondDate);
          if (firstMissing !== secondMissing) return firstMissing ? 1 : -1;
          if (firstMissing && secondMissing) return String(first.code).localeCompare(String(second.code), 'fa', { numeric: true });
          return (firstDate - secondDate) * multiplier;
        }

        const a = first[key] ?? '';
        const b = second[key] ?? '';
        let comparison;
        if (key === 'stock' || key === 'minimumStock' || key === 'sendQuantity') {
          comparison = (Number(a) || 0) - (Number(b) || 0);
        } else {
          comparison = String(a).localeCompare(String(b), 'fa', {
            numeric: true,
            sensitivity: 'base'
          });
        }
        return comparison * multiplier;
      });

      const filteredItems = sortedItems.filter(item => {
        if (!searchTerm) return true;
        const searchable = toEnglishDigits([
          item.code, item.description, item.category, item.stock, item.minimumStock, item.sendQuantity,
          item.entryTimestamp ? solarDateTime(new Date(item.entryTimestamp)).date : ''
        ].join(' ')).toLocaleLowerCase('fa');
        return searchable.includes(searchTerm);
      });

      inventoryGrid.replaceChildren();
      const lowStockCount = inventoryItems.filter(isLowStockItem).length;
      inventoryCount.textContent = 'تعداد کالاها: ' + toEnglishDigits(inventoryItems.length) +
        '؛ هشدار کمبود: ' + toEnglishDigits(lowStockCount) +
        (searchTerm ? '؛ نتیجه جست‌وجو: ' + toEnglishDigits(filteredItems.length) : '');
      inventoryEmpty.hidden = filteredItems.length > 0;
      if (inventoryItems.length && !filteredItems.length) {
        inventoryEmpty.textContent = 'کالایی با عبارت جست‌وجوشده پیدا نشد؛ عبارت را تغییر دهید یا پاک کنید.';
      } else {
        inventoryEmpty.textContent = 'هنوز کالایی وارد نشده است. ابتدا از سکشن «ورودی کالاها» کالا اضافه کنید.';
      }

      filteredItems.forEach(item => {
        const row = document.createElement('tr');

        const selectionCell = document.createElement('td');
        selectionCell.className = 'inventory-selection-cell';
        const selectionCheckbox = document.createElement('input');
        selectionCheckbox.type = 'checkbox';
        selectionCheckbox.className = 'item-select-checkbox';
        selectionCheckbox.checked = selectedItemCodes.has(item.code);
        selectionCheckbox.setAttribute('aria-label', 'انتخاب کالا با کد تدارکاتی ' + item.code);
        // رویداد «تغییر» برای چک‌باکس انتخاب قلم کالا؛ به‌روزرسانی داده‌ها و رابط پس از تغییر انتخاب.
        selectionCheckbox.addEventListener('change', () => {
          if (selectionCheckbox.checked) selectedItemCodes.add(item.code);
          else selectedItemCodes.delete(item.code);
          updateSelectionControls();
        });
        selectionCell.append(selectionCheckbox);

        const codeCell = document.createElement('td');
        codeCell.className = 'inventory-code-cell';
        codeCell.textContent = item.code;

        const descriptionCell = document.createElement('td');
        descriptionCell.className = 'inventory-description-cell';
        descriptionCell.textContent = item.description;
        descriptionCell.title = item.description;

        const categoryCell = document.createElement('td');
        categoryCell.className = 'inventory-category-cell';
        const categoryInput = document.createElement('input');
        categoryInput.type = 'text';
        categoryInput.maxLength = 80;
        categoryInput.className = 'inventory-category-input';
        categoryInput.value = typeof item.category === 'string' ? item.category : '';
        categoryInput.setAttribute('aria-label', 'گروه کالا برای کد ' + item.code);
        categoryInput.addEventListener('change', () => {
          const previousCategory = typeof item.category === 'string' ? item.category : '';
          item.category = normalizeArabicLetters(categoryInput.value).trim().slice(0, 80);
          if (!saveInventory()) {
            item.category = previousCategory;
            categoryInput.value = previousCategory;
            return;
          }
          inventoryFeedback.textContent = item.category
            ? 'گروه کالای ' + item.code + ' ذخیره شد؛ در گزارش ارسال‌های بعدی ثبت می‌شود.'
            : 'گروه کالای ' + item.code + ' پاک شد.';
          renderInventory();
        });
        categoryCell.append(categoryInput);

        const stockCell = document.createElement('td');
        stockCell.className = 'inventory-quantity-cell';
        stockCell.textContent = toEnglishDigits(item.stock);

        const minimumStockCell = document.createElement('td');
        minimumStockCell.className = 'inventory-minimum-stock-cell';
        const minimumStockInput = document.createElement('input');
        minimumStockInput.type = 'number';
        minimumStockInput.min = '0';
        minimumStockInput.step = 'any';
        minimumStockInput.inputMode = 'decimal';
        minimumStockInput.className = 'inventory-minimum-stock-input';
        minimumStockInput.value = String(Number(item.minimumStock) || 0);
        minimumStockInput.setAttribute('aria-label', 'حداقل موجودی کالا با کد ' + item.code);
        minimumStockInput.title = 'موجودی برابر یا کمتر از این مقدار، هشدار کمبود ایجاد می‌کند؛ صفر یعنی آستانه اختصاصی تنظیم نشده است.';
        minimumStockInput.addEventListener('change', () => {
          const rawValue = minimumStockInput.value.trim();
          const nextMinimum = rawValue === '' ? 0 : normalizeStock(rawValue);
          if (!Number.isFinite(nextMinimum) || nextMinimum < 0) {
            minimumStockInput.value = String(Number(item.minimumStock) || 0);
            inventoryFeedback.textContent = 'حداقل موجودی باید عددی معتبر و بزرگ‌تر یا مساوی صفر باشد.';
            minimumStockInput.focus();
            return;
          }
          const previousMinimum = Number(item.minimumStock) || 0;
          item.minimumStock = nextMinimum;
          if (!saveInventory()) {
            item.minimumStock = previousMinimum;
            minimumStockInput.value = String(previousMinimum);
            return;
          }
          inventoryFeedback.textContent = 'حداقل موجودی ذخیره شد؛ هشدار کمبود برای کد ' + item.code + ' به‌روز شد.';
          renderInventory();
        });
        minimumStockCell.append(minimumStockInput);
        if (isLowStockItem(item)) {
          stockCell.classList.add('inventory-low-stock-cell');
          const badge = document.createElement('span');
          badge.className = 'inventory-low-stock-badge';
          badge.textContent = 'هشدار کمبود';
          badge.setAttribute('role', 'status');
          stockCell.append(document.createTextNode(' '), badge);
        }

        const sendCell = document.createElement('td');
        const sendInput = document.createElement('input');
        sendInput.className = 'send-quantity-input';
        sendInput.type = 'number';
        sendInput.min = '0';
        sendInput.step = 'any';
        sendInput.inputMode = 'decimal';
        sendInput.placeholder = '۰';
        sendInput.value = item.sendQuantity;
        sendInput.setAttribute('aria-label', 'تعداد برای ارسال کالا ' + item.code);
        // رویداد «تغییر» برای فیلد مقدار آماده‌ارسال؛ به‌روزرسانی داده‌ها و رابط پس از تغییر انتخاب.
        sendInput.addEventListener('change', () => {
          const value = sendInput.value.trim();
          const numericValue = value === '' ? '' : normalizeStock(value);
          if (numericValue !== '' && (!Number.isFinite(numericValue) || numericValue < 0)) {
            sendInput.value = item.sendQuantity;
            inventoryFeedback.textContent = 'تعداد برای ارسال باید عددی بزرگ‌تر یا مساوی صفر باشد.';
            return;
          }
          const previousQuantity = item.sendQuantity;
          // صفر معادل «مقدار آماده‌ارسال خالی» است؛ ذخیره آن را یکسان‌سازی کن تا با بارگذاری بعدی تعارض نداشته باشد.
          item.sendQuantity = numericValue === 0 ? '' : numericValue;
          if (!saveInventory()) {
            item.sendQuantity = previousQuantity;
            sendInput.value = previousQuantity === '' ? '' : String(previousQuantity);
            return;
          }
          inventoryFeedback.textContent = '';
          renderDataQualityReport();
          if (inventorySort.key === 'sendQuantity') renderInventory();
        });
        sendCell.append(sendInput);

        const entryDateCell = document.createElement('td');
        entryDateCell.className = 'inventory-date-cell date-time-cell';
        if (item.entryTimestamp && Number.isFinite(Date.parse(item.entryTimestamp))) {
          const dateTime = solarDateTime(new Date(item.entryTimestamp));
          const dateText = document.createElement('span');
          dateText.className = 'date-part';
          dateText.textContent = dateTime.date;
          const timeText = document.createElement('span');
          timeText.className = 'time-part';
          timeText.textContent = dateTime.time;
          entryDateCell.append(dateText, timeText);
          entryDateCell.dataset.sortValue = item.entryTimestamp;
        } else {
          entryDateCell.textContent = 'نامشخص';
          entryDateCell.dataset.sortValue = '';
        }

        row.append(selectionCell, codeCell, descriptionCell, categoryCell, stockCell, minimumStockCell, sendCell, entryDateCell);
        inventoryGrid.append(row);
      });

      document.querySelectorAll('[data-inventory-sort]').forEach(button => {
        const active = button.dataset.inventorySort === key;
        const marker = button.querySelector('.inventory-sort-marker');
        if (marker) marker.textContent = active ? (direction === 'asc' ? '↑' : '↓') : '↕';
        const heading = button.closest('th');
        if (heading) heading.setAttribute('aria-sort', active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
        button.setAttribute('aria-label', 'مرتب‌سازی بر اساس ' + button.textContent.replace(/[↑↓↕]/g, '').trim() +
          (active ? (direction === 'asc' ? '، صعودی' : '، نزولی') : ''));
      });

      updateSelectionControls();
    }

    document.querySelectorAll('[data-inventory-sort]').forEach(button => {
      // رویداد «کلیک» برای دکمه‌های مرتب‌سازی جدول موجودی؛ تغییر ترتیب ردیف‌ها و نشانگر مرتب‌سازی.
      button.addEventListener('click', () => {
        const key = button.dataset.inventorySort;
        if (inventorySort.key === key) {
          inventorySort.direction = inventorySort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          inventorySort = { key, direction: key === 'entryDate' ? 'desc' : 'asc' };
        }
        renderInventory();
      });
    });

    // رویداد «تغییر مقدار ورودی» برای فیلد جست‌وجوی موجودی؛ همگام‌سازی پیش‌نمایش یا وضعیت رابط با مقدار جاری.
    inventorySearchInput.addEventListener('input', renderInventory);

    // رویداد «تغییر مقدار ورودی» برای فیلد کد کالا در ورود دستی؛ همگام‌سازی پیش‌نمایش یا وضعیت رابط با مقدار جاری.
    itemFormInputs.code.addEventListener('input', () => {
      const normalized = toEnglishDigits(itemFormInputs.code.value).replace(/[^0-9]/g, '').slice(0, 10);
      if (itemFormInputs.code.value !== normalized) itemFormInputs.code.value = normalized;
    });

    Object.values(itemFormInputs).forEach(input => {
      // رویداد «تغییر مقدار ورودی» برای عنصر رابط کاربری؛ همگام‌سازی پیش‌نمایش یا وضعیت رابط با مقدار جاری.
      input.addEventListener('input', () => {
        renderSinglePreview();
        singleFeedback.textContent = '';
      });
    });
    // تغییر گروه دستی هم باید پیش‌نمایش مشترک و پیش‌نمایش تکی را بدون انتظار برای تغییر فیلد دیگری تازه کند.
    manualCategoryInput.addEventListener('input', () => {
      renderSinglePreview();
      singleFeedback.textContent = '';
    });

    // رویداد «کلیک» برای دکمه بررسی/ثبت پیش‌نمایش؛ اجرای رفتار متناسب با این کنترل و رویداد.
    importPreviewButton.addEventListener('click', () => {
      const combinedRows = getCombinedPendingRows().map(item => item.row);
      if (!combinedRows.length) {
        inputFeedback.textContent = 'ابتدا اطلاعات را از یکی از روش‌ها وارد و پیش‌نمایش کنید.';
        return;
      }
      const invalidRows = combinedRows.filter(row =>
        Array.isArray(row) && row.some(value => String(value ?? '').trim() !== '') && !normalizeRow(row)
      );
      const duplicateGroups = findIncomingDuplicates(combinedRows);
      const validRows = combinedRows.filter(row => normalizeRow(row));
      if (!validRows.length) {
        inputFeedback.textContent = 'هیچ ردیف معتبری برای ثبت وجود ندارد؛ اطلاعات را اصلاح کنید.';
        return;
      }

      const uniqueRows = new Map();
      validRows.forEach(row => {
        const item = normalizeRow(row);
        uniqueRows.set(item.code, item);
      });
      const existingDuplicates = [...uniqueRows.values()]
        .map(incoming => ({ incoming, existing: inventoryItems.find(current => current.code === incoming.code) }))
        .filter(entry => entry.existing);

      const commitImport = () => {
        const result = addOrUpdateItems(validRows);
        showImportResult(result, inputFeedback);
        if (result.saved === false) return;

        if (invalidRows.length) showImportErrors(combinedRows);
        pendingExcelRows = [];
        pendingClipboardRows = [];
        itemFormInputs.code.value = '';
        itemFormInputs.description.value = '';
        itemFormInputs.stock.value = '';
        pastedDataInput.value = '';
        renderBulkPreview([], 'داده‌های کپی‌شده', bulkPreview);
        renderBulkPreview([], 'فایل اکسل', excelPreview);
        renderSinglePreview();
        renderSharedInputPreview();
        importPreviewButton.disabled = true;
      };

      if (duplicateGroups.length || existingDuplicates.length) {
        pendingImportConfirmation = commitImport;
        showDuplicateError(duplicateGroups, existingDuplicates);
        return;
      }
      commitImport();
    });

    // رویداد «تغییر مقدار ورودی» برای فیلد داده‌های کپی‌شده؛ همگام‌سازی پیش‌نمایش یا وضعیت رابط با مقدار جاری.
    pastedDataInput.addEventListener('input', () => {
      pendingClipboardRows = prepareImportRows(parseDelimitedText(pastedDataInput.value));
      inputFeedback.textContent = '';
      renderSharedInputPreview();
      importPreviewButton.disabled = !getCombinedPendingRows().some(item => normalizeRow(item.row));
    });

    // رویداد «تغییر» برای فیلد انتخاب فایل Excel یا CSV؛ به‌روزرسانی داده‌ها و رابط پس از تغییر انتخاب.
    document.getElementById('excel-file').addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      try {
        let rows;
        if (/\.csv$/i.test(file.name)) {
          rows = parseDelimitedText(await file.text());
        } else if (window.XLSX) {
          const buffer = await file.arrayBuffer();
          const workbook = window.XLSX.read(buffer, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = window.XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            raw: false,
            defval: ''
          });
        } else {
          excelFeedback.textContent = 'کتابخانه خواندن Excel بارگذاری نشد؛ اتصال اینترنت را بررسی کنید یا فایل CSV را انتخاب کنید.';
          return;
        }

        if (!rows || !rows.length) {
          pendingExcelRows = [];
          renderBulkPreview([], file.name, excelPreview);
          renderSharedInputPreview();
          confirmExcelImportButton.disabled = true;
          excelFeedback.textContent = 'در فایل انتخاب‌شده ردیفی برای نمایش پیدا نشد.';
          return;
        }
        pendingExcelRows = prepareImportRows(rows);
        renderBulkPreview(pendingExcelRows, file.name, excelPreview);
        renderSharedInputPreview();
        confirmExcelImportButton.disabled = !pendingExcelRows.some(row =>
          Array.isArray(row) && row.some(value => String(value ?? '').trim() !== '') && normalizeRow(row)
        );
        excelFeedback.textContent = 'فایل خوانده شد؛ اطلاعات را در همین باکس بررسی و سپس تأیید کنید.';
      } catch (error) {
        excelFeedback.textContent = 'خواندن فایل ممکن نشد. فایل اکسل باید معتبر باشد؛ در صورت خطا می‌توانید CSV یا کپی‌کردن داده‌ها را امتحان کنید.';
      } finally {
        event.target.value = '';
      }
    });

    renderInventory();
    renderSinglePreview();
    openSection('section-dashboard');
    setupDashboard();
  
    // بخش راه‌اندازی بکاپ؛ تا ذخیره موفق فایل اولیه، رابط اصلی قفل می‌ماند.
    const appLayout = document.getElementById('app-layout');
    const backupSetupGate = document.getElementById('backup-setup-gate');
    const backupGateChooseFolder = document.getElementById('backup-gate-choose-folder');
    const backupGateStatus = document.getElementById('backup-gate-status');
    const backupGateFeedback = document.getElementById('backup-gate-feedback');
    const backupFolderButton = document.getElementById('choose-backup-folder');
    const changeBackupFolderButton = document.getElementById('change-backup-folder');
    const backupFolderStatus = document.getElementById('backup-folder-status');
    const backupFeedback = document.getElementById('backup-feedback');
    const BACKUP_HANDLE_DB = 'anbar-backup-handle-db';
    const BACKUP_HANDLE_STORE = 'handles';
    let backupDirectoryHandle = null;
    let backupWriteTimer = null;
    let backupWriteInProgress = false;
    let backupWriteQueued = false;
    let applicationReady = false;
    // این گزینه فقط بکاپ خودکار را در همین نشست غیرفعال می‌کند؛ ذخیره عادی localStorage فعال می‌ماند.
    let automaticBackupDisabledForSession = false;

    /**
     * هدف: قفل/آزادکردن رابط اصلی براساس موفقیت راه‌اندازی بکاپ.
     * ورودی: ready: فقط پس از آماده‌شدن بکاپ باید true باشد.
     * خروجی: وضعیت inert و دروازه شروع تغییر می‌کند.
     */
    function setApplicationReady(ready) {
      applicationReady = Boolean(ready);
      appLayout.inert = !applicationReady;
      backupSetupGate.hidden = applicationReady;
      if (applicationReady) {
        backupGateFeedback.textContent = '';
        backupGateStatus.textContent = 'بکاپ اولیه ذخیره شد؛ سایت آماده استفاده است.';
      } else {
        backupGateChooseFolder.focus({ preventScroll: true });
      }
    }

    /**
     * هدف: بازکردن IndexedDB برای نگهداری مرجع پوشه بکاپ.
     * ورودی: پارامتر ندارد.
     * خروجی: Promise پایگاه داده یا خطای بازکردن.
     */
    function openBackupHandleDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(BACKUP_HANDLE_DB, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(BACKUP_HANDLE_STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    /**
     * هدف: ذخیره مرجع پوشه در IndexedDB برای استفاده در مراجعه بعدی.
     * ورودی: handle: مرجع پوشه انتخاب‌شده.
     * خروجی: Promise که پس از پایان تراکنش تمام می‌شود.
     */
    async function storeBackupDirectoryHandle(handle) {
      const db = await openBackupHandleDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(BACKUP_HANDLE_STORE, 'readwrite');
        tx.objectStore(BACKUP_HANDLE_STORE).put(handle, 'directory');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('ذخیره محل بکاپ لغو شد.'));
      });
      db.close();
    }
    /**
     * هدف: بازیابی مرجع پوشه بکاپ از IndexedDB.
     * ورودی: پارامتر ندارد.
     * خروجی: Promise شامل مرجع پوشه یا null.
     */
    async function loadBackupDirectoryHandle() {
      const db = await openBackupHandleDatabase();
      const handle = await new Promise((resolve, reject) => {
        const request = db.transaction(BACKUP_HANDLE_STORE, 'readonly').objectStore(BACKUP_HANDLE_STORE).get('directory');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return handle;
    }
    /**
     * هدف: ساخت نام فایل بکاپ براساس سال و ماه تقویم شمسی.
     * ورودی: date: زمان مبنا؛ به‌طور پیش‌فرض زمان جاری.
     * خروجی: نام فایل JSON.
     */
    function getSolarBackupFileName(date = new Date()) {
      const parts = new Intl.DateTimeFormat('en-u-ca-persian', { year: 'numeric', month: '2-digit' }).formatToParts(date);
      const year = parts.find(part => part.type === 'year')?.value;
      const month = parts.find(part => part.type === 'month')?.value;
      return 'anbar-backup-' + year + '-' + month + '.json';
    }
    /**
     * هدف: گردآوری موجودی، تاریخچه‌ها، محل‌ها و لاگ در یک شیء پشتیبان.
     * ورودی: پارامتر ندارد.
     * خروجی: شیء دارای exportedAt و آرایه‌های داده.
     */
    function readStoredSectionForBackup(key, fallback) {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    }

    function buildBackupPayload() {
      // داده خام برای بکاپ خوانده می‌شود تا رکوردی که loader پالایش می‌کند بی‌صدا از نسخه پشتیبان حذف نشود.
      return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        inventory: readStoredSectionForBackup(STORAGE_KEY, inventoryItems.map(item => ({ ...item }))),
        entryHistory: readStoredSectionForBackup(ENTRY_HISTORY_KEY, []),
        shipments: readStoredSectionForBackup(SHIPMENT_KEY, []),
        shipmentLocations: readStoredSectionForBackup(LOCATION_KEY, [])
      };
    }
    /**
     * هدف: نوشتن بکاپ JSON همراه کنترل مجوز، جلوگیری از نوشتن هم‌زمان و مدیریت شکست.
     * ورودی: directoryHandle: مرجع پوشه؛ allowPermissionPrompt: اجازه درخواست مجوز.
     * خروجی: Promise بولی؛ true فقط پس از ذخیره موفق فایل.
     */
    async function writeAutomaticBackup(directoryHandle = backupDirectoryHandle, allowPermissionPrompt = false) {
      if (!directoryHandle) return false;
      if (backupWriteInProgress) {
        backupWriteQueued = true;
        return false;
      }
      backupWriteInProgress = true;
      let succeeded = false;
      let writable = null;
      try {
        let permission = await directoryHandle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted' && allowPermissionPrompt) {
          permission = await directoryHandle.requestPermission({ mode: 'readwrite' });
        }
        if (permission !== 'granted') {
          backupFolderStatus.textContent = 'مجوز نوشتن در پوشه تأیید نشده است.';
          backupFeedback.textContent = 'برای فعال‌سازی سایت، پوشه را دوباره انتخاب کنید و دسترسی نوشتن را تأیید کنید.';
          backupGateStatus.textContent = 'دسترسی نوشتن در پوشه برقرار نیست؛ پوشه را دوباره انتخاب کنید.';
          return false;
        }
        const payload = buildBackupPayload();
        const validationErrors = validateBackupPayload(payload);
        if (validationErrors.length) {
          throw new Error('ساختار داده فعلی برای تولید بکاپ معتبر نیست: ' + validationErrors.slice(0, 4).join('؛ '));
        }
        const serializedBackup = JSON.stringify(payload, null, 2);
        const fileHandle = await directoryHandle.getFileHandle(getSolarBackupFileName(), { create: true });
        writable = await fileHandle.createWritable();
        await writable.write(new Blob([serializedBackup], { type: 'application/json;charset=utf-8' }));
        await writable.close();
        writable = null;
        succeeded = true;
        backupFolderStatus.textContent = 'بکاپ خودکار فعال است؛ فایل ' + getSolarBackupFileName() + ' در پوشه انتخاب‌شده به‌روزرسانی شد.';
        backupFeedback.textContent = 'آخرین بکاپ با موفقیت ذخیره شد.';
        backupGateStatus.textContent = 'فایل بکاپ با موفقیت ذخیره شد.';
        return true;
      } catch (error) {
        if (writable && typeof writable.abort === 'function') {
          try { await writable.abort(); } catch (abortError) { /* شکست abort نباید خطای اصلی را بپوشاند. */ }
        }
        const detail = error && error.message ? ' ' + error.message : '';
        backupFeedback.textContent = 'ذخیره خودکار انجام نشد. دسترسی پوشه و اعتبار داده‌ها را بررسی کنید.' + detail;
        backupGateFeedback.textContent = 'فایل بکاپ ساخته یا به‌روزرسانی نشد. سایت تا ذخیره موفق بکاپ قفل می‌ماند.';
        return false;
      } finally {
        backupWriteInProgress = false;
        if (backupWriteQueued) {
          backupWriteQueued = false;
          scheduleAutomaticBackup();
        }
        if (!succeeded && applicationReady && directoryHandle === backupDirectoryHandle) {
          backupGateStatus.textContent = 'ذخیره بکاپ ناموفق بود؛ برای ادامه، محل ذخیره را دوباره انتخاب کنید.';
          backupGateFeedback.textContent = 'برای جلوگیری از تغییرات بیشتر بدون بکاپ موفق، سایت قفل شد.';
          setApplicationReady(false);
        }
      }
    }
    /**
     * هدف: زمان‌بندی ذخیره بکاپ پس از تغییر داده و تجمیع تغییرهای سریع.
     * ورودی: پارامتر ندارد.
     * خروجی: زمان‌سنج بکاپ تنظیم می‌شود.
     */
    function scheduleAutomaticBackup() {
      if (!backupDirectoryHandle || !applicationReady || automaticBackupDisabledForSession) return;
      clearTimeout(backupWriteTimer);
      backupWriteTimer = setTimeout(() => {
        writeAutomaticBackup().then(saved => {
          if (!saved && applicationReady) {
            backupGateStatus.textContent = 'به‌روزرسانی بکاپ انجام نشد؛ پوشه و مجوز نوشتن را بررسی کنید.';
          }
        });
      }, 350);
    }

    /**
     * هدف: انتخاب/فعال‌سازی پوشه، بررسی مجوز و ذخیره اولین بکاپ پیش از آزادکردن رابط.
     * ورودی: forceChooseNew: اجبار به انتخاب پوشه تازه.
     * خروجی: Promise؛ رابط بر اساس نتیجه آماده یا قفل می‌شود.
     */
    /**
     * هدف: اجازه استفاده از سامانه در مرورگرهایی که انتخاب پوشه/ذخیره فایل در آن‌ها در دسترس نیست.
     * ورودی: ندارد.
     * خروجی: رابط اصلی آزاد می‌شود؛ داده‌ها در localStorage می‌مانند ولی بکاپ خودکار این نشست متوقف است.
     */
    function startWithoutAutomaticBackup() {
      automaticBackupDisabledForSession = true;
      clearTimeout(backupWriteTimer);
      setApplicationReady(true);
      backupGateStatus.textContent = 'سامانه فعال شد؛ بکاپ خودکار این نشست غیرفعال است.';
      backupFeedback.textContent = 'بکاپ خودکار غیرفعال است. اطلاعات در حافظه محلی مرورگر ذخیره می‌شوند؛ از بخش بکاپ، نسخه JSON دستی تهیه کنید.';
      recordActivity('شروع بدون بکاپ خودکار', 'کاربر سامانه را بدون فعال‌سازی ذخیره خودکار فایل بکاپ اجرا کرد.');
    }

    async function chooseBackupFolder(forceChooseNew = false) {
      if (typeof window.showDirectoryPicker !== 'function') {
        const message = 'این مرورگر انتخاب پوشه و ذخیره مستقیم فایل را پشتیبانی نمی‌کند. برای استفاده از سایت، آن را در نسخه به‌روز Chrome یا Edge روی رایانه و از طریق HTTPS باز کنید.';
        backupGateFeedback.textContent = message;
        backupFeedback.textContent = message;
        return;
      }

      let waitAttempts = 0;
      while (backupWriteInProgress && waitAttempts < 120) {
        backupGateStatus.textContent = 'در حال پایان یافتن ذخیره بکاپ جاری...';
        await new Promise(resolve => setTimeout(resolve, 100));
        waitAttempts += 1;
      }
      if (backupWriteInProgress) {
        backupFeedback.textContent = 'ذخیره قبلی هنوز در حال انجام است؛ چند لحظه دیگر دوباره تلاش کنید.';
        return;
      }

      const wasReady = applicationReady;
      const previousDirectory = backupDirectoryHandle || await loadBackupDirectoryHandle().catch(() => null);
      const previousDirectoryName = previousDirectory && previousDirectory.name ? previousDirectory.name : 'تعریف‌نشده';
      backupGateFeedback.textContent = '';
      backupFeedback.textContent = '';
      backupGateChooseFolder.disabled = true;
      if (backupFolderButton) backupFolderButton.disabled = true;
      if (changeBackupFolderButton) changeBackupFolderButton.disabled = true;

      try {
        // انتخاب پوشه جدید همیشه پنجره انتخاب پوشه را باز می‌کند.
        let selectedDirectory = forceChooseNew ? null : (backupDirectoryHandle || await loadBackupDirectoryHandle());
        if (selectedDirectory) {
          let permission = await selectedDirectory.queryPermission({ mode: 'readwrite' });
          if (permission !== 'granted') {
            backupGateStatus.textContent = 'در حال تمدید مجوز پوشه بکاپ ذخیره‌شده...';
            permission = await selectedDirectory.requestPermission({ mode: 'readwrite' });
          }
          if (permission !== 'granted') {
            backupGateFeedback.textContent = 'مجوز پوشه قبلی تأیید نشد. برای انتخاب پوشه دیگری، تأیید کنید.';
            const chooseAnother = window.confirm('مجوز پوشه بکاپ قبلی تأیید نشد. آیا می‌خواهید پوشه دیگری انتخاب کنید؟');
            if (!chooseAnother) return;
            selectedDirectory = null;
          }
        }

        if (!selectedDirectory) {
          backupGateStatus.textContent = 'در انتظار انتخاب پوشه و ذخیره اولین بکاپ...';
          selectedDirectory = await window.showDirectoryPicker({ mode: 'readwrite' });
          let permission = await selectedDirectory.queryPermission({ mode: 'readwrite' });
          if (permission !== 'granted') permission = await selectedDirectory.requestPermission({ mode: 'readwrite' });
          if (permission !== 'granted') throw new Error('مجوز نوشتن در پوشه داده نشد.');
        }

        backupGateStatus.textContent = 'پوشه آماده است؛ در حال ذخیره بکاپ...';
        const initialBackupSaved = await writeAutomaticBackup(selectedDirectory, false);
        if (!initialBackupSaved) throw new Error('ذخیره بکاپ در پوشه انتخاب‌شده ناموفق بود.');

        await storeBackupDirectoryHandle(selectedDirectory);
        backupDirectoryHandle = selectedDirectory;
        automaticBackupDisabledForSession = false;
        const selectedDirectoryName = selectedDirectory && selectedDirectory.name ? selectedDirectory.name : 'پوشه انتخاب‌شده';
        const changed = forceChooseNew || previousDirectoryName !== selectedDirectoryName;
        recordActivity(changed ? 'تغییر پوشه بکاپ' : 'فعال‌سازی پوشه بکاپ',
          'پوشه قبلی: «' + previousDirectoryName + '»؛ پوشه فعلی: «' + selectedDirectoryName + '»؛ بکاپ اولیه ذخیره شد.');
        const finalBackupSaved = await writeAutomaticBackup(selectedDirectory, false);
        if (!finalBackupSaved) throw new Error('ذخیره نهایی بکاپ ناموفق بود.');
        setApplicationReady(true);
      } catch (error) {
        if (error && error.name === 'AbortError') {
          backupGateStatus.textContent = wasReady
            ? 'عملیات لغو شد؛ محل ذخیره قبلی بدون تغییر باقی ماند.'
            : 'برای شروع سایت، یک پوشه بکاپ معتبر لازم است.';
        } else {
          backupGateFeedback.textContent = 'فعال‌سازی انجام نشد: ' + (error && error.message ? error.message : 'خطای ناشناخته') + '؛ مجوز پوشه را بررسی کنید.';
          backupGateStatus.textContent = 'بکاپ موفق ثبت نشده است.';
          backupFeedback.textContent = backupGateFeedback.textContent;
        }
        if (wasReady) {
          const previousBackupSaved = backupDirectoryHandle
            ? await writeAutomaticBackup(backupDirectoryHandle, false)
            : false;
          setApplicationReady(previousBackupSaved);
        }
      } finally {
        backupGateChooseFolder.disabled = false;
        if (backupFolderButton) backupFolderButton.disabled = false;
        if (changeBackupFolderButton) changeBackupFolderButton.disabled = false;
      }
    }

    // رویداد «کلیک» برای دکمه انتخاب پوشه بکاپ در صفحه شروع؛ اجرای رفتار متناسب با این کنترل و رویداد.
    backupGateChooseFolder.addEventListener('click', () => chooseBackupFolder(false));
    // رویداد کلیک برای شروع جایگزین؛ در صورت خطای مرورگر اجازه استفاده بدون فایل بکاپ خودکار داده می‌شود.
    document.getElementById('backup-gate-continue-without-backup').addEventListener('click', () => {
      const confirmed = window.confirm(
        'بدون بکاپ خودکار ادامه می‌دهید؟\\n\\nاطلاعات در حافظه محلی مرورگر ذخیره می‌شود، اما فایل پشتیبان خودکار ساخته نخواهد شد. پاک‌شدن داده‌های مرورگر ممکن است اطلاعات را از بین ببرد.\\n\\nبرای ادامه تأیید کنید.'
      );
      if (confirmed) startWithoutAutomaticBackup();
    });
    // رویداد «کلیک» برای دکمه فعال‌سازی پوشه بکاپ؛ اجرای رفتار متناسب با این کنترل و رویداد.
    if (backupFolderButton) backupFolderButton.addEventListener('click', () => chooseBackupFolder(false));
    // رویداد «کلیک» برای دکمه تغییر پوشه بکاپ؛ اجرای رفتار متناسب با این کنترل و رویداد.
    if (changeBackupFolderButton) changeBackupFolderButton.addEventListener('click', () => chooseBackupFolder(true));

    (async () => {
      try {
        const savedDirectory = await loadBackupDirectoryHandle();
        if (!savedDirectory) {
          backupGateStatus.textContent = 'هنوز محل ذخیره بکاپ مشخص نشده است. برای شروع، یک پوشه انتخاب کنید.';
          return;
        }

        backupDirectoryHandle = savedDirectory;
        const permission = await savedDirectory.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          backupGateStatus.textContent = 'پوشه ذخیره‌شده پیدا شد؛ در حال بررسی و به‌روزرسانی بکاپ...';
          const savedSuccessfully = await writeAutomaticBackup(savedDirectory, false);
          if (savedSuccessfully) {
            setApplicationReady(true);
          } else {
            backupGateStatus.textContent = 'پوشه قبلی پیدا شد، اما بکاپ موفق نشد. برای تمدید مجوز پوشه ذخیره‌شده دکمه زیر را بزنید.';
          }
        } else {
          backupGateStatus.textContent = 'پوشه بکاپ قبلی پیدا شد؛ برای تمدید مجوز همان پوشه دکمه زیر را بزنید. نیازی به انتخاب دوباره پوشه نیست.';
        }
      } catch (error) {
        backupGateStatus.textContent = 'محل ذخیره قبلی قابل استفاده نیست. برای شروع، پوشه را دوباره انتخاب کنید.';
      }
    })();

    // فقط تغییرات ذخیره‌شده در کلیدهای داده‌ای برنامه، بکاپ خودکار را زمان‌بندی می‌کنند.
    // رهگیری ذخیره‌سازی کلیدهای برنامه برای زمان‌بندی بکاپ پس از تغییر واقعی داده.
    const originalLocalStorageSetItem = Storage.prototype.setItem;

    /**
     * هدف: بازگرداندن مقدار خام ذخیره‌سازی پس از شکست یک عملیات چندمرحله‌ای.
     * ورودی: key: کلید localStorage؛ previousValue: مقدار قبلی یا null اگر وجود نداشته است.
     * خروجی: true در موفقیت و false در شکست؛ مقدار خام پیشین بدون نرمال‌سازی حفظ می‌شود.
     */
    function restoreLocalStorageValue(key, previousValue) {
      try {
        if (previousValue === null) localStorage.removeItem(key);
        else originalLocalStorageSetItem.call(localStorage, key, previousValue);
        return true;
      } catch (error) {
        return false;
      }
    }

    Storage.prototype.setItem = function(key, value) {
      originalLocalStorageSetItem.call(this, key, value);
      if ([STORAGE_KEY, ACTIVITY_KEY, ENTRY_HISTORY_KEY, SHIPMENT_KEY, LOCATION_KEY].includes(String(key))) {
        scheduleAutomaticBackup();
      }
    };
    const restoreFileInput = document.getElementById('restore-json-file');
    const restoreBackupButton = document.getElementById('restore-json-backup');
    const restoreFeedback = document.getElementById('restore-feedback');
    let pendingRestorePayload = null;

    /** نرمال‌سازی کلید متنی برای تشخیص تکرار با یکسان‌سازی فاصله و رقم‌ها. */
    // توابع کمکی ادغام بکاپ برای تشخیص رکوردهای تکراری.
    const normalizedKey = value => String(value ?? '').trim().replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).toLocaleLowerCase('fa');
    /** استخراج مجموعه مقادیر یکتای یک فیلد؛ مقدارهای خالی حذف می‌شوند. */
    const uniqueValues = (records, field) => new Set(records.map(record => normalizedKey(record && record[field])).filter(Boolean));
    /** ادغام بدون تکرار؛ رکورد دارای هر کلید تکراری رد می‌شود و دلیل آن به conflicts افزوده می‌شود. */
    const mergeUniqueRecords = (existing, incoming, fields, conflicts, label) => {
      const seen = new Set();
      existing.forEach(record => fields.forEach(field => {
        const value = normalizedKey(record && record[field]);
        if (value) seen.add(field + ':' + value);
      }));
      const accepted = [];
      incoming.forEach((record, index) => {
        const duplicateFields = fields.filter(field => {
          const value = normalizedKey(record && record[field]);
          return value && seen.has(field + ':' + value);
        });
        if (duplicateFields.length) {
          conflicts.push(label + ' ردیف ' + (index + 1) + ': ' + duplicateFields.map(field => {
            const names = { code: 'کد کالا', entryNumber: 'شماره ورود', exitNumber: 'شماره خروج', voucherNumber: 'شماره حواله', username: 'نام کاربری' };
            return names[field] + ' «' + record[field] + '»';
          }).join(' و '));
          return;
        }
        accepted.push(record);
        fields.forEach(field => {
          const value = normalizedKey(record && record[field]);
          if (value) seen.add(field + ':' + value);
        });
      });
      return accepted;
    };

    /**
     * هدف: اعتبارسنجی ساختار بکاپ و داده‌های هر بخش پیش از نوشتن یا بازگردانی.
     * ورودی: payload: شیء JSON بارگذاری‌شده یا داده‌های جاری برای بکاپ.
     * خروجی: آرایه پیام‌های خطا؛ آرایه خالی یعنی ساختار و رکوردها قابل قبول‌اند.
     * نسخه schemaVersion اختیاری است تا بکاپ‌های قدیمی همچنان قابل بازیابی بمانند.
     */
    function validateBackupPayload(payload) {
      const errors = [];
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return ['ریشه فایل باید یک شیء JSON باشد.'];
      }
      if (payload.schemaVersion !== undefined && payload.schemaVersion !== 1) {
        errors.push('نسخه ساختار بکاپ پشتیبانی نمی‌شود.');
      }
      if (payload.exportedAt !== undefined &&
          (typeof payload.exportedAt !== 'string' || !Number.isFinite(Date.parse(payload.exportedAt)))) {
        errors.push('زمان ساخت بکاپ معتبر نیست.');
      }

      const requiredArraysValid = Array.isArray(payload.inventory) && Array.isArray(payload.shipments);
      if (!Array.isArray(payload.inventory)) errors.push('فهرست موجودی وجود ندارد یا آرایه نیست.');
      if (!Array.isArray(payload.shipments)) errors.push('تاریخچه ارسال وجود ندارد یا آرایه نیست.');
      if (payload.entryHistory !== undefined && !Array.isArray(payload.entryHistory)) errors.push('تاریخچه ورود باید آرایه باشد.');
      if (payload.shipmentLocations !== undefined && !Array.isArray(payload.shipmentLocations)) errors.push('فهرست محل‌ها باید آرایه باشد.');
      if (payload.activityLog !== undefined && !Array.isArray(payload.activityLog)) errors.push('ساختار لاگ قدیمی باید آرایه باشد.');
      if (!requiredArraysValid) return errors;

      const validNumber = (value, allowZero) => {
        // داده ذخیره‌شده با قالب خام JSON کنترل می‌شود؛ جداکننده هزارگان نباید هنگام بازیابی تفسیر متفاوتی پیدا کند.
        if (typeof value === 'number') {
          return Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
        }
        if (typeof value !== 'string') return false;
        const text = toEnglishDigits(value).trim();
        const number = Number(text);
        return /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) &&
          Number.isFinite(number) && (allowZero ? number >= 0 : number > 0);
      };
      const records = (value, label, validator) => {
        value.forEach((record, index) => {
          const message = validator(record);
          if (message) errors.push(label + '، ردیف ' + (index + 1) + ': ' + message);
        });
      };

      records(payload.inventory, 'موجودی', item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return 'رکورد باید شیء باشد.';
        if (typeof item.code !== 'string' || !item.code.trim()) return 'کد کالا خالی یا نامعتبر است.';
        if (item.id !== undefined && (typeof item.id !== 'string' || !item.id.trim())) return 'شناسه کالا نامعتبر است.';
        if (item.category !== undefined && typeof item.category !== 'string') return 'گروه کالا نامعتبر است.';
        if (typeof item.description !== 'string' || !item.description.trim()) return 'شرح کالا خالی یا نامعتبر است.';
        if (!validNumber(item.stock, true)) return 'موجودی باید عددی متناهی و صفر یا مثبت باشد.';
        if (item.sendQuantity !== undefined && item.sendQuantity !== '' && item.sendQuantity !== null) {
          const pendingQuantity = typeof item.sendQuantity === 'number'
            ? item.sendQuantity : Number(toEnglishDigits(String(item.sendQuantity)).trim());
          if (!validNumber(item.sendQuantity, true) || pendingQuantity > Number(item.stock)) {
            return 'مقدار آماده‌ارسال نامعتبر است.';
          }
        }
        if (item.entryTimestamp && (typeof item.entryTimestamp !== 'string' || !Number.isFinite(Date.parse(item.entryTimestamp)))) {
          return 'زمان ورود کالا نامعتبر است.';
        }
        if (item.minimumStock !== undefined && !validNumber(item.minimumStock, true)) {
          return 'حداقل موجودی باید صفر یا مثبت باشد.';
        }
        return '';
      });

      records(payload.entryHistory || [], 'تاریخچه ورود', item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return 'رکورد باید شیء باشد.';
        if (typeof item.entryNumber !== 'string' || !item.entryNumber.trim()) return 'شماره ورود خالی یا نامعتبر است.';
        if (item.id !== undefined && (typeof item.id !== 'string' || !item.id.trim())) return 'شناسه سند ورود نامعتبر است.';
        if (item.items !== undefined && !Array.isArray(item.items)) return 'فهرست اقلام ورود نامعتبر است.';
        if (Array.isArray(item.items) && item.items.some(line => !line || typeof line !== 'object' || Array.isArray(line) ||
          typeof line.code !== 'string' || !line.code.trim() || (line.id !== undefined && (typeof line.id !== 'string' || !line.id.trim())) ||
          (line.itemId !== undefined && (typeof line.itemId !== 'string' || !line.itemId.trim())) ||
          (line.quantity !== undefined && (typeof line.quantity !== 'number' || !Number.isFinite(line.quantity) || line.quantity < 0)))) {
          return 'جزئیات یکی از اقلام ورود نامعتبر است.';
        }
        if (item.timestamp && (typeof item.timestamp !== 'string' || !Number.isFinite(Date.parse(item.timestamp)))) {
          return 'زمان ثبت ورود نامعتبر است.';
        }
        for (const field of ['itemCount', 'pieceCount']) {
          if (item[field] !== undefined &&
              (typeof item[field] !== 'number' || !Number.isFinite(item[field]) || item[field] < 0)) {
            return 'شمار ' + field + ' نامعتبر است.';
          }
        }
        return '';
      });

      records(payload.shipments, 'تاریخچه ارسال', item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return 'رکورد باید شیء باشد.';
        if (!Array.isArray(item.items) || item.items.length === 0) return 'ارسال باید دست‌کم یک ردیف کالا داشته باشد.';
        if (item.id !== undefined && (typeof item.id !== 'string' || !item.id.trim())) return 'شناسه سند ارسال نامعتبر است.';
        for (const field of ['voucherNumber', 'exitNumber', 'location', 'sublocation', 'date', 'time']) {
          if (item[field] !== undefined &&
              (typeof item[field] !== 'string' || (['voucherNumber', 'exitNumber', 'location'].includes(field) && !item[field].trim()))) {
            return 'فیلد ' + field + ' نامعتبر است.';
          }
        }
        if (item.timestamp && (typeof item.timestamp !== 'string' || !Number.isFinite(Date.parse(item.timestamp)))) {
          return 'زمان ثبت ارسال نامعتبر است.';
        }
        for (let index = 0; index < item.items.length; index += 1) {
          const line = item.items[index];
          if (!line || typeof line !== 'object' || Array.isArray(line) ||
              typeof line.code !== 'string' || !line.code.trim() ||
              !validNumber(line.quantity, false)) {
            return 'ردیف کالای شماره ' + (index + 1) + ' دارای کد یا تعداد نامعتبر است.';
          }
          if (line.description !== undefined && typeof line.description !== 'string') {
            return 'شرح ردیف کالای شماره ' + (index + 1) + ' نامعتبر است.';
          }
          if (line.id !== undefined && (typeof line.id !== 'string' || !line.id.trim())) return 'شناسه ردیف کالای شماره ' + (index + 1) + ' نامعتبر است.';
          if (line.itemId !== undefined && (typeof line.itemId !== 'string' || !line.itemId.trim())) return 'شناسه قلم ردیف ' + (index + 1) + ' نامعتبر است.';
        }
        return '';
      });

      records(payload.shipmentLocations || [], 'محل ارسال', location => {
        if (!location || typeof location !== 'object' || Array.isArray(location) ||
            typeof location.name !== 'string' || !location.name.trim()) {
          return 'نام محل خالی یا نامعتبر است.';
        }
        if (location.sublocations !== undefined &&
            (!Array.isArray(location.sublocations) ||
             !location.sublocations.every(value => typeof value === 'string' && value.trim()))) {
          return 'فهرست زیرمجموعه‌ها نامعتبر است.';
        }
        return '';
      });

      records(payload.activityLog || [], 'لاگ قدیمی', item =>
        !item || typeof item !== 'object' || Array.isArray(item) ? 'رکورد باید شیء باشد.' : ''
      );

      return errors;
    }

    /**
     * هدف: تشخیص رکوردهای تکراری و ساخت داده ادغام‌شده بدون حذف داده‌های فعلی.
     * ورودی: payload: بکاپ پس از کنترل ساختار.
     * خروجی: شیء شامل آرایه‌های ادغام‌شده، شمارش‌ها و مغایرت‌ها.
     */
    function analyzeRestorePayload(payload) {
      const conflicts = [];
      let currentInventory;
      try {
        currentInventory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!Array.isArray(currentInventory)) throw new Error('invalid inventory type');
      } catch (error) {
        throw new Error('CURRENT_INVENTORY_INVALID');
      }
      const currentEntries = loadEntryHistory();
      const currentShipments = loadShipments();
      const incomingInventory = mergeUniqueRecords(currentInventory, payload.inventory, ['code'], conflicts, 'کالای تکراری');
      const incomingEntries = mergeUniqueRecords(currentEntries, payload.entryHistory || [], ['entryNumber'], conflicts, 'ورود تکراری');
      // اگر شماره خروج یا شماره حواله تکراری باشد، کل رکورد ارسال وارد نمی‌شود.
      const incomingShipments = mergeUniqueRecords(currentShipments, payload.shipments, ['exitNumber', 'voucherNumber'], conflicts, 'ارسال دارای شماره تکراری');
      const currentLocations = loadShipmentLocations();
      const mergedLocations = currentLocations.map(location => ({
        name: location.name,
        sublocations: [...location.sublocations]
      }));
      const incomingLocations = Array.isArray(payload.shipmentLocations) ? payload.shipmentLocations : [];
      incomingLocations.forEach(incoming => {
        if (!incoming || typeof incoming.name !== 'string' || !incoming.name.trim()) return;
        let existing = mergedLocations.find(location => normLocation(location.name) === normLocation(incoming.name));
        if (!existing) {
          existing = { name: incoming.name.trim(), sublocations: [] };
          mergedLocations.push(existing);
        }
        (Array.isArray(incoming.sublocations) ? incoming.sublocations : []).forEach(value => {
          const sublocation = String(value || '').trim();
          if (sublocation && !existing.sublocations.some(item => normLocation(item) === normLocation(sublocation))) {
            existing.sublocations.push(sublocation);
          }
        });
      });

      const currentActivity = loadActivityLog();
      const incomingActivity = (payload.activityLog || []).filter(record => {
        const signature = JSON.stringify(record);
        const exists = currentActivity.some(item => JSON.stringify(item) === signature);

        return !exists;
      });
      return {
        conflicts,
        inventory: currentInventory.concat(incomingInventory),
        entryHistory: currentEntries.concat(incomingEntries).slice(0, 1000),
        shipments: currentShipments.concat(incomingShipments),
        activityLog: [],
        shipmentLocations: mergedLocations,
        counts: {
          inventory: incomingInventory.length,
          entries: incomingEntries.length,
          shipments: incomingShipments.length,
          activity: incomingActivity.length,
          locations: mergedLocations.length - currentLocations.length,
        }
      };
    }

    // رویداد «تغییر» برای فیلد انتخاب فایل بکاپ؛ به‌روزرسانی داده‌ها و رابط پس از تغییر انتخاب.
    restoreFileInput.addEventListener('change', async () => {
      pendingRestorePayload = null;
      restoreBackupButton.disabled = true;
      restoreFeedback.textContent = '';
      const file = restoreFileInput.files && restoreFileInput.files[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        const validationErrors = validateBackupPayload(payload);
        if (validationErrors.length) {
          restoreFeedback.textContent = 'فایل بکاپ پذیرفته نشد: ' +
            validationErrors.slice(0, 5).join('؛ ') +
            (validationErrors.length > 5 ? '؛ و ' + (validationErrors.length - 5) + ' خطای دیگر' : '');
          return;
        }

        const analysis = analyzeRestorePayload(payload);
        pendingRestorePayload = { payload, analysis };
        restoreBackupButton.disabled = false;
        const summary = [
          'بررسی فایل انجام شد.',
          'کالاهای جدید: ' + analysis.counts.inventory,
          'شماره‌های ورود جدید: ' + analysis.counts.entries,
          'ارسال‌های جدید: ' + analysis.counts.shipments,
          'محل‌های موجود در فهرست پس از ادغام: ' + analysis.shipmentLocations.length,
          'رخدادهای جدید: ' + analysis.counts.activity,
          'مغایرت‌ها و موارد تکراری: ' + analysis.conflicts.length,
          'اطلاعات فعلی حذف نمی‌شود؛ فقط رکوردهای جدید اضافه خواهند شد.'
        ];
        restoreFeedback.textContent = summary.join('\n');
      } catch (error) {
        restoreBackupButton.disabled = true;
        pendingRestorePayload = null;
        restoreFeedback.textContent = error && error.message === 'CURRENT_INVENTORY_INVALID'
          ? 'موجودی فعلی قابل خواندن نیست؛ پیش از بازگردانی، از داده‌ها نسخه جداگانه بگیرید و ساختار ذخیره محلی را بررسی کنید.'
          : 'فایل انتخاب‌شده معتبر نیست یا با ساختار بکاپ این برنامه سازگار نیست.';
      }
    });

    // رویداد «کلیک» برای دکمه تأیید بازگردانی بکاپ؛ اجرای رفتار متناسب با این کنترل و رویداد.
    restoreBackupButton.addEventListener('click', () => {
      if (!pendingRestorePayload) return;
      // فایل را دوباره اعتبارسنجی و تحلیل می‌کنیم تا وضعیت ذخیره‌سازی تا لحظه تأیید لحاظ شود.
      const validationErrors = validateBackupPayload(pendingRestorePayload.payload);
      if (validationErrors.length) {
        restoreBackupButton.disabled = true;
        pendingRestorePayload = null;
        restoreFeedback.textContent = 'بازگردانی متوقف شد: ' + validationErrors.slice(0, 5).join('؛ ');
        return;
      }
      let analysis;
      try {
        analysis = analyzeRestorePayload(pendingRestorePayload.payload);
      } catch (error) {
        restoreFeedback.textContent = error && error.message === 'CURRENT_INVENTORY_INVALID'
          ? 'موجودی فعلی قابل خواندن نیست؛ بازگردانی انجام نشد و هیچ داده‌ای تغییر نکرد.'
          : 'تحلیل بکاپ ناموفق بود؛ بازگردانی انجام نشد و هیچ داده‌ای تغییر نکرد.';
        return;
      }
      const mismatchLines = analysis.conflicts.length
        ? analysis.conflicts.slice(0, 80).map((item, index) => (index + 1) + '. ' + item)
        : ['هیچ مورد تکراری یا مغایرتی پیدا نشد.'];
      if (analysis.conflicts.length > 80) mismatchLines.push('... و ' + (analysis.conflicts.length - 80) + ' مورد دیگر');
      window.alert('گزارش مغایرت‌های فایل بکاپ\n\n' + mismatchLines.join('\n'));
      const confirmed = window.confirm(
        'نتیجه بررسی:\n' +
        'کالاهای قابل افزودن: ' + analysis.counts.inventory + '\n' +
        'ورودی‌های قابل افزودن: ' + analysis.counts.entries + '\n' +
        'ارسال‌های قابل افزودن: ' + analysis.counts.shipments + '\n' +
        'مغایرت‌ها/موارد تکراری: ' + analysis.conflicts.length + '\n\n' +
        'اطلاعات فعلی حفظ می‌شود و فقط موارد غیرتکراری اضافه می‌شوند. ادامه می‌دهید؟'
      );
      if (!confirmed) return;
      const restoreRecords = [
        [STORAGE_KEY, analysis.inventory],
        [ENTRY_HISTORY_KEY, analysis.entryHistory],
        [SHIPMENT_KEY, analysis.shipments],
        [LOCATION_KEY, analysis.shipmentLocations],
        [ACTIVITY_KEY, []],
      ];
      const previousValues = restoreRecords.map(([key]) => [key, localStorage.getItem(key)]);

      try {
        restoreRecords.forEach(([key, value]) => {
          // ذخیره خام کلید اصلی را دور می‌زنیم تا هنگام بازگردانی نیمه‌کاره بکاپ خودکار زمان‌بندی نشود.
          originalLocalStorageSetItem.call(localStorage, key, JSON.stringify(value));
        });
        recordActivity(
          'بازگردانی بکاپ',
          'کالاها، تاریخچه‌ها، محل‌های ارسال و رخدادها از فایل بکاپ ادغام شدند.'
        );
        restoreFeedback.textContent = 'بازگردانی تکمیل شد؛ اطلاعات قبلی حفظ و موارد جدید ادغام شدند.';
        window.location.reload();
      } catch (error) {
        // localStorage تراکنش چندکلیدی ندارد؛ در صورت شکست، مقادیر قبلی را تا حد امکان برمی‌گردانیم.
        const rollbackSucceeded = previousValues
          .map(([key, value]) => restoreLocalStorageValue(key, value))
          .every(Boolean);
        restoreFeedback.textContent = rollbackSucceeded
          ? 'بازگردانی ناموفق بود؛ تغییرات لغو و مقادیر قبلی بازیابی شدند. فضای ذخیره‌سازی مرورگر را بررسی کنید.'
          : 'بازگردانی ناموفق بود و بازیابی همه مقادیر قبلی کامل نشد؛ موجودی، تاریخچه‌ها و فایل بکاپ را فوراً بررسی کنید.';
      }
    });

    // رویداد «کلیک» برای دکمه به‌روزرسانی گزارش فعالیت؛ اجرای رفتار متناسب با این کنترل و رویداد.

    renderEntryHistory();
    renderShipmentHistory();
    renderKardex();

/* کنترل پنجره شناور یادداشت‌های انتشار با عنصر dialog بومی مرورگر. */
const releaseNotesDialog = document.getElementById('release-notes-dialog');
const openReleaseNotesButton = document.getElementById('open-release-notes');
const closeReleaseNotesButton = document.getElementById('close-release-notes');
if (releaseNotesDialog && openReleaseNotesButton && closeReleaseNotesButton) {
  openReleaseNotesButton.addEventListener('click', () => {
    if (typeof releaseNotesDialog.showModal === 'function') releaseNotesDialog.showModal();
    else releaseNotesDialog.setAttribute('open', '');
  });
  closeReleaseNotesButton.addEventListener('click', () => {
    if (typeof releaseNotesDialog.close === 'function') releaseNotesDialog.close();
    else releaseNotesDialog.removeAttribute('open');
  });
  releaseNotesDialog.addEventListener('click', event => {
    if (event.target === releaseNotesDialog && typeof releaseNotesDialog.close === 'function') releaseNotesDialog.close();
  });
}
