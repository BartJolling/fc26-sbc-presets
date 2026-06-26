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
