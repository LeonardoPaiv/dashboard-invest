from utils.storage import get_data, save_data

def load_settings():
    settings = get_data("settings")
    if not settings:
        return {
            "estrategia": "",
            "alvos": {
                "fiis": 33.0,
                "acoes": 33.0,
                "renda_fixa": 34.0
            }
        }
    return settings

def save_settings(settings):
    save_data("settings", settings)
