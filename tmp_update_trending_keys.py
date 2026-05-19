import json
from deep_translator import GoogleTranslator
import os

# Target languages to patch (must match existing lang/*.json files)
targets = {
    "de": "de",
    "es": "es",
    "fr": "fr",
    "hi": "hi",
    "it": "it",
    "ja": "ja",
    "ko": "ko",
    "pt-br": "pt",
    "ro": "ro",
    "sv": "sv",
    "zh": "zh-CN",
}

label_emoji = "🔥 "
label_en = "Trending Now"

sub_en = "The games getting the most attention today."

# Read EN as the source of truth for punctuation/wording if you ever change it
with open(os.path.join("lang", "en.json"), "r", encoding="utf-8") as f:
    en_data = json.load(f)

# If you want exact current EN strings:
label_en = en_data["cat_best_games"].replace("🔥", "").strip()
sub_en = en_data["cat_best_games_sub"].strip()

for file_base, translator_code in targets.items():
    path = os.path.join("lang", f"{file_base}.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    translator = GoogleTranslator(source="en", target=translator_code)

    translated_label = translator.translate(label_en)
    translated_sub = translator.translate(sub_en)

    data["cat_best_games"] = f"{label_emoji}{translated_label}"
    data["cat_best_games_sub"] = translated_sub

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("Trending keys updated across all languages.")
