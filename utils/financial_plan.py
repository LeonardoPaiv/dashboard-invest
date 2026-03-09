import pandas as pd
from utils.storage import get_data, save_data

def get_default_plan():
    months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]
    data = []
    for i, month in enumerate(months):
        data.append({
            "Mês": month,
            "Incoming (R$)": 15000.0,
            "Gastos (R$)": 2849.62 if i == 0 else 0.0,
            "Meta (%)": 50.0,
            "Investimento Adicional (R$)": 0.0
        })
    return {
        "monthly_data": data,
        "expected_return_monthly": 0.8,
        "initial_equity": 0.0,
        "projection_years": 10
    }

def load_financial_plan():
    plan = get_data("financial_plan")
    if not plan:
        return get_default_plan()
    return plan

def save_financial_plan(plan_data):
    save_data("financial_plan", plan_data)

def calculate_projection(plan_data, current_equity=0, years=1):
    monthly_df = pd.DataFrame(plan_data["monthly_data"])
    rate = pd.to_numeric(plan_data.get("expected_return_monthly", 0.8), errors='coerce') / 100
    
    # Garantir colunas numéricas
    cols = ["Incoming (R$)", "Gastos (R$)", "Meta (%)", "Investimento Adicional (R$)"]
    for col in cols:
        if col in monthly_df.columns:
            monthly_df[col] = pd.to_numeric(monthly_df[col], errors='coerce').fillna(0)
            
    # Cálculos base da tabela mensal (Superior)
    monthly_df["Saldo Mensal (R$)"] = monthly_df["Incoming (R$)"] - monthly_df["Gastos (R$)"]
    monthly_df["Investimento Total (R$)"] = monthly_df["Saldo Mensal (R$)"] + monthly_df["Investimento Adicional (R$)"]
    monthly_df["Meta (R$)"] = monthly_df["Incoming (R$)"] * (monthly_df["Meta (%)"] / 100)
    
    initial = pd.to_numeric(plan_data.get("initial_equity", 0), errors='coerce')
    if initial == 0:
        initial = current_equity
        
    projection = []
    current = initial
    
    # Projetar para N anos com Juros Compostos
    for year in range(1, years + 1):
        for idx, row in monthly_df.iterrows():
            # Rendimento sobre o patrimônio acumulado
            yield_val = current * rate
            # Aporte planejado
            contribution = row["Investimento Total (R$)"]
            # Novo total
            current = current + yield_val + contribution
            
            projection.append({
                "Período": f"Ano {year} - {row['Mês']}",
                "Ano": year,
                "Mês": row['Mês'],
                "Aporte (R$)": contribution,
                "Rendimento (R$)": yield_val,
                "Patrimônio Acumulado (R$)": current
            })
        
    return monthly_df, pd.DataFrame(projection)
