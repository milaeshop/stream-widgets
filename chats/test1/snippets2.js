/* =============================================================================
   SHARED WIDGET SNIPPETS
   Host this ONE file (GitHub + jsDelivr, or any static host) and load it
   dynamically from the top of each widget's JS tab (see main.template.js
   for the loader — StreamElements doesn't guarantee HTML-tab <script src>
   tags run before JS-tab code, so we don't rely on tag order at all).
   Editing this file and pushing the update makes the change live in every
   widget that loads it — fix the giant-emote hidden-character bug once,
   add the Giphy/GIF feature once, and it's live everywhere instead of
   copy-pasting into N widget folders.

   WHAT BELONGS HERE vs main.js
   -----------------------------------------------------------------------
   HERE (mutual — identical for every widget):
     - event plumbing: processEvent() and its helpers
     - badge/emote/gif/message parsing (resolveUserRole, composeMessageText,
       msgDiv, parseGifs, html_encode)
     - anything that talks to an outside API (get, getEmotes, getPronouns,
       getUserPronoun)
     - the test-button / fake-event generators used by the playground
     - queueing/animation helpers (ShowVert, ShowHor, LimitMsg, showMsgs)

   main.js (individual, one copy per widget — this is where the DESIGN lives):
     - addMessage / addEventBlock / addFollowerBlock / redeemAlert — the
       HTML each widget actually renders
     - ProcessEvents — decides what alert markup to build for a sub/tip/
       cheer/follow/raid, using addEventBlock/addFollowerBlock above
     - buildReplyBody — not every widget shows reply context, so this is
       per-widget; return "" if this widget doesn't do replies
     - handlePointRedemption's CALL SITE — gated on fieldData.redeems,
       from this widget's onEventReceived listener (the function itself
       lives below since the mechanics are the same for every widget)
     - onWidgetLoad — per-widget init (fieldData, classes, fonts, etc.)

   No hook registry, no config object — snippets.js calls a handful of
   plain functions (ProcessEvents, addMessage, redeemAlert, buildReplyBody)
   that main.js is expected to define, exactly the same way ProcessEvents/
   addMessage already worked before this reorganization.
   ========================================================================= */


/* ---------------------------------------------------------------------
   EVENT PIPELINE
--------------------------------------------------------------------- */

let counterEmotes = 0;
let testmsg = null;

async function processEvent(obj, fData) {
  if (handleTestButtonEvent(obj)) return;
  if (handleDeleteEvents(obj)) return;

  let type = obj.detail.listener;
  let event = obj.detail.event;

  if (filterDuplicateActivity(type, event, obj, fData)) return;

  // Widget-specific alert rendering (sub/tip/cheer/follow/raid) lives in
  // main.js — this shared file only decides WHETHER an event should be
  // processed, not HOW it looks.
  ProcessEvents(type, event);

  if (obj.detail.listener !== "message") return;

  let data = obj.detail.event.data;
  let username = data.displayName;
  if (data.text.startsWith("!") && hideCommands === "yes") return;
  if (ignoredUsers.indexOf(data.nick.toLowerCase()) !== -1) return;

  if (fData.sharedMsgs) {
    try {
      if (data.tags?.["source-room-id"] && providerID && data.tags["source-room-id"] !== providerID) return;
    } catch (e) {
      console.warn('[chat-widget] sharedMsgs filter error, skipping filter:', e);
    }
  }

  const tags = data.tags;

  // Mutual: badge/tier/userType detection is identical mechanics for
  // every widget. A widget that doesn't support a role this computes
  // (e.g. no artist styling) just normalizes it away in its OWN
  // addMessage() — see the comment there — instead of this file needing
  // per-widget config.
  const role = resolveUserRole(tags, data.badges, data.nick);
  userType = role.userType; // keep the legacy global in sync, some widgets' CSS/main.js may still read it

  const { message, emoteOnly } = composeMessageText(data, role.specialclass);

  // Individual: not every widget shows reply context, so main.js decides.
  const replyBody = buildReplyBody(tags);

  /*  await */ addMessage(
    fData, data.nick, username, role.badgesHtml, message, data.userId, data.msgId,
    role.userType, emoteOnly, replyBody, role.subTierIndicator, extraDecor, role.specialclass
  );

  attachPronouns(data, fData);
}

