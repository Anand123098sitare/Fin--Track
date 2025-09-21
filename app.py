from flask import Flask, render_template, request, redirect, url_for, jsonify, make_response
import sqlite3
import os
from datetime import datetime, date
from collections import defaultdict
import calendar
import csv
import io

# Get the directory of the current script for absolute paths
basedir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__, 
            template_folder=os.path.join(basedir, 'templates'),
            static_folder=os.path.join(basedir, 'static'))

# Configuration from environment variables
app.config['SECRET_KEY'] = os.environ.get('SESSION_SECRET', 'dev-secret-key')
app.config['APP_NAME'] = os.environ.get('APP_NAME', 'FinTrack')
app.config['APP_VERSION'] = os.environ.get('APP_VERSION', '1.0.0')

# Database configuration
DATABASE = os.environ.get('DATABASE_PATH', os.path.join(basedir, 'finance.db'))
if not os.path.isabs(DATABASE):
    DATABASE = os.path.join(basedir, DATABASE)

def init_db():
    """Initialize the SQLite database"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
            date TEXT NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
            is_custom INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insert default categories if they don't exist
    default_income_categories = [
        'Salary', 'Freelance', 'Business', 'Investments', 
        'Rental Income', 'Gifts', 'Other Income'
    ]
    default_expense_categories = [
        'Food & Dining', 'Shopping', 'Transportation', 'Bills & Utilities',
        'Entertainment', 'Healthcare', 'Travel', 'Education',
        'Groceries', 'Rent/Mortgage', 'Insurance', 'Other Expenses'
    ]
    
    for category in default_income_categories:
        cursor.execute('''
            INSERT OR IGNORE INTO categories (name, type, is_custom)
            VALUES (?, 'income', 0)
        ''', (category,))
    
    for category in default_expense_categories:
        cursor.execute('''
            INSERT OR IGNORE INTO categories (name, type, is_custom)
            VALUES (?, 'expense', 0)
        ''', (category,))
    
    conn.commit()
    conn.close()

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def dashboard():
    """Main dashboard page"""
    return render_template('index.html')

@app.route('/add')
def add_transaction_page():
    """Add transaction page"""
    return render_template('add.html')

@app.route('/categories')
def categories_page():
    """Categories management page"""
    return render_template('categories.html')

@app.route('/api/transactions', methods=['GET', 'POST'])
def transactions_api():
    """API endpoint for transactions"""
    if request.method == 'POST':
        # Add new transaction
        data = request.get_json()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO transactions (amount, category, type, date, notes)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            float(data['amount']),
            data['category'],
            data['type'],
            data['date'],
            data.get('notes', '')
        ))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Transaction added successfully'})
    
    else:
        # Get transactions with optional date filtering
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        conn = get_db_connection()
        query = 'SELECT * FROM transactions'
        params = []
        
        if start_date and end_date:
            query += ' WHERE date BETWEEN ? AND ?'
            params = [start_date, end_date]
        
        query += ' ORDER BY date DESC'
        
        transactions = conn.execute(query, params).fetchall()
        conn.close()
        
        # Convert to list of dictionaries
        transactions_list = []
        for transaction in transactions:
            transactions_list.append({
                'id': transaction['id'],
                'amount': transaction['amount'],
                'category': transaction['category'],
                'type': transaction['type'],
                'date': transaction['date'],
                'notes': transaction['notes'],
                'created_at': transaction['created_at']
            })
        
        return jsonify(transactions_list)

@app.route('/api/transactions/<int:transaction_id>', methods=['GET', 'PUT', 'DELETE'])
def transaction_detail_api(transaction_id):
    """API endpoint for individual transaction operations"""
    conn = get_db_connection()
    
    if request.method == 'GET':
        # Get single transaction
        transaction = conn.execute(
            'SELECT * FROM transactions WHERE id = ?', 
            (transaction_id,)
        ).fetchone()
        conn.close()
        
        if transaction:
            return jsonify({
                'id': transaction['id'],
                'amount': transaction['amount'],
                'category': transaction['category'],
                'type': transaction['type'],
                'date': transaction['date'],
                'notes': transaction['notes'],
                'created_at': transaction['created_at']
            })
        else:
            return jsonify({'error': 'Transaction not found'}), 404
    
    elif request.method == 'PUT':
        # Update transaction
        data = request.get_json()
        
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE transactions 
            SET amount = ?, category = ?, type = ?, date = ?, notes = ?
            WHERE id = ?
        ''', (
            float(data['amount']),
            data['category'],
            data['type'],
            data['date'],
            data.get('notes', ''),
            transaction_id
        ))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Transaction not found'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Transaction updated successfully'})
    
    elif request.method == 'DELETE':
        # Delete transaction
        cursor = conn.cursor()
        cursor.execute('DELETE FROM transactions WHERE id = ?', (transaction_id,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Transaction not found'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Transaction deleted successfully'})

@app.route('/api/summary')
def summary_api():
    """API endpoint for financial summary"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    conn = get_db_connection()
    query = 'SELECT type, amount FROM transactions'
    params = []
    
    if start_date and end_date:
        query += ' WHERE date BETWEEN ? AND ?'
        params = [start_date, end_date]
    
    transactions = conn.execute(query, params).fetchall()
    conn.close()
    
    total_income = sum(t['amount'] for t in transactions if t['type'] == 'income')
    total_expense = sum(t['amount'] for t in transactions if t['type'] == 'expense')
    balance = total_income - total_expense
    
    return jsonify({
        'total_income': total_income,
        'total_expense': total_expense,
        'balance': balance
    })

