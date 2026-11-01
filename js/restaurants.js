const DAYS = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok'];

const RESTAURANTS = [
    {
        id: 'druzba',
        name: 'Družba Cantina',
        url: 'https://www.druzbacatering.sk/jedalny-listok/',
        address: 'Botanická 25, 842 14 Bratislava',
        localFile: 'local/druzba.html',
        parse: parseDruzba
    },
    {
        id: 'eatandmeet',
        name: 'Eat & Meet',
        url: 'https://eatandmeet.sk/tyzdenne-menu',
        address: 'Staré Grunty 36, Átriaky, Blok AD-U, Bratislava',
        localFile: 'local/eatandmeet.html',
        parse: parseEatAndMeet
    },
    {
        id: 'nasehospoda',
        name: 'Naše Hospoda Karloveská',
        url: 'https://www.nasehospoda-karloveska.sk/',
        address: 'Segnerova 3, 841 02 Bratislava – Karlova Ves',
        localFile: 'local/nasehospoda.html',
        parse: parseNaseHospoda
    }
];


/*              HELPER FUNCTIONS BBY                 */

// Connect text with ' ' (space)
function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

// Finds day (weekend = null)
function findDay(text) {
    const lower = cleanText(text).toLowerCase();
    const day = DAYS.find(function (d) {
        return lower.startsWith(d.toLowerCase());
    });
    return day || null;
}

// One thing
function createItem(day, date, type, name, price, allergens, weight) {
    return {
        day: day,
        date: date || null,
        type: type,
        name: name,
        price: price || null,
        allergens: allergens || null,
        weight: weight || null
    };
}

// Packs restaurants into the same structure
function createResult(id, menu, error, notes) {
    const r = RESTAURANTS.find(function (x) { return x.id === id; });

    if (!error && menu.length === 0) {
        error = 'Na stránke sa nenašlo žiadne menu (možno sa zmenila jej štruktúra).';
    }

    return {
        id: r.id,
        name: r.name,
        url: r.url,
        address: r.address,
        lastUpdated: new Date().toISOString(),
        error: error || null,
        menu: menu,
        notes: notes || []
    };
}

// Delete () from allergens
function splitAllergens(text) {
    const match = text.match(/\(\s*([\d,\s]+)\)\s*$/);
    if (!match) {
        return { text: text, allergens: null };
    }
    return {
        text: text.slice(0, match.index).trim(),
        allergens: match[1].replace(/\s/g, '')
    };
}

// Monday date (Only Eat&meet bahahahha skill issue)
function getMondayOfThisWeek() {
    const d = new Date();
    const dayIndex = (d.getDay() + 6) % 7; 
    d.setDate(d.getDate() - dayIndex);
    return d;
}

// Date -> "26.10.2026" (num -> text)
function formatDate(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return day + '.' + month + '.' + d.getFullYear();
}


/* DRUŽBA */
function parseDruzba(doc) {
    const menu = [];

    doc.querySelectorAll('h2').forEach(function (h2) {
        const heading = cleanText(h2.textContent);      
        const day = findDay(heading);
        if (!day) {
            return;                                     
        }
        const date = heading.split(' ')[1] || null;

        const table = h2.parentElement.nextElementSibling;
        if (!table || table.tagName !== 'TABLE') {
            return;
        }

        table.querySelectorAll('tr').forEach(function (row) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) {
                return;                                 
            }

            const text = cleanText(cells[0].textContent);
            const priceText = cleanText(cells[1].textContent);
            if (text === '' || text === 'Názov') {
                return;                                 
            }

            let type;
            let name;
            let weight = null;

            if (text.toLowerCase().startsWith('polievka')) {
                type = 'Polievka';
                const parts = text.split(':');
                weight = parts[0].replace(/polievka/i, '').trim();   
                name = parts.slice(1).join(':').trim();
            } else {
                type = 'Hlavné jedlo';
                name = text.replace(/^[IVX]+\.\s*/, '');
                const w = name.match(/^(\d+\s?g)\s+/);
                if (w) {
                    weight = w[1];
                    name = name.slice(w[0].length);
                }
            }

            const split = splitAllergens(name);
            menu.push(createItem(
                day, date, type,
                split.text.replace(/,$/, ''),
                priceDruzba(priceText),
                split.allergens,
                weight
            ));
        });
    });

    return createResult('druzba', menu);
}


function priceDruzba(text) {
    const match = text.match(/(\d+,\d+)\s*€?\s*\/\s*(\d+,\d+)/);
    if (match) {
        return match[2] + ' € · ISIC ' + match[1] + ' €';
    }
    if (text === '') {
        return null;
    }
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}


