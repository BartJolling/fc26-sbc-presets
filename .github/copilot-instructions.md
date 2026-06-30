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
| `UTSquadBuilderViewController` | `updateCriteriaFromChallenge` | — | Early controller lifecycle hook for default criteria. Runs before `viewWillAppear` and before the builder becomes visible. |
| `UTSBCHubView` | `_generate` | `.container` | Top-level SBC hub listing all sets. |
| `UTSBCHubView` | `populateTiles` | — | Called when hub tile list is rebuilt. |
| `UTSBCHubView` | `onUpdate` | — | Called on data refresh. |
| `UTSquadListView` | `_generate` | `.ut-squad-list-view` | Active squad / squad list. |
| `UTMarketSearchFiltersView` | `_generate` | parent of `this._searchButton` | Transfer market filters. |
| `UTPaginatedItemListView` | `_generate` | list root | Any paginated item list (club, store…). |
| `UTItemDetailView` | `_generate` | item detail panel | Player/item detail overlay. |

## UTSquadBuilderViewController lifecycle

When the user opens Squad Builder, EA instantiates `UTSquadBuilderViewController` before the view becomes visible. The controller’s setup path runs in this rough order: `init`, `initWithSquad` or `initWithChallenge`, `updateCriteriaFromChallenge`, `viewWillAppear`, then `viewDidAppear`.

For overriding EA defaults, `updateCriteriaFromChallenge` is the useful early interception point. Wrap that prototype method and set controller state before returning, for example:

```js
const proto = window.UTSquadBuilderViewController && window.UTSquadBuilderViewController.prototype;
const original = proto && proto.updateCriteriaFromChallenge;
if (proto && typeof original === 'function') {
    proto.updateCriteriaFromChallenge = function () {
        const result = original.apply(this, arguments);
        // force default criteria here
        return result;
    };
}
```

`_generate` is later and is better suited to DOM insertion or post-render adjustments.

## Navigation transition timing (acting after viewDidAppear)

`viewDidAppear` fires **while the navigation push is still committing**. Acting then — e.g. calling `eBuildSelected()` to auto-Build — pops an unsettled navigation stack and corrupts rendering.

EA gates this with an **INTERACTION click shield**. In `UTNavigationController.prototype.show` (`webapp/js/compiled_2.js` ~22560):

```js
gClickShield.showShield(EAClickShieldView.Shield.INTERACTION);
// ...push commits, then:
this.currentController.viewDidAppear();
setTimeout(function () {
    gClickShield.hideShield(EAClickShieldView.Shield.INTERACTION);
}, 300);
```

The ~300 ms is **not arbitrary** — it is EA's transition window. You cannot safely act before the shield lowers, so nothing can beat it.

**Authoritative "transition done" signal**: `gClickShield` is a global in the main world (where injected modules run), so query it directly:

- `gClickShield.isInteractionShieldShowing()` returns `true` while the transition blocks input, `false` once settled.
- `EAClickShieldView` is defined in `webapp/js/compiled_4.js` ~13537: holds `shieldCounter {FULL, LOADING, INTERACTION}`, exposes `isInteractionShieldShowing()` / `isShowing()`, and fires `EAClickShieldView.Event.DISMISSED` when all counters reach 0.

**Implemented pattern** — `fc26SbcPresets.runWhenSettled` in `core.js`: poll `gClickShield.isInteractionShieldShowing()` (~30 ms interval), fire the callback when it returns `false`, with a max-wait cap and a fixed-delay fallback if the shield API is absent. This tracks EA's real timing and self-corrects if EA changes the duration.

Rejected alternatives (both fire too early and corrupt rendering): double `requestAnimationFrame` (lands before the push settles) and a debounced `MutationObserver` on `body` (a DOM-quiet gap can occur inside the 300 ms shield window).

`eBuildSelected(e, t, i)` ignores its arguments (only uses `this`), so `controller.eBuildSelected()` is functionally identical to a manual Build button tap.

## Example: How FUTGenie injects "Auto Complete" (reference)

Example of how the FUT Genie Chrome extension (see the 2.9.2_1 folder) injects the `Auto Complete` button in the sbc challenge view.

1. `setupSBCSquadDetailPanelAddMultipleHook()` patches `UTSBCSquadDetailPanelView.prototype._generate`.
    ```js
    this.setupSBCSquadDetailPanelAddMultipleHook(),
    ...
    e._ensureSbcDetailPanelAutoCompleteButton(this)
    ```
2. `_ensureSbcDetailPanelAutoCompleteButton()` calls `_insertFutGeniePrimaryButton()`.
3. `_insertFutGeniePrimaryButton()` targets `.sbc-button-container`, prefers `UTStandardButtonControl`, falls back to a plain `<button>`, and wires clicks with `attachUnifiedTap()`.
    ```js
    _ensureSbcDetailPanelAutoCompleteButton: function(e) {
        this._insertFutGeniePrimaryButton(e, {
            viewName: "UTSBCSquadDetailPanelView",
            selector: ".sbc-button-container",
            action: "autoComplete",
            classes: ["btn-standard", "upgrade"],
            childIndex: 0,
            getLabel: function() {
                return window.FutGenieDispatcher.t("button.autoComplete", "Auto Complete")
            }
        })
    ```
4. The insertion uses `childIndex: 0`; our Presets container should insert at `children[1]`.
5. The helper also skips duplicate `[data-futgenie-action]` nodes.

## Preset data shape

