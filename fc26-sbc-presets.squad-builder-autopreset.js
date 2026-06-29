// Runs in the EA web app's main world.
// Loads a matching preset into Squad Builder as early as possible.

(function () {
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

    function findPreset(challengeName) {
        var presets = fc26.presets || [];

        for (var i = 0; i < presets.length; i++) {
            if (presets[i].challengeName === challengeName) {
                return presets[i];
            }
        }

        return null;
    }

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
    }

    fc26.hookPrototype('UTSquadBuilderViewController', 'init', function () {
        var challengeName = getChallengeName(this);
        var preset = challengeName ? findPreset(challengeName) : null;

        if (preset) {
            applyPreset(this, preset);
        }
    });
}());