// Test/preview buttons in the playground (or SE's test panel) dispatch a
// synthetic 'widget-button' event; this maps each button to a fake
// onEventReceived payload. Mutual across every widget.
function handleTestButtonEvent(obj) {
  if (obj.detail.event.listener !== 'widget-button') return false;
  let emulated;
  switch (obj.detail.event.field) {
    case 'testtestMessage':
      emulated = new CustomEvent("onEventReceived", gettestMessage());
      break;
    case 'testMessageBot':
      emulated = new CustomEvent("onEventReceived", testMessageBot(testmsg));
      break;
    case "testMessageLong":
      emulated = new CustomEvent("onEventReceived", testMessageLong(testmsg));
      break;
    case "testMessageVip":
      emulated = new CustomEvent("onEventReceived", testMessageVip(testmsg));
      break;
    case "testhigh":
      emulated = new CustomEvent("onEventReceived", testhigh());
      break;
    case "testpwr":
      emulated = new CustomEvent("onEventReceived", testpwr());
      break;
    case "testgig":
      emulated = new CustomEvent("onEventReceived", testgig());
      break;
    case "testMessageVeryFirst":
      emulated = new CustomEvent("onEventReceived", testMessageVeryFirst(testmsg));
      break;
    case "testMessageSub":
      emulated = new CustomEvent("onEventReceived", testMessageSub(testmsg));
      break;
    case "testMessageSubT2":
      emulated = new CustomEvent("onEventReceived", testMessageSubT2(testmsg));
      break;
    case "testMessageSubT3":
      emulated = new CustomEvent("onEventReceived", testMessageSubT3(testmsg));
      break;
    case "testMessageMod":
      emulated = new CustomEvent("onEventReceived", testMessageMod(testmsg));
      break;
    case "testMessageLeadMod":
      emulated = new CustomEvent("onEventReceived", testMessageLeadMod(testmsg));
      break;
    case "testMessageFirst":
      emulated = new CustomEvent("onEventReceived", testMessageFirst());
      break;
    case "testSubEvent":
      emulated = new CustomEvent("onEventReceived", testSubEvent(genName()));
      break;
    case "testSubEventNew":
      emulated = new CustomEvent("onEventReceived", testSubEventNew(genName()));
      break;
    case "testSubEventGift":
      emulated = new CustomEvent("onEventReceived", testSubEventGift(genName()));
      break;
    case "testMessageArtist":
      emulated = new CustomEvent("onEventReceived", testMessageArtist(testmsg));
      break;
    case "testTipEvent":
      emulated = new CustomEvent("onEventReceived", testTipEvent(genName()));
      break;
    case "testCheerEvent":
      emulated = new CustomEvent("onEventReceived", testCheerEvent(genName()));
      break;
    case "testFollowEvent":
      emulated = new CustomEvent("onEventReceived", testFollowEvent(genName()));
      break;
    case "testRaidEvent":
      emulated = new CustomEvent("onEventReceived", testRaidEvent(genName()));
      break;
    case "reddemtest":
      redeemAlert("milaeshop", "drink water", 50000);
      break;
    case "testSessionLeader":
      sessionTop2();
      break;
  }
  window.dispatchEvent(emulated);
  return true;
}

function handleDeleteEvents(obj) {
  if (obj.detail.listener === "delete-message") {
    const msgId = obj.detail.event.msgId;
    $(`.message-row[data-msgid=${msgId}]`).remove();
    return true;
  }
  if (obj.detail.listener === "delete-messages") {
    const sender = obj.detail.event.userId;
    $(`.message-row[data-sender=${sender}]`).remove();
    return true;
  }
  return false;
}

// De-dupes events across widgets that share a session (fData.sharedEvents).
// Returns true when processEvent() should stop entirely.
function filterDuplicateActivity(type, event, obj, fData) {
  if (fData.sharedEvents) {
    try {
      if (type === "event" && event && event.activityId && event.channel && obj.detail?.event?.type !== "channelPointsRedemption") {
        channelEventMap.set(event.activityId, { channelId: event.channel, ts: Date.now() });
        if (channelEventMap.size > CHANNEL_MAP_MAX_SIZE) {
          const now = Date.now();
          for (const [id, rec] of channelEventMap) {
            if (now - rec.ts > CHANNEL_MAP_TTL_MS) channelEventMap.delete(id);
          }
        }
        return true;
      }

      if (
        (type === "subscriber-latest" || type === "tip-latest" || type === "cheer-latest" ||
          type === "follower-latest" || type === "raid-latest") &&
        event && event.activityId && roomID
      ) {
        const rec = channelEventMap.get(event.activityId);
        if (rec) {
          channelEventMap.delete(event.activityId);
          if (rec.channelId !== roomID) return true;
        }
      }
    } catch (e) {
      console.warn('[chat-widget] sharedEvents filter error, skipping filter:', e);
    }
  } else {
    if (type === "event" && obj.detail?.event?.type !== "channelPointsRedemption") return true;
  }
  return false;
}

function handlePointRedemption(obj) {
  const redemptionData = obj.detail.event.data;
  const redUser = redemptionData.username;
  const redTitle = redemptionData.redemption;
  const redCost = redemptionData.amount;
  const redMessage = redemptionData.message ? redemptionData.message : "";
  if (redCost >= redeemShow) redeemAlert(redUser, redTitle, redCost, redMessage);
}

function roleActive(role) {
  return typeof activeRoles === 'undefined' || activeRoles.includes(role);
}

