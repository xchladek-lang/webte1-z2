const STORAGE_KEY = 'lunchMenu';

let menuData = null;          
let selectedDay = 'Pondelok'; 
let hiddenIds = [];           

const menuList = document.getElementById('menuList');
const loader = document.getElementById('loader');
const dataStatus = document.getElementById('dataStatus');
const refreshButton = document.getElementById('refreshButton');
const clearButton = document.getElementById('clearButton');

function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function dateToISO(date) {
    const parts = date.split('.');
    if (parts.length !== 3) {
        return '';
    }
    return parts[2] + '-' + parts[1] + '-' + parts[0];
}

function formatDateTime(iso) {
    return new Date(iso).toLocaleString('sk-SK', {
        day: 'numeric', month: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function createEl(tag, classes, text) {
    const el = document.createElement(tag);
    if (classes) {
        el.className = classes;
    }
    if (text) {
        el.textContent = text;
    }
    return el;
}

function createIcon(name) {
    const i = createEl('i', 'bi ' + name + ' me-1');
    i.setAttribute('aria-hidden', 'true');
    return i;
}

function showToast(text) {
    document.getElementById('toastText').textContent = text;
    bootstrap.Toast.getOrCreateInstance(document.getElementById('toast')).show();
}


/* Localstorage */

function loadSaved() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
        return null;
    }
}

function saveData(value) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (e) {
        console.warn('Dáta sa nepodarilo uložiť do localStorage.', e);
    }
}

function clearSaved() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn('Dáta sa nepodarilo vymazať.', e);
    }
}

/* Loading */
async function loadRestaurant(restaurant) {
    let html;

    // Local download
    try {
        const response = await fetch(restaurant.localFile);
        if (!response.ok) {
            throw new Error('súbor ' + restaurant.localFile + ' sa nenašiel (chyba ' + response.status + ')');
        }
        html = await response.text();
    } catch (e) {
        return createResult(restaurant.id, [], 'Stránka reštaurácie je nedostupná: ' + e.message + '.');
    }

    // Text -> DOM -> Parser
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return restaurant.parse(doc);
    } catch (e) {
        console.error(restaurant.name, e);
        return createResult(restaurant.id, [], 'Menu sa nepodarilo spracovať – stránka reštaurácie pravdepodobne zmenila štruktúru.');
    }
}

// Load all restaurants
async function refreshMenu() {
    loader.classList.remove('d-none');
    menuList.replaceChildren();
    refreshButton.disabled = true;
    clearButton.disabled = true;

    const results = await Promise.allSettled(RESTAURANTS.map(loadRestaurant));

    const restaurants = results.map(function (r, i) {
        if (r.status === 'fulfilled') {
            return r.value;
        }
        return createResult(RESTAURANTS[i].id, [], 'Neočakávaná chyba pri načítaní.');
    });

    menuData = { date: todayISO(), restaurants: restaurants };
    saveData(menuData);

    loader.classList.add('d-none');
    refreshButton.disabled = false;
    clearButton.disabled = false;
    render();
    showToast('Menu bolo aktualizované.');
}

/* Render */
function render() {
    menuList.replaceChildren();

    const dayLabel = selectedDay === 'week' ? 'Celý týždeň' : selectedDay;
    document.title = dayLabel + ' – Obedové menu v okolí FEI STU';

    if (!menuData) {
        dataStatus.textContent = 'Nie sú uložené žiadne dáta. Kliknite na „Aktualizovať menu“.';
        return;
    }

    dataStatus.textContent = 'Dáta uložené ' + menuData.date.split('-').reverse().join('. ') +
        ' z lokálnych kópií stránok (priečinok local/).';

    const visible = menuData.restaurants.filter(function (r) {
        return !hiddenIds.includes(r.id);
    });

    if (visible.length === 0) {
        menuList.append(createEl('p', 'text-secondary', 'Všetky reštaurácie sú skryté filtrom.'));
        return;
    }

    visible.forEach(function (r) {
        menuList.append(createCard(r));
    });
}

// One restaurant card
function createCard(r) {
    const column = createEl('div', 'col-12 col-xl-6');   // do 1200 px 1 karta, potom 2
    const card = createEl('article', 'card restaurant-card h-100');
    const body = createEl('div', 'card-body p-4');

    const title = createEl('h2', 'restaurant-name h5 fw-bold mb-2');
    const link = createEl('a', 'text-reset text-decoration-none', r.name);
    link.href = r.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.append(' ', createIcon('bi-box-arrow-up-right small text-accent'));
    title.append(link);

    const address = createEl('p', 'small text-secondary mb-1');
    address.append(createIcon('bi-geo-alt'), r.address);

    const updated = createEl('p', 'small text-secondary mb-4');
    const time = createEl('time', '', formatDateTime(r.lastUpdated));
    time.dateTime = r.lastUpdated;
    updated.append(createIcon('bi-clock'), 'Aktualizované: ', time);

    body.append(title, address, updated);

    if (r.error) {
        const alert = createEl('div', 'alert alert-warning small mb-0');
        alert.setAttribute('role', 'alert');
        alert.append(createIcon('bi-exclamation-triangle'), r.error);
        body.append(alert);
        card.append(body);
        column.append(card);
        return column;
    }

    // Weekly specials
    if (r.notes && r.notes.length > 0) {
        const notes = createEl('ul', 'notes list-unstyled small mb-4');
        r.notes.forEach(function (text) {
            const li = createEl('li', 'mb-1');
            li.append(createIcon('bi-star text-accent'), text);
            notes.append(li);
        });
        body.append(notes);
    }

    const daysToShow = selectedDay === 'week' ? DAYS : [selectedDay];
    daysToShow.forEach(function (day) {
        body.append(createDayBlock(r, day));
    });

    card.append(body);
    column.append(card);
    return column;
}

