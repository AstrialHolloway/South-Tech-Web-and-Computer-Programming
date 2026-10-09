const SAVE_KEY = 'oliveClickerSave';
const SAVE_VERSION = 2;
const MAX_GAME_VALUE = 1e300;
const PRESTIGE_BASE_COST = 5_000_000;
const MAX_BACKGROUND_OLIVES = 40;

const upgrades = {
    press: { name: 'Olive Press', icon: '⚙️', initialCost: 15, growth: 1.35, production: 1, clickPower: 0 },
    grove: { name: 'Olive Grove', icon: '🌳', initialCost: 100, growth: 1.4, production: 5, clickPower: 0, previous: 'press', requiredOwned: 5 },
    mill: { name: 'Oil Mill', icon: '🏭', initialCost: 500, growth: 1.45, production: 25, clickPower: 0, previous: 'grove', requiredOwned: 5 },
    refinery: { name: 'Golden Refinery', icon: '✨', initialCost: 2500, growth: 1.5, production: 100, clickPower: 0, previous: 'mill', requiredOwned: 5 },
    orchard: { name: 'Grand Orchard', icon: '🌿', initialCost: 12000, growth: 1.55, production: 500, clickPower: 0, previous: 'refinery', requiredOwned: 5 },
    gloves: { name: 'Picking Gloves', icon: '🧤', initialCost: 50, growth: 1.4, production: 0, clickPower: 1 },
    basket: { name: 'Giant Basket', icon: '🧺', initialCost: 300, growth: 1.5, production: 0, clickPower: 10, previous: 'gloves', requiredOwned: 5 },
    tractor: { name: 'Olive Tractor', icon: '🚜', initialCost: 1800, growth: 1.55, production: 0, clickPower: 50, previous: 'basket', requiredOwned: 5 },
    goldenTouch: { name: 'Golden Touch', icon: '🪙', initialCost: 10000, growth: 1.6, production: 0, clickPower: 250, previous: 'tractor', requiredOwned: 5 },
    prestigePress: { name: 'Prestige Press', icon: '🌟', initialCost: 1000, growth: 1.5, production: 250, clickPower: 0, prestigeRequired: 1 },
    starGrove: { name: 'Star Grove', icon: '🌠', initialCost: 10000, growth: 1.6, production: 2500, clickPower: 0, prestigeRequired: 2 },
    cosmicBasket: { name: 'Cosmic Basket', icon: '🌌', initialCost: 50000, growth: 1.7, production: 0, clickPower: 1000, prestigeRequired: 3 }
};

const defaultState = () => ({
    olives: 0,
    totalClicks: 0,
    prestige: 0,
    owned: Object.fromEntries(Object.keys(upgrades).map((name) => [name, 0]))
});

const elements = {
    oliveCount: document.querySelector('#olive-count'),
    productionRate: document.querySelector('#production-rate'),
    clickPower: document.querySelector('#click-power'),
    prestigeLevel: document.querySelector('#prestige-level'),
    oliveButton: document.querySelector('#olive-button'),
    fallingOlives: document.querySelector('#falling-olives'),
    upgradeList: document.querySelector('#upgrade-list'),
    prestigeCost: document.querySelector('#prestige-cost'),
    prestigeButton: document.querySelector('#prestige-button'),
    prestigeDialog: document.querySelector('#prestige-dialog'),
    confirmPrestige: document.querySelector('#confirm-prestige'),
    eventPopup: document.querySelector('#event-popup'),
    eventTitle: document.querySelector('#event-title'),
    eventMessage: document.querySelector('#event-message'),
    dismissEvent: document.querySelector('#dismiss-event'),
    saveStatus: document.querySelector('#save-status'),
    resetButton: document.querySelector('#reset-button'),
    resetDialog: document.querySelector('#reset-dialog'),
    confirmReset: document.querySelector('#confirm-reset')
};

const numberFormat = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1
});

function isValidSave(save) {
    return save
        && (save.version === 1 || save.version === SAVE_VERSION)
        && Number.isFinite(save.olives)
        && save.olives >= 0
        && Number.isFinite(save.totalClicks)
        && save.totalClicks >= 0
        && (save.version === 1 || (Number.isSafeInteger(save.prestige) && save.prestige >= 0))
        && save.owned
        && Object.keys(save.owned).every((name) =>
            !Object.hasOwn(upgrades, name)
                || (Number.isSafeInteger(save.owned[name]) && save.owned[name] >= 0)
        );
}