function resolveUserRole(tags, badgeList, nick) {
  let userTypeLocal = "default";
  let badgesHtml = "", badge;
  let specialclass = "";
  let subTierIndicator = "", subIndicator = false;
  const tier3findB = /3\d\d\d/, tier2findB = /2\d\d\d/;
  const tier3find = /subscriber\/3\d\d\d/, tier2find = /subscriber\/2\d\d\d/;

  if (roleActive("sub") && tags.subscriber === "1") userTypeLocal = "sub";
  if (roleActive("mod") && tags.mod === "1") userTypeLocal = "mod";
  if (roleActive("vip") && tags.vip === "1") userTypeLocal = "vip";
  
  if (roleActive("bot") && nick && bots.indexOf(nick.toLowerCase()) !== -1) userTypeLocal = "bot";

  for (let i = 0; i < badgeList.length; i++) {
    badge = badgeList[i];
    if (roleActive("streamer") && badge.type === "broadcaster") userTypeLocal = "streamer";
    if (roleActive("mod") && badge.type === "lead_moderator") userTypeLocal = "mod";
    if (badge.type === "subscriber") {
      subIndicator = true;
      if (tier3findB.test(badge['version'])) subTierIndicator = t3nameb;
      if (tier2findB.test(badge['version'])) subTierIndicator = t2nameb;
    }

    if (roleActive("artist") && badge.type === "artist-badge") {
     userTypeLocal = "artist";
  }
     if (roleActive("bot") && badge.type === "bot-badge") {
    userTypeLocal = "bot";
  }

    badgesHtml += `<div class="${badge.type} custombadge"><img alt="" src="${badge.url}" class="badge2"></div>`;
  }

  if (subIndicator) {
    const searchSub = tags.badges;
    if (tier2find.test(searchSub)) subTierIndicator = t2nameb;
    if (tier3find.test(searchSub)) subTierIndicator = t3nameb;
  }
  if (userTypeLocal === "streamer") subTierIndicator = t2namest;
  


  if (roleActive("highlighted") && tags["msg-id"] == "highlighted-message") { userTypeLocal = "highlighted" }
  if (roleActive("powerup") && tags["msg-id"] == "animated-message") {
    userTypeLocal = "highlighted";
    specialclass = "powerup";
  }
  if (tags["msg-id"] === "gigantified-emote-message") specialclass = "gigant";

  if (tags["first-msg"] == "1") {
      extraDecor += firstChatDec;
      specialclass = "firsttime";
};
  /*
  let badgetag = "";

  if (data.nick.toLowerCase() == globalSeshdata?.["cheer-session-top-donator"]?.["name"]?.toLowerCase()) {
     badgetag = addBadge("SESSION LEADER")
     specialclass += " hasLeader"
  }

  if (data.nick.toLowerCase() == globalSeshdata?.["cheer-weekly-top-donator"]?.["name"]?.toLowerCase()) {
     extraDecor = weekbadge;
     specialclass += " hasLeader"
  }

  if (data.nick.toLowerCase() == globalSeshdata?.["cheer-monthly-top-donator"]?.["name"]?.toLowerCase()) {
     badgetag = addBadge("month LEADER")
     specialclass += " hasLeader"
  }

  if (data.nick.toLowerCase() == globalSeshdata?.["cheer-alltime-top-donator"]?.["name"]?.toLowerCase()) {
     badgetag = addBadge("TOP CHEER LEADER")
     specialclass += " hasLeader"
  }

  if (data.nick.toLowerCase() == globalSeshdata["subscriber-alltime-gifter"]["name"]) {
  badgetag = addBadge("TOP GIFTER")
  specialclass += " hasLeader"
  }
  */

  return { userType: userTypeLocal, badgesHtml, subTierIndicator, specialclass, subIndicator };
}

// GIF tokens (Giphy etc, via data.tags.gifs) + emote lookup (msgDiv) +
// @mention wrapping, in that order. Adding a NEW message-text feature
// (another inline media type, say) goes here so it's shared everywhere.
function composeMessageText(data, specialclass) {
  let gifs = parseGifs(data.tags?.gifs);
  let gifMap = {};
  if (gifs.length) {
    let text = data.text;
    gifs.sort((a, b) => b.start - a.start);
    gifs.forEach((g, i) => {
      const token = `GIF${i}`;
      text = text.slice(0, g.start) + token + text.slice(g.end + 1);
      gifMap[token] = g.gifUrl;
    });
    data = { ...data, text };
  }

  let [rawMessage, emoteOnly] = msgDiv(data, specialclass);

  let message = rawMessage.split(" ").map(el =>
    el.startsWith("@") ? `<span class="mentionNick">${el}</span>` : el
  ).join(" ");

  for (const [token, url] of Object.entries(gifMap)) {
    message = message.split(token).join(`<img class="chat-gif" src="${url}" alt="GIF" loading="lazy">`);
  }

  return { message, emoteOnly, data };
}

function attachPronouns(data, fData) {
  if (!fData.pronounsOn) return;
  const currDiv = $(`#${data.msgId}`);
  (async function getP() {
    const pronounsText = await getUserPronoun(data.displayName);
    if (pronounsText) {
      $(currDiv).find(".pronouns").text(`${pronounsText} `).addClass("pronounsDiv");
    }
  })();
}

async function onChatLoad(fData) {
  console.log("load 1.1");
  if (fData.editsMode) {
    let queuearr = [];
    for (let i = 0; i < testarr.length; i++) {
      queuearr.push(queue[testarr[i]]);
    }
    let queuearr2 = [];
    for (let i = 0; i < instarr.length; i++) {
      queuearr2.push(queue[instarr[i]]);
    }
    for (let i = 0; i < queuearr2.length; i++) {
      if (queuearr2[i][1] === "sesh") {
        let func = queuearr2[i][0];
        func();
      } else {
        window.dispatchEvent(new CustomEvent("onEventReceived", queuearr2[i][0]));
      }
    }
    showMsgs(delaytotal, delmsg, delal1, queuearr);
  }

  if (fData.pronounsOn) { await getPronouns(); }
  if (fData.EmotesAPI) { await getEmotes(); }
}


/* ---------------------------------------------------------------------
   MESSAGE TEXT / EMOTES
   The "MSG div" function — tokenizes text vs emotes, decides large-emote
   sizing, and strips the invisible/hidden characters Twitch sometimes
   sends (which is what broke gigantified-emote detection before). Fixes
   to this logic belong here so they apply to every widget at once.
--------------------------------------------------------------------- */

function msgDiv(message, spclass) {
  let text = html_encode(message.text);
  let data = message.emotes;

  let emoteLookup = new Map(emotesMap);
  for (let i = 0; i < data.length; i++) {
    emoteLookup.set(data[i].name, data[i]);
  }

  let tokens = text.split(" ");
  let emoteCount = 0;
  let nonEmoteParts = [];
  for (let i = 0; i < tokens.length; i++) {
    if (emoteLookup.has(tokens[i])) {
      emoteCount++;
    } else {
      nonEmoteParts.push(tokens[i]);
    }
  }
  let notext = nonEmoteParts.join(" ").replace(/\p{C}/gu, '').replace(/͏/g, "").trim();
  let emoteOnly = notext === "";

  let out = [];
  for (let i = 0; i < tokens.length; i++) {
    let key = tokens[i];
    let emote = emoteLookup.get(key);
    if (emote) {
      let url;
      let cls;
      if ((emoteOnly && largeEmotes === "on") || spclass == "gigant") {
        if (emoteCount === 1) {
          url = emote.urls[4];
          cls = "emote large";
        } else {
          url = emote.urls[2];
          cls = "emote default";
        }
      } else {
        url = emote.urls[1];
        cls = "emote nolarge";
      }
      out.push(`<img class="${cls}" src="${url}"/>`);
    } else {
      out.push(key);
    }
  }

  return [out.join(" "), emoteOnly];
}

