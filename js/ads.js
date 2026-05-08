(function () {
  if (!location.hostname.includes("neonminigamehub.com")) {
    console.log("Ads disabled (not live domain)");
    return;
  }

  // =============================
  // 1️⃣ ADSENSE
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
  // 2️⃣ HELPERS
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

    const target = document.querySelector(".main-content") || document.body;
    target.appendChild(c);

    return c;
  }

  function createHorizontalAd() {
	  const ins = document.createElement("ins");
	  ins.className = "adsbygoogle";
	  ins.style.display = "block";
	  ins.style.width = "100%";
	  ins.style.minHeight = "90px";

	  ins.setAttribute("data-ad-client", "ca-pub-5482914432517813");
	  ins.setAttribute("data-ad-slot", "8834567127");
	  ins.setAttribute("data-ad-format", "auto");
	  ins.setAttribute("data-full-width-responsive", "true");

	  return ins;
	}

  function createAsideAd(slot) {
	  const aside = document.createElement("aside");
	  aside.style.width = "160px";
	  aside.style.minHeight = "600px";

	  const ins = document.createElement("ins");
	  ins.className = "adsbygoogle";
	  ins.style.display = "inline-block";
	  ins.style.width = "160px";
	  ins.style.height = "600px";

	  ins.setAttribute("data-ad-client", "ca-pub-5482914432517813");
	  ins.setAttribute("data-ad-slot", slot);

	  aside.appendChild(ins);
	  return aside;
	}


 function pushAd(el) {
  if (!el || !el.classList.contains("adsbygoogle")) return;
  if (!document.contains(el)) return;

  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (e) {
    console.log("Ad push error", e);
  }
}

  // =============================
  // 3️⃣ STYLES
  // =============================
  (function addAdStyles() {
    if (document.getElementById("ads-global-styles")) return;

    const style = document.createElement("style");
    style.id = "ads-global-styles";

    style.innerHTML = `
      .fixed-side-ad {
	  position: fixed;
	  top: 140px;
	  width: 160px;
	  min-height: 600px;
	  z-index: 999999;
	  display: block;
	  background: rgba(255,0,0,0.2);
	}

	.fixed-side-ad.left {
	  left: 10px;
	}

	.fixed-side-ad.right {
	  right: calc((100vw - 1300px) / 2 - 180px);
	}

	#extra-bottom-ad {
	  width: 100%;
	  max-width: 970px;
	  min-height: 120px;
	  margin: 50px auto;
	  text-align: center;
	  display: block;
	  clear: both;
	}

	.inline-ad-slot {
	  width: 100%;
	  max-width: 960px;
	  min-height: 90px;
	  margin: 35px auto;
	  text-align: center;
	}

	@media (max-width: 1400px) {
	  .fixed-side-ad {
		display: none !important;
	  }
	}	
    `;

    document.head.appendChild(style);
  })();
	
  // =============================
  // 4️⃣ HIDE EMPTY ADSTERRA CONTAINERS ONLY
  // =============================
  function hideBlankAds() {
    document.querySelectorAll('[id^="container-"]').forEach(ad => {
      const hasIframe = ad.querySelector("iframe");
      const visibleText = ad.innerText.trim().length;

      if (!hasIframe && visibleText === 0) {
        ad.style.display = "none";
      }
    });
  }

  setInterval(hideBlankAds, 1000);

  // =============================
  function isGamePage() {
  // NOT the main hub → game page
	  return !document.body.classList.contains("hub-page");
	}
	
  function addCloseButton(wrapper) {
	  if (!isGamePage()) return; // 🚫 only on game pages

	  const btn = document.createElement("button");
	  btn.innerText = "×";

	  btn.style.position = "absolute";
	  btn.style.top = "5px";
	  btn.style.right = "5px";
	  btn.style.background = "rgba(0,0,0,0.6)";
	  btn.style.color = "#fff";
	  btn.style.border = "none";
	  btn.style.cursor = "pointer";
	  btn.style.fontSize = "16px";
	  btn.style.padding = "2px 6px";
	  btn.style.zIndex = "1000000";

	  btn.onclick = () => {
		wrapper.style.display = "none";
	  };

	  wrapper.style.position = "relative";
	  wrapper.appendChild(btn);
	}
  // 5️⃣ TOP AD
  // =============================
  function addTopAd() {
    const top = document.querySelector(".top-banner");
    if (!top || top.dataset.extraAd) return;

    if (!top.querySelector(".adsbygoogle")) {
      const ins = createHorizontalAd();
      top.appendChild(ins);
      setTimeout(() => pushAd(ins), 1200);
    }

    top.dataset.extraAd = "1";
  }

  // =============================
  // 6️⃣ BOTTOM AD
  // =============================
  function addBottomAd() {
	  if (document.getElementById("extra-bottom-ad")) return;

	  const bottom = document.createElement("div");
	  bottom.id = "extra-bottom-ad";
	  bottom.style.width = "100%";
	  bottom.style.maxWidth = "970px";
	  bottom.style.minHeight = "120px";
	  bottom.style.margin = "50px auto";
	  bottom.style.textAlign = "center";
	  bottom.style.display = "block";
	  bottom.style.clear = "both";

	  const ad = createHorizontalAd();
	  bottom.appendChild(ad);

	  document.body.appendChild(bottom);

	  setTimeout(() => pushAd(ad), 2000);
	}

  // =============================
  // 7️⃣ SIDE ADS
  // =============================
  function addSideAds() {
	  if (window.innerWidth < 1400) return;

	  setTimeout(() => {
		if (!document.getElementById("extra-left-ad")) {
		  const left = document.createElement("aside");
		  left.id = "extra-left-ad";
		  left.className = "fixed-side-ad left";
		  left.style.display = "block";

		  const ad = createAsideAd("3686182226");
		  left.appendChild(ad);
		  addCloseButton(left); 
		  document.body.appendChild(left);
		  setTimeout(() => pushAd(ad.querySelector("ins")), 2000);
		}

		if (!document.getElementById("extra-right-ad")) {
		  const right = document.createElement("aside");
		  right.id = "extra-right-ad";
		  right.className = "fixed-side-ad right";
		  right.style.display = "block";

		  const ad = createAsideAd("7624620010");
		  right.appendChild(ad);
		  addCloseButton(right);
		  document.body.appendChild(right);
		  setTimeout(() => pushAd(ad.querySelector("ins")), 2500);
		}
	  }, 2000);
	}

  // =============================
  // 8️⃣ IN-CONTENT ADS
  // =============================
  function addInContentAds() {
    const sections = document.querySelectorAll(".section");
    if (!sections.length) return;

    sections.forEach((section, i) => {
      if (i % 2 === 1 && !section.nextElementSibling?.classList?.contains("inline-ad-slot")) {
        const wrap = document.createElement("div");
        wrap.className = "inline-ad-slot";

        const ad = createHorizontalAd();
        wrap.appendChild(ad);

        section.after(wrap);
        setTimeout(() => pushAd(ad), 1200);
      }
    });
  }

  // =============================
  // 9️⃣ GAME PAGE ADS
  // =============================
  function addGamePageAds() {
    if (document.getElementById("game-ad")) return;

    const game = document.querySelector("canvas, iframe, .game-container, #game");
    if (!game) return;

    const wrap = document.createElement("div");
    wrap.id = "game-ad";
    wrap.className = "inline-ad-slot";

    const ad = createHorizontalAd();
    wrap.appendChild(ad);

    game.parentNode.insertBefore(wrap, game.nextSibling);
    setTimeout(() => pushAd(ad), 1200);
  }

  // =============================
  // 🔟 INIT
  // =============================
  function initExtraAds() {
    addTopAd();
    addBottomAd();
    addSideAds();
    addInContentAds();
    addGamePageAds();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initExtraAds);
  } else {
    initExtraAds();
  }

  // =============================
  // CONSENT FALLBACK
  // =============================
  function waitForConsentAndLoadAds() {
    const check = setInterval(() => {
      try {
        if (window.googlefc && window.googlefc.getConsentStatus) {
          const status = window.googlefc.getConsentStatus();

          if (status === 1 || status === 2) {
            document.querySelectorAll(".adsbygoogle").forEach(ad => {
              pushAd(ad);
            });

            clearInterval(check);
          }
        }
      } catch (e) {}
    }, 500);
  }
	// =============================
