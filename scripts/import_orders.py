#!/usr/bin/env python3
"""
订单导入脚本
从 Excel 文件导入订单数据到数据库

Excel 格式说明:
- 每个 Sheet 是一个订单
- 表头区域包含客户信息
- 数据行包含产品明细

用法:
    source venv/bin/activate
    python import_orders.py --file "../2025年12月份-接单1(2).xlsx" --analyze
    python import_orders.py --file "../2025年12月份-接单1(2).xlsx" --import
"""

import argparse
import pandas as pd
import mysql.connector
from datetime import datetime
import random
import string
import re
import math

# 数据库配置
DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': 'Wang0616',
    'database': 'trace',
    'charset': 'utf8mb4'
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

def generate_order_no():
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_part = random.randint(100000, 999999)
    return f"ORD-{timestamp}-{random_part}"

def is_valid_number(val):
    """检查是否为有效数字"""
    if pd.isna(val):
        return False
    try:
        f = float(val)
        return f > 0 and not math.isnan(f)
    except:
        return False

def find_order_blocks(df):
    """
    在 Sheet 中查找所有订单块的起始行
    每个订单以"销货清单"开头
    """
    order_starts = []
    for i in range(len(df)):
        row = df.iloc[i]
        cell0 = str(row.iloc[0]) if not pd.isna(row.iloc[0]) else ''
        if '销货清单' in cell0:
            order_starts.append(i)
    return order_starts

def parse_single_order(df, start_row, end_row, sheet_name):
    """
    解析单个订单块（从 start_row 到 end_row）
    """
    category = '榻榻米' if '榻榻米' in sheet_name else ('回弹棉' if '回弹棉' in sheet_name else sheet_name.replace('详单', ''))
    
    order = {
        'category': category,
        'customer_name': '',
        'phone': '',
        'address': '',
        'date': '',
        'remark': '',
        'items': []
    }
    
    # 在订单块内查找信息（通常在前6行）
    search_end = min(start_row + 10, end_row)
    
    for i in range(start_row, search_end):
        row = df.iloc[i]
        for j, cell in enumerate(row):
            cell_str = str(cell) if not pd.isna(cell) else ''
            
            # 查找日期
            if cell_str == '日期' and j + 1 < len(row):
                date_val = row.iloc[j + 1]
                if not pd.isna(date_val):
                    order['date'] = str(date_val)
            
            # 查找客户
            if cell_str == '客户' and j + 1 < len(row):
                customer_val = row.iloc[j + 1]
                if not pd.isna(customer_val):
                    order['customer_name'] = str(customer_val)
            
            # 查找客户名称（木制品格式）
            if cell_str == '客户名称' and j + 1 < len(row):
                customer_val = row.iloc[j + 1]
                if not pd.isna(customer_val):
                    order['customer_name'] = str(customer_val)
            
            # 查找电话
            if cell_str == '电话' and j + 1 < len(row):
                phone_val = row.iloc[j + 1]
                if not pd.isna(phone_val):
                    order['phone'] = str(phone_val)
            
            # 查找地址
            if cell_str == '地址' and j + 1 < len(row):
                addr_val = row.iloc[j + 1]
                if not pd.isna(addr_val):
                    order['address'] = str(addr_val)
            
            # 查找备注（"备注："后面的内容）
            if '备注：' in cell_str or cell_str == '备注：':
                if j + 1 < len(row) and not pd.isna(row.iloc[j + 1]):
                    order['remark'] = str(row.iloc[j + 1])
    
    # 查找数据起始行（品名/长/宽/高 表头）
    data_start = -1
    for i in range(start_row, search_end):
        row = df.iloc[i]
        row_str = ''.join([str(c) for c in row if not pd.isna(c)])
        if '品名' in row_str and ('长' in row_str or '宽' in row_str):
            data_start = i + 1
            break
    
    if data_start < 0:
        return order
    
    # 解析数据行（直到遇到"大写："或空行过多）
    data_end = min(data_start + 15, end_row)
    for i in range(data_start, data_end):
        row = df.iloc[i]
        
        # 检查是否到达末尾（"大写："标志结束）
        cell0 = str(row.iloc[0]) if not pd.isna(row.iloc[0]) else ''
        if '大写' in cell0:
            break
        
        length = 0
        width = 0
        height = 0
        quantity = 1
        unit_price = 0
        total_price = 0
        item_name = ''
        remark = ''
        
        try:
            # 品名
            if not pd.isna(row.iloc[0]):
                item_name = str(row.iloc[0])
            
            # 长宽高: 列 1, 2, 3
            if len(row) >= 4:
                if is_valid_number(row.iloc[1]):
                    length = float(row.iloc[1])
                if is_valid_number(row.iloc[2]):
                    width = float(row.iloc[2])
                if is_valid_number(row.iloc[3]):
                    h = float(row.iloc[3])
                    if h < 100:  # 高度通常小于100，否则可能是其他值
                        height = h
            
            # 查找数量列（列5，通常是小数，表示平米数）
            if len(row) > 5 and is_valid_number(row.iloc[5]):
                quantity = float(row.iloc[5])
            
            # 查找单价（列6）
            if len(row) > 6 and is_valid_number(row.iloc[6]):
                unit_price = float(row.iloc[6])
            
            # 查找金额（列7）
            if len(row) > 7 and is_valid_number(row.iloc[7]):
                total_price = float(row.iloc[7])
            
            # 备注（列8）
            if len(row) > 8 and not pd.isna(row.iloc[8]):
                remark = str(row.iloc[8])
                
        except Exception as e:
            continue
        
        # 有有效数据时添加（长宽大于0，或有品名且数量金额大于0）
        if length > 0 or width > 0 or (item_name and total_price > 0):
            order['items'].append({
                'name': item_name,
                'length': length,
                'width': width,
                'height': height,
                'quantity': quantity if quantity > 0 else 1,
                'unit': '平米' if 0 < quantity < 10 else '块',
                'unit_price': unit_price,
                'total_price': total_price,
                'remark': remark
            })
    
    return order