@app.route('/api/monthly-data')
def monthly_data_api():
    """API endpoint for monthly income vs expense data"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    conn = get_db_connection()
    query = 'SELECT type, amount, date FROM transactions'
    params = []
    
    if start_date and end_date:
        query += ' WHERE date BETWEEN ? AND ?'
        params = [start_date, end_date]
    
    query += ' ORDER BY date'
    
    transactions = conn.execute(query, params).fetchall()
    conn.close()
    
    monthly_data = defaultdict(lambda: {'income': 0, 'expense': 0})
    
    for transaction in transactions:
        transaction_date = datetime.strptime(transaction['date'], '%Y-%m-%d')
        month_key = transaction_date.strftime('%Y-%m')
        monthly_data[month_key][transaction['type']] += transaction['amount']
    
    # Convert to format suitable for Chart.js
    months = sorted(monthly_data.keys())
    income_data = [monthly_data[month]['income'] for month in months]
    expense_data = [monthly_data[month]['expense'] for month in months]
    
    # Format month labels
    month_labels = []
    for month in months:
        date_obj = datetime.strptime(month, '%Y-%m')
        month_labels.append(date_obj.strftime('%b %Y'))
    
    return jsonify({
        'labels': month_labels,
        'income': income_data,
        'expenses': expense_data
    })

@app.route('/api/category-data')
def category_data_api():
    """API endpoint for expense distribution by category"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    conn = get_db_connection()
    query = 'SELECT category, SUM(amount) as total FROM transactions WHERE type = "expense"'
    params = []
    
    if start_date and end_date:
        query += ' AND date BETWEEN ? AND ?'
        params = [start_date, end_date]
    
    query += ' GROUP BY category'
    
    categories = conn.execute(query, params).fetchall()
    conn.close()
    
    labels = [cat['category'] for cat in categories]
    data = [cat['total'] for cat in categories]
    
    return jsonify({
        'labels': labels,
        'data': data
    })

