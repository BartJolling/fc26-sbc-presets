// Runs in the EA web app's main world.
// Challenge list enhancement - captures the selected challenge name before navigation continues.

if (!fc26SbcPresets._sbcChallengeListClickTrackerInstalled && typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function (event) {
        var button = event && event.target && event.target.closest ? event.target.closest('.ut-sbc-requirements-view footer button.btn-standard.primary') : null;
        if (!button) return;

        var selectedRow = document.querySelector('.ut-sbc-challenges-view--challenges .ut-sbc-challenge-table-row-view.selected') ||
            document.querySelector('.ut-sbc-challenge-table-row-view.selected');
        if (!selectedRow) return;

        var titleEl = selectedRow.querySelector('.ut-sbc-challenge-table-row-view--title');
        var title = titleEl && titleEl.textContent ? String(titleEl.textContent).trim() : '';
        if (!title) return;

        fc26SbcPresets.lastClickedChallengeName = title;
    }, true);
    fc26SbcPresets._sbcChallengeListClickTrackerInstalled = true;
}