// Runs in the EA web app's main world.
// Enhancements for the Squad Builder view (UTSquadBuilderView).

fc26.applySquadBuilderPreset = function (preset, root) {

    function simulateClick(el) {
        ['mousedown', 'mouseup', 'click'].forEach(function (eventType) {
            if (eventType === 'click' && typeof el.click === 'function') { return el.click(); }
            el.dispatchEvent(new MouseEvent(eventType, { view: window, bubbles: true, cancelable: true }));
        });
    }

    // --- Toggles ---
    function setToggle(labelText, desiredState) {
        if (desiredState === null) return;
        var cells = root.querySelectorAll('.ut-toggle-cell-view');
        for (var i = 0; i < cells.length; i++) {
            var lbl = cells[i].querySelector('.ut-toggle-cell-view--label');
            if (lbl && lbl.textContent.trim() === labelText) {
                var toggle = cells[i].querySelector('.ut-toggle-control');
                var isOn = toggle && toggle.classList.contains('toggled');
                if (isOn !== desiredState) simulateClick(toggle);
                break;
            }
        }
    }
    setToggle('Use Concept Players',         preset.useConcept);
    setToggle('Untradeables Only',           preset.untradeablesOnly);
    setToggle('Exclude Active Squad Players',preset.excludeActiveSquad);
    setToggle('Ignore Position',             preset.ignorePosition);

    // --- OVR inputs ---
    var ovrInputs = root.querySelectorAll('.text-input-container .inputs .ut-number-input-control');
    if (ovrInputs.length >= 2) {
        if (preset.minOvr !== null) {
            ovrInputs[0].value = String(preset.minOvr);
            ovrInputs[0].dispatchEvent(new Event('input',  { bubbles: true }));
            ovrInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (preset.maxOvr !== null) {
            ovrInputs[1].value = String(preset.maxOvr);
            ovrInputs[1].dispatchEvent(new Event('input',  { bubbles: true }));
            ovrInputs[1].dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // --- Async dropdown queue ---
    var tasks = [];

    function enqueue(triggerEl, text) {
        if (triggerEl) tasks.push({ trigger: triggerEl, text: text });
    }

    function findFilterByImage(pattern) {
        var controls = root.querySelectorAll('.ut-search-filter-control');
        for (var i = 0; i < controls.length; i++) {
            var img = controls[i].querySelector('img.ut-search-filter-control--row-image');
            if (img && img.src.indexOf(pattern) !== -1) return controls[i];
        }
        return null;
    }

    if (preset.sortBy !== null) {
        var sortByLabel = root.querySelector('.sort-filter-container:not([data-fc26-action]) .ut-drop-down-control .label');
        enqueue(sortByLabel, preset.sortBy);
    }
    if (preset.storage !== null) {
        var storageCtrl = findFilterByImage('players_club');
        enqueue(storageCtrl && storageCtrl.querySelector('.label'), preset.storage);
    }
    if (preset.quality !== null) {
        var qualityCtrl = findFilterByImage('/level/');
        enqueue(qualityCtrl && qualityCtrl.querySelector('.label'), preset.quality);
    }
    if (preset.rarity !== null) {
        var rarityCtrl = findFilterByImage('/rarity/');
        enqueue(rarityCtrl && rarityCtrl.querySelector('.label'), preset.rarity);
    }
    if (preset.league !== null) {
        var leagueCtrl = findFilterByImage('/leagues/');
        enqueue(leagueCtrl && leagueCtrl.querySelector('.label'), preset.league);
    }

    function runNext(index) {
        if (index >= tasks.length) {
            var buildBtn = root.querySelector('.button-container .btn-standard.primary');
            if (buildBtn) simulateClick(buildBtn);
            return;
        }
        var task = tasks[index];
        simulateClick(task.trigger);
        setTimeout(function () {
            var lis = document.querySelectorAll('.is-open li');
            for (var i = 0; i < lis.length; i++) {
                if (lis[i].textContent.trim() === task.text) {
                    simulateClick(lis[i]);
                    break;
                }
            }
            setTimeout(function () { runNext(index + 1); }, 150);
        }, 300);
    }

    runNext(0);
};

fc26.hookPrototype('UTSquadBuilderView', '_generate', function () {
    var root = this.getRootElement ? this.getRootElement() : this.__root;
    if (!root) return;

    var filters = root.querySelector('.ut-squad-builder-view--filters');
    if (!filters) return;
    if (filters.querySelector('[data-fc26-action="presets"]')) return;

    var info = filters.querySelector('.ut-squad-builder-view--info');
    var sortFilter = filters.querySelector('.sort-filter-container');
    if (!info || !sortFilter) return;

    var titleEl = document.querySelector('.ut-navigation-bar-view.navbar-style-landscape h1.title');
    var challengeName = titleEl ? titleEl.textContent.trim() : 'Unknown Challenge';

    var container = document.createElement('div');
    container.className = 'sort-filter-container';
    container.setAttribute('data-fc26-action', 'presets');

    var heading = document.createElement('h4');
    heading.textContent = 'Presets';
    container.appendChild(heading);

    var select = document.createElement('select');
    select.className = 'inline-list-select ut-drop-down-control';
    select.style.padding = '0 10px';

    var defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Preset';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    var matchingPresets = (fc26.presets || []).filter(function (p) {
        return p.challengeName === challengeName;
    });
    matchingPresets.forEach(function (preset) {
        var option = document.createElement('option');
        option.value = preset.label;
        option.textContent = preset.label;
        select.appendChild(option);
    });

    container.appendChild(select);

    select.addEventListener('change', function () {

        console.log('[fc26] Preset "' + select.value + '" selected. Applying preset...');
        var chosen = (fc26.presets || []).find(function (p) { return p.label === select.value; });
        if (chosen) fc26.applySquadBuilderPreset(chosen, root);
        select.value = '';
    });

    // Insert between the info paragraph and the "Filter By" section
    filters.insertBefore(container, sortFilter);
});
