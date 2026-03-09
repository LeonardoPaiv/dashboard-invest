from datetime import datetime
from utils.storage import get_data, save_data

def load_snapshots():
    snapshots = get_data("snapshots")
    if not snapshots:
        return []
    return snapshots

def save_snapshot(snapshot):
    snapshots = load_snapshots()
    snapshot['id'] = datetime.now().strftime("%Y%m%d_%H%M%S")
    snapshot['date'] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    snapshots.insert(0, snapshot) # Adiciona no topo
    save_data("snapshots", snapshots)

def delete_snapshot(snapshot_id):
    snapshots = load_snapshots()
    snapshots = [s for s in snapshots if s.get('id') != snapshot_id]
    save_data("snapshots", snapshots)
