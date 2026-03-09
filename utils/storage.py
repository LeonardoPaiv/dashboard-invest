import streamlit as st
import json
import os
import hashlib
from streamlit_js_eval import streamlit_js_eval

STORAGE_KEY = "invest_dashboard_data"

def get_browser_data():
    """Reads all data from browser localStorage."""
    try:
        data = streamlit_js_eval(js_expressions=f"window.localStorage.getItem('{STORAGE_KEY}')", key="read_localstorage")
        if data:
            return json.loads(data)
    except:
        pass
    return None

def save_to_browser(data):
    """Saves all data to browser localStorage by rendering a component."""
    if not data:
        return
    try:
        val_json = json.dumps(data)
        # Use more robust escaping for JS string injection
        val_json_esc = val_json.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
        
        data_hash = hashlib.md5(val_json.encode()).hexdigest()
        # The key must change to trigger the JS script execution again
        streamlit_js_eval(js_expressions=f"window.localStorage.setItem('{STORAGE_KEY}', '{val_json_esc}')", key=f"write_ls_{data_hash}")
    except Exception as e:
        print(f"Error saving to browser: {e}")

def initialize_state():
    """Initializes st.session_state from localStorage or defaults."""
    if "app_data" not in st.session_state:
        # First pass: try reading
        st.session_state.app_data = {
            "settings": {
                "estrategia": "",
                "alvos": {"fiis": 33.0, "acoes": 33.0, "renda_fixa": 34.0}
            },
            "financial_plan": {"monthly_data": [], "expected_return_monthly": 0.8, "initial_equity": 0, "projection_years": 10},
            "custom_lists": [],
            "scraped_cache": {},
            "snapshots": [],
            "history": [],
            "latest_file": {}
        }
        st.session_state.initialized = False
        st.session_state.sync_required = False
    
    # Try to load from browser until success
    if not st.session_state.get("initialized", False):
        browser_data = get_browser_data()
        if browser_data:
            # We found data!
            st.session_state.app_data = browser_data
            st.session_state.initialized = True
            st.rerun() # Refresh with the new data

def get_data(category):
    """Gets data for a specific category from session_state."""
    initialize_state()
    return st.session_state.app_data.get(category, {})

def save_data(category, data):
    """Saves data for a specific category and syncs to browser."""
    initialize_state()
    st.session_state.app_data[category] = data
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
        st.session_state.initialized = True
        return True
    except:
        return False
