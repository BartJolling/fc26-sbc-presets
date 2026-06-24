// Runs in the EA web app's main world.
// Challenge view enhancement - adds preset buttons for the current challenge.

fc26.hookPrototype('UTSBCSquadDetailPanelView', '_generate', function () {
    var view = this;
    setTimeout(function () {
        var root = view.getRootElement ? view.getRootElement() : view.__root;
        if (!root) return;

        var container = root.querySelector('.sbc-button-container');
        if (!container) return;
        if (container.querySelector('[data-fc26-action="presets"]')) return;

        var titleEl = document.querySelector('.ut-navigation-bar-view.navbar-style-landscape h1.title');
        var challengeName = titleEl ? titleEl.textContent.trim() : 'Unknown Challenge';

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
    }, 200);
});
