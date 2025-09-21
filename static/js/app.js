// FinTrack JavaScript Application

// Global variables for charts
let monthlyChart = null;
let categoryChart = null;

// Category options based on transaction type
const categories = {
    income: [
        'Salary', 'Freelance', 'Business', 'Investments', 
        'Rental Income', 'Gifts', 'Other Income'
    ],
    expense: [
        'Food & Dining', 'Shopping', 'Transportation', 'Bills & Utilities',
        'Entertainment', 'Healthcare', 'Travel', 'Education',
        'Groceries', 'Rent/Mortgage', 'Insurance', 'Other Expenses'
    ]
};

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname;
    
    if (currentPage === '/' || currentPage.includes('index')) {
        initializeDashboard();
    } else if (currentPage.includes('add')) {
        initializeAddTransaction();
    }
});

// Dashboard Functions
function initializeDashboard() {
    loadSummaryData();
    loadTransactions();
    loadCharts();
}

function loadSummaryData(startDate = '', endDate = '') {
    let url = '/api/summary';
    if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            updateSummaryCards(data);
        })
        .catch(error => {
            console.error('Error loading summary data:', error);
        });
}

function updateSummaryCards(data) {
    const totalIncomeEl = document.getElementById('total-income');
    const totalExpenseEl = document.getElementById('total-expense');
    const balanceEl = document.getElementById('balance');
    const balanceCard = document.getElementById('balance-card');
    
    if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(data.total_income);
    if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(data.total_expense);
    if (balanceEl) balanceEl.textContent = formatCurrency(data.balance);
    
    // Update balance card color based on positive/negative balance
    if (balanceCard) {
        balanceCard.className = 'card text-white';
        if (data.balance >= 0) {
            balanceCard.classList.add('bg-success');
        } else {
            balanceCard.classList.add('bg-danger');
        }
    }
}

function loadTransactions(startDate = '', endDate = '') {
    let url = '/api/transactions';
    if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            displayTransactions(data);
        })
        .catch(error => {
            console.error('Error loading transactions:', error);
        });
}

function displayTransactions(transactions) {
    const tbody = document.getElementById('transactions-table');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No transactions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${formatDate(transaction.date)}</td>
            <td>${transaction.category}</td>
            <td>
                <span class="badge badge-${transaction.type}">
                    ${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                </span>
            </td>
            <td class="${transaction.type === 'income' ? 'text-success' : 'text-danger'}">
                ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
            </td>
            <td>${transaction.notes || '-'}</td>
        </tr>
    `).join('');
}

function loadCharts() {
    loadMonthlyChart();
    loadCategoryChart();
}

function loadMonthlyChart() {
    fetch('/api/monthly-data')
        .then(response => response.json())
        .then(data => {
            createMonthlyChart(data);
        })
        .catch(error => {
            console.error('Error loading monthly chart data:', error);
        });
}

function createMonthlyChart(data) {
    const ctx = document.getElementById('monthly-chart');
    if (!ctx) return;
    
    if (monthlyChart) {
        monthlyChart.destroy();
    }
    
    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Income',
                data: data.income,
                backgroundColor: '#198754',
                borderColor: '#146c43',
                borderWidth: 1
            }, {
                label: 'Expenses',
                data: data.expenses,
                backgroundColor: '#dc3545',
                borderColor: '#b02a37',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                },
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

function loadCategoryChart(startDate = '', endDate = '') {
    let url = '/api/category-data';
    if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            createCategoryChart(data);
        })
        .catch(error => {
            console.error('Error loading category chart data:', error);
        });
}

function createCategoryChart(data) {
    const ctx = document.getElementById('category-chart');
    if (!ctx) return;
    
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    if (data.labels.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }
    
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#36A2EB'
    ];
    
    categoryChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: colors.slice(0, data.labels.length),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return context.label + ': $' + context.parsed.toFixed(2) + ' (' + percentage + '%)';
                        }
                    }
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Date filter function
function applyDateFilter() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    if (startDate && endDate) {
        loadSummaryData(startDate, endDate);
        loadTransactions(startDate, endDate);
        loadCategoryChart(startDate, endDate);
    } else {
        alert('Please select both start and end dates');
    }
}

// Add Transaction Page Functions
function initializeAddTransaction() {
    const typeSelect = document.getElementById('type');
    const form = document.getElementById('transaction-form');
    
    if (typeSelect) {
        typeSelect.addEventListener('change', updateCategoryOptions);
    }
    
    if (form) {
        form.addEventListener('submit', handleTransactionSubmit);
    }
}

function updateCategoryOptions() {
    const typeSelect = document.getElementById('type');
    const categorySelect = document.getElementById('category');
    
    if (!typeSelect || !categorySelect) return;
    
    const selectedType = typeSelect.value;
    categorySelect.innerHTML = '<option value="">Select category...</option>';
    
    if (selectedType && categories[selectedType]) {
        categories[selectedType].forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }
}

function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const transactionData = {
        amount: parseFloat(formData.get('amount')),
        type: formData.get('type'),
        category: formData.get('category'),
        date: formData.get('date'),
        notes: formData.get('notes') || ''
    };
    
    // Validate data
    if (!transactionData.amount || !transactionData.type || !transactionData.category || !transactionData.date) {
        showErrorToast('Please fill in all required fields');
        return;
    }
    
    // Submit transaction
    fetch('/api/transactions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(transactionData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccessToast();
            e.target.reset();
            // Set today's date again
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('date').value = today;
            // Clear category options
            document.getElementById('category').innerHTML = '<option value="">Select category...</option>';
        } else {
            showErrorToast(data.message || 'Error adding transaction');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showErrorToast('Error adding transaction');
    });
}

// Toast notification functions
function showSuccessToast() {
    const toast = new bootstrap.Toast(document.getElementById('success-toast'));
    toast.show();
}

function showErrorToast(message) {
    const errorMessageEl = document.getElementById('error-message');
    if (errorMessageEl) {
        errorMessageEl.textContent = message;
    }
    const toast = new bootstrap.Toast(document.getElementById('error-toast'));
    toast.show();
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}