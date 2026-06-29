// Runs in the EA web app's main world.
// Challenge view enhancement - adds preset buttons for the current challenge.

fc26SbcPresets.getActiveChallengeName = fc26SbcPresets.getActiveChallengeName || function (view) {
    if (fc26SbcPresets.lastClickedChallengeName) {
        return fc26SbcPresets.lastClickedChallengeName;
    }
    return '';
};

if (!fc26SbcPresets._sbcTileClickTrackerInstalled && typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function (event) {
        var tile = event && event.target && event.target.closest ? event.target.closest('.ut-sbc-set-tile-view') : null;
        if (!tile) return;

        var titleEl = tile.querySelector('.tileTitle');
        var title = titleEl && titleEl.textContent ? String(titleEl.textContent).trim() : '';
        if (!title) return;

        fc26SbcPresets.lastClickedChallengeName = title;
    }, true);
    fc26SbcPresets._sbcTileClickTrackerInstalled = true;
}

fc26SbcPresets.hookPrototype('UTSBCSquadDetailPanelView', '_generate', function () {
    var root = this.getRootElement ? this.getRootElement() : this.__root;
    if (!root) return;

    var container = root.querySelector('.sbc-button-container');
    if (!container) return;
    if (container.querySelector('[data-fc26-action="presets"]')) return;

    function openSquadBuilder(button) {
        if (!button) return;
        ['mousedown', 'mouseup', 'click'].forEach(function (eventType) {
            if (eventType === 'click' && typeof button.click === 'function') {
                return button.click();
            }
            button.dispatchEvent(new MouseEvent(eventType, { view: window, bubbles: true, cancelable: true }));
        });
    }

    var challengeName = fc26SbcPresets.getActiveChallengeName(this);
    if (!challengeName) return;

    var matchingPresets = (fc26SbcPresets.presets || []).filter(function (p) {
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
            fc26SbcPresets.pendingPresetRequest = {
                challengeName: preset.challengeName,
                presetName: preset.label
            };
            var buttons = container.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                if (buttons[i].textContent.trim() === 'Use Squad Builder') {
                    openSquadBuilder(buttons[i]);
                    break;
                }
            }
        });
        container.insertBefore(btn, container.children[1] || null);
    });
});