
    // اتصال‌های ثابت DOM؛ شناسه‌ها باید با index.html هماهنگ بمانند.
    const sectionLinks = document.querySelectorAll('.nav-link');
    const sectionCards = document.querySelectorAll('.section-card');
    const inventoryGrid = document.getElementById('inventory-grid');
    const inventorySearchInput = document.getElementById('inventory-search');
    const inventorySearchQuery = document.getElementById('inventory-search-query');
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
    const itemFormInputs = {
      code: document.getElementById('supply-code'),
      description: document.getElementById('item-description'),
      stock: document.getElementById('item-stock')
    };
    // کلیدهای اصلی داده و وضعیت صفحه‌بندی گزارش‌ها.
    const STORAGE_KEY = 'anbar.inventory.v1';
    const ACTIVITY_KEY = 'anbar.activity-log.v1';
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
      try {
        localStorage.setItem(ENTRY_HISTORY_KEY, JSON.stringify(records.slice(0, 1000)));
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
     * هدف: ثبت سابقه تجمیعی برای ورود موفق کالاها و درج جزئیات آن در لاگ فعالیت.
     * ورودی: items: کالاهای ثبت‌شده در این نوبت.
     * خروجی: بدون مقدار بازگشتی؛ برای فهرست خالی عملیات نمی‌کند.
     */
    function recordIncomingEntry(items) {
      if (!items.length) return;
      const now = new Date();
      const dateTime = solarDateTime(now);
      const record = {
        entryNumber: makeEntryNumber(now),
        timestamp: now.toISOString(),
        date: dateTime.date,
        time: dateTime.time,
        itemCount: items.length,
        pieceCount: items.reduce((total, item) => total + item.stock, 0)
      };
      const records = loadEntryHistory();
      records.unshift(record);
      if (saveEntryHistory(records)) {
        renderEntryHistory();
        const itemDetails = items.map(item =>
          String(item.code || 'بدون کد') + ' (' + String(item.description || 'بدون شرح') + '): ' + toEnglishDigits(item.stock)
        ).join('؛ ');
        recordActivity('ثبت ورود کالا', 'شماره ورود: ' + record.entryNumber +
          '؛ تعداد اقلام: ' + items.length + '؛ تعداد کل: ' + toEnglishDigits(record.pieceCount) +
          '؛ جزئیات اقلام: ' + itemDetails);
      }
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
      try { localStorage.setItem(SHIPMENT_KEY, JSON.stringify(records)); return true; }
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
            if (index === 2 && value && typeof value === 'object') {
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
      return prefix+'-'+solarDateTime(date).label.replace(/[^۰-۹٠-٩0-9]/g,'-')+'-'+String(epoch);
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
      for (const input of shipmentItemsContainer.querySelectorAll('.shipment-quantity')) {
        const item = inventoryItems.find(candidate => candidate.code === input.dataset.code);
        const quantity = normalizeStock(input.value);
        if (!item || !Number.isFinite(quantity) || quantity <= 0 || quantity > item.stock) {
          shipmentFeedback.textContent = 'تعداد ارسالی باید بیشتر از صفر و حداکثر برابر موجودی فعلی باشد. مقدار ردیف مشخص‌شده را اصلاح کنید.';
          input.focus();
          return;
        }
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
      const voucher = shipmentVoucherInput.value.trim() || makeShipmentNumber('حواله', now, epoch);
      const exitNumber = shipmentExitInput.value.trim() || makeShipmentNumber('خروج', now, epoch + 1);

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
        shipmentFeedback.textContent = 'ذخیره محل ارسال ممکن نشد؛ ارسال ثبت نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید.';
        return;
      }

      const shipment = {
        id: 'shipment-' + epoch,
        date: generatedAt.date,
        time: generatedAt.time,
        timestamp: now.toISOString(),
        location,
        sublocation,
        voucherNumber: voucher,
        exitNumber,
        items: quantities.map(({ item, quantity }) => ({
          code: item.code,
          description: item.description,
          quantity
        }))
      };

      if (!saveShipments([shipment, ...existingShipments])) {
        saveShipmentLocations(previousLocations);
        return;
      }

      quantities.forEach(({ item, quantity }) => {
        item.stock = Number((item.stock - quantity).toFixed(8));
        item.sendQuantity = '';
      });

      if (!saveInventory()) {
        quantities.forEach(({ item, quantity }) => {
          item.stock = Number((item.stock + quantity).toFixed(8));
          item.sendQuantity = quantity;
        });
        saveShipments(existingShipments);
        saveShipmentLocations(previousLocations);
        renderShipmentLocationOptions();
        renderLocationManager();
        renderInventory();
        shipmentFeedback.textContent = 'ذخیره موجودی انجام نشد؛ ارسال ثبت نشد. دوباره تلاش کنید.';
        return;
      }

      const itemDetails = quantities.map(({ item, quantity }) =>
        item.code + ' (' + item.description + '): ' + toEnglishDigits(quantity)
      ).join('؛ ');
      if (isNewLocation || isNewSublocation) {
        recordActivity(isNewLocation ? 'ثبت خودکار محل ارسال' : 'افزودن زیرمجموعه محل ارسال',
          'محل: «' + location + '»؛ زیرمجموعه: «' + (sublocation || 'ندارد') + '»؛ محل در جریان ارسال ذخیره شد.');
      }
      recordActivity('ثبت ارسال کالا',
        'محل: «' + location + '»؛ زیرمجموعه: «' + (sublocation || 'ندارد') +
        '»؛ شماره حواله: ' + voucher + '؛ شماره خروج: ' + exitNumber +
        '؛ تعداد ردیف: ' + quantities.length + '؛ جزئیات کالاها: ' + itemDetails);

      renderShipmentLocationOptions();
      renderLocationManager();
      selectedItemCodes.clear();
      renderInventory();
      renderShipmentHistory();
      closeShipmentDialog();
      inventoryFeedback.textContent = 'ارسال با موفقیت ثبت شد. شماره حواله: ' + voucher + '؛ شماره خروج: ' + exitNumber;
      renderActivityResults(document.getElementById('backup-log-results'), loadActivityLog(), 'هنوز رخدادی ثبت نشده است.');
    }

    /**
     * هدف: افزودن رخداد به ابتدای لاگ همراه زمان و محدودکردن اندازه جزئیات.
     * ورودی: action: عنوان عملیات؛ details: شرح رخداد.
     * خروجی: بدون مقدار بازگشتی؛ خطای ثبت لاگ مانع عملیات اصلی نمی‌شود.
     */
    function recordActivity(action, details) {
      try {
        const now = new Date();
        const logs = loadActivityLog();
        const fullDetails = String(details || 'جزئیاتی ثبت نشده است.');
        const safeDetails = fullDetails.length > 3000
          ? fullDetails.slice(0, 3000) + '… (ادامه جزئیات برای جلوگیری از حجیم شدن لاگ کوتاه شد)'
          : fullDetails;
        logs.unshift({
          action: String(action || 'تغییر نامشخص'),
          details: safeDetails,
          actor: 'کاربر',
          timestamp: now.toISOString(),
          solarDate: new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
            year: 'numeric', month: '2-digit', day: '2-digit'
          }).format(now)
        });
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(logs.slice(0, 1000)));
      } catch (error) {
        /* ثبت لاگ نباید مانع ادامه عملیات اصلی شود. */
      }
    }

    /**
     * هدف: ساخت جدول رخدادها با textContent برای جلوگیری از اجرای متن به‌عنوان HTML.
     * ورودی: target: ظرف نمایشی؛ logs: رخدادها؛ emptyText: پیام حالت خالی.
     * خروجی: DOM گزارش فعالیت به‌روزرسانی می‌شود.
     */
    function renderActivityResults(target, logs, emptyText) {
      target.replaceChildren();
      if (!logs.length) {
        const empty = document.createElement('p');
        empty.className = 'preview-empty';
        empty.textContent = emptyText;
        target.append(empty);
        return;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'preview-table-wrap bulk-preview-scroll';
      const { table, tbody } = createDataTable(['تاریخ و ساعت', 'کاربر', 'عملیات', 'جزئیات'], 'settings-log-table');

      logs.slice(0, 1000).forEach(log => {
        const row = document.createElement('tr');
        const dateCell = document.createElement('td');
        const timestamp = log.timestamp ? new Date(log.timestamp) : null;
        if (timestamp && Number.isFinite(timestamp.getTime())) {
          const dateTime = solarDateTime(timestamp);
          const date = document.createElement('span');
          date.className = 'date-part';
          date.textContent = dateTime.date;
          const time = document.createElement('span');
          time.className = 'time-part';
          time.textContent = dateTime.time;
          dateCell.className = 'date-time-cell';
          dateCell.append(date, time);
          dateCell.dataset.sortValue = log.timestamp;
        } else {
          dateCell.textContent = log.solarDate || '—';
        }

        const actorCell = document.createElement('td');
        actorCell.textContent = log.actor || '—';
        const actionCell = document.createElement('td');
        actionCell.textContent = log.action || '—';
        const detailsCell = document.createElement('td');
        detailsCell.textContent = log.details || '—';
        row.append(dateCell, actorCell, actionCell, detailsCell);
        tbody.append(row);
      });

      wrapper.append(table);
      target.append(wrapper);
      enableTableSorting(table, { defaultColumn: 0, defaultDirection: 'desc' });
    }

    const bulkPreview = document.getElementById('bulk-preview');
    const excelPreview = document.getElementById('excel-preview');
    const singlePreview = document.getElementById('single-preview');
    const importPreviewButton = document.getElementById('confirm-all-imports');
    const confirmExcelImportButton = document.getElementById('confirm-all-imports');
    const pastedDataInput = document.getElementById('pasted-data');
    const excelFeedback = document.getElementById('excel-feedback');
    const singleFeedback = document.getElementById('single-feedback');
    const duplicateDialog = document.getElementById('duplicate-dialog');
    const duplicateDialogDetails = document.getElementById('duplicate-dialog-details');
    let pendingClipboardRows = [];
    let pendingExcelRows = [];

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
              code: item.code,
              description: item.description,
              stock,
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

    // رویداد «کلیک» برای دکمه پاک‌کردن جست‌وجوی موجودی؛ اجرای رفتار متناسب با این کنترل و رویداد.
    document.getElementById('clear-inventory-search').addEventListener('click', () => {
      inventorySearchInput.value = '';
      renderInventory();
      inventorySearchInput.focus();
    });

    /**
     * هدف: ذخیره موجودی جاری و ثبت خلاصه تغییر در لاگ فعالیت.
     * ورودی: پارامتر ندارد؛ از inventoryItems استفاده می‌شود.
     * خروجی: true در ذخیره موفق و false در شکست.
     */
    function saveInventory() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inventoryItems));
        recordActivity('ذخیره / تغییر موجودی', 'تعداد اقلام فعلی: ' + toEnglishDigits(inventoryItems.length));
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
        stock: ['موجودی','تعدادموجودی','تعداد','مقدار','quantity','stock','inventory']
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
          headerMap.stock >= 0 ? row[headerMap.stock] : row[2]
        ] : row.slice(0,3);
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
      return { code, description, stock };
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
      const manualRow = [itemFormInputs.code.value.trim(), itemFormInputs.description.value.trim(), itemFormInputs.stock.value.trim()];
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
      const { table, tbody } = createDataTable(['منبع ورودی', 'کد تدارکاتی', 'شرح کالا', 'موجودی', 'وضعیت']);
      combined.forEach(({row, source}) => {
        const error = getRowError(row);
        const tr = document.createElement('tr');
        if (error) tr.className = 'import-invalid-row';
        [source, toEnglishDigits(row[0] ?? ''), normalizeArabicLetters(row[1] ?? ''), toEnglishDigits(row[2] ?? ''), error || 'معتبر'].forEach(value => {
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
      const { table, tbody } = createDataTable(['کد تدارکاتی', 'شرح کالا', 'موجودی', 'وضعیت']);
      previewRows.forEach(row => {
        const error = getRowError(row);
        const tr = document.createElement('tr');
        if (error) tr.className = 'import-invalid-row';
        [toEnglishDigits(row[0] ?? ''), normalizeArabicLetters(row[1] ?? ''), toEnglishDigits(row[2] ?? ''), error || 'معتبر'].forEach(value => {
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
      const row = [itemFormInputs.code.value.trim(), itemFormInputs.description.value.trim(), itemFormInputs.stock.value.trim()];
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
      const { table, tbody } = createDataTable(['کد تدارکاتی', 'شرح کالا', 'موجودی']);
      const tr = document.createElement('tr');
      [row[0], row[1], item ? item.stock : row[2]].forEach(value => {
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
          const pendingQuantity = existing.sendQuantity === '' || existing.sendQuantity === null || existing.sendQuantity === undefined
            ? NaN
            : normalizeStock(existing.sendQuantity);
          if (!Number.isFinite(pendingQuantity) || pendingQuantity <= 0 || pendingQuantity > item.stock) {
            existing.sendQuantity = '';
          }
          existing.entryTimestamp = entryTimestamp;
          updated += 1;
        } else {
          inventoryItems.push({ ...item, sendQuantity: '', entryTimestamp });
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
      recordIncomingEntry([...incomingItems.values()]);
      return { added, updated, skipped, saved: true };
    }

    /**
     * هدف: نمایش نتیجه ورود و تفکیک خطای ذخیره از ثبت موفق.
     * ورودی: result: نتیجه پردازش؛ target: عنصر پیام.
     * خروجی: متن نتیجه در رابط نمایش داده می‌شود.
     */
    function showImportResult(result, target) {
      if (result.saved === false) {
        target.textContent = 'ذخیره‌سازی ناموفق بود؛ هیچ تغییری ثبت نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید و دوباره تلاش کنید.';
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
      try {
        localStorage.setItem(LOCATION_KEY, JSON.stringify(locations));
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
          recordActivity('حذف محل ارسال',
            'محل: «' + location.name + '»؛ زیرمجموعه‌ها: ' +
            (location.sublocations.join('، ') || 'ندارد') + '؛ سوابق ارسال قبلی حفظ شدند.');
          document.getElementById('location-manager-feedback').textContent = 'محل انتخاب‌شده حذف شد.';
          renderLocationManager();
          renderShipmentLocationOptions();
          renderActivityResults(document.getElementById('backup-log-results'), loadActivityLog(), 'هنوز رخدادی ثبت نشده است.');
        });

        row.append(details, removeButton);
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

      recordActivity('ثبت محل ارسال',
        'محل: «' + name + '»؛ زیرمجموعه‌ها: ' + (sublocations.join('، ') || 'ندارد') + '؛ منبع ثبت: مدیریت محل‌ها.');
      event.target.reset();
      feedback.textContent = 'محل ارسال ذخیره شد و در ارسال‌های بعدی قابل انتخاب است.';
      renderLocationManager();
      renderShipmentLocationOptions();
      renderActivityResults(document.getElementById('backup-log-results'), loadActivityLog(), 'هنوز رخدادی ثبت نشده است.');
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
    function renderInventory() {
      const { key, direction } = inventorySort;
      const multiplier = direction === 'desc' ? -1 : 1;
      const searchTerm = toEnglishDigits(inventorySearchInput.value).trim().toLocaleLowerCase('fa');
      inventorySearchQuery.textContent = inventorySearchInput.value.trim() || '—';

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
        if (key === 'stock' || key === 'sendQuantity') {
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
          item.code, item.description, item.stock, item.sendQuantity,
          item.entryTimestamp ? solarDateTime(new Date(item.entryTimestamp)).date : ''
        ].join(' ')).toLocaleLowerCase('fa');
        return searchable.includes(searchTerm);
      });

      inventoryGrid.replaceChildren();
      inventoryCount.textContent = 'تعداد کالاها: ' + toEnglishDigits(inventoryItems.length) +
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

        const stockCell = document.createElement('td');
        stockCell.className = 'inventory-quantity-cell';
        stockCell.textContent = toEnglishDigits(item.stock);

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
          item.sendQuantity = numericValue;
          saveInventory();
          inventoryFeedback.textContent = '';
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

        row.append(selectionCell, codeCell, descriptionCell, stockCell, sendCell, entryDateCell);
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
    function buildBackupPayload() {
      return {
        exportedAt: new Date().toISOString(),
        inventory: inventoryItems,
        entryHistory: loadEntryHistory(),
        shipments: loadShipments(),
        shipmentLocations: loadShipmentLocations(),
        activityLog: loadActivityLog(),
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
        const fileHandle = await directoryHandle.getFileHandle(getSolarBackupFileName(), { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(new Blob([JSON.stringify(buildBackupPayload(), null, 2)], { type: 'application/json;charset=utf-8' }));
        await writable.close();
        succeeded = true;
        backupFolderStatus.textContent = 'بکاپ خودکار فعال است؛ فایل ' + getSolarBackupFileName() + ' در پوشه انتخاب‌شده به‌روزرسانی شد.';
        backupFeedback.textContent = 'آخرین بکاپ با موفقیت ذخیره شد.';
        backupGateStatus.textContent = 'فایل بکاپ با موفقیت ذخیره شد.';
        return true;
      } catch (error) {
        backupFeedback.textContent = 'ذخیره خودکار انجام نشد. دسترسی پوشه را بررسی کنید و دوباره محل ذخیره را انتخاب کنید.';
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
      if (!backupDirectoryHandle || !applicationReady) return;
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
     * هدف: تشخیص رکوردهای تکراری و ساخت داده ادغام‌شده بدون حذف داده‌های فعلی.
     * ورودی: payload: بکاپ پس از کنترل ساختار.
     * خروجی: شیء شامل آرایه‌های ادغام‌شده، شمارش‌ها و مغایرت‌ها.
     */
    function analyzeRestorePayload(payload) {
      const conflicts = [];
      const currentInventory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
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
        if (exists) conflicts.push('رخداد تکراری در لاگ فعالیت: ' + String(record && (record.action || record.title) || 'بدون عنوان'));
        return !exists;
      });
      return {
        conflicts,
        inventory: currentInventory.concat(incomingInventory),
        entryHistory: currentEntries.concat(incomingEntries).slice(0, 1000),
        shipments: currentShipments.concat(incomingShipments),
        activityLog: currentActivity.concat(incomingActivity).slice(0, 1000),
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
        if (!payload || !Array.isArray(payload.inventory) ||
            (payload.entryHistory !== undefined && !Array.isArray(payload.entryHistory)) ||
            !Array.isArray(payload.shipments) || !Array.isArray(payload.activityLog) ||
            (payload.shipmentLocations !== undefined && !Array.isArray(payload.shipmentLocations))) {
          throw new Error('invalid backup structure');
        }

        const validInventory = payload.inventory.every(item =>
          item && typeof item.code === 'string' && typeof item.description === 'string' &&
          Number.isFinite(Number(item.stock)) && Number(item.stock) >= 0
        );
        const validEntries = (payload.entryHistory || []).every(item =>
          item && typeof item === 'object' && !Array.isArray(item) && typeof item.entryNumber === 'string'
        );
        const validShipments = payload.shipments.every(item =>
          item && typeof item === 'object' && !Array.isArray(item) &&
          Array.isArray(item.items) &&
          (item.voucherNumber === undefined || typeof item.voucherNumber === 'string') &&
          (item.exitNumber === undefined || typeof item.exitNumber === 'string') &&
          (item.location === undefined || typeof item.location === 'string') &&
          item.items.every(line =>
            line && typeof line === 'object' && typeof line.code === 'string' &&
            Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0
          )
        );
        const validActivity = payload.activityLog.every(item =>
          item && typeof item === 'object' && !Array.isArray(item)
        );
        if (!validInventory || !validEntries || !validShipments || !validActivity) {
          throw new Error('invalid backup records');
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
        restoreFeedback.textContent = 'فایل انتخاب‌شده معتبر نیست یا با ساختار بکاپ این برنامه سازگار نیست.';
      }
    });

    // رویداد «کلیک» برای دکمه تأیید بازگردانی بکاپ؛ اجرای رفتار متناسب با این کنترل و رویداد.
    restoreBackupButton.addEventListener('click', () => {
      if (!pendingRestorePayload) return;
      // تحلیل را در لحظه تأیید دوباره انجام می‌دهیم تا تغییرات پس از انتخاب فایل هم لحاظ شود.
      const analysis = analyzeRestorePayload(pendingRestorePayload.payload);
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
        [ACTIVITY_KEY, analysis.activityLog],
      ];
      const previousValues = restoreRecords.map(([key]) => [key, localStorage.getItem(key)]);

      try {
        restoreRecords.forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
        recordActivity(
          'بازگردانی بکاپ',
          'کالاها، تاریخچه‌ها، محل‌های ارسال و رخدادها از فایل بکاپ ادغام شدند.'
        );
        restoreFeedback.textContent = 'بازگردانی تکمیل شد؛ اطلاعات قبلی حفظ و موارد جدید ادغام شدند.';
        window.location.reload();
      } catch (error) {
        // localStorage تراکنش چندکلیدی ندارد؛ در صورت شکست، مقادیر قبلی را تا حد امکان برمی‌گردانیم.
        previousValues.forEach(([key, value]) => {
          try {
            if (value === null) localStorage.removeItem(key);
            else originalLocalStorageSetItem.call(localStorage, key, value);
          } catch (rollbackError) {
            // پیام نهایی به کاربر اعلام می‌کند که بازیابی کامل تضمین نشده است.
          }
        });
        restoreFeedback.textContent = 'بازگردانی کامل نشد؛ ذخیره‌سازی به مشکل خورد و اطلاعات قبلی تا حد امکان بازگردانده شد. فضای مرورگر را بررسی کنید.';
      }
    });

    // رویداد «کلیک» برای دکمه به‌روزرسانی گزارش فعالیت؛ اجرای رفتار متناسب با این کنترل و رویداد.
    document.getElementById('refresh-backup-log').addEventListener('click', () => {
      renderActivityResults(document.getElementById('backup-log-results'), loadActivityLog(), 'هنوز رخدادی ثبت نشده است.');
    });
    renderEntryHistory();
    renderShipmentHistory();
    renderActivityResults(document.getElementById('backup-log-results'), loadActivityLog(), 'هنوز رخدادی ثبت نشده است.');
