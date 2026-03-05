window.i18n = {};
window.currentLang = "en";
async function loadLanguage(lang) {
    try {
        const response = await fetch(`../lang/${lang}.json`);
        const dict = await response.json();

        // ✔ salvează dicționarul pentru funcția t()
        window.i18n[lang] = dict;
        window.currentLang = lang;

        // ✔ aplică traducerile din DOM
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
// 🔵 FUNCTIA t() — pentru texte in JavaScript
function t(key, vars = {}) {
    let str = window.i18n?.[window.currentLang]?.[key] || key;

    Object.keys(vars).forEach(k => {
        str = str.replace(`{${k}}`, vars[k]);
    });

    return str;
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

    // 🔥 notificăm că limbajul e pregătit (JOCUL AȘTEAPTĂ ASTA)
    document.dispatchEvent(new Event("i18n-ready"));

    // Makes EN/RO buttons work globally
    window.setLanguage = async function(newLang) {
        localStorage.setItem("site-lang", newLang);
        await loadLanguage(newLang);

        // 🔥 când schimbăm limba — retraducem și jocul
        document.dispatchEvent(new Event("i18n-ready"));
    };
})();