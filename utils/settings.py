import json
import os

SETTINGS_PATH = "data/data.json"

def load_settings():
    if not os.path.exists("data"):
        os.makedirs("data")
        
    if not os.path.exists(SETTINGS_PATH):
        return {
            "estrategia": "",
            "alvos": {
                "fiis": 33.0,
                "acoes": 33.0,
                "renda_fixa": 34.0
            }
        }
    
    with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except:
            return {
                "estrategia": "",
                "alvos": {
                    "fiis": 33.0,
                    "acoes": 33.0,
                    "renda_fixa": 34.0
                }
            }

def save_settings(settings):
    if not os.path.exists("data"):
        os.makedirs("data")
        
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=4, ensure_ascii=False)
