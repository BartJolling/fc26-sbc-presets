// Runs in the EA web app's main world.
// Challenge list enhancement - captures the selected challenge name before navigation continues.

// Sync selectedChallengeName BEFORE viewWillAppear renders — EA triggers _generate on the
// detail panel synchronously inside viewWillAppear, so afterFn is too late.
// We compute getFirstIncompleteChallengeIndex() ourselves (same value viewWillAppear will set).
fc26SbcPresets.hookPrototype('UTSBCChallengesViewController', 'viewWillAppear', function () {
    var vm = this.sbcViewModel;
    var challenges = vm && typeof vm.getChallenges === 'function' ? vm.getChallenges() : null;
    var idx = vm && typeof vm.getFirstIncompleteChallengeIndex === 'function' ? vm.getFirstIncompleteChallengeIndex() : -1;
    var challenge = challenges && idx >= 0 ? challenges[idx] : null;
    var title = challenge && challenge.name ? String(challenge.name).trim() : '';
    if (title) { fc26SbcPresets.selectedChallengeName = title; }
}, null);

// User selects a different challenge row.
fc26SbcPresets.hookPrototype('UTSBCChallengesViewController', 'onChallengeSelected',
    function (e, t, i) {
        var challenge = i && this.sbset && typeof this.sbset.getChallenge === 'function'
            ? this.sbset.getChallenge(i.challengeId) : null;
        var title = challenge && challenge.name ? String(challenge.name).trim() : '';
        if (title) { fc26SbcPresets.selectedChallengeName = title; }
    }, null
);

// Single-challenge SBC sets skip UTSBCChallengesViewController entirely and navigate
// directly to UTSBCSquadDetailPanelViewController. Use beforeFn — _generate fires
// synchronously inside initWithSBCSet before afterFn would run.
// Arguments: e = UTSBCSetEntity, t = challengeId
fc26SbcPresets.hookPrototype('UTSBCSquadDetailPanelViewController', 'initWithSBCSet',
    function (e, t) {
        var challenge = e && typeof e.challenges === 'object' && e.challenges.get
            ? e.challenges.get(t) : null;
        var title = challenge && challenge.name ? String(challenge.name).trim() : '';
        if (title) { fc26SbcPresets.selectedChallengeName = title; }
    }, null
);