// Runs in the EA web app's main world.
// Loads a matching preset into Squad Builder and clicks Build when the view is ready.

(function () {
    /**
     * Gets the current SBC challenge name from the controller or the navbar title.
     * @param {object} controller - UTSBCSquadBuilderViewController instance
     * @returns {string} current challenge name
     */
    function getChallengeName(controller) {
        var challenge = controller && controller.challenge;

        if (challenge) {
            if (typeof challenge.getTitle === 'function') {
                var title = challenge.getTitle();
                if (title) {
                    return String(title).trim();
                }
            }

            if (challenge.title) {
                return String(challenge.title).trim();
            }
            if (challenge.name) {
                return String(challenge.name).trim();
            }
        }

        var titleEl = document.querySelector('.ut-navigation-bar-view.navbar-style-landscape h1.title');
        return titleEl ? titleEl.textContent.trim() : '';
    }

    /**
     * Finds the matching preset for a challenge, optionally by preset label.
     * @param {string} challengeName - SBC challenge name
     * @param {string} presetName - optional preset label to match
     * @returns {object|null} matching preset or null
     */
    function findPreset(challengeName, presetName) {
        var presets = fc26SbcPresets.presets || [];
        var i;
        var preset;

        if (presetName) {
            for (i = 0; i < presets.length; i++) {
                preset = presets[i];
                if (preset.challengeName === challengeName && preset.label === presetName) {
                    return preset;
                }
            }
        }

        for (i = 0; i < presets.length; i++) {
            preset = presets[i];
            if (preset.challengeName === challengeName) {
                return preset;
            }
        }

        return null;
    }

    /**
     * Converts a rarity label to the EA rarity id.
     * @param {string} rarity - rarity label
     * @returns {number|null} rarity id or null
     */
    function getRarityId(rarity) {
        if (rarity === 'Common') {
            return ItemRarity.NONE;
        }

        if (rarity === 'Rare') {
            return ItemRarity.RARE;
        }

        if (rarity === 'Special') {
            return ItemRarity.RARE + 1;
        }

        return null;
    }

    /**
     * Resolves a league label, abbreviation, or id to the EA league id.
     * @param {string|number} league - league label, abbreviation, or id
     * @returns {number|null} league id or null
     */
    function resolveLeagueId(league) {
        var teamConfig = repositories && repositories.TeamConfig;
        var leagues = teamConfig && typeof teamConfig.getLeagues === 'function' ? teamConfig.getLeagues() : null;
        var i;
        var leagueEntry;
        var normalizedLeague;

        if (typeof league === 'number' && isFinite(league)) {
            return league;
        }

        if (!leagues || !leagues.length || league === null || league === undefined) {
            return null;
        }

        normalizedLeague = String(league).trim().toUpperCase();
        if (!normalizedLeague) {
            return null;
        }

        if (/^\d+$/.test(normalizedLeague)) {
            return parseInt(normalizedLeague, 10);
        }

        for (i = 0; i < leagues.length; i++) {
            leagueEntry = leagues[i];
            if (leagueEntry && leagueEntry.abbreviation && String(leagueEntry.abbreviation).trim().toUpperCase() === normalizedLeague) {
                return leagueEntry.id;
            }
        }

        for (i = 0; i < leagues.length; i++) {
            leagueEntry = leagues[i];
            if (leagueEntry && leagueEntry.name && String(leagueEntry.name).trim().toUpperCase() === normalizedLeague) {
                return leagueEntry.id;
            }
        }

        return null;
    }

    /**
     * Clicks the Squad Builder Build button once the view has finished rendering.
     * @param {object} controller - UTSquadBuilderViewController instance
     */
    function clickBuildNow(controller) {
        if (controller && typeof controller.eBuildSelected === 'function') {
            controller.eBuildSelected();
        }
    }

    /**
     * Applies the selected preset to Squad Builder, then clicks Build.
     * @param {object} controller - UTSquadBuilderViewController instance
     * @param {object} preset - entry from fc26SbcPresets.presets[]
     */
    function applyPreset(controller, preset) {
        var viewModel = controller.viewModel;
        var view = controller.getView ? controller.getView() : null;
        var sortDropDown = view && view.getSortDropDown ? view.getSortDropDown() : null;
        var sortOptions = view && view.getSortOptions ? view.getSortOptions() : null;
        var searchFeatureChanged = false;

        if (!viewModel) {
            return;
        }

        if (preset.useConcept !== null) {
            controller.useConceptPlayers = !!preset.useConcept;
            if (sortOptions && sortOptions.toggleById) sortOptions.toggleById(enums.UISortOptionType.CONCEPT, controller.useConceptPlayers);
            if (view && view.toggleExcludeSquadSlider) view.toggleExcludeSquadSlider(!controller.useConceptPlayers);
            if (controller.useConceptPlayers) {
                viewModel.searchFeature = ItemSearchFeature.CONCEPT;
                searchFeatureChanged = true;
            }
        }

        if (preset.excludeActiveSquad !== null) {
            if (sortOptions && sortOptions.toggleById) sortOptions.toggleById(enums.UISortOptionType.EXCLUDE_SQUAD, preset.excludeActiveSquad);
            if (preset.excludeActiveSquad) {
                viewModel.requestActiveSquadDefIds().observe(controller, function (observable, result) {
                    observable.unobserve(controller);
                    if (result && result.data && result.data.defIds) {
                        viewModel.searchCriteria.excludeDefIds = result.data.defIds;
                    }
                });
            } else {
                viewModel.searchCriteria.excludeDefIds = [];
            }
        }

        if (preset.ignorePosition !== null) {
            controller.ignorePosition = !!preset.ignorePosition;
            if (sortOptions && sortOptions.toggleById) sortOptions.toggleById(enums.UISortOptionType.IGNORE_POSITION, controller.ignorePosition);
        }

        if (preset.untradeablesOnly !== null) {
            viewModel.searchCriteria.untradeables = preset.untradeablesOnly ? SearchUntradeables.ONLY : SearchUntradeables.DEFAULT;
            if (sortOptions && sortOptions.toggleById) sortOptions.toggleById(enums.UISortOptionType.UNTRADEABLE, preset.untradeablesOnly);
        }

        if (preset.rarity !== null) {
            var rarityId = getRarityId(preset.rarity);
            if (rarityId !== null) {
                viewModel.searchCriteria.rarities = [rarityId];
                viewModel.defaultSearchCriteria.rarities = [rarityId];
            }
        }

        if (preset.league !== null) {
            var leagueId = resolveLeagueId(preset.league);
            if (leagueId !== null) {
                viewModel.searchCriteria.league = leagueId;
                viewModel.defaultSearchCriteria.league = leagueId;
            }
        }

        if (preset.minOvr !== null) {
            viewModel.searchCriteria.ovrMin = preset.minOvr;
        }

        if (preset.maxOvr !== null) {
            viewModel.searchCriteria.ovrMax = preset.maxOvr;
        }

        if (preset.sortBy === 'Rating High to Low') {
            viewModel.searchCriteria.sort = SearchSortOrder.DESCENDING;
            viewModel.searchCriteria.sortBy = SearchSortType.RATING;
            if (sortDropDown && sortDropDown.setIndexById) sortDropDown.setIndexById(SearchSortID.RATING_DESC);
        } else if (preset.sortBy === 'Rating Low to High') {
            viewModel.searchCriteria.sort = SearchSortOrder.ASCENDING;
            viewModel.searchCriteria.sortBy = SearchSortType.RATING;
            if (sortDropDown && sortDropDown.setIndexById) sortDropDown.setIndexById(SearchSortID.RATING_ASC);
        }

        if (preset.quality === 'Bronze') {
            viewModel.defaultSearchCriteria.level = SearchLevel.BRONZE;
            viewModel.searchCriteria.level = SearchLevel.BRONZE;
        } else if (preset.quality === 'Silver') {
            viewModel.defaultSearchCriteria.level = SearchLevel.SILVER;
            viewModel.searchCriteria.level = SearchLevel.SILVER;
        } else if (preset.quality === 'Gold') {
            viewModel.defaultSearchCriteria.level = SearchLevel.GOLD;
            viewModel.searchCriteria.level = SearchLevel.GOLD;
        }

        if (preset.storage === 'Any') {
            viewModel.searchFeature = ItemSearchFeature.ANY;
            searchFeatureChanged = true;
        } else if (preset.storage === 'My Club' || preset.storage === 'SBC Storage') {
            viewModel.searchFeature = ItemSearchFeature.STORAGE;
            searchFeatureChanged = true;
        }

        if (searchFeatureChanged) {
            if (view && view.setPileFilter) {
                view.setPileFilter(factories.DataProvider.getSearchPileDPWithAny(controller.hasStoragePileSearch()), viewModel.searchFeature);
            }
            controller.updateOvrRangeVisibility();
        }

        if (view && view.setFilters) {
            view.setFilters(viewModel, false);
        }

        if (view && view._searchFilters && view._searchFilters._ovrRangeOptions) {
            if (preset.minOvr !== null) {
                view._searchFilters._ovrRangeOptions.setMinValue(preset.minOvr);
            }
            if (preset.maxOvr !== null) {
                view._searchFilters._ovrRangeOptions.setMaxValue(preset.maxOvr);
            }
        }

        controller._fc26PresetApplied = true;

    }

    fc26SbcPresets.hookPrototype('UTSquadBuilderViewController', 'init', function () {
        this._fc26PresetApplied = false;

        var challengeName = getChallengeName(this);
        var request = fc26SbcPresets.pendingPresetRequest;
        var preset = request && request.challengeName === challengeName ? findPreset(challengeName, request.presetName) : null;

        fc26SbcPresets.pendingPresetRequest = null;

        if (preset) {
            applyPreset(this, preset);
        }
    });

    fc26SbcPresets.hookPrototype('UTSquadBuilderViewController', 'viewDidAppear', function () {
        if (!this._fc26PresetApplied) {
            return;
        }

        this._fc26PresetApplied = false;

        // viewDidAppear fires while the builder push is still being committed.
        // Building synchronously here pops the builder off an unsettled navigation
        // stack and corrupts rendering, so defer until the push has settled.
        var controller = this;
        fc26SbcPresets.runWhenSettled(function () {
            clickBuildNow(controller);
        });
    });
}());