// One day block
function createDayBlock(r, day) {
    const block = createEl('section', 'day-block mb-4');
    const items = r.menu.filter(function (item) { return item.day === day; });

    const heading = createEl('h3', 'day-title fw-bold mb-1', day + ' ');
    const date = items.length > 0 ? items[0].date : null;
    if (date) {
        const time = createEl('time', 'fw-normal text-secondary', date);
        time.dateTime = dateToISO(date);
        heading.append(time);
    }
    block.append(heading);

    if (items.length === 0) {
        block.append(createEl('p', 'small text-secondary fst-italic py-2 mb-0', 'Menu na tento deň nie je k dispozícii.'));
        return block;
    }

    const list = createEl('ul', 'list-unstyled mb-0');
    items.forEach(function (item) {
        list.append(createMenuItem(item));
    });
    block.append(list);
    return block;
}

function createMenuItem(item) {
    const li = createEl('li', 'menu-item d-flex justify-content-between gap-3');
    const left = createEl('div');

    let badgeClass = 'badge-other';
    if (item.type === 'Polievka') {
        badgeClass = 'badge-soup';
    } else if (item.type === 'Hlavné jedlo') {
        badgeClass = 'badge-main';
    }
    left.append(createEl('span', 'badge ' + badgeClass + ' mb-1', item.type));

    left.append(createEl('div', item.type === 'Polievka' ? '' : 'fw-bold', item.name));

    const extras = [];
    if (item.weight) {
        extras.push(item.weight);
    }
    if (item.allergens) {
        extras.push('Alergény: ' + item.allergens);
    }
    if (extras.length > 0) {
        left.append(createEl('div', 'small text-secondary', extras.join(' · ')));
    }

    const priceParts = (item.price || '—').split(' · ');
    const price = createEl('div', 'price', priceParts[0]);
    if (priceParts[1]) {
        price.append(createEl('small', '', priceParts[1]));
    }

    li.append(left, price);
    return li;
}

/* Default day selector */
function setDefaultDay() {
    const dayNumber = new Date().getDay();   
    if (dayNumber >= 1 && dayNumber <= 5) {
        selectedDay = DAYS[dayNumber - 1];
    } else {
        selectedDay = 'Pondelok';
        document.getElementById('weekendInfo').classList.remove('d-none');
    }
}

function markActiveDayButton() {
    document.querySelectorAll('[data-day]').forEach(function (button) {
        const active = button.dataset.day === selectedDay;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

// Checkboxes
function createFilters() {
    const filters = document.getElementById('filters');
    RESTAURANTS.forEach(function (r) {
        const wrapper = createEl('div', 'form-check mb-1');
        const input = createEl('input', 'form-check-input');
        input.type = 'checkbox';
        input.id = 'filter-' + r.id;
        input.checked = true;
        input.addEventListener('change', function () {
            if (input.checked) {
                hiddenIds = hiddenIds.filter(function (id) { return id !== r.id; });
            } else {
                hiddenIds.push(r.id);
            }
            render();
        });
        const label = createEl('label', 'form-check-label', r.name);
        label.htmlFor = input.id;
        wrapper.append(input, label);
        filters.append(wrapper);
    });
}


/* APP START BBYBOY CLAUDE COOKED FRFR */

const todayDate = document.getElementById('todayDate');
todayDate.textContent = new Date().toLocaleDateString('sk-SK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});
todayDate.dateTime = todayISO();

createFilters();
setDefaultDay();
markActiveDayButton();

document.querySelectorAll('[data-day]').forEach(function (button) {
    button.addEventListener('click', function () {
        selectedDay = button.dataset.day;
        markActiveDayButton();
        render();
    });
});

refreshButton.addEventListener('click', refreshMenu);

clearButton.addEventListener('click', function () {
    clearSaved();
    menuData = null;
    render();
    showToast('Uložené dáta boli vymazané.');
});

// Todays data, we will not load again
menuData = loadSaved();
if (menuData && menuData.date === todayISO() && Array.isArray(menuData.restaurants)) {
    render();
} else {
    refreshMenu();
}

// Life is life but life is not what life used to be so life
// will be life when we learn to live life.
// OS & webte in the same day, good luck y'all! 