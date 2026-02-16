(function () {

  // Rulează DOAR pe domeniul live
  if (location.hostname !== "neonminigamehub.com") {
    console.log("Ads disabled (not live domain)");
    return;
  }

  // =============================
  // 1️⃣ AdSense Loader (o singură dată)
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
  // 2️⃣ AdSense Banner TOP (toate paginile)
  // =============================
  const adTop = document.createElement("div");
  adTop.style.textAlign = "center";
  adTop.style.margin = "20px auto";
  adTop.style.maxWidth = "1200px";

  adTop.innerHTML = `
    <ins class="adsbygoogle"
      style="display:block"
      data-ad-client="CA-PUB-XXXX"
      data-ad-slot="1234567890"
      data-ad-format="auto"
      data-full-width-responsive="true"></ins>
  `;

  document.body.insertBefore(adTop, document.body.firstChild);

  (window.adsbygoogle = window.adsbygoogle || []).push({});

  // =============================
  // 3️⃣ Adsterra Footer Script
  // =============================
  const adsterra = document.createElement("script");
  adsterra.src =
    "https://pl28700278.effectivegatecpm.com/26/13/e8/2613e8380f7bdfa828796e21eede7894.js";
  document.body.appendChild(adsterra);

})();
