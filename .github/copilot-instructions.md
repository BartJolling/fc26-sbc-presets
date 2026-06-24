# FC26 SBC Presets — GitHub Copilot Instructions

## Project purpose

Tampermonkey userscript that injects preset buttons into the EA FC 26 Ultimate Team web app (`https://www.ea.com/*/ea-sports-fc/ultimate-team/web-app*`) to quickly configure the Squad Builder with saved filter combinations.

## File structure

| File | Role |
|---|---|
| `fc26-sbc-presets.user.js` | **Production** entry point. `@resource` URLs point to `raw.githubusercontent.com`. Installed from GitHub. |
| `fc26-sbc-presets.development.user.js` | **Local dev** entry point. `@resource` URLs are `file:///C:/Source/Github/FC26-FUT-SBC/...`. Always carries `@version` one ahead of the production script so Tampermonkey treats it as newer and doesn't auto-replace it with the online version. |
| `fc26-sbc-presets.core.js` | Defines `fc26.hookPrototype()`. Must be injected first. |
| `fc26-sbc-presets.data.js` | `fc26.presets[]` array — all preset definitions. |
| `fc26-sbc-presets.challenge-view.js` | Hooks `UTSBCSquadDetailPanelView` — injects preset buttons into the SBC challenge panel. |
| `fc26-sbc-presets.squad-builder-view.js` | Hooks `UTSquadBuilderView` — injects a preset dropdown + applies it to the Squad Builder filters. |
| `inject-some.js` | Third-party helper (copied from [BartJolling/inject-some](https://github.com/BartJolling/inject-some)). Provides `injectsome.content.script()`. |

## Why two-stage injection is needed

Tampermonkey runs in an **isolated sandbox** — it cannot access the EA web app's own JavaScript globals (`window.UTSBCSquadDetailPanelView`, `window.services`, etc.). Each module file is injected as a real `<script>` tag via `injectsome.content.script()`, placing it in the **main world** alongside EA's code.

Load order in the user script:
1. `fc26core` → `fc26.hookPrototype()` available
2. `fc26data` → `fc26.presets[]` available
3. `fc26challengeview` → hooks `UTSBCSquadDetailPanelView`
4. `fc26squadbuilder` → hooks `UTSquadBuilderView`

## fc26.hookPrototype(className, methodName, afterFn)

Polls every 100 ms until `window[className]` exists (EA loads classes lazily after app boot), then wraps `prototype[methodName]`. After the original runs, `afterFn` is called with `this` bound to the view instance.

```js
fc26.hookPrototype('UTSomeView', '_generate', function () {
    var root = this.getRootElement ? this.getRootElement() : this.__root;
    // manipulate DOM here — root is the view's root element
});
```

## Known hookable EA web app classes

| Class | Method | DOM root selector | Notes |
|---|---|---|---|
| `UTSBCSquadDetailPanelView` | `_generate` | `.sbc-button-container` | SBC challenge detail panel. FUTGenie injects "Auto Complete" at `children[0]`; our Presets go at `children[1]`. **Challenge title is NOT in the panel root** — get it from `document.querySelector('.ut-navigation-bar-view.navbar-style-landscape h1.title')`. |
| `UTSquadBuilderView` | `_generate` | `.ut-squad-builder-view--filters` | Opens when clicking "Use Squad Builder". Title also from navbar selector above. Insert between `.ut-squad-builder-view--info` and `.sort-filter-container`. |
| `UTSBCHubView` | `_generate` | `.container` | Top-level SBC hub listing all sets. |
| `UTSBCHubView` | `populateTiles` | — | Called when hub tile list is rebuilt. |
| `UTSBCHubView` | `onUpdate` | — | Called on data refresh. |
| `UTSquadListView` | `_generate` | `.ut-squad-list-view` | Active squad / squad list. |
| `UTMarketSearchFiltersView` | `_generate` | parent of `this._searchButton` | Transfer market filters. |
| `UTPaginatedItemListView` | `_generate` | list root | Any paginated item list (club, store…). |
| `UTItemDetailView` | `_generate` | item detail panel | Player/item detail overlay. |

## How FUTGenie injects "Auto Complete" (reference)

`_ensureSbcDetailPanelAutoCompleteButton` calls `_insertFutGeniePrimaryButton`:
- class: `UTSBCSquadDetailPanelView`
- selector: `.sbc-button-container`
- `childIndex: 0` ← Auto Complete is always at position 0

Our Presets container therefore inserts at `children[1]`.

## Preset data shape

```js
{
    label:              string,   // shown in the dropdown
    challengeName:      string,   // must match navbar h1 title exactly

    // Toggles: true = ON, false = OFF, null = leave as-is
    useConcept:         null,
    untradeablesOnly:   null,
    excludeActiveSquad: null,
    ignorePosition:     null,

    // Dropdowns: null = leave as-is
    sortBy:   null,   // "Rating High to Low" | "Rating Low to High"
    storage:  null,   // "Any" | "My Club" | "SBC Storage"
    quality:  null,   // "Bronze" | "Silver" | "Gold"
    rarity:   null,   // "Common" | "Rare" | "Special"
    league:   null,   // "BEL 1" | "ENG 1" | "ESP 1" | "FRA 1" | "GER 1" | "ITA1" | "NED 1" | "POR 1"

    // OVR inputs: null = leave as-is
    minOvr:   null,   // integer 45–99
    maxOvr:   null,   // integer 45–99
}
```

## Tampermonkey cache note

`@resource` files are cached by Tampermonkey. After editing any `.js` module, open the Tampermonkey dashboard → script editor → click **Check for updates**, or bump `@version` in the user script to force a reload.
