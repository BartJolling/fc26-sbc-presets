// Runs in the EA web app's main world.
// Challenge view enhancement - adds a split button for the current challenge.

/**
 * Returns the active SBC challenge name.
 * Prefers the name captured from the last tile click; falls back to the navbar h1 title.
 * @param {object} view - UTSBCSquadDetailPanelView instance (unused, kept for future use)
 * @returns {string} challenge name, or empty string if not found
 */
fc26SbcPresets.getActiveChallengeName = fc26SbcPresets.getActiveChallengeName || function (view) {
    if (fc26SbcPresets.lastClickedChallengeName) {
        return fc26SbcPresets.lastClickedChallengeName;
    }
    var titleEl = document.querySelector('.ut-navigation-bar-view.navbar-style-landscape h1.title');
    if (titleEl && titleEl.textContent) {
        return String(titleEl.textContent).trim();
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

if (!fc26SbcPresets._splitButtonDismissInstalled && typeof document !== 'undefined' && document.addEventListener) {
    fc26SbcPresets._splitButtonDismissInstalled = true;

    /** Collapses all open preset dropdown menus in the page. */
    fc26SbcPresets.closeSplitPresetMenus = function () {
        var wrappers = document.querySelectorAll('[data-fc26-action="split-presets"]');
        for (var i = 0; i < wrappers.length; i++) {
            var wrapper = wrappers[i];
            var menu = wrapper.querySelector('.fc26-sbc-split-menu');
            var toggle = wrapper.querySelector('button[aria-haspopup="menu"]');
            if (menu) menu.hidden = true;
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
    };

    document.addEventListener('click', function (event) {
        var insideSplitButton = event && event.target && event.target.closest ? event.target.closest('[data-fc26-action="split-presets"]') : null;
        if (!insideSplitButton) {
            fc26SbcPresets.closeSplitPresetMenus();
        }
    }, true);

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            fc26SbcPresets.closeSplitPresetMenus();
        }
    }, true);
}

fc26SbcPresets.hookPrototype('UTSBCSquadDetailPanelView', '_generate', function () {
    var root = this.getRootElement ? this.getRootElement() : this.__root;
    if (!root) { return; }

    var container = root.querySelector('.sbc-button-container');
    if (!container) { return; }
    if (container.querySelector('[data-fc26-action="split-presets"]')) {
        return;
    }

    var challengeName = fc26SbcPresets.getActiveChallengeName(this);
    var matchingPresets = fc26SbcPresets.getPresetsForChallenge(challengeName);

    /**
     * Finds the "Use Squad Builder" button inside the SBC button container.
     * @returns {HTMLButtonElement|null} the button element, or null if not present
     */
    function findUseSquadBuilderButton() {
        var buttons = container.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
            if (buttons[i].textContent && buttons[i].textContent.trim() === 'Use Squad Builder') {
                return buttons[i];
            }
        }
        return null;
    }

    /**
     * Wraps the EA "Use Squad Builder" button in a split-button container and injects
     * a transparent dropdown-toggle overlay on its right side.
     * @param {HTMLButtonElement} useSquadBuilderButton - EA's "Use Squad Builder" button
     * @returns {boolean} true if the split button was installed, false if the button was missing
     */
    function installSplitButton(useSquadBuilderButton) {
        if (!useSquadBuilderButton) {
            return false;
        }

        var splitButton = document.createElement('div');
        splitButton.className = 'fc26-sbc-split-button';
        splitButton.setAttribute('data-fc26-action', 'split-presets');

        var toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'fc26-sbc-split-toggle';
        toggleButton.textContent = '▼';
        toggleButton.setAttribute('aria-haspopup', 'menu');
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.setAttribute('aria-label', 'More preset actions');

        var menu = document.createElement('ul');
        menu.className = 'fc26-sbc-split-menu';
        menu.setAttribute('role', 'menu');
        menu.hidden = true;

        /**
         * Opens or closes the preset dropdown menu.
         * @param {boolean} isOpen - true to open, false to close
         */
        function setMenuOpen(isOpen) {
            menu.hidden = !isOpen;
            toggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }

        function closeMenu() {
            fc26SbcPresets.closeSplitPresetMenus();
        }

        function toggleMenu() {
            setMenuOpen(menu.hidden);
        }

        if (matchingPresets.length === 0) {
            var emptyItem = document.createElement('li');
            emptyItem.setAttribute('role', 'none');

            var emptyButton = document.createElement('button');
            emptyButton.type = 'button';
            emptyButton.className = 'fc26-sbc-split-menu-item';
            emptyButton.textContent = 'No presets for this challenge';
            emptyButton.disabled = true;

            emptyItem.appendChild(emptyButton);
            menu.appendChild(emptyItem);
        }

        matchingPresets.forEach(function (preset) {
            var item = document.createElement('li');
            item.setAttribute('role', 'menuitem');

            var presetButton = document.createElement('button');
            presetButton.type = 'button';
            presetButton.className = 'fc26-sbc-split-menu-item';
            presetButton.textContent = preset.label;

            presetButton.addEventListener('click', function () {
                fc26SbcPresets.pendingPresetRequest = {
                    challengeName: challengeName,
                    presetName: preset.label
                };
                closeMenu();
                fc26SbcPresets.simulateClick(useSquadBuilderButton);
            });

            item.appendChild(presetButton);
            menu.appendChild(item);
        });

        toggleButton.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            toggleMenu();
        });

        var nextSibling = useSquadBuilderButton.nextSibling;
        splitButton.appendChild(useSquadBuilderButton);
        splitButton.appendChild(toggleButton);
        splitButton.appendChild(menu);
        container.insertBefore(splitButton, nextSibling);
        return true;
    }

    var useSquadBuilderButton = findUseSquadBuilderButton();
    if (!useSquadBuilderButton) {
        if (!root.__fc26SplitButtonObserverStarted) {
            root.__fc26SplitButtonObserverStarted = true;

            if (typeof MutationObserver === 'function') {
                root.__fc26SplitButtonObserver = new MutationObserver(function () {
                    var currentButton = findUseSquadBuilderButton();
                    if (!currentButton) {
                        return;
                    }

                    if (root.__fc26SplitButtonObserver) {
                        root.__fc26SplitButtonObserver.disconnect();
                        root.__fc26SplitButtonObserver = null;
                    }
                    root.__fc26SplitButtonObserverStarted = false;
                    installSplitButton(currentButton);
                });

                root.__fc26SplitButtonObserver.observe(container, {
                    childList: true,
                    subtree: true
                });
            }
        }
        return;
    }

    installSplitButton(useSquadBuilderButton);
});