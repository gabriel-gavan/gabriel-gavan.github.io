(function () {

  if (location.hostname !== "neonminigamehub.com") {
    console.log("Ads disabled (not live domain)");
    return;
  }

  // =============================
  // 1️⃣ AdSense (Auto Ads only)
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

  // =====================================================
  // 2️⃣ ADSTERRA UNITS
  // =====================================================

  function loadAdsterraScript(url, placement = "body") {
    if (document.querySelector(`script[src="${url}"]`)) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = url;

    if (placement === "head") {
      document.head.appendChild(script);
    } else {
      document.body.appendChild(script);
    }
  }

  // 🔹 Social Bar
  loadAdsterraScript(
    "https://pl28700278.effectivegatecpm.com/26/13/e8/2613e8380f7bdfa828796e21eede7894.js",
    "head"
  );

  // 🔹 Native Banner
  function loadAdsterraContainer(scriptUrl, containerId) {
    if (document.getElementById(containerId)) return;

    const container = document.createElement("div");
    container.id = containerId;
    container.style.maxWidth = "1200px";
    container.style.margin = "20px auto";
    container.style.textAlign = "center";

    document.querySelector(".main-content")?.appendChild(container);

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = scriptUrl;

    container.appendChild(script);
  }

  setTimeout(() => {
    loadAdsterraContainer(
      "https://pl28742157.effectivegatecpm.com/afff8cbe88a210d98b8ca11d2adc0943/invoke.js",
      "container-afff8cbe88a210d98b8ca11d2adc0943"
    );
  }, 1500);

  // 🔹 320x50 Mobile Banner
  function loadAdsterra320x50() {
    if (window.innerWidth > 768) return;

    const containerId = "adsterra-320x50";
    if (document.getElementById(containerId)) return;

    const container = document.createElement("div");
    container.id = containerId;
    container.style.width = "320px";
    container.style.height = "50px";
    container.style.margin = "20px auto";
    container.style.textAlign = "center";

    document.querySelector(".main-content")?.appendChild(container);

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
  }

  setTimeout(loadAdsterra320x50, 2000);

  // 🔹 Popunder
  setTimeout(() => {
  loadAdsterraScript(
    "https://pl28741283.effectivegatecpm.com/c2/46/66/c24666ba56d10524410f231d33bf7708.js"
  );
}, 3000);


})();