function loadGame() {
    try {
        const savedValue = localStorage.getItem(SAVE_KEY);
        if (!savedValue) return defaultState();

        const save = JSON.parse(savedValue);
        if (!isValidSave(save)) {
            console.warn('Olive Clicker save data was invalid; starting a new game.');
            return defaultState();
        }

        return {
            olives: save.olives,
            totalClicks: save.totalClicks,
            prestige: save.version === 1 ? 0 : save.prestige,
            owned: Object.fromEntries(Object.keys(upgrades).map((name) => [
                name,
                save.owned[name] ?? 0
            ]))
        };
    } catch (error) {
        console.error('Unable to load Olive Clicker progress.', error);
        return defaultState();
    }
}

let state = loadGame();
let activeEvent = null;
let eventExpiryTimer = null;

function productionPerSecond() {
    const baseProduction = Object.entries(upgrades).reduce((total, [name, upgrade]) =>
        total + upgradeAmount(upgrade.production, state.owned[name]), 0
    );
    const prestigeMultiplier = Math.min(MAX_GAME_VALUE, 1 + 0.5 * state.prestige);
    return Math.min(MAX_GAME_VALUE, baseProduction * prestigeMultiplier * (activeEvent?.multiplier ?? 1));
}

function olivesPerClick() {
    const baseClickPower = 1 + Object.entries(upgrades).reduce((total, [name, upgrade]) =>
        total + clickUpgradeAmount(upgrade.clickPower, state.owned[name]), 0
    );
    return Math.min(MAX_GAME_VALUE, baseClickPower * Math.min(MAX_GAME_VALUE, 1 + 0.5 * state.prestige));
}

function upgradeAmount(amount, owned) {
    if (amount === 0 || owned === 0) return 0;
    return Math.min(MAX_GAME_VALUE, amount * owned);
}

function clickUpgradeAmount(amount, owned) {
    return Math.min(MAX_GAME_VALUE, amount * owned);
}

function upgradeCost(name) {
    const upgrade = upgrades[name];
    return Math.min(MAX_GAME_VALUE, Math.ceil(upgrade.initialCost * upgrade.growth ** state.owned[name]));
}

function prestigeCost() {
    return Math.min(MAX_GAME_VALUE, PRESTIGE_BASE_COST * 5 ** state.prestige);
}

function isUpgradeUnlocked(upgrade) {
    const previousUnlocked = !upgrade.previous
        || state.owned[upgrade.previous] >= upgrade.requiredOwned;
    const prestigeUnlocked = !upgrade.prestigeRequired
        || state.prestige >= upgrade.prestigeRequired;
    return previousUnlocked && prestigeUnlocked;
}

function spawnFallingOlive() {
    if (elements.fallingOlives.childElementCount >= MAX_BACKGROUND_OLIVES) return;

    const olive = document.createElement('span');
    olive.className = 'falling-olive';
    olive.setAttribute('aria-hidden', 'true');
    olive.textContent = '🫒';
    olive.style.left = `${Math.random() * 100}vw`;
    olive.style.setProperty('--fall-duration', `${2.5 + Math.random() * 2}s`);
    elements.fallingOlives.append(olive);
    olive.addEventListener('animationend', () => olive.remove(), { once: true });
}

function hideEventPopup() {
    elements.eventPopup.hidden = true;
}

function showRandomEvent() {
    const events = [
        { title: 'Olive boom!', message: 'The harvest is thriving: production doubled for 20 seconds.', multiplier: 2 },
        { title: 'Perfect weather!', message: 'Gentle sunshine boosts production by 50% for 20 seconds.', multiplier: 1.5 },
        { title: 'A swarm of pests!', message: 'Pests slow production to half speed for 20 seconds.', multiplier: 0.5 },
        { title: 'The oil spill!', message: 'A messy spill slows production to 25% for 20 seconds.', multiplier: 0.25 }
    ];
    const event = events[Math.floor(Math.random() * events.length)];

    activeEvent = { multiplier: event.multiplier };
    elements.eventTitle.textContent = event.title;
    elements.eventMessage.textContent = event.message;
    elements.eventPopup.hidden = false;
    window.clearTimeout(eventExpiryTimer);
    eventExpiryTimer = window.setTimeout(() => {
        activeEvent = null;
        hideEventPopup();
        render();
    }, 20_000);
    render();
}

