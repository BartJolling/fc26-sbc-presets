// ==UserScript==
// @name         FC26 SBC Presets
// @namespace    https://github.com/BartJolling/fc26-sbc-presets
// @version      0.3
// @description  FC 26 FUT SBC helper
// @author       BartJolling
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ea.com
// @updateURL    https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/fc26-sbc-presets.user.js
// @downloadURL  https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/fc26-sbc-presets.user.js
// @match        https://www.ea.com/ea-sports-fc/ultimate-team/web-app*
// @match        https://ea.com/ea-sports-fc/ultimate-team/web-app*
// @match        https://www.ea.com/*/ea-sports-fc/ultimate-team/web-app*
// @match        https://ea.com/*/ea-sports-fc/ultimate-team/web-app*
// @require      https://raw.githubusercontent.com/BartJolling/inject-some/master/inject-some.js
// @resource     presets-core              https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/core.js
// @resource     presets-data              https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/presets.js
// @resource     presets-squad-builder     https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/squad-builder-viewcontroller.js
// @resource     presets-challenge-details https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/challenge-details-view.js
// @resource     presets-challenges        https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/challenges-view.js
// @grant        GM_getResourceText
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    injectsome.content.script(GM_getResourceText('presets-core'), 'presets-core');
    injectsome.content.script(GM_getResourceText('presets-data'), 'presets-data');
    injectsome.content.script(GM_getResourceText('presets-squad-builder'), 'presets-squad-builder');
    injectsome.content.script(GM_getResourceText('presets-challenge-details'), 'presets-challenge-details');
    injectsome.content.script(GM_getResourceText('presets-challenges'), 'presets-challenges');
})();
