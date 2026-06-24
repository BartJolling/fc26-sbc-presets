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
    var hookKey = '_fc26_' + className + '_' + methodName + '_hooked';

    function checkAndHook() {
        if (!window[className] || !window[className].prototype) {
            return setTimeout(checkAndHook, 100);
        }
        var proto = window[className].prototype;
        if (proto[hookKey]) return;

        var original = proto[methodName];
        proto[methodName] = function () {
            var result = original.apply(this, arguments);
            try { afterFn.call(this); } catch (e) {}
            return result;
        };
        proto[hookKey] = true;
    }

    checkAndHook();
};