function scheduleRandomEvent() {
    window.setTimeout(() => {
        showRandomEvent();
        scheduleRandomEvent();
    }, 30_000 + Math.random() * 30_000);
}

function saveGame() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
            version: SAVE_VERSION,
            olives: state.olives,
            totalClicks: state.totalClicks,
            prestige: state.prestige,
            owned: state.owned
        }));
        elements.saveStatus.textContent = 'Progress saves automatically';
    } catch (error) {
        console.error('Unable to save Olive Clicker progress.', error);
        elements.saveStatus.textContent = 'Could not save progress in this browser';
    }
}

function render() {
    elements.oliveCount.textContent = numberFormat.format(state.olives);
    elements.productionRate.textContent = numberFormat.format(productionPerSecond());
    elements.clickPower.textContent = numberFormat.format(olivesPerClick());
    elements.prestigeLevel.textContent = numberFormat.format(state.prestige);
    elements.prestigeCost.textContent = numberFormat.format(prestigeCost());
    elements.prestigeButton.disabled = state.olives < prestigeCost();

    elements.upgradeList.querySelectorAll('[data-upgrade]').forEach((button) => {
        const name = button.dataset.upgrade;
        const upgrade = upgrades[name];
        const cost = upgradeCost(name);
        button.querySelector('[data-cost]').textContent = numberFormat.format(cost);
        button.querySelector('[data-owned]').textContent = numberFormat.format(state.owned[name]);
        const unlocked = isUpgradeUnlocked(upgrade);
        button.hidden = !unlocked;
        button.disabled = state.olives < cost;
        button.querySelector('[data-unlock]').textContent =
            `Next purchase: +${numberFormat.format(upgrade.production ? upgrade.production : upgrade.clickPower)} ${upgrade.production ? 'olives/sec' : 'per click'}`;
    });
}

elements.oliveButton.addEventListener('click', () => {
    state.olives = Math.min(MAX_GAME_VALUE, state.olives + olivesPerClick());
    state.totalClicks += 1;
    spawnFallingOlive();
    render();
    saveGame();
});

elements.upgradeList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-upgrade]');
    if (!button || button.disabled) return;

    const name = button.dataset.upgrade;
    const cost = upgradeCost(name);
    if (state.olives < cost) return;

    state.olives -= cost;
    state.owned[name] += 1;
    render();
    saveGame();
});

elements.prestigeButton.addEventListener('click', () => {
    if (state.olives >= prestigeCost()) elements.prestigeDialog.showModal();
});

elements.prestigeDialog.addEventListener('submit', (event) => {
    if (event.submitter !== elements.confirmPrestige) return;

    state = {
        ...defaultState(),
        prestige: state.prestige + 1
    };
    render();
    saveGame();
});

elements.dismissEvent.addEventListener('click', hideEventPopup);

elements.resetButton.addEventListener('click', () => {
    elements.resetDialog.showModal();
});

elements.resetDialog.addEventListener('submit', (event) => {
    if (event.submitter !== elements.confirmReset) return;

    try {
        localStorage.removeItem(SAVE_KEY);
        state = defaultState();
        activeEvent = null;
        window.clearTimeout(eventExpiryTimer);
        hideEventPopup();
        render();
        elements.saveStatus.textContent = 'Progress reset. A new save will be created as you play.';
    } catch (error) {
        event.preventDefault();
        console.error('Unable to reset Olive Clicker progress.', error);
        elements.saveStatus.textContent = 'Could not reset saved progress. Please try again.';
    }
});

window.setInterval(() => {
    const production = productionPerSecond();
    if (production === 0) return;

    state.olives = Math.min(MAX_GAME_VALUE, state.olives + production);
    render();
}, 1000);

window.setInterval(saveGame, 5000);
window.addEventListener('pagehide', saveGame);

render();
scheduleRandomEvent();