function parseGifs(tagValue) {
  if (!tagValue) return [];
  return tagValue.split(',').map(entry => {
    const [range, gifId, gifUrl] = entry.split('|');
    const [start, end] = range.split('-').map(Number);
    return { start, end, gifId, gifUrl };
  }).filter(g => g.gifUrl);
}

function html_encode(e) {
  return e.replace(/[<>"^]/g, function (e) {
    return "&#" + e.charCodeAt(0) + ";";
  });
}

function removeCheer(str) {
  return str.replace(/\bCheer\d+\b/g, '').replace(/\s+/g, ' ').trim();
}


/* ---------------------------------------------------------------------
   ANIMATION / QUEUE HELPERS
--------------------------------------------------------------------- */

let ShowMessage;
function ShowVert(el, usrT = "") {
  $(el).slideToggle(150);
}

function ShowHor(el, usrT = "") {
  $(el).animate({ width: 'toggle' }, 300);
}

function LimitMsg(el, usrT = "") {
  if (fieldData.smooth && !document.hidden) {
    //   $(el).slideToggle(150);
    // $(el).animate({width: 'toggle'}, 300);
    ShowMessage(el, usrT);
  } else {
    $(el).show();
  }

  if (usrT && usrT.includes("gigant") && fieldData.gigantEmote) {
    $(".main-container").addClass("shake");
    setTimeout(() => {
      $(".main-container").removeClass("shake");
    }, 500);
  }

  const limit = msgLimit ? msgLimitAmount : 15;
  const container = document.querySelector('.main-container');
  if (!container) return;
  const children = container.children;
  const overflow = children.length - limit;
  if (overflow <= 0) return;

  const toRemove = [];
  if (msgAlign === "end") {
    for (let i = 0; i < overflow; i++) toRemove.push(children[i]);
  } else {
    for (let i = 0; i < overflow; i++) toRemove.push(children[children.length - 1 - i]);
  }
  $(toRemove).fadeOut(200, function () { $(this).remove(); });
}

function showMsgs(delay, delmsg, speedA, arrr) {
  let delsum = delmsg;
  for (let i = 0; i < arrr.length; i++) {
    let delbefore = arrr[i][1] === "msg" ? delmsg : speedA;

    setTimeout(() => {
      if (arrr[i][1] === "sesh") {
        let func = arrr[i][0];
        func();
      }
      window.dispatchEvent(new CustomEvent("onEventReceived", arrr[i][0]));
    }, delay + delsum * 1000);
    delsum += delbefore;
  }
}


/* ---------------------------------------------------------------------
   BADGES (SVG injection)
--------------------------------------------------------------------- */

