import os
import pandas as pd
from datetime import datetime
from utils.parser import parse_investment_xlsx

HISTORY_DIR = "data/history"

def save_to_history(file_name, file_content):
    if not os.path.exists(HISTORY_DIR):
        os.makedirs(HISTORY_DIR)
    
    # Generate unique filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = os.path.splitext(file_name)[0]
    save_path = os.path.join(HISTORY_DIR, f"{timestamp}_{base_name}.xlsx")
    
    with open(save_path, "wb") as f:
        f.write(file_content)
    return save_path

def get_equity_history():
    if not os.path.exists(HISTORY_DIR):
        return pd.DataFrame(columns=['Data', 'Total'])
    
    history_data = []
    
    # Sort files by timestamp in filename
    files = sorted([f for f in os.listdir(HISTORY_DIR) if f.endswith(".xlsx")])
    
    for f in files:
        try:
            # Extract date from filename: YYYYMMDD_HHMMSS_...
            date_str = f.split('_')[0]
            dt = datetime.strptime(date_str, "%Y%m%d")
            
            file_path = os.path.join(HISTORY_DIR, f)
            with open(file_path, "rb") as file:
                data = parse_investment_xlsx(file.read())
                total = data['resumo'].get('total_investido', 0)
                history_data.append({'Data': dt, 'Total': total})
        except Exception as e:
            print(f"Erro ao processar arquivo histórico {f}: {e}")
            
    df = pd.DataFrame(history_data)
    if not df.empty:
        # Group by date and take the last one for each day to avoid duplicates in chart
        df = df.groupby('Data')['Total'].last().reset_index()
        df = df.sort_values('Data')
        
    return df

def get_latest_history_content():
    if not os.path.exists(HISTORY_DIR):
        return None, None
    
    files = sorted([f for f in os.listdir(HISTORY_DIR) if f.endswith(".xlsx")])
    if not files:
        return None, None
    
    latest_file = files[-1]
    file_path = os.path.join(HISTORY_DIR, latest_file)
    with open(file_path, "rb") as f:
        return latest_file, f.read()
