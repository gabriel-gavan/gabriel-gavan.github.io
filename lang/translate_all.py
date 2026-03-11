import json
import time
from deep_translator import GoogleTranslator

languages = {
    "zh": "zh-CN",
    "hi": "hi",
    "ja": "ja",
    "ko": "ko",
    "fr": "fr",
    "it": "it",
    "de": "de",
    "sv": "sv",
    "pt-br": "pt",
    "es": "es"
}

with open("en.json","r",encoding="utf-8") as f:
    data = json.load(f)

for file, lang in languages.items():

    print("\n========================")
    print("Starting language:", file)
    print("========================")

    translator = GoogleTranslator(source="en", target=lang)

    output_file = file + ".json"

    translated = {}

    # CREATE FILE FIRST
    with open(output_file,"w",encoding="utf-8") as f:
        json.dump({},f)

    for key,value in data.items():

        if isinstance(value,str):

            try:

                print("REQUEST:", value)

                response = translator.translate(value)

                print("RESPONSE:", response)

                translated[key] = response

            except Exception as e:

                print("ERROR:", e)

                translated[key] = value

        else:
            translated[key] = value

        # WRITE AFTER EACH TRANSLATION
        with open(output_file,"w",encoding="utf-8") as f:
            json.dump(translated,f,ensure_ascii=False,indent=2)

        time.sleep(0.1)

print("\nAll translations finished.")