const SAVE_KEY = 'oliveClickerSave';
const SAVE_VERSION = 1;

const upgrades = {
    press: { initialCost: 15, growth: 1.15, production: 1, clickPower: 0 },
    grove: { initialCost: 100, growth: 1.15, production: 5, clickPower: 0 },
    mill: { initialCost: 500, growth: 1.15, production: 25, clickPower: 0 },
    gloves: { initialCost: 50, growth: 1.5, production: 0, clickPower: 1 },
    basket: { initialCost: 500, growth: 1.5, production: 0, clickPower: 10 }
};

const defaultState = () => ({
    olives: 0,
    totalClicks: 0,
    owned: Object.fromEntries(Object.keys(upgrades).map((name) => [name, 0]))
});

const elements = {
    oliveCount: document.querySelector('#olive-count'),
    productionRate: document.querySelector('#production-rate'),
    clickPower: document.querySelector('#click-power'),
    oliveButton: document.querySelector('#olive-button'),
    upgradeList: document.querySelector('#upgrade-list'),
    saveStatus: document.querySelector('#save-status'),
    resetButton: document.querySelector('#reset-button'),
    resetDialog: document.querySelector('#reset-dialog'),
    confirmReset: document.querySelector('#confirm-reset')
};

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function isValidSave(save) {
    return save
        && save.version === SAVE_VERSION
        && Number.isFinite(save.olives)
        && save.olives >= 0
        && Number.isFinite(save.totalClicks)
        && save.totalClicks >= 0
        && save.owned
        && Object.keys(upgrades).every((name) =>
            Number.isSafeInteger(save.owned[name]) && save.owned[name] >= 0
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
            owned: Object.fromEntries(Object.keys(upgrades).map((name) => [name, save.owned[name]]))
        };
    } catch (error) {
        console.error('Unable to load Olive Clicker progress.', error);
        return defaultState();
    }
}

let state = loadGame();

function productionPerSecond() {
    return Object.entries(upgrades).reduce(
        (total, [name, upgrade]) => total + state.owned[name] * upgrade.production,
        0
    );
}

function olivesPerClick() {
    return 1 + Object.entries(upgrades).reduce(
        (total, [name, upgrade]) => total + state.owned[name] * upgrade.clickPower,
        0
    );
}

function upgradeCost(name) {
    const upgrade = upgrades[name];
    return Math.ceil(upgrade.initialCost * upgrade.growth ** state.owned[name]);
}

function saveGame() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
            version: SAVE_VERSION,
            olives: state.olives,
            totalClicks: state.totalClicks,
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

    elements.upgradeList.querySelectorAll('[data-upgrade]').forEach((button) => {
        const name = button.dataset.upgrade;
        const cost = upgradeCost(name);
        button.querySelector('[data-cost]').textContent = numberFormat.format(cost);
        button.querySelector('[data-owned]').textContent = numberFormat.format(state.owned[name]);
        button.disabled = state.olives < cost;
    });
}

elements.oliveButton.addEventListener('click', () => {
    state.olives += olivesPerClick();
    state.totalClicks += 1;
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

elements.resetButton.addEventListener('click', () => {
    elements.resetDialog.showModal();
});

elements.resetDialog.addEventListener('submit', (event) => {
    if (event.submitter !== elements.confirmReset) return;

    try {
        localStorage.removeItem(SAVE_KEY);
        state = defaultState();
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

    state.olives += production;
    render();
}, 1000);

window.setInterval(saveGame, 5000);
window.addEventListener('pagehide', saveGame);

render();
