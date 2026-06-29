// Runs in the EA web app's main world.
// Core utilities shared across all FC26 FUT SBC view scripts.

var fc26SbcPresets = fc26SbcPresets || {};

/**
 * Polls until window[className] exists, then wraps methodName on its prototype.
 * afterFn is called with `this` bound to the view instance after the original method runs.
 * @param {string} className  - EA global class name, e.g. 'UTSBCSquadDetailPanelView'
 * @param {string} methodName - prototype method to wrap, e.g. '_generate'
 * @param {Function} afterFn  - called after the original method with the view as `this`
 */
fc26SbcPresets.hookPrototype = function (className, methodName, afterFn) {
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

/** Dispatches mousedown + mouseup + click on an element, matching EA's event handling. */
fc26SbcPresets.simulateClick = function (el) {
    if (!el) return;
    ['mousedown', 'mouseup', 'click'].forEach(function (eventType) {
        if (eventType === 'click' && typeof el.click === 'function') { return el.click(); }
        el.dispatchEvent(new MouseEvent(eventType, { view: window, bubbles: true, cancelable: true }));
    });
};

/**
 * Runs callback once EA's navigation transition has finished.
 *
 * When EA pushes a view, UTNavigationController raises an INTERACTION click shield
 * that blocks input for the duration of the transition, then lowers it ~300ms later
 * (see UTNavigationController.show). viewDidAppear fires while that shield is still up,
 * so acting before it lowers lands on an unsettled navigation stack and corrupts
 * rendering. gClickShield.isInteractionShieldShowing() is the authoritative signal:
 * we poll it and fire the callback the instant EA lowers the shield. This tracks EA's
 * real timing (no magic number) and self-corrects if EA changes the duration.
 *
 * If the shield API isn't available, falls back to a fixed delay matching EA's window.
 * @param {Function} callback - invoked once the transition shield has lowered
 * @param {Object} [options]
 * @param {number} [options.pollMs=30] - poll interval while the shield is up
 * @param {number} [options.maxWaitMs=2000] - hard cap before firing regardless
 * @param {number} [options.fallbackMs=300] - delay used when the shield API is absent
 */
fc26SbcPresets.runWhenSettled = function (callback, options) {
    var opts = options || {};
    var pollMs = typeof opts.pollMs === 'number' && opts.pollMs > 0 ? opts.pollMs : 30;
    var maxWaitMs = typeof opts.maxWaitMs === 'number' && opts.maxWaitMs >= 0 ? opts.maxWaitMs : 2000;
    var fallbackMs = typeof opts.fallbackMs === 'number' && opts.fallbackMs >= 0 ? opts.fallbackMs : 300;
    var shield = typeof gClickShield !== 'undefined' && gClickShield ? gClickShield : null;
    var done = false;
    var start = Date.now();

    if (!shield || typeof shield.isInteractionShieldShowing !== 'function') {
        setTimeout(callback, fallbackMs);
        return;
    }

    function finish() {
        if (done) { return; }
        done = true;
        callback();
    }

    function poll() {
        if (done) { return; }
        if (!shield.isInteractionShieldShowing() || Date.now() - start >= maxWaitMs) {
            finish();
            return;
        }
        setTimeout(poll, pollMs);
    }

    poll();
};
