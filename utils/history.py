import pandas as pd
from datetime import datetime
import base64
from utils.parser import parse_investment_xlsx
from utils.storage import get_data, save_data

def save_to_history(file_name, file_content):
    # Get current history metadata
    history = get_data("history")
    if not history:
        history = []
    
    # Calculate current total for the history chart
    try:
        data = parse_investment_xlsx(file_content)
        total = data['resumo'].get('total_investido', 0)
    except:
        total = 0
        
    # Add to history list
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    history.append({
        "timestamp": timestamp,
        "date": date_str,
        "filename": file_name,
        "total": total
    })
    
    # Limit history to avoid bloat in localStorage (e.g., last 50 points)
    if len(history) > 50:
        history = history[-50:]
        
    save_data("history", history)
    
    # Save the latest file content separately (encoded)
    encoded_content = base64.b64encode(file_content).decode('utf-8')
    save_data("latest_file", {"name": file_name, "content": encoded_content})
    
    return True

def get_equity_history():
    history = get_data("history")
    if not history:
        return pd.DataFrame(columns=['Data', 'Total'])
    
    history_data = []
    for item in history:
        try:
            dt = datetime.strptime(item['date'], "%Y-%m-%d")
            history_data.append({'Data': dt, 'Total': item['total']})
        except:
            continue
            
    df = pd.DataFrame(history_data)
    if not df.empty:
        df = df.groupby('Data')['Total'].last().reset_index()
        df = df.sort_values('Data')
        
    return df

def get_latest_history_content():
    latest = get_data("latest_file")
    if not latest or "content" not in latest:
        return None, None
    
    try:
        file_content = base64.b64decode(latest["content"])
        return latest["name"], file_content
    except:
        return None, None
