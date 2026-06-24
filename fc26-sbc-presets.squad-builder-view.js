// Runs in the EA web app's main world.
// Enhancements for the Squad Builder view (UTSquadBuilderView) — dropdown UI only.
// Pending preset application is handled in fc26-sbc-presets.core.js.

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
        var chosen = (fc26.presets || []).find(function (p) { return p.label === select.value; });
        if (chosen) fc26.applySquadBuilderPreset(chosen, root);
        select.value = '';
    });

    // Insert between the info paragraph and the "Filter By" section
    filters.insertBefore(container, sortFilter);
});