```js
{
    challengeName:      string,   // must match navbar h1 title exactly
    label:              string,   // shown in the dropdown    

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

## League repository snapshot

The Squad Builder league dropdown is populated from `repositories.TeamConfig.getLeagues()`. Use the league `id` as the canonical key, and keep this table aligned with the live app when updating presets.

| id | name | abbreviation |
|---|---|---|
| 1 | 3F Superliga | DEN 1 |
| 4 | 1A Pro League | BEL 1 |
| 10 | Eredivisie | NED 1 |
| 13 | Premier League | ENG 1 |
| 14 | EFL Championship | ENG 2 |
| 16 | Ligue 1 McDonald's | FRA 1 |
| 17 | Ligue 2 BKT | FRA 2 |
| 19 | Bundesliga | GER 1 |
| 20 | Bundesliga 2 | GER 2 |
| 31 | Serie A Enilive | ITA 1 |
| 32 | Serie BKT | ITA 2 |
| 39 | MLS | MLS |
| 41 | Eliteserien | NOR 1 |
| 50 | Scottish Prem | SPFL |
| 53 | LALIGA EA SPORTS | ESP 1 |
| 54 | LALIGA HYPERMOTION | ESP 2 |
| 56 | Allsvenskan | SWE 1 |
| 60 | EFL League One | ENG 3 |
| 61 | EFL League Two | ENG 4 |
| 63 | Hellas Liga | GRE 1 |
| 65 | SSE Airtricity PD | IRL 1 |
| 66 | PKO BP Ekstraklasa | POL 1 |
| 68 | Trendyol Süper Lig | TUR 1 |
| 78 | Men's National | INT |
| 80 | Ö. Bundesliga | AUT 1 |
| 83 | K League 1 | KOR 1 |
| 189 | Brack Super League | SUI 1 |
| 308 | Liga Portugal | POR 1 |
| 317 | Liga Hrvatska | CRO 1 |
| 319 | Česká Liga | CZE 1 |
| 322 | Finnliiga | FIN 1 |
| 330 | SUPERLIGA | ROM 1 |
| 332 | Ukrayina Liha | UKR 1 |
| 350 | ROSHN Saudi League | SAU 1 |
| 351 | A-League | AUS 1 |
| 353 | LPF | ARG 1 |
| 1003 | Libertadores | LIB |
| 1014 | Sudamericana | SUD |
| 2012 | CSL | CHN 1 |
| 2070 | Thailand League | THA 1 |
| 2076 | 3. Liga | GER 3 |
| 2118 | Icons | ICN |
| 2136 | Women's Intl. Cup | WNT |
| 2149 | ISL | IND 1 |
| 2172 | United Emirates League | UAE 1 |
| 2209 | Liga Colombia | COL 1 |
| 2210 | Liga Cyprus | CYP 1 |
| 2211 | Magyar Liga | HUN 1 |
| 2215 | GPFBL | GER 1 |
| 2216 | Barclays WSL | ENG 1 |
| 2218 | Arkema PL | FRA 1 |
| 2221 | NWSL | USA 1 |
| 2222 | Liga F Moeve | ESP 1 |
| 2228 | Liga Portugal Feminino | POR 1 |
| 2229 | Nederland Vrouwen Liga | NED 1 |
| 2230 | Ceska Liga Žen | CZE 1 |
| 2231 | Schweizer Damen Liga | SUI 1 |
| 2232 | Sverige Liga | SWE 1 |
| 2233 | Scottish Women's League | SCO 1 |
| 2236 | Calcio A Femminile | ITA 1 |
| 2244 | Liga Azerbaijan | AZE 1 |
| 2249 | Liga Chile | CHI 1 |
| 2265 | *global.leagueabbr15.2026.league2265 | PAR |

## Preset Interaction Rules

Use `fc26.simulateClick()` for UI clicks in view scripts, including preset selection and the final Build button. Do not call DOM `.click()` directly unless a specific EA control needs it.

The `storage` dropdown is special: `Any` is the cleared state. If the preset needs `Any` from another value, open the storage dropdown and select the first item with a plain `.click()` on that option. For the other dropdowns, `Any` means click the control's clear row-button instead of selecting a menu item, and the UI will show the dropdown name again, such as `Quality`.

## Tampermonkey cache note

`@resource` files are cached by Tampermonkey. After editing any `.js` module, open the Tampermonkey dashboard → script editor → click **Check for updates**, or bump `@version` in the user script to force a reload.

## Annex: UT Window Globals

This annex records the known  EA web app widgets from the main table above, grouped by type in a single two-column reference.
### ViewControllers

| Class name | Description |
|---|---|
| `UTAboutViewController` |  |
| `UTAcademyClubSearchViewController` |  |
| `UTAcademyFiltersViewController` |  |
| `UTAcademyHubViewController` |  |
| `UTAcademyPlayerFromClubViewController` |  |
| `UTAcademySlotItemDetailsViewController` |  |
| `UTAcademySplitViewController` |  |
| `UTActionConfirmationPopupViewController` |  |
| `UTApplicableConsumableListViewController` |  |
| `UTApplicablePositionSelectViewController` |  |
| `UTAppSettingsViewController` |  |
| `UTBaseSquadSplitViewController` |  |
| `UTBulkActionPopupViewController` |  |
| `UTCancelTimedEvolutionPopupViewController` |  |
| `UTClaimCampaignRewardsViewController` |  |
| `UTClubHubViewController` |  |
| `UTClubSearchFiltersViewController` |  |
| `UTClubSearchResultsViewController` |  |
| `UTCompareActionPanelViewController` |  |
| `UTConsumableCategoriesViewController` |  |
| `UTConsumablesHubViewController` |  |
| `UTCustomizeHubViewController` |  |
| `UTEvolveAnimationViewController` |  |
| `UTFCPointsPurchaseViewController` |  |
| `UTFunCaptchaViewController` |  |
| `UTGameModesHubViewController` |  |
| `UTGameRewardsViewController` |  |
| `UTGettingStartedViewController` |  |
| `UTHomeHubViewController` |  |
| `UTItemDetailsViewController` |  |
| `UTLanguageSelectViewController` |  |
| `UTLeaderboardFiltersViewController` |  |
| `UTLeaderboardsHubViewController` |  |
| `UTLicenseViewController` |  |
| `UTLiveMessagePopupViewController` |  |
| `UTLoggedOnConsoleViewController` |  |
| `UTLoginViewController` |  |
| `UTManagerBioViewController` |  |
| `UTMarketSearchFiltersViewController` |  |
| `UTMarketSearchResultsSplitViewController` |  |
| `UTMarketSearchResultsViewController` |  |
| `UTMyClubSearchFiltersViewController` |  |
| `UTNoCampaignViewController` |  |
| `UTNotificationLayerViewController` |  |
| `UTObjectiveCategoryViewController` |  |
| `UTObjectivesFiltersViewController` |  |
| `UTObjectivesHubViewController` |  |
| `UTPackAnimationViewController` |  |
| `UTPackOddsViewController` |  |
| `UTPersonaSelectorPopupViewController` |  |
| `UTPersonaSelectorViewController` |  |
| `UTPersonaViewController` |  |
| `UTPinnedItemViewController` |  |
| `UTPlayerBioViewController` |  |
| `UTPlayerHealthLimitPopupViewController` |  |
| `UTPlayerHealthViewController` |  |
| `UTPlayerPicksViewController` |  |
| `UTQuickListPanelViewController` |  |
| `UTQuickSellPopupViewController` |  |
| `UTRenamePopupViewController` |  |
| `UTRenameSquadPopupViewController` |  |
| `UTResetWarningsViewController` |  |
| `UTRewardSelectionChoiceViewController` |  |
| `UTRootViewController` |  |
| `UTSBCChallengesViewController` |  |
| `UTSBCConfirmSubmissionPopupViewController` |  |
| `UTSBCFiltersViewController` |  |
| `UTSBCGroupChallengeSplitViewController` |  |
| `UTSBCHubViewController` |  |
| `UTSBCRequirementsNotificationViewController` |  |
| `UTSBCRequirementsPopupViewController` |  |
| `UTSBCRequirementsViewController` |  |
| `UTSBCRewardPreviewViewController` |  |
| `UTSBCSquadDetailPanelViewController` |  |
| `UTSBCSquadOverviewViewController` |  |
| `UTSBCSquadSplitViewController` |  |
| `UTSeasonalCampaignPopupViewController` |  |
| `UTSelectItemFromClubViewController` |  |
| `UTSendToSquadViewController` |  |
| `UTSlotActionPanelViewController` |  |
| `UTSlotDetailsViewController` |  |
| `UTSocialViewController` |  |
| `UTSPCapPopupViewController` |  |
| `UTSplitViewController` |  |
| `UTSquadActionsViewController` |  |
| `UTSquadBattlesViewController` |  |
| `UTSquadBuilderViewController` |  |
| `UTSquadChemistryPopupViewController` |  |
| `UTSquadComparePlayersViewController` |  |
| `UTSquadListSplitViewController` |  |
| `UTSquadListViewController` |  |
| `UTSquadOverviewViewController` |  |
| `UTSquadsHubViewController` |  |
| `UTSquadSplitViewController` |  |
| `UTStoreBundleDetailsModalViewController` |  |
| `UTStoreBundleRevealModalListViewController` |  |
| `UTStoreHubViewController` |  |
| `UTStoreItemViewController` |  |
| `UTStoreMTXViewController` |  |
| `UTStorePackRevealModalListViewController` |  |
| `UTStorePackViewController` |  |
| `UTStoreViewController` |  |
| `UTSwapComparePlayersViewController` |  |
| `UTTacticsDefensiveStyleSelectViewController` |  |
| `UTTacticsEditSlotPopupViewController` |  |
| `UTTacticsExportCodePopupViewController` |  |
| `UTTacticsFormationSelectViewController` |  |
| `UTTacticsImportCodePopupViewController` |  |
| `UTTacticsManageSettingsViewController` |  |
| `UTTacticsOffensiveStyleSelectViewController` |  |
| `UTTacticsPositionAdjustmentViewController` |  |
| `UTTacticsPresetPopupViewController` |  |
| `UTTacticsProfileMenuViewController` |  |
| `UTTacticsProfileSelectPopupViewController` |  |
| `UTTacticsRoleMenuViewController` |  |
| `UTTacticsRoleSelectViewController` |  |
| `UTTacticsRoleSlotSelectViewController` |  |
| `UTTacticsSelectSlotPopupViewController` |  |
| `UTTacticsSplitViewController` |  |
| `UTTacticsVariationSelectViewController` |  |
| `UTTOTWSquadListViewController` |  |
| `UTTOTWSquadOverviewViewController` |  |
| `UTTOTWSquadSplitViewController` |  |
| `UTTraitDetailViewController` |  |
| `UTTransferClubResultsViewController` |  |
| `UTTransferClubSearchViewController` |  |
| `UTTransferListSplitViewController` |  |
| `UTTransferListViewController` |  |
| `UTTransfersHubViewController` |  |
| `UTUnassignedItemsSplitViewController` |  |
| `UTUnassignedItemsViewController` |  |
| `UTUndoDiscardSplitViewController` |  |
| `UTUndoDiscardViewController` |  |
| `UTWatchListSplitViewController` |  |
| `UTWatchListViewController` |  |
| `UTWelcomeBackViewController` |  |

### Controllers

| Class name | Description |
|---|---|
| `UTAppTrackingController` |  |
| `UTBootFlowNavigationController` |  |
| `UTFCPointsBrokerWindowController` |  |
| `UTFCPointsPurchaseFlowController` |  |
| `UTGameFlowNavigationController` |  |
| `UTGameTabBarController` |  |
| `UTGoToLinkController` |  |
| `UTItemActionController` |  |
| `UTItemDetailsNavigationController` |  |
| `UTLoginController` |  |
| `UTMyStadiumController` |  |
| `UTNavigationController` |  |
| `UTPlayerHealthController` |  |
| `UTPresentationController` |  |
| `UTRootPresentationController` |  |
| `UTServerSettingsUpdateController` |  |
| `UTSheetPresentationController` |  |
| `UTSquadDetailsNavigationController` |  |
| `UTSquadItemDetailsNavigationController` |  |
| `UTTabBarController` |  |
| `UTTransferListNavigationController` |  |

### Views

| Class name | Description |
|---|---|
| `UTAboutView` |  |
| `UTAcademyBaseLabelView` |  |
| `UTAcademyClubSearchResultsView` |  |
| `UTAcademyClubSearchView` |  |
| `UTAcademyFiltersView` |  |
| `UTAcademyHeaderLabelView` |  |
| `UTAcademyHubTileView` |  |
| `UTAcademyHubView` |  |
| `UTAcademyItemCanvasView` |  |
| `UTAcademyPreviewItemView` |  |
| `UTAcademyRepeatabilityStatusLabelView` |  |
| `UTAcademySlotActionPanelView` |  |
| `UTAcademySlotItemDetailsView` |  |
| `UTAcademySlotRequirementsView` |  |
| `UTAcademySlotRoleUpgradeView` |  |
| `UTAcademySlotStatView` |  |
| `UTAcademySlotTileView` |  |
| `UTAcademyTokenItemView` |  |
| `UTActionConfirmationPopupView` |  |
| `UTApplicableConsumableListView` |  |
| `UTApplicablePositionSelectView` |  |
| `UTAppSettingsView` |  |
| `UTAuctionActionPanelView` |  |
| `UTBackgroundEffectsView` |  |
| `UTBadgeItemView` |  |
| `UTBallItemView` |  |
| `UTBaseShineView` |  |
| `UTBulkActionPopupView` |  |
| `UTCancelTimedEvolutionPopupView` |  |
| `UTChemistryStyleItemView` |  |
| `UTClaimCampaignRewardsView` |  |
| `UTClockIconView` |  |
| `UTClubCategoryRowView` |  |
| `UTClubHubView` |  |
| `UTClubItemSearchHeaderView` |  |
| `UTClubSearchFiltersView` |  |
| `UTClubSearchResultsView` |  |
| `UTCompanionCarouselItemContainerView` |  |
| `UTCompanionCarouselItemView` |  |
| `UTCompareActionPanelView` |  |
| `UTCompareDetailsView` |  |
| `UTConfirmationToggleContainerView` |  |
| `UTConsumableCategoriesView` |  |
| `UTConsumableItemView` |  |
| `UTConsumablesHubView` |  |
| `UTCurrencyEventTokenView` |  |
| `UTCurrencyNavigationBarView` |  |
| `UTCustomBrickItemView` |  |
| `UTCustomizeHubView` |  |
| `UTCustomSelectionTileView` |  |
| `UTCustomSlotListView` |  |
| `UTDefaultActionPanelView` |  |
| `UTDiscardedItemActionPanelView` |  |
| `UTDonutGraphView` |  |
| `UTDuplicateLoanActionPanelView` |  |
| `UTEmptySectionMessageView` |  |
| `UTEventTokenIconView` |  |
| `UTEventTokenNotificationView` |  |
| `UTEvolveAnimationShineView` |  |
| `UTEvolveAnimationView` |  |
| `UTExternalLinkTileView` |  |
| `UTFCPointsPurchaseView` |  |
| `UTFunCaptchaView` |  |
| `UTFUTLogoView` |  |
| `UTGameModesHubView` |  |
| `UTGameModesRewardsCarouselView` |  |
| `UTGameModesTierProgressBarView` |  |
| `UTGameModeTileView` |  |
| `UTGameRewardsView` |  |
| `UTGettingStartedView` |  |
| `UTGraphicalInfoTileContentView` |  |
| `UTGraphicalInfoTileView` |  |
| `UTHeaderView` |  |
| `UTHealingListDataView` |  |
| `UTHomeHubView` |  |
| `UTHubMessagesTileView` |  |
| `UTImageListView` |  |
| `UTItemBioListView` |  |
| `UTItemBioRowView` |  |
| `UTItemBioView` |  |
| `UTItemCanvasView` |  |
| `UTItemDetailsView` |  |
| `UTItemManagerCanvasView` |  |
| `UTItemPlayerCanvasView` |  |
| `UTItemPlayerStateIndicatorView` |  |
| `UTItemSearchView` |  |
| `UTItemStatBarsView` |  |
| `UTItemStatChevronsView` |  |
| `UTItemTableCellView` |  |
| `UTItemTraitsCanvasView` |  |
| `UTItemView` |  |
| `UTKitItemView` |  |
| `UTLabelView` |  |
| `UTLanguageSelectView` |  |
| `UTLanguageTableCellView` |  |
| `UTLargeAcademyPreviewView` |  |
| `UTLargeAcademyRepeatTokenItemView` |  |
| `UTLargeAcademyTokenItemView` |  |
| `UTLargeBadgeItemView` |  |
| `UTLargeBallItemView` |  |
| `UTLargeChemistryStyleItemView` |  |
| `UTLargeConsumableItemView` |  |
| `UTLargeCustomBrickItemView` |  |
| `UTLargeKitItemView` |  |
| `UTLargeManagerItemView` |  |
| `UTLargeMiscItemView` |  |
| `UTLargePlayerItemView` |  |
| `UTLargeStadiumItemView` |  |
| `UTLargeVanityItemView` |  |
| `UTLeaderboardFiltersView` |  |
| `UTLeaderboardsEntryView` |  |
| `UTLeaderboardsHubView` |  |
| `UTLeaderboardsTileView` |  |
| `UTLicenseView` |  |
| `UTListActiveTagView` |  |
| `UTListChemistryTagView` |  |
| `UTListNoResultsView` |  |
| `UTListTagView` |  |
| `UTLiveMessagePopupView` |  |
| `UTLoggedOnConsoleView` |  |
| `UTLoginView` |  |
| `UTManagerBioView` |  |
| `UTManagerItemView` |  |
| `UTManagerLeagueListDataView` |  |
| `UTMarketSearchFiltersView` |  |
| `UTMarketSearchView` |  |
| `UTMiscItemView` |  |
| `UTModalContainerView` |  |
| `UTNavigationBarView` |  |
| `UTNavigationContainerView` |  |
| `UTNimbleMTXDetailsView` |  |
| `UTNoCampaignView` |  |
| `UTNotificationLayerView` |  |
| `UTNotificationView` |  |
| `UTObjectiveCategoryView` |  |
| `UTObjectiveGroupView` |  |
| `UTObjectivesFiltersView` |  |
| `UTObjectivesHubTileContentView` |  |
| `UTObjectivesHubTileView` |  |
| `UTObjectivesHubView` |  |
| `UTObjectiveStatusLabelView` |  |
| `UTObjectiveTaskCondensedView` |  |
| `UTOnboardingSelectView` |  |
| `UTOnboardingToolbarView` |  |
| `UTPackAnimationShineView` |  |
| `UTPackAnimationView` |  |
| `UTPackGraphicView` |  |
| `UTPackOddsCollapsibleSectionView` |  |
| `UTPackOddsView` |  |
| `UTPaginatedItemListView` |  |
| `UTPersonaSelectorPopupView` |  |
| `UTPersonaSelectorView` |  |
| `UTPersonaTableCellView` |  |
| `UTPersonaView` |  |
| `UTPinnedItemTableCellView` |  |
| `UTPlayerBioRoleCellView` |  |
| `UTPlayerBioRoleRowView` |  |
| `UTPlayerBioStoryView` |  |
| `UTPlayerBioTemporaryItemRowView` |  |
| `UTPlayerBioView` |  |
| `UTPlayerHealthLimitPopupView` |  |
| `UTPlayerHealthStatView` |  |
| `UTPlayerHealthTileContentView` |  |
| `UTPlayerHealthTileView` |  |
| `UTPlayerHealthView` |  |
| `UTPlayerItemView` |  |
| `UTPlayerPickOptionView` |  |
| `UTPlayerPicksTileView` |  |
| `UTPlayerPicksView` |  |
| `UTPlayerPositionCellView` |  |
| `UTPlayerPositionListDataView` |  |
| `UTPlayerRoleCellView` |  |
| `UTPlayerRoleTableCellView` |  |
| `UTPlayerStatsListDataView` |  |
| `UTPlayerVariationCellView` |  |
| `UTPlayerVariationTableCellView` |  |
| `UTPlayStyleListDataView` |  |
| `UTProgressBarView` |  |
| `UTProgressionHeaderView` |  |
| `UTProgressListItemView` |  |
| `UTPseudoTableView` |  |
| `UTQuickListPanelView` |  |
| `UTQuickSellPopupView` |  |
| `UTRenamePopupView` |  |
| `UTResetWarningsView` |  |
| `UTRestoreItemListDataView` |  |
| `UTRewardIconView` |  |
| `UTRewardsBannerTileView` |  |
| `UTRewardsCarouselView` |  |
| `UTRewardSelectionChoiceView` |  |
| `UTRewardSelectionView` |  |
| `UTRootView` |  |
| `UTSBCBrickActionPanelView` |  |
| `UTSBCChallengeDetailsView` |  |
| `UTSBCChallengeHeaderView` |  |
| `UTSBCChallengeRequirementsView` |  |
| `UTSBCChallengesView` |  |
| `UTSBCChallengeTableRowView` |  |
| `UTSBCConfirmSubmissionPopupView` |  |
| `UTSBCFiltersView` |  |
| `UTSBCGroupRewardListView` |  |
| `UTSBCHubView` |  |
| `UTSBCRequirementsNotificationView` |  |
| `UTSBCRequirementsPopupView` |  |
| `UTSBCRequirementsView` |  |
| `UTSBCRewardPreviewView` |  |
| `UTSBCRewardTableCellView` |  |
| `UTSBCSetInfoView` |  |
| `UTSBCSetTileView` |  |
| `UTSBCSquadDetailPanelView` |  |
| `UTSBCSquadOverviewView` |  |
| `UTSBCSquadStatsView` |  |
| `UTSBCSquadSummaryBannerView` |  |
| `UTSBCSummaryProgressView` |  |
| `UTSBCTimerLabelView` |  |
| `UTSearchCriteriaPriceView` |  |
| `UTSeasonalCampaignPopupView` |  |
| `UTSectionedItemListView` |  |
| `UTSectionedSlotListView` |  |
| `UTSectionedSquadTableView` |  |
| `UTSectionedTableHeaderView` |  |
| `UTSendToSquadView` |  |
| `UTSheetView` |  |
| `UTSlotActionPanelView` |  |
| `UTSlotSelectPanelView` |  |
| `UTSmallAcademyPreviewView` |  |
| `UTSmallAcademyRepeatTokenItemView` |  |
| `UTSmallAcademyTokenItemView` |  |
| `UTSmallBadgeItemView` |  |
| `UTSmallBallItemView` |  |
| `UTSmallChemistryStyleItemView` |  |
| `UTSmallConsumableItemView` |  |
| `UTSmallCustomBrickItemView` |  |
| `UTSmallKitItemView` |  |
| `UTSmallManagerItemView` |  |
| `UTSmallMiscItemView` |  |
| `UTSmallPlayerItemView` |  |
| `UTSmallStadiumItemView` |  |
| `UTSmallTacticsPlayerItemView` |  |
| `UTSmallVanityItemView` |  |
| `UTSocialEventTileView` |  |
| `UTSocialRequirementRowView` |  |
| `UTSocialView` |  |
| `UTSPCapPopupView` |  |
| `UTSplitView` |  |
| `UTSquadActionsView` |  |
| `UTSquadBattlesProgressionHeaderView` |  |
| `UTSquadBattlesTierProgressBarView` |  |
| `UTSquadBattlesTierView` |  |
| `UTSquadBattlesView` |  |
| `UTSquadBuilderView` |  |
| `UTSquadBuildingSetStatusLabelView` |  |
| `UTSquadChemistryBaseEntryView` |  |
| `UTSquadChemistryCondensedEntryView` |  |
| `UTSquadChemistryCondensedHeaderView` |  |
| `UTSquadChemistryFullEntryView` |  |
| `UTSquadChemistryFullHeaderView` |  |
| `UTSquadChemistryPointView` |  |
| `UTSquadChemistryPopupView` |  |
| `UTSquadChemistrySectionHeaderView` |  |
| `UTSquadChemistrySummaryEntryView` |  |
| `UTSquadChemistryTutorialView` |  |
| `UTSquadListView` |  |
| `UTSquadOverviewView` |  |
| `UTSquadPitchView` |  |
| `UTSquadsHubView` |  |
| `UTSquadSlotChemistryPointsView` |  |
| `UTSquadSlotDockView` |  |
| `UTSquadSlotPedestalView` |  |
| `UTSquadSlotView` |  |
| `UTSquadStarRatingView` |  |
| `UTSquadStatsListDataView` |  |
| `UTSquadStatsView` |  |
| `UTSquadSummaryBannerView` |  |
| `UTSquadTableCellView` |  |
| `UTSquadTileContentView` |  |
| `UTSquadTileView` |  |
| `UTStadiumItemView` |  |
| `UTStarRatingView` |  |
| `UTStarterSquadOverviewView` |  |
| `UTStoreArticleDetailsView` |  |
| `UTStoreArticlePackGraphicView` |  |
| `UTStoreBundleDetailsModalView` |  |
| `UTStoreBundleDetailsView` |  |
| `UTStoreHubView` |  |
| `UTStorePackDetailsView` |  |
| `UTStoreRevealModalListView` |  |
| `UTStoreView` |  |
| `UTStoreWebRedirectTileView` |  |
| `UTStoreXrayPackDetailsView` |  |
| `UTStringListDataView` |  |
| `UTTabBarItemNotificationView` |  |
| `UTTabBarItemView` |  |
| `UTTabBarView` |  |
| `UTTacticsApplyManagerPresetRowView` |  |
| `UTTacticsApplyPresetRowView` |  |
| `UTTacticsBaseSelectView` |  |
| `UTTacticsDefensiveStyleSelectView` |  |
| `UTTacticsEditSlotPopupRowView` |  |
| `UTTacticsEditSlotPopupView` |  |
| `UTTacticsExportCodePopupView` |  |
| `UTTacticsFormationSelectView` |  |
| `UTTacticsImportCodePopupView` |  |
| `UTTacticsInfoCellView` |  |
| `UTTacticsInfoRowView` |  |
| `UTTacticsManageSettingsRowView` |  |
| `UTTacticsManageSettingsView` |  |
| `UTTacticsOffensiveStyleSelectView` |  |
| `UTTacticsPositionAdjustmentView` |  |
| `UTTacticsPresetInfoRowView` |  |
| `UTTacticsPresetInfoView` |  |
| `UTTacticsPresetPopupView` |  |
| `UTTacticsProfileMenuView` |  |
| `UTTacticsProfileSelectPopupView` |  |
| `UTTacticsRoleMenuView` |  |
| `UTTacticsRoleSelectView` |  |
| `UTTacticsSelectSlotPopupView` |  |
| `UTTacticsSquadPitchView` |  |
| `UTTacticsStyleSelectCardView` |  |
| `UTTacticsVariationSelectView` |  |
| `UTTierProgressBarView` |  |
| `UTTierView` |  |
| `UTTileDimOverlayView` |  |
| `UTTileSquadStatsView` |  |
| `UTTileView` |  |
| `UTToggleCellView` |  |
| `UTToggleControlGroupView` |  |
| `UTToolbarView` |  |
| `UTTOTWSquadListView` |  |
| `UTTOTWSquadOverviewView` |  |
| `UTTOTWSummaryBannerView` |  |
| `UTTraitDetailPopupView` |  |
| `UTTraitListView` |  |
| `UTTraitNoPlayStylesView` |  |
| `UTTraitTableCellView` |  |
| `UTTransferActionPanelView` |  |
| `UTTransferListView` |  |
| `UTTransfersHubView` |  |
| `UTTransfersTileContentView` |  |
| `UTTransfersTileView` |  |
| `UTUnassignedItemsView` |  |
| `UTUnassignedTileView` |  |
| `UTUndoDiscardStatusBarView` |  |
| `UTUndoDiscardView` |  |
| `UTVanityItemView` |  |
| `UTWarningCardView` |  |
| `UTWatchListView` |  |
| `UTWelcomeBackView` |  |

### ViewModels

| Class name | Description |
|---|---|
| `UTAcademyViewModel` |  |
| `UTBucketedItemSearchViewModel` |  |
| `UTCaptchaViewModel` |  |
| `UTChampionsViewModel` |  |
| `UTClubViewModel` |  |
| `UTConsumableCategoriesViewModel` |  |
| `UTDiscardedItemsViewModel` |  |
| `UTHomeHubViewModel` |  |
| `UTItemInfoStateViewModel` |  |
| `UTItemListViewModel` |  |
| `UTItemSearchViewModel` |  |
| `UTItemSectionListViewModel` |  |
| `UTLeaderboardsViewModel` |  |
| `UTMyStadiumViewModel` |  |
| `UTObjectivesViewModel` |  |
| `UTOnboardingStateViewModel` |  |
| `UTPaginatedAcademySlotListViewModel` |  |
| `UTPaginatedItemListViewModel` |  |
| `UTPlayerHealthViewModel` |  |
| `UTRivalsViewModel` |  |
| `UTSBCChallengesViewModel` |  |
| `UTSBCItemWarningViewModel` |  |
| `UTSBCSetsViewModel` |  |
| `UTSocialViewModel` |  |
| `UTSquadBattlesViewModel` |  |
| `UTSquadBuilderViewModel` |  |
| `UTSquadListViewModel` |  |
| `UTSquadMarketSearchViewModel` |  |
| `UTSquadSectionListViewModel` |  |
| `UTSquadTacticsViewModel` |  |
| `UTSquadViewModel` |  |
| `UTStoreViewModel` |  |
| `UTTacticsPopupViewModel` |  |
| `UTTOTWHistoryViewModel` |  |
| `UTTransferMarketPaginationViewModel` |  |
| `UTTransferSectionListViewModel` |  |
| `UTUnassignedItemsViewModel` |  |
| `UTViewModel` |  |
| `UTWatchSectionListViewModel` |  |

### Entities

| Class name | Description |
|---|---|
| `UTAcademyAwardEntity` |  |
| `UTAcademyLevelEntity` |  |
| `UTAcademyObjectiveEntity` |  |
| `UTAcademySlotEntity` |  |
| `UTArubaMessageEntity` |  |
| `UTAuctionEntity` |  |
| `UTCampaignCategoryEntity` |  |
| `UTCampaignGroupEntity` |  |
| `UTCampaignObjectiveEntity` |  |
| `UTChampionsEventEntity` |  |
| `UTChampionsEventPrizeTiersEntity` |  |
| `UTChampionsEventStageEntity` |  |
| `UTChemistryParameterEntity` |  |
| `UTChemistryProfileEntity` |  |
| `UTCustomBrickItemEntity` |  |
| `UTEventTokenEntity` |  |
| `UTItemAcademyStatEntity` |  |
| `UTItemEntity` |  |
| `UTMyStadiumEntity` |  |
| `UTMyStadiumSlotEntity` |  |
| `UTMyStadiumTierEntity` |  |
| `UTNimbleMTXItemEntity` |  |
| `UTNullItemEntity` |  |
| `UTNullSquadSlotEntity` |  |
| `UTPersonaEntity` |  |
| `UTPlayerHealthEntity` |  |
| `UTPlayerHealthStatEntity` |  |
| `UTRewardSetEntity` |  |
| `UTRivalsEventEliteTierEntity` |  |
| `UTRivalsEventEntity` |  |
| `UTRivalsEventPrizeTierEntity` |  |
| `UTRivalsEventStageEntity` |  |
| `UTSBCChallengeEntity` |  |
| `UTSBCSetEntity` |  |
| `UTSocialEventEntity` |  |
| `UTSquadBattlesEventEntity` |  |
| `UTSquadBattlesEventTierEntity` |  |
| `UTSquadEntity` |  |
| `UTSquadSlotEntity` |  |
| `UTSquadTacticsEntity` |  |
| `UTStoreArticleEntity` |  |
| `UTStoreBundleEntity` |  |
| `UTStoreItemPackEntity` |  |
| `UTStorePointsPackEntity` |  |
| `UTStorePurchasableArticleEntity` |  |
| `UTStoreXrayItemPackEntity` |  |
| `UTUserEntity` |  |

### DTOs

| Class name | Description |
|---|---|
| `UTAcademyCategoryDTO` |  |
| `UTAcademySlotSearchCriteriaDTO` |  |
| `UTArubaTextFieldDTO` |  |
| `UTCareerEntryDTO` |  |
| `UTClubStatDTO` |  |
| `UTConsumableStatsDTO` |  |
| `UTDataProviderEntryDTO` |  |
| `UTHttpResponseDTO` |  |
| `UTItemAnimationCanvasDTO` |  |
| `UTItemCanvasDTO` |  |
| `UTItemRarityColorMapDTO` |  |
| `UTItemRarityDTO` |  |
| `UTLeaderboardEntryDTO` |  |
| `UTLeaderboardOptionDTO` |  |
| `UTLeaderboardPermutationDTO` |  |
| `UTLeagueDTO` |  |
| `UTLegendsBioDTO` |  |
| `UTNationDTO` |  |
| `UTPackOddsDTO` |  |
| `UTPersonaClubDTO` |  |
| `UTPlayerIconDataDTO` |  |
| `UTPlayerMetaDataDTO` |  |
| `UTPlayStyleDTO` |  |
| `UTPopupDTO` |  |
| `UTSBCCategoryDTO` |  |
| `UTSBCEligibilityDTO` |  |
| `UTSBCPlayerRequirementDTO` |  |
| `UTScreenLoadDTO` |  |
| `UTSearchCriteriaDTO` |  |
| `UTServiceResponseDTO` |  |
| `UTSquadFormationDTO` |  |
| `UTSquadPositionDTO` |  |
| `UTStaticBadgeItemDataDTO` |  |
| `UTStaticBallItemDataDTO` |  |
| `UTStaticHealingItemDataDTO` |  |
| `UTStaticItemDataDTO` |  |
| `UTStaticKitItemDataDTO` |  |
| `UTStaticManagerItemDataDTO` |  |
| `UTStaticMiscItemDataDTO` |  |
| `UTStaticPlayerDataDTO` |  |
| `UTStaticPlayerItemDataDTO` |  |
| `UTStaticStadiumItemDataDTO` |  |
| `UTStaticTrainingItemDataDTO` |  |
| `UTStaticVanityItemDataDTO` |  |
| `UTTacticsRoleDTO` |  |
| `UTTacticsSummaryDTO` |  |
| `UTTeamDTO` |  |
| `UTTeamKitDTO` |  |
| `UTTeamLinkDTO` |  |
| `UTUnassignedItemStatsDTO` |  |

### DAOs

| Class name | Description |
|---|---|
| `UTAcademyDAO` |  |
| `UTAnalyticsDAO` |  |
| `UTCaptchaDAO` |  |
| `UTChampionsDAO` |  |
| `UTChemistryDAO` |  |
| `UTClubDAO` |  |
| `UTCompanionDAO` |  |
| `UTConfigurationDAO` |  |
| `UTEventTokenDAO` |  |
| `UTFirstPartyStoreDAO` |  |
| `UTItemDAO` |  |
| `UTLeaderboardsDAO` |  |
| `UTMessagesDAO` |  |
| `UTModuleDAO` |  |
| `UTMyStadiumDAO` |  |
| `UTObjectivesDAO` |  |
| `UTOnboardingDAO` |  |
| `UTPlayerHealthDAO` |  |
| `UTPlayerMetaDataDAO` |  |
| `UTRivalsDAO` |  |
| `UTSocialDAO` |  |
| `UTSquadBattlesDAO` |  |
| `UTSquadBuildingChallengeDAO` |  |
| `UTSquadDAO` |  |
| `UTStoreDAO` |  |
| `UTTransfersDAO` |  |
| `UTUserDAO` |  |

### Repositories

| Class name | Description |
|---|---|
| `UTAcademyRepository` |  |
| `UTChampionsEventRepository` |  |
| `UTChemistryRepository` |  |
| `UTClubRepository` |  |
| `UTCompanionRepository` |  |
| `UTDiscardedRepository` |  |
| `UTEventTokenRepository` |  |
| `UTGameModesEventRepository` |  |
| `UTItemDomainRepository` |  |
| `UTItemRarityRepository` |  |
| `UTItemRepository` |  |
| `UTKeyAttributeRepository` |  |
| `UTLeaderboardEntryRepository` |  |
| `UTLeagueRepository` |  |
| `UTMessagesRepository` |  |
| `UTModuleRepository` |  |
| `UTMyStadiumRepository` |  |
| `UTNationRepository` |  |
| `UTNimbleMTXItemRepository` |  |
| `UTPlayerHealthRepository` |  |
| `UTPlayerIconRepository` |  |
| `UTPlayerMetaRepository` |  |
| `UTPlayStyleRepository` |  |
| `UTRivalRewardsRepository` |  |
| `UTRivalsEventRepository` |  |
| `UTSBCRepository` |  |
| `UTServerSettingsRepository` |  |
| `UTSocialEventRepository` |  |
| `UTSquadBattlesEventRepository` |  |
| `UTSquadRepository` |  |
| `UTStoreRepository` |  |
| `UTTacticsRepository` |  |
| `UTTeamConfigRepository` |  |
| `UTTeamRepository` |  |
| `UTTOTWSquadRepository` |  |
| `UTTransferMarketRepository` |  |
| `UTUserRepository` |  |

### Services

| Class name | Description |
|---|---|
| `UTAcademyService` |  |
| `UTChampionsService` |  |
| `UTChemistryService` |  |
| `UTClubService` |  |
| `UTCompanionService` |  |
| `UTConfigurationService` |  |
| `UTEventTokenService` |  |
| `UTItemService` |  |
| `UTLeaderboardsService` |  |
| `UTMessagesService` |  |
| `UTMetricsService` |  |
| `UTModuleService` |  |
| `UTMTXService` |  |
| `UTMyStadiumService` |  |
| `UTOnboardingService` |  |
| `UTPlayerHealthService` |  |
| `UTPlayerMetaDataService` |  |
| `UTRivalsService` |  |
| `UTSBCService` |  |
| `UTShowcaseService` |  |
| `UTSocialService` |  |
| `UTSquadBattlesService` |  |
| `UTSquadService` |  |
| `UTStoreService` |  |
| `UTTransferMarketService` |  |
| `UTUserService` |  |
| `UTUtasRequestQueueService` |  |

### Factories

| Class name | Description |
|---|---|
| `UTAcademyFactory` |  |
| `UTAuctionEntityFactory` |  |
| `UTChampionsEventEntityFactory` |  |
| `UTChemistryFactory` |  |
| `UTDataProviderFactory` |  |
| `UTEventTokenEntityFactory` |  |
| `UTItemEntityFactory` |  |
| `UTItemViewFactory` |  |
| `UTMyStadiumEntityFactory` |  |
| `UTNimbleMTXItemFactory` |  |
| `UTObjectivesFactory` |  |
| `UTObjectivesUpdateFactory` |  |
| `UTPlayerHealthEntityFactory` |  |
| `UTRewardFactory` |  |
| `UTRivalsEventEntityFactory` |  |
| `UTSBCFactory` |  |
| `UTSocialEventEntityFactory` |  |
| `UTSquadBattlesEntityFactory` |  |
| `UTSquadEntityFactory` |  |
| `UTSquadTacticsEntityFactory` |  |
| `UTStoreArticleEntityFactory` |  |
| `UTUserFactory` |  |

### Controls

| Class name | Description |
|---|---|
| `UTButtonControl` |  |
| `UTChemistryButtonControl` |  |
| `UTControl` |  |
| `UTCurrencyButtonControl` |  |
| `UTCurrencyInputControl` |  |
| `UTDoubleRangeControl` |  |
| `UTDropDownControl` |  |
| `UTFlatButtonControl` |  |
| `UTFloatingImageButtonControl` |  |
| `UTGroupButtonControl` |  |
| `UTImageButtonControl` |  |
| `UTItemInfoChangeButtonControl` |  |
| `UTLimitStatInputSpinnerControl` |  |
| `UTNavigationButtonControl` |  |
| `UTNumberInputControl` |  |
| `UTNumberInputSpinnerControl` |  |
| `UTNumericInputSpinnerControl` |  |
| `UTPlayerSearchControl` |  |
| `UTRangeControl` |  |
| `UTSBCFavoriteButtonControl` |  |
| `UTSearchFilterControl` |  |
| `UTSquadTabButtonControl` |  |
| `UTStandardButtonControl` |  |
| `UTTacticsEditRangeControl` |  |
| `UTTextInputControl` |  |
| `UTToggleButtonControl` |  |
| `UTToggleControl` |  |
| `UTToolbarButtonControl` |  |

### VOs

| Class name | Description |
|---|---|
| `UTChemistryProfileRuleVO` |  |
| `UTChemistryThresholdVO` |  |
| `UTConfettiColourVO` |  |
| `UTCoordinateVO` |  |
| `UTCurrencyVO` |  |
| `UTEvolutionEligibilityVO` |  |
| `UTItemCosmeticLayerVO` |  |
| `UTKeyAttributeVO` |  |
| `UTObjectivesUpdateVO` |  |
| `UTObjectiveUpdateEntryVO` |  |
| `UTPlayerAttributeVO` |  |
| `UTPlayerPositionCharacteristicsVO` |  |
| `UTPlayerRoleVO` |  |
| `UTPlayerSubAttributeVO` |  |
| `UTRequestMetricsVO` |  |
| `UTRewardVO` |  |
| `UTRushEligibilityVO` |  |
| `UTServerErrorVO` |  |
| `UTSquadChemistryVO` |  |
| `UTSquadParameterChemistryVO` |  |
| `UTSquadSlotChemistryVO` |  |
| `UTTacticsProfileVO` |  |
| `UTTraitVO` |  |
| `UTValueBandVO` |  |

### Utils

| Class name | Description |
|---|---|
| `UTAcademyUtils` |  |
| `UTDragDropUtils` |  |
| `UTEventTokenUtils` |  |
| `UTItemUtils` |  |
| `UTLocalizationUtil` |  |
| `UTSquadChemCalculatorUtils` |  |

### Other

| Class name | Description |
|---|---|
| `UTAccordionHeaderButton` |  |
| `UTConfettiCannonParticleSystem` |  |
| `UTConfettiParticle` |  |
| `UTConfettiRainParticleSystem` |  |
| `UTFireworksParticleSystem` |  |
| `UTHttpRequest` |  |
| `UTMessageChannel` |  |
| `UTMessageMediator` |  |
| `UTMessageProcessor` |  |
| `UTMessageQueue` |  |
| `UTNativeStorage` |  |
| `UTNotificationDispatcher` |  |
| `UTParticle` |  |
| `UTParticleSystem` |  |
| `UTParticleTrail` |  |
| `UTPlayerSearchEngine` |  |
| `UTSnowfallParticleSystem` |  |
| `UTSnowflakeParticle` |  |
| `UTStadiumMessage` |  |
| `UTStadiumMessageConsumer` |  |
| `UTStadiumMessageProducer` |  |
| `UTStorageAlternative` |  |
| `UTTelemetryRateUtility` |  |