function replaceBadges(badges, el) {
  if (badges != "" && fieldData.badgesDisplay) {
    $(el).find(".vip").html(`<svg class="svgbadge" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" version="1.1" id="svg902" viewBox="0 0 96 96">
    <defs id="defs906"/>
    <g id="g908">
      <path fill="var(--badgescol)" d="M 19.403191,10.959868 0.36376509,36.881015 47.159463,87.576356 95.560901,35.504671 76.292081,11.189259 Z" id="path916"/>
    </g>
  </svg>`);
    $(el).find(".moderator").html(`<svg class="svgbadge" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" version="1.1" id="svg966" viewBox="0 0 96 96">
    <defs id="defs970"/>
    <g id="g972">
      <path fill="var(--badgescol)" stroke="var(--badgescol)" d="m 5.514926,89.698649 6.163741,6.001538 19.302241,-12.65189 13.1385,12.489686 8.110185,-7.785778 L 39.253297,76.073538 90.671872,29.196667 90.509668,0.97322224 56.771297,1.7842408 23.843945,62.448427 10.705445,51.742982 4.8661112,59.690964 16.706982,70.396408 Z" id="path976"/>
    </g>
  </svg>`);
    $(el).find(".broadcaster").html(`
  <svg class="svgbadge" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" viewBox="0 0 30.074135 21.467426" version="1.1" id="svg5" xml:space="preserve"><defs id="defs2"/><g id="layer1" transform="translate(-72.032296,-84.451693)"><path id="rect237" style="fill:var(--badgescol);stroke-width:0" d="m 76.467684,84.451693 c -2.457256,0 -4.435388,1.978132 -4.435388,4.435388 v 12.596649 c 0,2.45725 1.978132,4.43539 4.435388,4.43539 h 12.774414 c 2.457256,0 4.435388,-1.97814 4.435388,-4.43539 v -1.44074 l 8.403624,3.88762 0.0253,-8.658906 -0.3328,-8.654252 -8.096144,4.028178 v -1.758549 c 0,-2.457256 -1.978132,-4.435388 -4.435388,-4.435388 z"/></g></svg>
  `);
    $(el).find(".premium").html(`<svg class="svgbadge" width="258.166" height="258.166" viewBox="0 0 68.306 68.306" xml:space="preserve" xmlns="http://www.w3.org/2000/svg">
    <path style="fill:var(--badgescol);stroke-width:3.293;stroke-linecap:round;stroke-linejoin:round;-inkscape-stroke:none;paint-order:stroke fill markers" d="M100.243 106.668c-.419 0-.838.158-1.158.476L82.462 123.6l-12.86-11.883c-1.078-.997-2.823-.192-2.764 1.275l1.243 31.403a1.646 1.646 0 0 0 1.646 1.581h60.323c.877 0 1.6-.687 1.644-1.564l1.596-32.113c.074-1.505-1.743-2.31-2.809-1.246l-12.502 12.502-16.578-16.412a1.642 1.642 0 0 0-1.158-.476z" transform="translate(-65.823 -93.145)"/>
  </svg>`);
    $(el).find(".artist-badge").html(`<svg width="260.306" height="261.125" viewBox="0 0 260.306 261.125" xmlns="http://www.w3.org/2000/svg">
    <path style="fill:var(--badgescol);stroke:none;stroke-width:2.236;stroke-linecap:square;paint-order:markers stroke fill" d="M249.344 55.868s-49.869 46.12-66.367 73.49c0 0-44.62-8.248-65.242 35.621 0 0-4.124 9.75-3.374 20.998 0 0 4.43 12.464-21.816 36.086 0 0 60.06 4.784 85.183-8.34 25.122-13.123 26.996-44.244 26.621-47.619-.374-3.374-.374-16.498-.374-16.498l73.115-65.991s26.997 32.246 18.748 64.491c-8.249 32.246-17.998 36.746-36.37 57.368-18.373 20.623-17.248 10.499-18.748 31.871-1.5 21.373-17.998 50.994-54.368 58.868-36.37 7.874-82.115-9.374-91.864-16.123-9.749-6.75-56.618-37.87-57.368-96.738S55.868 93.363 70.491 79.115C85.114 64.867 116.235 36.37 163.48 37.12c47.244.75 68.991 2.25 85.864 18.748z" transform="translate(-37.1 -37.106)"/>
  </svg>`);
    $(el).find(".partner").html(`<svg width="19.6" height="19.598" viewBox="0 0 5.186 5.185" xml:space="preserve" xmlns="http://www.w3.org/2000/svg">
    <path style="opacity:1;fill:var(--badgescol);fill-opacity:1;stroke:none;stroke-width:.216527;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:1;paint-order:stroke markers fill" d="M2.61 0 .772.747 0 2.575l.747 1.839 1.829.771 1.838-.747.772-1.828L4.439.77Zm.904 1.37.612.607L2.28 3.84l-.011-.01-.008.006-.567-.576-.026-.026-.625-.635.607-.613.624.635Z"/>
  </svg>
  `);
    $(el).find(".lead_moderator").html(`<svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M45.0215 12.4786C46.7193 14.1764 46.672 16.9765 44.9159 18.7328L41.8326 21.816L41.9314 27.1297L43.3691 28.5674L50.0203 28.5895L57.5001 36.0694L39.5684 54.0011L32.0885 46.5213L31.7529 40.1836L30.3152 38.7459L24.6079 39.0407L7.4972 56.1515C5.74087 57.9076 2.94084 57.9549 1.24304 56.2571C-0.454768 54.5593 -0.407447 51.7593 1.34869 50.0029L18.4594 32.8922L18.7543 27.1849L17.3166 25.7472L10.9796 25.4123L3.49901 17.9318L21.4308 0L28.9114 7.48055L28.9328 14.1311L30.3704 15.5688L35.6841 15.6675L38.7673 12.5843C40.5237 10.8282 43.3237 10.7808 45.0215 12.4786Z" fill="var(--badgescol)"/>
</svg>
  `);
  }
}


/* ---------------------------------------------------------------------
   PRONOUNS API
--------------------------------------------------------------------- */

let pronounsCache = {};
let pronounsbadge, pronounsObj = { pronouns: {} };
const PRONOUNS_API_BASE = 'https://pronouns.alejo.io/api';
const PRONOUNS_API = {
  user: username => `${PRONOUNS_API_BASE}/users/${username}`,
  pronouns: `${PRONOUNS_API_BASE}/pronouns`,
};

async function getPronouns() {
  const res = await get(PRONOUNS_API.pronouns);
  if (res) {
    res.forEach(pronoun => {
      pronounsObj.pronouns[pronoun.name] = pronoun.display;
    });
  }
}

async function getUserPronoun(username) {
  const lowercaseUsername = username.toLowerCase();
  let pronouns = pronounsCache[lowercaseUsername];
  if (!pronouns || pronouns.expire < Date.now()) {
    const res = await get(PRONOUNS_API.user(lowercaseUsername));
    const [newPronouns] = res;
    pronounsCache[lowercaseUsername] = {
      ...newPronouns,
      expire: Date.now() + 1000 * 60 * 5,
    };
    pronouns = pronounsCache[lowercaseUsername];
  }

  if (!pronouns.pronoun_id) {
    return null;
  }
  return pronounsObj.pronouns[pronouns.pronoun_id];
}

async function get(URL) {
  return await fetch(URL)
    .then(async res => {
      if (!res.ok) return null;
      return res.json();
    })
    .catch(error => null);
}


/* ---------------------------------------------------------------------
   EMOTES (7TV)
--------------------------------------------------------------------- */

async function getEmotes() {
  try {
    const res = await get(`https://7tv.io/v3/users/twitch/${providerID}?timestamp=${new Date().getTime()}`);
    const emotes = res?.emote_set?.emotes;
    if (!Array.isArray(emotes)) return;

    for (let i = 0; i < emotes.length; i++) {
      const host = emotes[i]?.data?.host;
      const files = host?.files;
      if (!host || !files || files.length < 4) continue;

      const emote = {
        name: emotes[i].name,
        urls: {
          1: "https:" + host.url + "/" + files[1].name,
          2: "https:" + host.url + "/" + files[2].name,
          4: "https:" + host.url + "/" + files[3].name
        }
      };
      emotesStorage.unshift(emote);
      emotesMap.set(emote.name, emote);
    }
  } catch (e) {
    console.warn('[chat-widget] getEmotes failed:', e);
  }
}


