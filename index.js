
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
    const STORAGE_KEY = 'anbar.inventory.v1';
    const ACTIVITY_KEY = 'anbar.activity-log.v1';
    const ENTRY_HISTORY_KEY = 'anbar.entry-history.v1';
    const ENTRY_PAGE_SIZE = 10;
    let entryHistoryPage = 0;
    let entryHistorySort = { key: 'entryNumber', direction: 'desc' };
    let shipmentHistoryPage = 0;
    let shipmentHistorySort = { key: 'date', direction: 'desc' };

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

    function saveEntryHistory(records) {
      try {
        localStorage.setItem(ENTRY_HISTORY_KEY, JSON.stringify(records.slice(0, 1000)));
        return true;
      } catch (error) {
        inventoryFeedback.textContent = 'ذخیره تاریخچه ورود ممکن نشد؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.';
        return false;
      }
    }

    function makeEntryNumber(date = new Date()) {
      const parts = solarDateTime(date).label
        .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
        .replace(/[^0-9]/g, '-');
      return 'ورود-' + parts + '-' + String(date.getMilliseconds()).padStart(3, '0');
    }

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

    document.getElementById('entry-history-prev').addEventListener('click', () => {
      if (entryHistoryPage > 0) { entryHistoryPage -= 1; renderEntryHistory(); }
    });
    document.getElementById('entry-history-next').addEventListener('click', () => {
      if ((entryHistoryPage + 1) * ENTRY_PAGE_SIZE < loadEntryHistory().length) {
        entryHistoryPage += 1;
        renderEntryHistory();
      }
    });

    function loadShipments() {
      try { const records = JSON.parse(localStorage.getItem(SHIPMENT_KEY) || '[]'); return Array.isArray(records) ? records : []; }
      catch (error) { return []; }
    }
    function saveShipments(records) {
      try { localStorage.setItem(SHIPMENT_KEY, JSON.stringify(records)); return true; }
      catch (error) { shipmentFeedback.textContent = 'ذخیره تاریخچه ارسال انجام نشد؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.'; return false; }
    }

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
    document.getElementById('shipment-history-prev').addEventListener('click', () => {
      if (shipmentHistoryPage > 0) { shipmentHistoryPage -= 1; renderShipmentHistory(); }
    });
    document.getElementById('shipment-history-next').addEventListener('click', () => {
      if ((shipmentHistoryPage + 1) * ENTRY_PAGE_SIZE < loadShipments().length) {
        shipmentHistoryPage += 1;
        renderShipmentHistory();
      }
    });
    function solarDateTime(date = new Date()) {
      const datePart = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
      const timePart = new Intl.DateTimeFormat('fa-IR', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
      return {date:datePart,time:timePart,label:datePart+' '+timePart};
    }
    function makeShipmentNumber(prefix, date, epoch) {
      return prefix+'-'+solarDateTime(date).label.replace(/[^۰-۹٠-٩0-9]/g,'-')+'-'+String(epoch);
    }
    function createShipmentField(labelText, value, type='text') {
      const group=document.createElement('div'); group.className='field-group';
      const label=document.createElement('label'); label.textContent=labelText;
      const input=document.createElement('input'); input.type=type; input.value=value; input.required=true; input.className='shipment-quantity-input';
      if(type==='number'){input.min='0.0000001';input.step='any';input.inputMode='decimal';}
      else input.readOnly=true;
      input.id='shipment-field-'+Math.random().toString(36).slice(2); label.htmlFor=input.id;
      group.append(label,input); return {group,input};
    }
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
    function closeShipmentDialog() {
      if(typeof shipmentDialog.close==='function'&&shipmentDialog.open)shipmentDialog.close();else shipmentDialog.removeAttribute('open');
    }
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

    document.getElementById('clear-inventory-search').addEventListener('click', () => {
      inventorySearchInput.value = '';
      renderInventory();
      inventorySearchInput.focus();
    });

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
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openSection(link.getAttribute('href').slice(1));
      });
    });

    function formatDashboardNumber(value) {
      const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
      return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(safeValue);
    }

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

    function setupDashboard() {
      document.querySelectorAll('[data-section-target]').forEach(link => {
        link.addEventListener('click', event => {
          event.preventDefault();
          const sectionId = link.getAttribute('data-section-target');
          if (sectionId && document.getElementById(sectionId)) openSection(sectionId);
        });
      });
      updateDashboardSummary();
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

    function normalizeArabicLetters(value) {
      return String(value ?? '')
        .replace(/[يى]/g, 'ی')
        .replace(/ك/g, 'ک');
    }

    function toEnglishDigits(value) {
      return String(value ?? '')
        .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    }

    function normalizeStock(value) {
      const normalized = toEnglishDigits(value)
        .replace(/[٬,]/g, '')
        .replace(/٫/g, '.')
        .trim();
      if (normalized === '') return NaN;
      return Number(normalized);
    }

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

    function normalizeHeader(value) {
      return String(value ?? '').toLowerCase().replace(/[\s_\-()\[\]]+/g, '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
    }
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
    function isHeaderRow(row) { return Boolean(getHeaderMap(row)); }
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

    function getCombinedPendingRows() {
      const combined = [];
      pendingExcelRows.forEach(row => combined.push({ row, source: 'Excel/CSV' }));
      pendingClipboardRows.forEach(row => combined.push({ row, source: 'کلیپ‌بورد' }));
      const manualRow = [itemFormInputs.code.value.trim(), itemFormInputs.description.value.trim(), itemFormInputs.stock.value.trim()];
      if (manualRow.some(value => value !== '')) combined.push({ row: manualRow, source: 'ورود دستی' });
      return combined;
    }

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
    function closeImportErrorDialog() {
      if (importErrorDialog.open) importErrorDialog.close();
    }
    document.getElementById('import-error-close').addEventListener('click', closeImportErrorDialog);
    document.getElementById('import-error-ok').addEventListener('click', closeImportErrorDialog);

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

    function closeDuplicateDialog() {
      if (duplicateDialog.open) duplicateDialog.close();
    }

    document.getElementById('duplicate-dialog-x').addEventListener('click', closeDuplicateDialog);
    let pendingImportConfirmation = null;
    document.getElementById('duplicate-import-cancel').addEventListener('click', () => {
      pendingImportConfirmation = null;
      closeDuplicateDialog();
      inputFeedback.textContent = 'ورود لغو شد؛ اطلاعات انبار تغییری نکرد.';
    });
    document.getElementById('duplicate-import-confirm').addEventListener('click', () => {
      const confirm = pendingImportConfirmation;
      pendingImportConfirmation = null;
      closeDuplicateDialog();
      if (confirm) confirm();
    });
    duplicateDialog.addEventListener('click', event => {
      if (event.target === duplicateDialog) closeDuplicateDialog();
    });

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

    selectAllItems.addEventListener('change', () => {
      if (selectAllItems.checked) {
        inventoryItems.forEach(item => selectedItemCodes.add(item.code));
      } else {
        selectedItemCodes.clear();
      }
      renderInventory();
    });

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

    function normLocation(value) {
      return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa');
    }

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

    function saveShipmentLocations(locations) {
      try {
        localStorage.setItem(LOCATION_KEY, JSON.stringify(locations));
        return true;
      } catch (error) {
        return false;
      }
    }

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
    shipmentLocationInput.addEventListener('input',updateShipmentSublocations);shipmentLocationInput.addEventListener('change',updateShipmentSublocations);renderShipmentLocationOptions();
    openShipmentDialogButton.addEventListener('click', openShipmentDialog);
    shipmentForm.addEventListener('submit', commitShipment);
    document.getElementById('shipment-dialog-x').addEventListener('click', closeShipmentDialog);
    document.getElementById('shipment-cancel').addEventListener('click', closeShipmentDialog);

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

    inventorySearchInput.addEventListener('input', renderInventory);

    itemFormInputs.code.addEventListener('input', () => {
      const normalized = toEnglishDigits(itemFormInputs.code.value).replace(/[^0-9]/g, '').slice(0, 10);
      if (itemFormInputs.code.value !== normalized) itemFormInputs.code.value = normalized;
    });

    Object.values(itemFormInputs).forEach(input => {
      input.addEventListener('input', () => {
        renderSinglePreview();
        singleFeedback.textContent = '';
      });
    });

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

    pastedDataInput.addEventListener('input', () => {
      pendingClipboardRows = prepareImportRows(parseDelimitedText(pastedDataInput.value));
      inputFeedback.textContent = '';
      renderSharedInputPreview();
      importPreviewButton.disabled = !getCombinedPendingRows().some(item => normalizeRow(item.row));
    });

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

    function openBackupHandleDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(BACKUP_HANDLE_DB, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(BACKUP_HANDLE_STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
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
    function getSolarBackupFileName(date = new Date()) {
      const parts = new Intl.DateTimeFormat('en-u-ca-persian', { year: 'numeric', month: '2-digit' }).formatToParts(date);
      const year = parts.find(part => part.type === 'year')?.value;
      const month = parts.find(part => part.type === 'month')?.value;
      return 'anbar-backup-' + year + '-' + month + '.json';
    }
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

    backupGateChooseFolder.addEventListener('click', () => chooseBackupFolder(false));
    if (backupFolderButton) backupFolderButton.addEventListener('click', () => chooseBackupFolder(false));
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

    const normalizedKey = value => String(value ?? '').trim().replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).toLocaleLowerCase('fa');
    const uniqueValues = (records, field) => new Set(records.map(record => normalizedKey(record && record[field])).filter(Boolean));
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

    document.getElementById('refresh-backup-log').addEventListener('click', () => {
      renderActivityResults(document.getElementById('backup-log-results'), loadActivityLog(), 'هنوز رخدادی ثبت نشده است.');
    });
    renderEntryHistory();
    renderShipmentHistory();
    renderActivityResults(document.getElementById('backup-log-results'), loadActivityLog(), 'هنوز رخدادی ثبت نشده است.');
