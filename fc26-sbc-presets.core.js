// Runs in the EA web app's main world.
// Core utilities shared across all FC26 FUT SBC view scripts.

var fc26 = fc26 || {};

/**
 * Polls until window[className] exists, then wraps methodName on its prototype.
 * afterFn is called with `this` bound to the view instance after the original method runs.
 * @param {string} className  - EA global class name, e.g. 'UTSBCSquadDetailPanelView'
 * @param {string} methodName - prototype method to wrap, e.g. '_generate'
 * @param {Function} afterFn  - called after the original method with the view as `this`
 */
fc26.hookPrototype = function (className, methodName, afterFn) {
    var callbacksKey = '_fc26_' + className + '_' + methodName + '_callbacks';

    function checkAndHook() {
        if (!window[className] || !window[className].prototype) {
            return setTimeout(checkAndHook, 100);
        }
        var proto = window[className].prototype;

        if (!proto[callbacksKey]) {
            proto[callbacksKey] = [];
            var original = proto[methodName];
            proto[methodName] = function () {
                var result = original.apply(this, arguments);
                var self = this;
                var cbs = proto[callbacksKey];
                for (var i = 0; i < cbs.length; i++) {
                    try { cbs[i].call(self); } catch (e) {}
                }
                return result;
            };
        }
        proto[callbacksKey].push(afterFn);
    }

    checkAndHook();
};

// Preset to apply as soon as the Squad Builder view renders.
fc26.pendingPreset = null;

// Apply pendingPreset when UTSquadBuilderView renders — works regardless of whether
// the squad-builder-view dropdown UI is injected.
fc26.hookPrototype('UTSquadBuilderView', '_generate', function () {
    if (!fc26.pendingPreset) return;
    var root = this.getRootElement ? this.getRootElement() : this.__root;
    if (!root) return;
    var preset = fc26.pendingPreset;
    fc26.pendingPreset = null;
    setTimeout(function () { fc26.applySquadBuilderPreset(preset, root); }, 300);
});

/** Dispatches mousedown + mouseup + click on an element, matching EA's event handling. */
fc26.simulateClick = function (el) {
    if (!el) return;
    ['mousedown', 'mouseup', 'click'].forEach(function (eventType) {
        if (eventType === 'click' && typeof el.click === 'function') { return el.click(); }
        el.dispatchEvent(new MouseEvent(eventType, { view: window, bubbles: true, cancelable: true }));
    });
};

/**
 * Applies a preset to the Squad Builder filters and clicks Build.
 * @param {object} preset - entry from fc26.presets[]
 * @param {Element} root  - root DOM element of UTSquadBuilderView
 */
fc26.applySquadBuilderPreset = function (preset, root) {

    function simulateClick(el) { fc26.simulateClick(el); }

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
    setToggle('Use Concept Players',          preset.useConcept);
    setToggle('Untradeables Only',            preset.untradeablesOnly);
    setToggle('Exclude Active Squad Players', preset.excludeActiveSquad);
    setToggle('Ignore Position',              preset.ignorePosition);

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

    var tasks = [];

    // Standard: open dropdown, find li by text, simulateClick it (works for items with icons).
    function enqueue(triggerEl, text) {
        if (triggerEl) tasks.push({ trigger: triggerEl, text: text });
    }

    // Storage 'Any': open dropdown, click the first li using .click() only — no mousedown,
    // which would trigger EA's document-level close handler before the selection registers.
    function enqueueFirstItem(triggerEl) {
        if (triggerEl) tasks.push({ trigger: triggerEl, firstItem: true });
    }

    // Others 'Any': click the clear row-button to reset the filter.
    function enqueueClear(ctrl) {
        var clearBtn = ctrl && ctrl.querySelector('.ut-search-filter-control--row-button');
        if (clearBtn) tasks.push({ clearBtn: clearBtn });
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
        if (storageCtrl) {
            if (preset.storage === 'Any') enqueueFirstItem(storageCtrl.querySelector('.label'));
            else enqueue(storageCtrl.querySelector('.label'), preset.storage);
        }
    }
    if (preset.quality !== null) {
        var qualityCtrl = findFilterByImage('/level/');
        if (qualityCtrl) {
            if (preset.quality === 'Any') enqueueClear(qualityCtrl);
            else enqueue(qualityCtrl.querySelector('.label'), preset.quality);
        }
    }
    if (preset.rarity !== null) {
        var rarityCtrl = findFilterByImage('/rarity/');
        if (rarityCtrl) {
            if (preset.rarity === 'Any') enqueueClear(rarityCtrl);
            else enqueue(rarityCtrl.querySelector('.label'), preset.rarity);
        }
    }
    if (preset.league !== null) {
        var leagueCtrl = findFilterByImage('/leagues/');
        if (leagueCtrl) {
            tasks.push({ leagueCtrl: leagueCtrl, league: preset.league });
        }
    }

    function runNext(index) {
        if (index >= tasks.length) {
            var buildBtn = root.querySelector('.button-container .btn-standard.primary');
            if (buildBtn) simulateClick(buildBtn);
            return;
        }
        var task = tasks[index];
        if (task.clearBtn) {
            simulateClick(task.clearBtn);
            setTimeout(function () { runNext(index + 1); }, 150);
            return;
        }
        if (task.leagueCtrl) {
            var leagueLabel = task.leagueCtrl.querySelector('.label');
            var leagueText = leagueLabel && leagueLabel.textContent ? leagueLabel.textContent.trim() : '';
            var leagueHasSelection = task.leagueCtrl.classList.contains('has-selection');
            var leagueMarker = '(' + task.league + ')';

            if (leagueHasSelection && leagueText.indexOf(leagueMarker) === -1 && !task.leagueCleared) {
                var leagueClearBtn = task.leagueCtrl.querySelector('.ut-search-filter-control--row-button');
                if (leagueClearBtn) {
                    task.leagueCleared = true;
                    simulateClick(leagueClearBtn);
                    setTimeout(function () { runNext(index); }, 200);
                    return;
                }
            }

            simulateClick(leagueLabel);
            setTimeout(function () {
                var lis = document.querySelectorAll('.is-open li');
                var match = null;
                for (var i = 0; i < lis.length; i++) {
                    var text = lis[i].textContent ? lis[i].textContent.trim() : '';
                    if (text.indexOf(leagueMarker) !== -1 || text.indexOf(task.league) !== -1) {
                        match = lis[i];
                        break;
                    }
                }
                if (match) {
                    simulateClick(match);
                }
                setTimeout(function () { runNext(index + 1); }, 150);
            }, 300);
            return;
        }
        simulateClick(task.trigger);
        setTimeout(function () {
            if (task.firstItem) {
                var first = document.querySelector('.is-open li');
                if (first) first.click();
            } else {
                var lis = document.querySelectorAll('.is-open li');
                for (var i = 0; i < lis.length; i++) {
                    if (lis[i].textContent.trim() === task.text) {
                        simulateClick(lis[i]);
                        break;
                    }
                }
            }
            setTimeout(function () { runNext(index + 1); }, 150);
        }, 300);
    }

    runNext(0);
};
