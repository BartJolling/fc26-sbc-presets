// ==UserScript==
// @name         FC26 SBC Presets
// @namespace    https://github.com/BartJolling/fc26-sbc-presets
// @version      0.1
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
// @resource     fc26core           https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/fc26-sbc-presets.core.js
// @resource     fc26data           https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/fc26-sbc-presets.data.js
// @resource     challenge-details  https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/fc26-sbc-presets.challenge-details-view.js
// @resource     challenges         https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/fc26-sbc-presets.challenges-view.js
// @resource     squad-builder      https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/fc26-sbc-presets.squad-builder-view.js
// @grant        GM_getResourceText
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    injectsome.content.script(GM_getResourceText('fc26core'), 'fc26core');
    injectsome.content.script(GM_getResourceText('fc26data'), 'fc26data');
    injectsome.content.script(GM_getResourceText('challenge-details'), 'challenge-details');
    injectsome.content.script(GM_getResourceText('challenges'), 'challenges');
    injectsome.content.script(GM_getResourceText('squad-builder'), 'squad-builder');
})();
