(function () {

if (!location.hostname.includes("neonminigamehub.com")) {
console.log("Ads disabled (not live domain)");
return;
}

// =============================
// 1️⃣ ADSENSE (AUTO ADS)
// =============================
if (!window.adsbygoogleLoaded) {
const adsenseScript = document.createElement("script");
adsenseScript.async = true;
adsenseScript.src =
"https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5482914432517813";
adsenseScript.crossOrigin = "anonymous";
document.head.appendChild(adsenseScript);
window.adsbygoogleLoaded = true;
}

// =============================
// 2️⃣ HELPER FUNCTIONS
// =============================

function loadScript(url, target = document.body) {
if (document.querySelector(`script[src="${url}"]`)) return;
const s = document.createElement("script");
s.async = true;
s.src = url;
target.appendChild(s);
}

function createContainer(id, width = "auto", height = "auto") {
if (document.getElementById(id)) return document.getElementById(id);
const c = document.createElement("div");
c.id = id;
c.style.width = width;
c.style.height = height;
c.style.margin = "20px auto";
c.style.textAlign = "center";
document.querySelector(".main-content")?.appendChild(c);
return c;
}

// =============================
// 🔥 NEW AD TYPES (ADDED)
// =============================

function createHorizontalAd() {
const ins = document.createElement("ins");
ins.className = "adsbygoogle";
ins.style.display = "block";
ins.style.width = "100%";
ins.style.minHeight = "90px";

```
ins.setAttribute("data-ad-client", "ca-pub-5482914432517813");
ins.setAttribute("data-ad-slot", "8834567127");

return ins;
```

}

// =============================
// 5️⃣ AUTO-HIDE EMPTY ADS
// =============================
function hideBlankAds() {
document.querySelectorAll('[id^="container-"]').forEach(ad => {
if (!ad) return;

```
  const hasIframe = ad.querySelector("iframe");
  const visibleText = ad.innerText.trim().length;

  if (!hasIframe && visibleText === 0) {
    ad.style.display = "none";
  }
});
```

}

setInterval(hideBlankAds, 1000);

// =============================
// 🔧 STYLES
// =============================
(function addAdStyles() {
if (document.getElementById("ads-global-styles")) return;

```
const style = document.createElement("style");
style.id = "ads-global-styles";

style.innerHTML = `
  .fixed-side-ad {
    position: fixed;
    top: 120px;
    width: 160px;
    z-index: 999;
  }
  .fixed-side-ad.left { left: 10px; }
  .fixed-side-ad.right { right: 10px; }

  @media (max-width: 1400px) {
    .fixed-side-ad { display: none; }
  }
`;

document.head.appendChild(style);
```

})();

// =============================
// EXISTING SIDE AD CREATOR (KEEP)
// =============================
function createAsideAd() {
const aside = document.createElement("aside");
aside.className = "sidebar-ad left";
aside.style.width = "160px";
aside.style.minHeight = "600px";

```
const ins = document.createElement("ins");
ins.className = "adsbygoogle";
ins.style.display = "block";
ins.style.width = "160px";
ins.style.height = "600px";

ins.setAttribute("data-ad-client", "ca-pub-5482914432517813");
ins.setAttribute("data-ad-slot", "3686182226");

aside.appendChild(ins);
return aside;
```

}

// =============================
// TOP
// =============================
function addTopAd() {
const top = document.querySelector(".top-banner");
if (!top || top.dataset.extraAd) return;

```
if (!top.querySelector(".adsbygoogle")) {
  const ins = createHorizontalAd();
  top.appendChild(ins);
  setTimeout(() => pushAd(ins), 1200);
}

top.dataset.extraAd = "1";
```

}

// =============================
// 🔥 FIXED BOTTOM (IMPORTANT)
// =============================
function addBottomAd() {
if (document.getElementById("extra-bottom-ad")) return;

```
const bottom = document.createElement("div");
bottom.id = "extra-bottom-ad";
bottom.style.maxWidth = "960px";
bottom.style.margin = "30px auto";
bottom.style.textAlign = "center";

const ad = createHorizontalAd(); // 🔥 FIXED HERE
bottom.appendChild(ad);

document.querySelector(".main-content")?.appendChild(bottom);

setTimeout(() => pushAd(ad), 800);
```

}

// =============================
// SIDE ADS
// =============================
function addSideAds() {
if (window.innerWidth < 1400) return;

```
setTimeout(() => {

  if (!document.getElementById("extra-left-ad")) {
    const left = document.createElement("aside");
    left.id = "extra-left-ad";
    left.className = "fixed-side-ad left";

    const ad = createAsideAd();
    left.appendChild(ad);

    document.body.appendChild(left);
    setTimeout(() => pushAd(ad.querySelector("ins")), 800);
  }

  if (!document.getElementById("extra-right-ad")) {
    const right = document.createElement("aside");
    right.id = "extra-right-ad";
    right.className = "fixed-side-ad right";

    const ad = createAsideAd();
    right.appendChild(ad);

    document.body.appendChild(right);
    setTimeout(() => pushAd(ad.querySelector("ins")), 800);
  }

}, 1500);
```

}

// =============================
// 🔥 NEW: IN-CONTENT ADS
// =============================
function addInContentAds() {
const sections = document.querySelectorAll(".section");

```
sections.forEach((section, i) => {
  if (i % 2 === 1) {
    const ad = createHorizontalAd();
    ad.style.margin = "30px 0";

    section.after(ad);
    setTimeout(() => pushAd(ad), 800);
  }
});
```

}

// =============================
// 🔥 NEW: GAME PAGE ADS
// =============================
function addGamePageAds() {
const game = document.querySelector("canvas, iframe");
if (!game || document.getElementById("game-ad")) return;

```
const ad = createHorizontalAd();
ad.id = "game-ad";
ad.style.margin = "20px 0";

game.parentNode.insertBefore(ad, game.nextSibling);
setTimeout(() => pushAd(ad), 800);
```

}

function isAdInitialized(el) {
if (!el) return true;
if (el.dataset.adPushAttempted === "true") return true;
if (el.hasAttribute("data-adsbygoogle-status")) return true;
if (el.querySelector("iframe")) return true;
if (el.innerHTML.trim() !== "") return true;
return false;
}

function pushAd(el) {
if (!el || !el.classList.contains("adsbygoogle")) return;
if (!document.contains(el)) return;
if (isAdInitialized(el)) return;

```
el.dataset.adPushAttempted = "true";

try {
  (window.adsbygoogle = window.adsbygoogle || []).push({});
} catch (e) {}
```

}

// =============================
// INIT
// =============================
function initExtraAds() {
addTopAd();
addBottomAd();
addSideAds();
addInContentAds();   // 🔥 NEW
addGamePageAds();    // 🔥 NEW
}

if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", initExtraAds);
} else {
initExtraAds();
}

// =============================
// CONSENT
// =============================
function waitForConsentAndLoadAds() {
const check = setInterval(() => {
try {
if (window.googlefc && window.googlefc.getConsentStatus) {
const status = window.googlefc.getConsentStatus();

```
      if (status === 1 || status === 2) {
        document.querySelectorAll(".adsbygoogle").forEach(ad => {
          try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          } catch (e) {}
        });

        clearInterval(check);
      }
    }
  } catch (e) {}
}, 500);
```

}

waitForConsentAndLoadAds();

})();