/* ---------------------------------------------------------------------
   SESSION LEADERBOARD (test helper)
--------------------------------------------------------------------- */

function sessionTop2() {
  globalSeshdata["subscriber-alltime-gifter"]["name"] = genName();
  globalSeshdata["subscriber-alltime-gifter"]["name"] = "subscriber";
  globalSeshdata["cheer-session-top-donator"]["name"] = "moderator";
  globalSeshdata["cheer-monthly-top-donator"]["name"] = "artist";
  globalSeshdata["cheer-alltime-top-donator"]["name"] = "hehehaha";
  //  window.dispatchEvent(new CustomEvent("onSessionUpdate", globalSeshdata))
}

function testRedeem() {
  redeemAlert("milaeshop", "drink water", 50000);
}


/* ---------------------------------------------------------------------
   TEST / FAKE EVENT GENERATORS (playground + SE test panel)
--------------------------------------------------------------------- */

var nameList = [
  'Judah', 'Alejandro', 'Roberto', 'Fernando',
  'Paparazzi', 'YourBiggestFan', "Monster", "BloodyMary", "i_m_kinda_busy"
];

function genName() {
  return nameList[Math.floor(Math.random() * nameList.length)];
}
function randNum() {
  return Math.floor(Math.random() * 99999);
}

function gettestMessage() {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "moderator/1,partner/1",
            color: "#1e90ff",
            mod: "1",
            subscriber: "1",
            "user-id": "100135114",
            "user-type": "mod"
          },
          userId: "100135114",
          displayName: "Streamer",
          nick: "Streamer",
          displayColor: "#5B99FF",
          badges: [{
            "type": "broadcaster",
            "version": "1",
            "url": "https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3"
          }],
          text: `This is a test message`,
          emotes: [],
          msgId: `85909-412c-4eee-b80d-89123f72ba${randNum()}4`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageLong(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "",
            color: "#8a2be2",
            mod: "0",
            subscriber: "0",
            "user-id": "100135115",
            "user-type": "mod"
          },
          userId: "100135115",
          displayName: "Follower user",
          nick: "Milaeshop",
          displayColor: "#8a2be2",
          badges: [],
          text: `${testmsg ? testmsg : "This is a viewer message. Long long long long long long long long long long long long long long long long message."}`,
          emotes: [],
          msgId: `43285909-412c-4eee-b80d-83452ba${randNum()}3`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageArtist(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "",
            color: "#8a2be2",
            mod: "0",
            subscriber: "0",
            "user-id": "100135115",
            "user-type": "mod"
          },
          userId: "100135115",
          displayName: "Artist",
          nick: "Milaeshop",
          badges: [{
            "type": "artist-badge",
            "version": "1",
            "url": "https://static-cdn.jtvnw.net/badges/v1/4300a897-03dc-4e83-8c0e-c332fee7057f/3",
            "description": "Artist"
          }],
          text: `${testmsg ? testmsg : "This is a artist message"}`,
          emotes: [],
          msgId: `43285909-412c-4eee-b80d-83452ba${randNum()}3`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageSub(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "subscriber/1",
            color: "#ff69b4",
            vip: "0",
            subscriber: "1",
            "user-id": "100135116",
            "user-type": "subscriber",
            "reply-parent-display-name": "moderator",
            "reply-parent-msg-body": "This is moderator message"
          },
          userId: "100135116",
          displayName: "Subscriber",
          nick: "Subscriber",
          displayColor: "#ff69b4",
          badges: [{
            type: "subscriber",
            version: "1",
            url: "https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3",
            description: "Verified"
          }],
          text: `${testmsg ? testmsg : "hey @moderator, I am a sub"}`,
          emotes: [],
          msgId: `285909-412c-4eee-b80d-89f1482ba${randNum()}2`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageSubT2(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "subscriber/2000,no_audio/1",
            color: "#ff69b4",
            vip: "0",
            subscriber: "1",
            "user-id": "100135116",
            "user-type": "subscriber"
          },
          userId: "100135116",
          displayName: "SubTier2",
          nick: "SubTier2",
          displayColor: "#ff69b4",
          badges: [{
            type: "subscriber",
            version: "2000",
            url: "https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3",
            description: "Verified"
          }],
          text: `${testmsg ? testmsg : "hey @moderator, I am a Tier 2 sub"}`,
          emotes: [],
          msgId: `285909-412c-4eee-b80d-89f1482ba${randNum()}2`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageSubT3(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "subscriber/3000,no_audio/1",
            color: "#ff69b4",
            vip: "0",
            subscriber: "1",
            "user-id": "100135116",
            "user-type": "subscriber"
          },
          userId: "100135116",
          displayName: "SubTier3",
          nick: "SubTier3",
          displayColor: "#ff69b4",
          badges: [{
            type: "subscriber",
            version: "3000",
            url: "https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3",
            description: "Verified"
          }],
          text: `${testmsg ? testmsg : "hey @moderator, I am a Tier 3 sub"}`,
          emotes: [],
          msgId: `285909-412c-4eee-b80d-89f1482ba${randNum()}2`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageVeryFirst(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "moderator/1",
            color: "#00ff7f",
            mod: "0",
            "first-msg": "1",
            subscriber: "0",
            "user-id": "100135115",
            "user-type": "mod"
          },
          userId: "100135115",
          displayName: "new user",
          nick: "newuser",
          displayColor: "#00ff7f",
          badges: [],
          text: `${testmsg ? testmsg : "This is my first message in a chat"}`,
          emotes: [],
          msgId: `43285909-412c-4eee-b80d-89228ba${randNum()}0`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testhigh(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "",
            color: "#8a2be2",
            mod: "0",
            subscriber: "0",
            "user-id": "100132815",
            "user-type": "mod",
            "msg-id": "highlighted-message"
          },
          userId: "100132815",
          displayName: "Username",
          nick: "Username",
          badges: [{
            "type": "artist-badge",
            "version": "1",
            "url": "https://static-cdn.jtvnw.net/badges/v1/4300a897-03dc-4e83-8c0e-c332fee7057f/3",
            "description": "Artist"
          }],
          text: `${testmsg ? testmsg : "yaaay my highlighted message!!"}`,
          emotes: [],
          msgId: `43285909-412c-4eee-b80d-83452ba${randNum()}3`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testpwr(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "",
            color: "#8a2be2",
            mod: "0",
            subscriber: "0",
            "user-id": "100132815",
            "user-type": "mod",
            "msg-id": "animated-message"
          },
          userId: "100132815",
          displayName: "Username",
          nick: "Username",
          badges: [{
            "type": "artist-badge",
            "version": "1",
            "url": "https://static-cdn.jtvnw.net/badges/v1/4300a897-03dc-4e83-8c0e-c332fee7057f/3",
            "description": "Artist"
          }],
          text: `${testmsg ? testmsg : "yaaay my highlighted message!!"}`,
          emotes: [],
          msgId: `43285909-412c-4eee-b80d-83452ba${randNum()}3`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageVip() {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "vip/1,subscriber/3000,no_audio/1",
            color: "#ff69b4",
            vip: "1",
            subscriber: "0",
            "user-id": "100135117",
            "user-type": "vip"
          },
          userId: "100135117",
          displayName: "Vip user",
          nick: "Username",
          displayColor: "#ff69b4",
          badges: [{
            type: "vip",
            version: "1",
            url: "https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3"
          },
          {
            type: "subscriber",
            version: "3000",
            url: "https://static-cdn.jtvnw.net/badges/v1/bf51cd37-097d-41a4-8915-40de1f245abe/2",
            description: "Subscriber"
          }],
          text: `${testmsg ? testmsg : "This is a VIP user test message"}`,
          emotes: [],
          msgId: `285909-412c-4eee-b80d-89f1482ba${randNum()}1`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageLeadMod(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "moderator/1",
            color: "#00ff7f",
            mod: "1",
            subscriber: "1",
            "user-id": "100135118",
            "user-type": "mod"
          },
          userId: "100135118",
          displayName: "Moderator",
          nick: "Moderator",
          displayColor: "#00ff7f",
          badges: [
            {
              "type": "lead_moderator",
              "version": "1",
              "url": "https://static-cdn.jtvnw.net/badges/v1/0822047b-65e0-46f2-94a9-d1091d685d33/2"
            }],
          text: `${testmsg ? testmsg : "This is a moderator test message"}`,
          emotes: [],
          msgId: `43285909-412c-4eee-b80d-89228ba${randNum()}0`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageMod(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "moderator/1",
            color: "#00ff7f",
            mod: "1",
            subscriber: "1",
            "user-id": "100135118",
            "user-type": "mod"
          },
          userId: "100135118",
          displayName: "Moderator",
          nick: "Moderator",
          displayColor: "#00ff7f",
          badges: [{
            type: "moderator",
            version: "1",
            url: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3",
            description: "Moderator"
          }],
          text: `${testmsg ? testmsg : "This is a moderator test message"}`,
          emotes: [],
          msgId: `43285909-412c-4eee-b80d-89228ba${randNum()}0`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageFirst() {
  counterEmotes++;
  counterEmotes = counterEmotes > 2 ? 0 : counterEmotes;
  let emotesText, emotes;
  switch (counterEmotes) {
    case 2:
      emotes = `{ "type": "twitch","name": "PepeLaugh","id": "112291","gif": false,"animated": false,"urls": {"1": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/1x.avif","2": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/2x.avif","4": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/4x.avif"},"start": 0,"end": 7}, { "type": "twitch","name": "PepeLaugh","id": "112291","gif": false,"animated": false,"urls": {"1": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/1x.avif","2": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/2x.avif","4": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/4x.avif"},"start": 0,"end": 7}, { "type": "twitch","name": "PepeLaugh","id": "112291","gif": false,"animated": false,"urls": {"1": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/1x.avif","2": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/2x.avif","4": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/4x.avif"},"start": 0,"end": 7}, { "type": "twitch","name": "PepeLaugh","id": "112291","gif": false,"animated": false,"urls": {"1": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/1x.avif","2": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/2x.avif","4": "https://cdn.7tv.app/emote/60afbb3952a13d1adb34b2a1/4x.avif"},"start": 0,"end": 7}`;
      emotesText = "PepeLaugh  PepeLaugh  PepeLaugh  PepeLaugh  󠀀";
      break;
    case 1:
      emotes = `{ "type": "twitch","name": "CatBag","id": "112291","gif": false,"animated": false,"urls": {"1": "https://cdn.frankerfacez.com/emote/25927/1","2": "https://cdn.frankerfacez.com/emote/25927/2","4": "https://cdn.frankerfacez.com/emote/25927/4"},"start": 0,"end": 7}`;
      emotesText = " CatBag ";
      break;
    case 0:
      emotes = `{ "type": "twitch","name": "Binoculous","id": "112291","gif": false,"animated": false,"urls": {"1": "https://cdn.7tv.app/emote/62348f3b73f35ccbda40810c/1x.webp","2": "https://cdn.7tv.app/emote/62348f3b73f35ccbda40810c/2x.webp","4": "https://cdn.7tv.app/emote/62348f3b73f35ccbda40810c/4x.webp"},"start": 0,"end": 7}`;
      emotesText = " Binoculous ";
      break;
  }
  let obj = `{
  "detail": {
    "listener": "message",
    "event": {
      "data": {
        "tags": {
          "badges": "",
          "color": "#b22222",
          "first-msg": "1",
          "userId": "100998119"
        },
        "userId": "100995119",
        "displayName": "Hehehaha",
		"nick": "Hehehaha",
        "displayColor": "#b22222",
        "badges": [],
        "text": "${emotesText}",
        "emotes": [
          ${emotes}
        ],
        "msgId": "43285909-412c-4eee-b80d-89228ba${randNum()}0"
      }
    }
  }
}`;

  return JSON.parse(obj);
}

