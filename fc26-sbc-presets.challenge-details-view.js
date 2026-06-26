// Runs in the EA web app's main world.
// Challenge view enhancement - adds preset buttons for the current challenge.

fc26.getActiveChallengeName = fc26.getActiveChallengeName || function (view) {
    if (fc26.lastClickedChallengeName) {
        return fc26.lastClickedChallengeName;
    }
    return '';
};

if (!fc26._sbcTileClickTrackerInstalled && typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function (event) {
        var tile = event && event.target && event.target.closest ? event.target.closest('.ut-sbc-set-tile-view') : null;
        if (!tile) return;

        var titleEl = tile.querySelector('.tileTitle');
        var title = titleEl && titleEl.textContent ? String(titleEl.textContent).trim() : '';
        if (!title) return;

        fc26.lastClickedChallengeName = title;
    }, true);
    fc26._sbcTileClickTrackerInstalled = true;
}

fc26.hookPrototype('UTSBCSquadDetailPanelView', '_generate', function () {
    var root = this.getRootElement ? this.getRootElement() : this.__root;
    if (!root) return;

    var container = root.querySelector('.sbc-button-container');
if (!container) return;
    if (container.querySelector('[data-fc26-action="presets"]')) return;

    var challengeName = fc26.getActiveChallengeName(this);
    if (!challengeName) return;

    var matchingPresets = (fc26.presets || []).filter(function (p) {
        return p.challengeName === challengeName;
    });
    if (matchingPresets.length === 0) return;

    matchingPresets.sort(function (a, b) { return a.label.localeCompare(b.label); });

    matchingPresets.forEach(function (preset) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-standard primary';
        btn.textContent = preset.label;
        btn.setAttribute('data-fc26-action', 'presets');
        btn.addEventListener('click', function () {
            fc26.pendingPreset = preset;
            var buttons = container.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                if (buttons[i].textContent.trim() === 'Use Squad Builder') {
                    fc26.simulateClick(buttons[i]);
                    break;
                }
            }
        });
        container.insertBefore(btn, container.children[1] || null);
    });
});