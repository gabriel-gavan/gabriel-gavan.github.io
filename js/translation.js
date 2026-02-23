async function loadLanguage(lang) {
    try {
        const response = await fetch(`lang/${lang}.json`);
        const dict = await response.json();

        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (dict[key]) el.textContent = dict[key];
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (dict[key]) el.placeholder = dict[key];
        });

    } catch (err) {
        console.error("Failed to load language file:", err);
    }
}


function detectDefaultLanguage() {
    // 1. Respect user selection if saved
    const saved = localStorage.getItem("site-lang");
    if (saved) return saved;

    // 2. Auto-detect from browser
    const locale = navigator.language || navigator.userLanguage;
    if (locale && locale.toLowerCase().startsWith("ro")) return "ro";

    // 3. Otherwise EN
    return "en";
}


// ====================== MAIN INITIALISER ======================
(async () => {
    const lang = detectDefaultLanguage();
    await loadLanguage(lang);

    // Makes EN/RO buttons work globally
    window.setLanguage = async function(newLang) {
        localStorage.setItem("site-lang", newLang);
        await loadLanguage(newLang);
    };
})();