@app.route('/api/categories', methods=['GET', 'POST'])
def categories_api():
    """API endpoint for categories management"""
    conn = get_db_connection()
    
    if request.method == 'POST':
        # Add new custom category
        data = request.get_json()
        
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO categories (name, type, is_custom)
                VALUES (?, ?, 1)
            ''', (data['name'], data['type']))
            conn.commit()
            conn.close()
            return jsonify({'success': True, 'message': 'Category added successfully'})
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'error': 'Category already exists'}), 400
    
    else:
        # Get all categories
        category_type = request.args.get('type')  # 'income' or 'expense'
        query = 'SELECT * FROM categories'
        params = []
        
        if category_type:
            query += ' WHERE type = ?'
            params = [category_type]
        
        query += ' ORDER BY name'
        
        categories = conn.execute(query, params).fetchall()
        conn.close()
        
        categories_list = []
        for category in categories:
            categories_list.append({
                'id': category['id'],
                'name': category['name'],
                'type': category['type'],
                'is_custom': category['is_custom'],
                'created_at': category['created_at']
            })
        
        return jsonify(categories_list)

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
def delete_category_api(category_id):
    """API endpoint to delete custom category"""
    conn = get_db_connection()
    
    # Check if category is custom (can only delete custom categories)
    category = conn.execute(
        'SELECT * FROM categories WHERE id = ? AND is_custom = 1',
        (category_id,)
    ).fetchone()
    
    if not category:
        conn.close()
        return jsonify({'error': 'Category not found or cannot be deleted'}), 404
    
    # Check if category is being used in transactions
    usage_count = conn.execute(
        'SELECT COUNT(*) as count FROM transactions WHERE category = ?',
        (category['name'],)
    ).fetchone()['count']
    
    if usage_count > 0:
        conn.close()
        return jsonify({'error': f'Cannot delete category. It is used in {usage_count} transactions.'}), 400
    
    # Delete the category
    cursor = conn.cursor()
    cursor.execute('DELETE FROM categories WHERE id = ?', (category_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Category deleted successfully'})

@app.route('/api/export/csv')
def export_csv():
    """Export transactions to CSV"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    conn = get_db_connection()
    query = '''
        SELECT id, amount, category, type, date, notes, created_at
        FROM transactions
    '''
    params = []
    
    if start_date and end_date:
        query += ' WHERE date BETWEEN ? AND ?'
        params = [start_date, end_date]
    
    query += ' ORDER BY date DESC'
    
    transactions = conn.execute(query, params).fetchall()
    conn.close()
    
    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write headers
    writer.writerow(['ID', 'Amount', 'Category', 'Type', 'Date', 'Notes', 'Created At'])
    
    # Write data with formula injection protection
    for transaction in transactions:
        # Protect against formula injection by prefixing dangerous characters
        notes = transaction['notes'] or ''
        if notes and notes[0] in ['=', '+', '-', '@']:
            notes = "'" + notes  # Prefix with apostrophe to neutralize formulas
            
        category = transaction['category']
        if category and category[0] in ['=', '+', '-', '@']:
            category = "'" + category
        
        writer.writerow([
            transaction['id'],
            transaction['amount'],
            category,
            transaction['type'],
            transaction['date'],
            notes,
            transaction['created_at']
        ])
    
    # Create response
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    
    # Generate filename with date range if provided
    if start_date and end_date:
        filename = f'fintrack_transactions_{start_date}_to_{end_date}.csv'
    else:
        filename = f'fintrack_transactions_{datetime.now().strftime("%Y-%m-%d")}.csv'
    
    response.headers['Content-Disposition'] = f'attachment; filename={filename}'
    
    return response

@app.route('/api/import/csv', methods=['POST'])
def import_csv():
    """Import transactions from CSV"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if not file.filename or file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.lower().endswith('.csv'):
        return jsonify({'error': 'File must be a CSV'}), 400
    
    try:
        # Read CSV content
        content = file.read().decode('utf-8')
        csv_data = csv.DictReader(io.StringIO(content))
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        imported_count = 0
        skipped_count = 0
        
        for row in csv_data:
            try:
                # Validate required fields
                if not all([row.get('Amount'), row.get('Category'), row.get('Type'), row.get('Date')]):
                    skipped_count += 1
                    continue
                
                # Validate amount
                try:
                    amount = float(row['Amount'])
                except (ValueError, TypeError):
                    skipped_count += 1
                    continue
                
                # Validate type
                if row['Type'].lower() not in ['income', 'expense']:
                    skipped_count += 1
                    continue
                
                # Validate date format
                try:
                    datetime.strptime(row['Date'], '%Y-%m-%d')
                except ValueError:
                    skipped_count += 1
                    continue
                
                # Insert transaction (skip if ID already exists)
                cursor.execute('''
                    INSERT INTO transactions (amount, category, type, date, notes)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    amount,
                    row['Category'],
                    row['Type'].lower(),
                    row['Date'],
                    row.get('Notes', '')
                ))
                imported_count += 1
                
            except Exception as e:
                print(f"Error importing row: {e}")
                skipped_count += 1
                continue
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Import completed. {imported_count} transactions imported, {skipped_count} skipped.',
            'imported': imported_count,
            'skipped': skipped_count
        })
    
    except Exception as e:
        return jsonify({'error': f'Error processing file: {str(e)}'}), 400

if __name__ == '__main__':
    init_db()
    
    # Get Flask configuration from environment variables
    flask_host = os.environ.get('FLASK_HOST', '0.0.0.0')
    flask_port = int(os.environ.get('FLASK_PORT', 5000))
    flask_debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    app.run(host=flask_host, port=flask_port, debug=flask_debug)