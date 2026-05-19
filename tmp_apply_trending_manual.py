import json, os

translations = {
  "de": ("🔥 Jetzt im Trend", "Die Spiele, die heute die meiste Aufmerksamkeit bekommen."),
  "en": ("🔥 Trending Now", "The games getting the most attention today."),
  "es": ("🔥 Tendencia ahora", "Los juegos que más atención reciben hoy."),
  "fr": ("🔥 À la une", "Les jeux qui attirent le plus l’attention aujourd’hui."),
  "hi": ("🔥 आज ट्रेंडिंग", "आज सबसे ज़्यादा ध्यान पाने वाले गेम।"),
  "it": ("🔥 Di tendenza ora", "I giochi che oggi ricevono più attenzione."),
  "ja": ("🔥 今注目", "今日いちばん注目を集めているゲーム。"),
  "ko": ("🔥 지금 뜨는", "오늘 가장 많은 관심을 받는 게임."),
  "pt-br": ("🔥 Em alta agora", "Os jogos que estão recebendo mais atenção hoje."),
  "ro": ("🔥 În tendințe acum", "Jocurile care primesc azi cea mai multă atenție."),
  "sv": ("🔥 Trendar nu", "Spelen som får mest uppmärksamhet idag."),
  "zh": ("🔥 热门趋势中", "今天最受关注的游戏。"),
}

for file_base, (label, sub) in translations.items():
  path = os.path.join("lang", f"{file_base}.json")
  if not os.path.exists(path):
    continue
  with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

  data["cat_best_games"] = label
  data["cat_best_games_sub"] = sub

  with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Applied manual Trending Now translations to cat_best_games keys.")
