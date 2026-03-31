"""
Excel在庫管理表 → Supabase インポートスクリプト

使い方:
  pip install pandas openpyxl supabase
  export SUPABASE_URL=https://xxxxx.supabase.co
  export SUPABASE_SERVICE_KEY=eyJhbGci...
  python import_data.py 在庫管理表.xlsx
"""

import sys, os
import pandas as pd
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("環境変数 SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_location_id(sheet_name):
    res = supabase.table("locations").select("id").eq("sheet_name", sheet_name).execute()
    if res.data:
        return res.data[0]["id"]
    return None

def safe_num(val):
    if pd.isna(val):
        return 0
    try:
        return float(val)
    except:
        return 0

def safe_str(val):
    if pd.isna(val):
        return None
    return str(val).strip()

def import_warehouse_sheet(xls, sheet_name, has_owner=True, has_no=False, has_location_detail=False):
    """野田倉庫・小倉営業所・東京本社 形式のインポート"""
    loc_id = get_location_id(sheet_name)
    if not loc_id:
        print(f"  Location not found for: {sheet_name}")
        return

    df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
    header_row = df.iloc[0]

    col_map = {}
    date_cols = {}
    for c in range(df.shape[1]):
        val = header_row[c]
        if pd.isna(val):
            continue
        val_str = str(val).strip()
        if val_str in ("品名", "製品名"):
            col_map["product_name"] = c
        elif val_str == "No":
            col_map["item_no"] = c
        elif val_str == "持ち主":
            col_map["owner"] = c
        elif val_str in ("仕入先", "メーカー"):
            col_map["supplier"] = c
        elif val_str == "場所詳細":
            col_map["location_detail"] = c
        elif val_str == "型式":
            col_map["model"] = c
        elif val_str in ("在庫数", "数量"):
            col_map["quantity"] = c
        elif val_str == "単位":
            col_map["unit"] = c
        elif val_str == "単価":
            col_map["unit_price"] = c
        elif val_str in ("合計金額", "合計"):
            col_map["total_price"] = c
        elif val_str == "備考":
            col_map["remarks"] = c
        else:
            try:
                date_val = pd.Timestamp(val)
                if not pd.isna(date_val):
                    date_cols[c] = date_val.strftime("%Y-%m-%d")
            except:
                pass

    print(f"  Columns mapped: {list(col_map.keys())}, Date columns: {len(date_cols)}")

    items_inserted = 0
    counts_inserted = 0

    for r in range(1, df.shape[0]):
        product_name = safe_str(df.iloc[r, col_map.get("product_name", 0)])
        if not product_name:
            continue

        item_data = {
            "location_id": loc_id,
            "product_name": product_name,
            "owner": safe_str(df.iloc[r, col_map["owner"]]) if "owner" in col_map else None,
            "supplier": safe_str(df.iloc[r, col_map["supplier"]]) if "supplier" in col_map else None,
            "location_detail": safe_str(df.iloc[r, col_map["location_detail"]]) if "location_detail" in col_map else None,
            "model": safe_str(df.iloc[r, col_map["model"]]) if "model" in col_map else None,
            "manufacturer": safe_str(df.iloc[r, col_map.get("manufacturer")]) if "manufacturer" in col_map else None,
            "item_no": safe_str(df.iloc[r, col_map["item_no"]]) if "item_no" in col_map else None,
            "quantity": safe_num(df.iloc[r, col_map["quantity"]]) if "quantity" in col_map else 0,
            "unit": safe_str(df.iloc[r, col_map["unit"]]) if "unit" in col_map else None,
            "unit_price": safe_num(df.iloc[r, col_map["unit_price"]]) if "unit_price" in col_map else 0,
            "total_price": safe_num(df.iloc[r, col_map["total_price"]]) if "total_price" in col_map else 0,
            "remarks": safe_str(df.iloc[r, col_map["remarks"]]) if "remarks" in col_map else None,
        }
        item_data = {k: v for k, v in item_data.items() if v is not None}

        res = supabase.table("inventory_items").insert(item_data).execute()
        item_id = res.data[0]["id"]
        items_inserted += 1

        daily_batch = []
        for col_idx, date_str in date_cols.items():
            count_val = df.iloc[r, col_idx]
            if pd.notna(count_val):
                try:
                    daily_batch.append({
                        "item_id": item_id,
                        "count_date": date_str,
                        "count_value": float(count_val)
                    })
                except (ValueError, TypeError):
                    pass

        if daily_batch:
            for i in range(0, len(daily_batch), 500):
                supabase.table("daily_counts").insert(daily_batch[i:i+500]).execute()
                counts_inserted += len(daily_batch[i:i+500])

    print(f"  Items: {items_inserted}, Daily counts: {counts_inserted}")

def import_old_inventory(xls, sheet_name):
    """旧在庫管理表形式のインポート"""
    loc_id = get_location_id(sheet_name)
    if not loc_id:
        print(f"  Location not found for: {sheet_name}")
        return

    df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
    items_inserted = 0

    data_start = None
    for r in range(df.shape[0]):
        val = safe_str(df.iloc[r, 0])
        if val and "在庫" in val and r >= 2:
            data_start = r
            break

    if data_start is None:
        data_start = 2

    current_category = safe_str(df.iloc[data_start, 0]) if data_start < df.shape[0] else ""

    for r in range(data_start + 1, df.shape[0]):
        col0 = safe_str(df.iloc[r, 0])
        col1 = df.iloc[r, 1]

        if col0 and pd.isna(col1):
            current_category = col0
            continue

        if pd.notna(col1) or pd.notna(df.iloc[r, 2]):
            product_name = None
            for c in [6, 7]:
                if c < df.shape[1]:
                    val = safe_str(df.iloc[r, c])
                    if val:
                        product_name = val
                        break
            if not product_name:
                product_name = f"{current_category} (行{r+1})"

            item_data = {
                "location_id": loc_id,
                "product_name": product_name,
                "quantity": safe_num(col1),
                "unit": "M" if "ケーブル" in (current_category or "") else None,
                "remarks": current_category,
            }
            item_data = {k: v for k, v in item_data.items() if v is not None}
            supabase.table("inventory_items").insert(item_data).execute()
            items_inserted += 1

    print(f"  Items: {items_inserted}")

def import_jouwa(xls, sheet_name):
    """上和電機在庫のインポート"""
    loc_id = get_location_id(sheet_name)
    if not loc_id:
        return

    df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
    items_inserted = 0

    for r in range(1, df.shape[0]):
        product_name = safe_str(df.iloc[r, 0])
        if not product_name:
            continue
        item_data = {
            "location_id": loc_id,
            "product_name": product_name,
            "manufacturer": safe_str(df.iloc[r, 1]),
            "quantity": safe_num(df.iloc[r, 2]),
            "unit": safe_str(df.iloc[r, 3]),
            "unit_price": safe_num(df.iloc[r, 4]),
            "total_price": safe_num(df.iloc[r, 5]),
            "remarks": safe_str(df.iloc[r, 6]),
        }
        item_data = {k: v for k, v in item_data.items() if v is not None}
        supabase.table("inventory_items").insert(item_data).execute()
        items_inserted += 1

    print(f"  Items: {items_inserted}")

def import_noda_yuimyu(xls, sheet_name):
    """野田倉庫(ゆい・みゆ担当分)のインポート"""
    loc_id = get_location_id(sheet_name)
    if not loc_id:
        return

    df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
    header_row = df.iloc[0]

    date_cols = {}
    for c in range(df.shape[1]):
        val = header_row[c]
        if pd.isna(val):
            continue
        try:
            date_val = pd.Timestamp(val)
            if not pd.isna(date_val):
                date_cols[c] = date_val.strftime("%Y-%m-%d")
        except:
            pass

    items_inserted = 0
    counts_inserted = 0

    for r in range(1, df.shape[0]):
        product_name = safe_str(df.iloc[r, 0])
        if not product_name:
            continue

        supplier_col = 1
        quantity_col = 2
        unit_col = 3

        item_data = {
            "location_id": loc_id,
            "product_name": product_name,
            "supplier": safe_str(df.iloc[r, supplier_col]),
            "quantity": safe_num(df.iloc[r, quantity_col]),
            "unit": safe_str(df.iloc[r, unit_col]),
        }
        item_data = {k: v for k, v in item_data.items() if v is not None}
        res = supabase.table("inventory_items").insert(item_data).execute()
        item_id = res.data[0]["id"]
        items_inserted += 1

        daily_batch = []
        for col_idx, date_str in date_cols.items():
            count_val = df.iloc[r, col_idx]
            if pd.notna(count_val):
                try:
                    daily_batch.append({
                        "item_id": item_id,
                        "count_date": date_str,
                        "count_value": float(count_val)
                    })
                except:
                    pass

        if daily_batch:
            for i in range(0, len(daily_batch), 500):
                supabase.table("daily_counts").insert(daily_batch[i:i+500]).execute()
                counts_inserted += len(daily_batch[i:i+500])

    print(f"  Items: {items_inserted}, Daily counts: {counts_inserted}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python import_data.py <path_to_excel>")
        sys.exit(1)

    excel_path = sys.argv[1]
    xls = pd.ExcelFile(excel_path)

    print("=== 在庫データインポート開始 ===\n")

    print("[1/8] (旧)在庫管理表")
    import_old_inventory(xls, "(旧)在庫管理表")

    print("\n[2/8] 野田倉庫棚卸(金担当分)")
    import_warehouse_sheet(xls, "野田倉庫棚卸(金担当分)")

    print("\n[3/8] 旧シート")
    import_old_inventory(xls, "旧シート")

    print("\n[4/8] 小倉営業所(金担当分)")
    import_warehouse_sheet(xls, "小倉営業所(金担当分)")

    print("\n[5/8] 26年03月東京本社(金＆設計担当分) ダブルチェック用")
    import_warehouse_sheet(xls, "26年03月東京本社(金＆設計担当分) ダブルチェック用")

    print("\n[6/8] 上和電機在庫")
    import_jouwa(xls, "上和電機在庫")

    print("\n[7/8] 長沼現場在庫")
    import_warehouse_sheet(xls, "長沼現場在庫")

    print("\n[8/8] 野田倉庫棚卸(ゆい・みゆ担当分) ")
    import_noda_yuimyu(xls, "野田倉庫棚卸(ゆい・みゆ担当分) ")

    print("\n=== インポート完了 ===")

if __name__ == "__main__":
    main()
