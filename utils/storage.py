import streamlit as st
import json
import os
from streamlit_js_eval import streamlit_js_eval

STORAGE_KEY = "invest_dashboard_data"

def get_browser_data():
    """Reads all data from browser localStorage."""
    try:
        data = streamlit_js_eval(js_expressions=f"window.localStorage.getItem('{STORAGE_KEY}')", key="load_from_localstorage")
        if data:
            return json.loads(data)
    except:
        pass
    return None

def save_to_browser(data):
    """Saves all data to browser localStorage."""
    try:
        val_json = json.dumps(data).replace("'", "\\'")
        streamlit_js_eval(js_expressions=f"window.localStorage.setItem('{STORAGE_KEY}', '{val_json}')", key="save_to_localstorage")
    except:
        pass

def initialize_state():
    """Initializes st.session_state from localStorage or defaults."""
    if "initialized" not in st.session_state:
        browser_data = get_browser_data()
        if browser_data:
            st.session_state.app_data = browser_data
        else:
            st.session_state.app_data = {
                "settings": {
                    "estrategia": "",
                    "alvos": {"fiis": 33.0, "acoes": 33.0, "renda_fixa": 34.0}
                },
                "financial_plan": {
                    "expected_return_monthly": 0.8,
                    "initial_equity": 0,
                    "projection_years": 10,
                    "monthly_data": []
                },
                "custom_lists": [],
                "scraped_cache": {},
                "snapshots": [],
                "history": []
            }
        st.session_state.initialized = True

def get_data(category):
    """Gets data for a specific category from session_state."""
    initialize_state()
    return st.session_state.app_data.get(category, {})

def save_data(category, data):
    """Saves data for a specific category and syncs to browser."""
    initialize_state()
    st.session_state.app_data[category] = data
    # Syncing to browser can be expensive if done on every call
    # We will trigger a save at the end of the app run or via a specific trigger
    st.session_state.sync_required = True

def export_all_data():
    """Returns a JSON string of all app data."""
    initialize_state()
    return json.dumps(st.session_state.app_data, indent=4, ensure_ascii=False)

def import_all_data(json_str):
    """Imports all app data from a JSON string."""
    try:
        data = json.loads(json_str)
        st.session_state.app_data = data
        st.session_state.sync_required = True
        return True
    except:
        return False