/* Eat & meet */
function parseEatAndMeet(doc) {
    const menu = [];
    const monday = getMondayOfThisWeek();

    for (let i = 1; i <= 5; i++) {                      
        const panel = doc.querySelector('#day-' + i);
        if (!panel) {
            continue;
        }

        const tab = doc.querySelector('a[href="#day-' + i + '"]');
        const day = (tab && findDay(tab.textContent)) || DAYS[i - 1];

        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + (i - 1));
        const date = formatDate(dayDate);

        panel.querySelectorAll('.menu-details').forEach(function (meal) {
            const titleEl = meal.querySelector('.menu-title h4');
            const priceEl = meal.querySelector('.menu-title .price');
            const descEl = meal.querySelector('.menu-description .desc');
            if (!titleEl || !descEl) {
                return;
            }

            const allergenSpan = descEl.querySelector('span');
            let allergens = null;
            let name = descEl.textContent;
            if (allergenSpan) {
                allergens = cleanText(allergenSpan.textContent).replace('(', '').replace(')', '');
                name = name.replace(allergenSpan.textContent, '');
            }

            menu.push(createItem(
                day, date,
                typeEatAndMeet(cleanText(titleEl.textContent)),
                cleanText(name),
                priceEatAndMeet(priceEl),
                allergens,
                null                                    
            ));
        });
    }

    return createResult('eatandmeet', menu);
}

function typeEatAndMeet(title) {
    const lower = title.toLowerCase();
    if (lower.startsWith('polievka')) {
        return 'Polievka';
    }
    if (lower.startsWith('menu')) {
        return 'Hlavné jedlo';
    }
    return title.charAt(0) + title.slice(1).toLowerCase();
}

function priceEatAndMeet(priceEl) {
    if (!priceEl) {
        return null;
    }
    const parts = cleanText(priceEl.textContent).split('/');
    const regular = parts[0].trim();
    const subsidized = (parts[1] || '').trim();
    if (subsidized === '' || subsidized === regular) {
        return regular;
    }
    return regular + ' · s dotáciou ' + subsidized;
}

/* Naše Hospoda Karloveská */
function parseNaseHospoda(doc) {
    const section = doc.querySelector('#menu');
    if (!section) {
        return createResult('nasehospoda', [], 'Na stránke sa nenašla sekcia s menu (#menu).');
    }

    const menu = [];
    const notes = [];

    section.querySelectorAll('article').forEach(function (card) {
        const rows = card.querySelectorAll('.divide-y > div');

        // Týždenný špeciál → poznámka k celému týždňu
        const h3 = card.querySelector('h3');
        if (h3) {
            rows.forEach(function (row) {
                const meal = readHospodaMeal(row);
                notes.push(cleanText(h3.textContent) + ': ' + meal.name +
                    (meal.price ? ' – ' + meal.price : ''));
            });
            return;
        }
        const header = card.firstElementChild;
        if (!header || !header.firstElementChild) {
            return;
        }
        const info = header.firstElementChild.children;
        const day = findDay(info[0] ? info[0].textContent : '');
        if (!day) {
            return;                                     
        }
        const date = info[1] ? cleanText(info[1].textContent) : null;

        rows.forEach(function (row) {
            const meal = readHospodaMeal(row);
            if (meal.name) {
                menu.push(createItem(day, date, meal.type, meal.name, meal.price, meal.allergens, meal.weight));
            }
        });
    });
    
    section.querySelectorAll('div').forEach(function (div) {
        if (cleanText(div.textContent) === 'Akcia k dennému menu' && div.nextElementSibling) {
            notes.push('Akcia: ' + cleanText(div.nextElementSibling.textContent));
        }
    });

    return createResult('nasehospoda', menu, null, notes);
}

function readHospodaMeal(row) {
    const meal = { type: 'Hlavné jedlo', name: '', price: null, allergens: null, weight: null };

    const content = row.querySelector('.flex-1');      
    const priceEl = row.querySelector('.shrink-0');     
    if (!content || !content.firstElementChild) {
        return meal;
    }

    const nameEl = content.firstElementChild;
    const infoEl = content.children[1];

    nameEl.querySelectorAll('span').forEach(function (span) {
        const t = cleanText(span.textContent);
        if (!/^\d+\.$/.test(t)) {
            meal.weight = t;
        }
    });

    let name = '';
    nameEl.childNodes.forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE) {
            name += node.textContent;
        }
    });
    meal.name = cleanText(name);

    if (infoEl) {
        const info = cleanText(infoEl.textContent);
        if (info.toLowerCase().startsWith('polievka')) {
            meal.type = 'Polievka';
        }
        const pos = info.indexOf('Alergény:');
        if (pos !== -1) {
            meal.allergens = info.slice(pos + 'Alergény:'.length).trim();
        }
    }

    if (priceEl) {
        meal.price = cleanText(priceEl.textContent);
    }
    return meal;
}