function testgig(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "",
            color: "#8a2be2",
            mod: "0",
            subscriber: "0",
            "user-id": "100132815",
            "user-type": "mod",
            "msg-id": "gigantified-emote-message"
          },
          userId: "100132815",
          displayName: "Username",
          nick: "Username",
          badges: [],
          text: `${testmsg ? testmsg : "doomer4Monke"}`,
          emotes: [{
            animated: false,
            end: 12,
            gif: false,
            id: "emotesv2_d81ee8b15a93478a8200521bd7fab324",
            name: "doomer4Monke",
            start: 0,
            type: "twitch",
            urls: {
              1: "https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_e3906c657e274c72a33c95bff3948b54/default/dark/1.0",
              2: "https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_e3906c657e274c72a33c95bff3948b54/default/dark/2.0",
              4: "https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_e3906c657e274c72a33c95bff3948b54/default/dark/3.0"
            }
          }],
          msgId: `43285909-412c-4eee-b80d-83452ba${randNum()}3`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testMessageBot(testmsg) {
  return {
    detail: {
      listener: "message",
      event: {
        data: {
          tags: {
            badges: "",
            color: "#8a2be2",
            mod: "0",
            subscriber: "0",
            "user-id": "100135115",
            "user-type": "mod"
          },
          userId: "100135115",
          displayName: "SoundAlerts",
          nick: "SoundAlerts",
          badges: [{
            "type": "bot-badge",
            "version": "1",
            "url": "https://static-cdn.jtvnw.net/badges/v1/4300a897-03dc-4e83-8c0e-c332fee7057f/3",
            "description": "Artist"
          }],
          text: `${testmsg ? testmsg : "Username just played AYAYA for 100 bits!"}`,
          emotes: [],
          msgId: `43285909-412c-4eee-b80d-83452ba${randNum()}3`
        },
        renderedText: 'Test message in a custom chat'
      }
    }
  };
}

