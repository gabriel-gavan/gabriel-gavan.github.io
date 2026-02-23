(function () {

  if (location.hostname !== "neonminigamehub.com") {
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

  // Load external JS safely
  function loadScript(url, target = document.body) {
    if (document.querySelector(`script[src="${url}"]`)) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = url;
    target.appendChild(s);
  }

  // Create generic container
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
  // 3️⃣ DESKTOP UNITS ONLY
  // =============================
  if (window.innerWidth > 768) {

    // Desktop Social Bar (BLOCK MOBILE)
    loadScript(
      "https://pl28700278.effectivegatecpm.com/26/13/e8/2613e8380f7bdfa828796e21eede7894.js",
      document.head
    );

    // Native Banner (Desktop Only)
    setTimeout(() => {
      const id = "container-afff8cbe88a210d98b8ca11d2adc0943";
      const container = createContainer(id, "100%", "auto");

      const script = document.createElement("script");
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      script.src =
        "https://pl28742157.effectivegatecpm.com/afff8cbe88a210d98b8ca11d2adc0943/invoke.js";

      container.appendChild(script);
    }, 1200);

    // Popunder (Desktop Only)
    setTimeout(() => {
      loadScript(
        "https://pl28741283.effectivegatecpm.com/c2/46/66/c24666ba56d10524410f231d33bf7708.js"
      );
    }, 3000);
  }

  // =============================
  // 4️⃣ MOBILE UNITS ONLY
  // =============================
  else {

    setTimeout(() => {
      const id = "adsterra-320x50";
      const container = createContainer(id, "320px", "50px");

      window.atOptions = {
        key: "f003d840adf5943aadf32d7057595e7f",
        format: "iframe",
        height: 50,
        width: 320,
        params: {}
      };

      const script = document.createElement("script");
      script.async = true;
      script.src =
        "https://www.highperformanceformat.com/f003d840adf5943aadf32d7057595e7f/invoke.js";
      container.appendChild(script);
    }, 1500);

  }

  // ========================================
  // 5️⃣ AUTO-HIDE EMPTY / NO-FILL AD CONTAINERS
  // ========================================
  function hideBlankAds() {
    document.querySelectorAll('#adsterra-320x50, [id^="container-"]').forEach(ad => {
      if (!ad) return;

      const hasIframe = ad.querySelector("iframe");
      const visibleText = ad.innerText.trim().length;

      if (!hasIframe && visibleText === 0) {
        ad.style.display = "none";
      }
    });
  }

  // Run every 1 sec
  setInterval(hideBlankAds, 1000);

})();