def parse_tatami_sheet(df, sheet_name):
    """
    解析榻榻米垫/回弹棉格式的 Sheet
    一个 Sheet 可能包含多个订单（以"销货清单"分隔）
    返回订单列表
    """
    orders = []
    
    # 查找所有订单块的起始位置
    order_starts = find_order_blocks(df)
    
    if not order_starts:
        # 如果没有找到"销货清单"标记，尝试按旧方式解析整个 Sheet 为单个订单
        order = parse_single_order(df, 0, len(df), sheet_name)
        if order['customer_name']:
            orders.append(order)
        return orders
    
    # 解析每个订单块
    for i, start in enumerate(order_starts):
        # 确定结束行（下一个订单的开始，或 Sheet 末尾）
        end = order_starts[i + 1] if i + 1 < len(order_starts) else len(df)
        
        order = parse_single_order(df, start, end, sheet_name)
        if order['customer_name']:
            orders.append(order)
    
    return orders

def analyze_excel(file_path):
    """分析 Excel 并解析所有订单"""
    print(f"\n📊 分析 Excel 文件: {file_path}\n")
    
    xl = pd.ExcelFile(file_path)
    detail_sheets = [s for s in xl.sheet_names if '详单' in s]
    
    print(f"📑 找到 {len(detail_sheets)} 个详单 Sheet\n")
    
    all_orders = []
    
    for sheet_name in detail_sheets:
        print(f"=== {sheet_name} ===")
        df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
        
        # parse_tatami_sheet 现在返回订单列表
        orders = parse_tatami_sheet(df, sheet_name)
        
        print(f"  📦 找到 {len(orders)} 个订单")
        
        for order in orders:
            all_orders.append(order)
            print(f"\n  [{len(all_orders)}] 客户: {order['customer_name']}")
            print(f"      日期: {order['date']}")
            print(f"      电话: {order['phone']}")
            print(f"      类别: {order['category']}")
            print(f"      产品明细: {len(order['items'])} 项")
            
            total = 0
            for idx, item in enumerate(order['items'][:5]):  # 只显示前5项
                name = item.get('name', '')
                name_str = f"[{name}] " if name else ""
                print(f"        {idx+1}. {name_str}{item['length']}x{item['width']}x{item['height']} "
                      f"数量:{item['quantity']:.2f} 单价:{item['unit_price']} 金额:{item['total_price']:.2f}")
                total += item['total_price']
            
            if len(order['items']) > 5:
                print(f"        ... 还有 {len(order['items']) - 5} 项")
            
            print(f"      💰 总金额: ¥{total:.2f}")
        
        if not orders:
            print(f"  ⚠️ 未找到有效订单")
        
        print()
    
    print(f"\n{'='*50}")
    print(f"✅ 共解析到 {len(all_orders)} 个有效订单")
    
    # 统计各类别订单数
    from collections import Counter
    category_counts = Counter(o['category'] for o in all_orders)
    print(f"\n📊 各类别订单统计:")
    for cat, count in category_counts.items():
        print(f"   {cat}: {count} 个")
    
    return all_orders