function testSubEventNew(usrname) {
  return {
    detail: {
      listener: "subscriber-latest",
      event: {
        name: usrname,
        tier: "3000",
        amount: `1`,
        message: ``
      },
    }
  };
}

function testSubEventGift(usrname) {
  return {
    detail: {
      listener: "subscriber-latest",
      event: {
        name: usrname,
        sender: usrname,
        tier: "3000",
        amount: `40`,
        bulkGifted: true
      },
    }
  };
}

function testSubEvent(usrname) {
  return {
    detail: {
      listener: "subscriber-latest", event: {
        name: usrname,
        tier: "3000",
        amount: `10`,
        message: `Hi, I just resubscribed! Love you streamer`
      },
    }
  };
}

function testCheerEvent(usrname) {
  return {
    detail: {
      listener: "cheer-latest", event: {
        name: usrname,
        amount: `10000`,
        message: `Cheers for streamer Kappa Cheers for streamer Kappa Cheers for streamer Kappa Cheers for streamer Kappa Cheers for streamer Kappa `
      },
    }
  };
}

function testFollowEvent(usrname) {
  return {
    detail: {
      listener: "follower-latest", event: {
        name: usrname
      },
    }
  };
}

function testTipEvent(usrname) {
  return {
    detail: {
      listener: "tip-latest", event: {
        name: usrname,
        tier: "3000",
        amount: 500,
        message: `Tip for the streamer and alert message added to the tip ho-ho ha-ha`
      },
    }
  };
}

function testRaidEvent(usrname) {
  return {
    detail: {
      listener: "raid-latest", event: {
        name: usrname,
        amount: 500
      },
    }
  };
}

let queue = {
  streamer: [gettestMessage(), "msg"],
  bot: [testMessageBot(), "msg"],
  long: [testMessageLong(), "msg"],
  vip: [testMessageVip(), "msg"],
  sub: [testMessageSub(), "msg"],
  subT2: [testMessageSubT2(), "msg"],
  subT3: [testMessageSubT3(), "msg"],
  mod: [testMessageMod(), "msg"],
  leadmod: [testMessageLeadMod(), "msg"],
  first: [testMessageFirst(), "msg"],
  first2: [testMessageFirst(), "msg"],
  first3: [testMessageFirst(), "msg"],
  artist: [testMessageArtist(), "msg"],
  tip: [testTipEvent(genName()), "event"],
  resub: [testSubEvent(genName()), "event"],
  cheer: [testCheerEvent(genName()), "event"],
  follow: [testFollowEvent(genName()), "event"],
  raid: [testRaidEvent(genName()), "event"],
  high: [testhigh(), "msg"],
  pwr: [testpwr(), "msg"],
  gig: [testgig(), "msg"],
  veryFirst: [testMessageVeryFirst(), "msg"],
  newsub: [testSubEventNew(genName()), "event"],
  giftsub: [testSubEventGift(genName()), "event"],
  redeem: [testRedeem, "sesh"],
  sesh: [sessionTop2, "sesh"]
};
