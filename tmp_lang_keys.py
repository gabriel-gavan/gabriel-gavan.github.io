import json, os, glob

KEYS = {
    "cat_best_games": ("cat_top_picks",),
    "cat_best_games_sub": ("cat_top_picks_sub",),
    "cat_addictive_games": ("cat_top_picks",),
    "cat_addictive_games_sub": ("cat_top_picks_sub",),
}

lang_files = sorted(glob.glob(os.path.join("lang", "*.json")))
for path in lang_files:
    base = os.path.basename(path)
    if base in ("translate_all.py",):
        continue
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    updated = False
    for new_key, (source_key,) in KEYS.items():
        if new_key not in data:
            data[new_key] = data.get(source_key, new_key)
            updated = True

    if updated:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

print("done")