// 🎮 PUBLIC API FOR GAME PAGES
// =============================
	window.NeonAds = {
	  showGameBreakAd: function (containerSelector) {

		const target =
		  document.querySelector(containerSelector) ||
		  document.querySelector(".game-container") ||
		  document.querySelector("#game") ||
		  document.body;

		if (!target) return;

		let wrap = document.getElementById("neon-game-break-ad");

		if (!wrap) {
		  wrap = document.createElement("div");
		  wrap.id = "neon-game-break-ad";

		  wrap.style.position = "fixed";
		  wrap.style.top = "0";
		  wrap.style.left = "0";
		  wrap.style.width = "100%";
		  wrap.style.height = "100%";
		  wrap.style.background = "rgba(0,0,0,0.9)";
		  wrap.style.display = "flex";
		  wrap.style.alignItems = "center";
		  wrap.style.justifyContent = "center";
		  wrap.style.zIndex = "999999";

		  // ✅ CLOSE BUTTON
		  const close = document.createElement("button");
		  close.innerText = "×";
		  close.style.position = "absolute";
		  close.style.top = "20px";
		  close.style.right = "20px";
		  close.style.fontSize = "28px";
		  close.style.background = "transparent";
		  close.style.color = "white";
		  close.style.border = "none";
		  close.style.cursor = "pointer";

		  close.onclick = () => {
			wrap.style.display = "none";
		  };

		  // ✅ AD CONTAINER (SQUARE)
		  const ad = document.createElement("ins");
		  ad.className = "adsbygoogle";
		  ad.style.display = "inline-block";
		  ad.style.width = "300px";
		  ad.style.height = "250px";

		  ad.setAttribute("data-ad-client", "ca-pub-5482914432517813");
		  ad.setAttribute("data-ad-slot", "1570389117");

		  wrap.appendChild(close);
		  wrap.appendChild(ad);

		  document.body.appendChild(wrap);

		  setTimeout(() => {
			try {
			  (window.adsbygoogle = window.adsbygoogle || []).push({});
			} catch (e) {}
		  }, 300);

		} else {
		  wrap.style.display = "flex";
		}
	  },

	  hideGameBreakAd: function () {
		const wrap = document.getElementById("neon-game-break-ad");
		if (wrap) wrap.style.display = "none";
	  }
	};
  waitForConsentAndLoadAds();
})();