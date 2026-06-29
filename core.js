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
