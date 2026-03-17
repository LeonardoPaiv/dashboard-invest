import uuid
from utils.storage import get_data, save_data

def load_custom_lists():
    lists = get_data("custom_lists")
    if not lists:
        # Default lists if none exist
        default_lists = [
            {"id": str(uuid.uuid4()), "name": "Minha Lista 1", "items": []},
            {"id": str(uuid.uuid4()), "name": "Minha Lista 2", "items": []},
            {"id": str(uuid.uuid4()), "name": "Minha Lista 3", "items": []}
        ]
        save_custom_lists(default_lists)
        return default_lists
    return lists

def save_custom_lists(lists):
    save_data("custom_lists", lists)


def add_list(name):
    lists = load_custom_lists()
    new_list = {"id": str(uuid.uuid4()), "name": name, "items": []}
    lists.append(new_list)
    save_custom_lists(lists)
    return new_list

def delete_list(list_id):
    lists = load_custom_lists()
    lists = [l for l in lists if l['id'] != list_id]
    save_custom_lists(lists)

def add_item_to_list(list_id, ticker, item_type):
    lists = load_custom_lists()
    for l in lists:
        if l['id'] == list_id:
            # Check if ticker already exists in this list
            if not any(item['ticker'].upper() == ticker.upper() for item in l['items']):
                l['items'].append({"ticker": ticker.upper(), "type": item_type})
            break
    save_custom_lists(lists)

def remove_item_from_list(list_id, ticker):
    lists = load_custom_lists()
    for l in lists:
        if l['id'] == list_id:
            l['items'] = [item for item in l['items'] if item['ticker'].upper() != ticker.upper()]
            break
    save_custom_lists(lists)

def rename_list(list_id, new_name):
    lists = load_custom_lists()
    for l in lists:
        if l['id'] == list_id:
            l['name'] = new_name
            break
    save_custom_lists(lists)
