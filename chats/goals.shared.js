/* ─────────────────────────────────────────────────────────────
   goals.shared.js — shared across every goal widget.

   Host this and point each widget's loadShared() at a PINNED
   version. A change here goes live in every widget at once.

   ── The contract ────────────────────────────────────────────
   main.js must DECLARE (plain top-level let):
     fieldData, goalD, sum
     currency      — optional. SE's symbol, obj.detail.currency.symbol.
                     Falls back to fieldData.cur, then "".

   main.js must DEFINE:
     updateOnEvent(latest, firstload)
       latest   — { kind, name, amount } or null. Ignore it if the
                  widget has no ticker.
       firstload— true on the initial paint. Must NOT animate or
                  celebrate when true, or every refresh replays the show.

   main.js WIRES the listeners (same convention as the chat widgets):
     window.addEventListener('onEventReceived',  processGoalEvent);
     window.addEventListener('onSessionUpdate',  processGoalSession);

   ── latest.kind ─────────────────────────────────────────────
   "tip" | "cheer" | "sub" | "follower"
   Deliberately NOT markup. A widget maps the kind to its own icon
   SVG; a widget without a ticker ignores it entirely. That's what
   lets two goal widgets look nothing alike off one shared file.
   ───────────────────────────────────────────────────────────── */


/* The session's stored total for this goal type + timeframe. */
function initializeData(sData) {

    switch (fieldData["goalType"]) {
        default:
        case "tip":
        case "cheer":
        case "superchat":
            sum = +sData[`${fieldData.goalType}-${fieldData.timeframe}`]["amount"];
            break;
        case "sponsor":
        case "follower":
        case "subscriber":
            sum = +sData[`${fieldData.goalType}-${fieldData.timeframe}`][`${fieldData.timeframe == "goal" ? "amount" : "count"}`];
            break;
        case "sub-points":
            sum = +sData[`subscriber-points`]["amount"];
            break;
    }

    updateOnEvent(latestFromSession(sData), true);
}


/* Whoever did the last thing, as stored in the session.
   Used to seed a ticker on load so it isn't blank. */
function latestFromSession(sData) {
    const node = sData[`${fieldData.goalType}-latest`];
    if (!node) return null;
    return getLatest(fieldData.goalType, node["name"], node["amount"]);
}


/* Event -> how much it's worth. The only place that decides
   whether something counts. */
function processGoalEvent(obj) {
    if (!fieldData) return;

    const data = obj.detail.event;
    const type = fieldData.goalType + "-" + obj.detail.listener;
    const resubs = fieldData["resubs"];
    if (type.indexOf("latest") == -1) return;

    switch (type) {
        case "follower-follower-latest":
        case "sponsor-sponsor-latest":
            addToGoal(1, getLatest(fieldData.goalType, data.name));
            break;

        case "subscriber-subscriber-latest":
            // SE sends the bulk summary AND one event per recipient.
            // Count the summary, drop the children.
            if (data.isCommunityGift == true) {
                return;
            }
            if (data.bulkGifted && data.sender == data.name) {
                const n = +data.amount || 0;
                addToGoal(n, { kind: "sub", name: data.sender, amount: n + (n == 1 ? " sub" : " subs") });
                return;
            }
            if (resubs == false && data.gifted == false && data.amount > 1) {
                return;
            }
            addToGoal(1, getLatest("subscriber", data.name, data.amount));
            break;

        case "tip-tip-latest":
        case "cheer-cheer-latest":
        case "superchat-superchat-latest":
            // +x, not x.toFixed(2) — SE sometimes sends amount as a string
            addToGoal(+data.amount || 0, getLatest(fieldData.goalType, data.name, data.amount));
            break;
    }
}


/* sub-points is the one type with no event listener, so the session
   has to drive it. Everything else is event-driven and is left alone
   here on purpose: reconciling against the session snaps test events
   (and manual-reset timeframes) straight back down. */
function processGoalSession(obj) {
    if (!fieldData) return;
    if (fieldData.goalType != "sub-points") return;

    sum = +obj.detail.session["subscriber-points"]["amount"];
    updateOnEvent(null, false);
}


/* THE seam. Every source of "the number moved" goes through here —
   SE events now, Ko-fi sockets / custom counters / backend later:
     addToGoal(5, { kind: "tip", name: "someone", amount: "$5" });
   Add a source, every goal widget picks it up unchanged. */
function addToGoal(delta, latest) {
    if (!delta) return;
    sum += delta;
    updateOnEvent(latest || null, false);
}


/* Raw pieces for a ticker — data, never markup. */
function getLatest(goalType, name, amount) {
    let kind = "tip";
    let amt = (amount === 0 || amount) ? String(amount) : "";

    switch (goalType) {
        case "follower":
        case "sponsor":
            kind = "follower";
            amt = "";
            break;
        case "subscriber":
        case "sub-points":
            kind = "sub";
            if (amt) amt = "x" + amt;
            break;
        case "cheer":
        case "superchat":
            kind = "cheer";
            if (amt) amt = "x" + amt;
            break;
        case "tip":
            kind = "tip";
            if (amt) amt = goalCur() + amt;
            break;
    }

    return { kind: kind, name: name || "", amount: amt };
}


function goalCur() {
    if (typeof currency !== "undefined" && currency) return currency;
    return (fieldData && fieldData.cur) ? fieldData.cur : "";
}