def import_orders(file_path, dry_run=False):
    """导入订单到数据库"""
    print(f"\n📥 导入订单...")
    print(f"   模式: {'模拟运行' if dry_run else '正式导入'}\n")
    
    # 先解析所有订单
    all_orders = analyze_excel(file_path)
    
    if dry_run:
        print("\n🔍 模拟运行完成，未写入数据库")
        return
    
    if not all_orders:
        print("❌ 没有找到有效订单")
        return
    
    conn = get_db_connection()
    cursor = conn.cursor(buffered=True)  # 使用 buffered cursor 避免 Unread result found 错误
    
    # 检测 orders 表是否有 address 列
    cursor.execute("SHOW COLUMNS FROM orders LIKE 'address'")
    has_address_col = cursor.fetchone() is not None
    
    # 检测 order_products 表是否有 unit 列
    cursor.execute("SHOW COLUMNS FROM order_products LIKE 'unit'")
    has_unit_col = cursor.fetchone() is not None
    
    print(f"📋 表结构检测: address={has_address_col}, unit={has_unit_col}")
    
    imported = 0
    errors = 0
    
    print(f"\n📝 开始写入数据库...")
    
    try:
        for order_data in all_orders:
            if not order_data['items']:
                print(f"  ⚠️ {order_data['customer_name']}: 无产品明细，跳过")
                continue
            
            try:
                # 查找或创建产品（使用类别作为产品名）
                product_name = order_data['category']
                cursor.execute("SELECT id FROM products WHERE name = %s", (product_name,))
                result = cursor.fetchone()
                
                if result:
                    product_id = result[0]
                else:
                    # 查找分类
                    cursor.execute("SELECT id FROM categories WHERE name LIKE %s", (f"%{order_data['category']}%",))
                    cat_result = cursor.fetchone()
                    category_id = cat_result[0] if cat_result else 1
                    
                    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                    cursor.execute(
                        "INSERT INTO products (category_id, name, code, created_at, updated_at) VALUES (%s, %s, %s, NOW(), NOW())",
                        (category_id, product_name, code)
                    )
                    product_id = cursor.lastrowid
                
                # 计算总金额
                total_amount = sum(item['total_price'] for item in order_data['items'])
                
                # 创建订单
                order_no = generate_order_no()
                if has_address_col:
                    cursor.execute("""
                        INSERT INTO orders 
                        (customer_name, phone, address, amount, remark, status, order_no, qr_code, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, '', NOW(), NOW())
                    """, (
                        order_data['customer_name'],
                        order_data['phone'],
                        order_data['address'],
                        total_amount,
                        order_data['remark'],
                        '待下料',
                        order_no
                    ))
                else:
                    cursor.execute("""
                        INSERT INTO orders 
                        (customer_name, phone, amount, remark, status, order_no, qr_code, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, '', NOW(), NOW())
                    """, (
                        order_data['customer_name'],
                        order_data['phone'],
                        total_amount,
                        order_data['remark'],
                        '待下料',
                        order_no
                    ))
                order_id = cursor.lastrowid
                
                # 更新二维码
                qr_code = f"ORDER-{order_id}"
                cursor.execute("UPDATE orders SET qr_code = %s WHERE id = %s", (qr_code, order_id))
                
                # 创建订单产品明细
                for item in order_data['items']:
                    if has_unit_col:
                        cursor.execute("""
                            INSERT INTO order_products
                            (order_id, product_id, length, width, height, quantity, unit, unit_price, total_price, created_at, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                        """, (
                            order_id, product_id,
                            item['length'], item['width'], item['height'],
                            int(item['quantity']) if item['quantity'] >= 1 else 1,
                            item['unit'],
                            item['unit_price'],
                            item['total_price']
                        ))
                    else:
                        cursor.execute("""
                            INSERT INTO order_products
                            (order_id, product_id, length, width, height, quantity, unit_price, total_price, created_at, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                        """, (
                            order_id, product_id,
                            item['length'], item['width'], item['height'],
                            int(item['quantity']) if item['quantity'] >= 1 else 1,
                            item['unit_price'],
                            item['total_price']
                        ))
                
                conn.commit()
                imported += 1
                print(f"  ✅ [{imported}] {order_data['customer_name']} - ¥{total_amount:.2f} ({len(order_data['items'])}项)")
                
            except Exception as e:
                errors += 1
                print(f"  ❌ {order_data['customer_name']}: {e}")
                conn.rollback()
    
    finally:
        cursor.close()
        conn.close()
    
    print(f"\n{'='*50}")
    print(f"✅ 导入完成!")
    print(f"   成功: {imported}")
    print(f"   失败: {errors}")

def main():
    parser = argparse.ArgumentParser(description='导入 Excel 订单数据')
    parser.add_argument('--file', '-f', required=True, help='Excel 文件路径')
    parser.add_argument('--analyze', '-a', action='store_true', help='分析 Excel 结构')
    parser.add_argument('--import', '-i', dest='do_import', action='store_true', help='执行导入')
    parser.add_argument('--dry-run', '-d', action='store_true', help='模拟运行')
    
    args = parser.parse_args()
    
    if args.analyze:
        analyze_excel(args.file)
    elif args.do_import:
        import_orders(args.file, dry_run=False)
    elif args.dry_run:
        import_orders(args.file, dry_run=True)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
