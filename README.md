# FC26 SBC Presets

A Tampermonkey userscript that adds preset management to the EA Sports FC 26 Ultimate Team Squad Builder. Save and apply squad builder configurations for SBC challenges instantly.

## What It Does

- **Save presets** for every SBC challenge with all squad builder settings (toggles, OVR ranges, filters)
- **Apply presets** with one click—automatically configures toggles, dropdowns, and OVR ranges
- **Auto-build**—optionally click the Build button automatically after applying a preset
- Works seamlessly with EA's FC 26 FUT web app

## Requirements

- **Browser**: Chrome, Firefox, Edge, or any Chromium-based browser
- **Userscript manager**: One of the following:
  - [Tampermonkey](https://www.tampermonkey.net/) (recommended)
  - [Greasemonkey](https://www.greasespot.net/)
  - [Violentmonkey](https://violentmonkey.github.io/)
  - Any other userscript manager that supports `@require`, `@resource`, and `@grant`

> **Note**: Tested and verified working with **Tampermonkey on Microsoft Edge**. Other browsers/managers may work but are untested.

## Installation

### Step 1: Install Tampermonkey

Choose your browser and install Tampermonkey:

- **Chrome/Brave**: [Chrome Web Store - Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Edge**: [Microsoft Edge Add-ons - Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
- **Firefox**: [Firefox Add-ons - Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)

### Step 2: Give Tampermonkey Permission to Use Script

Follow [this guide](https://www.tampermonkey.net/faq.php?locale=en&q=Q209) on the Tampermonkley website to give Tampermonkey the necessary permissions to run user scripts

### Step 3: Install FC26 SBC Presets

Click this link to install (requires Tampermonkey to be installed):
[Install FC26 SBC Presets](https://raw.githubusercontent.com/BartJolling/fc26-sbc-presets/main/fc26-sbc-presets.user.js)

Or manually:

1. Open Tampermonkey dashboard
2. Click **Create new script**
3. Copy the contents of `fc26-sbc-presets.user.js` from this repo
4. Paste into the editor
5. Save (Ctrl+S)

> **Note**: When you save, Tampermonkey will automatically download the following files:
>
> - `inject-some.js` (dependency injection library)
> - `fc26-sbc-presets.core.js`, `fc26-sbc-presets.data.js`, `fc26-sbc-presets.squad-builder-view.js` (this extension's modules)
>
> You can review the source code in this repository before installing.

### Step 4: Use It

1. Go to [FC 26 Ultimate Team SBC](https://www.ea.com/ea-sports-fc/ultimate-team/web-app)
2. Open a Squad Builder challenge
3. The challenge panel shows a **Use Squad Builder** split button
4. Use the dropdown half to pick a preset, or click the main button to open Squad Builder normally

## Features

- **12+ presets** covering common SBC challenges (5x 77+ Upgrade, 81+ Player Pick, etc.)
- **Smart filtering** by storage, quality, rarity, league
- **OVR range support** for challenges with min/max requirements
- **Custom toggles** for Untradeable-only, Exclude Active Squad, ignore Position, etc.
- **Split-button challenge launch** with per-challenge preset menu
- **Auto-click Build button** option to complete workflow

## Dependencies

- [inject-some](https://github.com/BartJolling/inject-some) — Main-world script injection library for bypassing content-script isolation

## License

MIT

## Support

Found a bug or want to suggest a preset? [Open an issue](https://github.com/BartJolling/fc26-sbc-presets/issues) on GitHub.
