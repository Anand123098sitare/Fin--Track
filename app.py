from flask import Flask, render_template, request, redirect, url_for, jsonify
import sqlite3
import os
from datetime import datetime, date
from collections import defaultdict
import calendar

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SESSION_SECRET', 'dev-secret-key')

DATABASE = 'finance.db'

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

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)