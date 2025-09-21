// FinTrack JavaScript Application

// Global variables for charts
let monthlyChart = null;
let categoryChart = null;

// Category options loaded from database
let categories = {
    income: [],
    expense: []
};

// Load categories from API
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const data = await response.json();
        categories.income = data.filter(cat => cat.type === 'income').map(cat => cat.name);
        categories.expense = data.filter(cat => cat.type === 'expense').map(cat => cat.name);
        return categories;
    } catch (error) {
        console.error('Error loading categories:', error);
        // Fallback to default categories if API fails
        categories = {
            income: ['Salary', 'Freelance', 'Business', 'Investments', 'Rental Income', 'Gifts', 'Other Income'],
            expense: ['Food & Dining', 'Shopping', 'Transportation', 'Bills & Utilities', 'Entertainment', 'Healthcare', 'Travel', 'Education', 'Groceries', 'Rent/Mortgage', 'Insurance', 'Other Expenses']
        };
        return categories;
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', async function() {
    const currentPage = window.location.pathname;
    
    // Initialize theme
    initializeTheme();
    
    // Load categories first and wait for completion
    await loadCategories();
    
    if (currentPage === '/' || currentPage.includes('index')) {
        initializeDashboard();
        initializeEditModal();
    } else if (currentPage.includes('add')) {
        initializeAddTransaction();
    } else if (currentPage.includes('categories')) {
        initializeCategoriesPage();
    }
});

// Initialize edit modal functionality
function initializeEditModal() {
    const editTypeSelect = document.getElementById('edit-type');
    const editForm = document.getElementById('edit-transaction-form');
    
    if (editTypeSelect) {
        editTypeSelect.addEventListener('change', function() {
            updateEditCategoryOptions(this.value, '');
        });
    }
    
    if (editForm) {
        editForm.addEventListener('submit', handleEditTransactionSubmit);
    }
}

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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No transactions found</td></tr>';
        return;
    }
    
    // Clear existing content
    tbody.innerHTML = '';
    
    // Create rows safely using DOM APIs
    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        
        // Date column
        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(transaction.date);
        row.appendChild(dateCell);
        
        // Category column (safe text content)
        const categoryCell = document.createElement('td');
        categoryCell.textContent = transaction.category;
        row.appendChild(categoryCell);
        
        // Type column
        const typeCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = `badge badge-${transaction.type}`;
        badge.textContent = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);
        typeCell.appendChild(badge);
        row.appendChild(typeCell);
        
        // Amount column
        const amountCell = document.createElement('td');
        amountCell.className = transaction.type === 'income' ? 'text-success' : 'text-danger';
        amountCell.textContent = `${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}`;
        row.appendChild(amountCell);
        
        // Notes column (safe text content)
        const notesCell = document.createElement('td');
        notesCell.textContent = transaction.notes || '-';
        row.appendChild(notesCell);
        
        // Actions column
        const actionsCell = document.createElement('td');
        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group';
        btnGroup.setAttribute('role', 'group');
        
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-sm btn-outline-primary';
        editBtn.onclick = () => editTransaction(transaction.id);
        editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
        btnGroup.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-sm btn-outline-danger';
        deleteBtn.onclick = () => deleteTransaction(transaction.id);
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        btnGroup.appendChild(deleteBtn);
        
        actionsCell.appendChild(btnGroup);
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
    });
}

function loadCharts() {
    loadMonthlyChart();
    loadCategoryChart();
}

function loadMonthlyChart(startDate = '', endDate = '') {
    let url = '/api/monthly-data';
    if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    
    fetch(url)
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
    
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const textColor = currentTheme === 'dark' ? '#f8f9fa' : '#212529';
    const gridColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
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
            aspectRatio: 2,
            layout: {
                padding: {
                    top: 10,
                    bottom: 10
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: gridColor
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    grid: {
                        color: gridColor
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
                    position: 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        color: textColor
                    }
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
    
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const textColor = currentTheme === 'dark' ? '#f8f9fa' : '#212529';
    const borderColor = currentTheme === 'dark' ? '#343a40' : '#ffffff';
    
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
                borderColor: borderColor,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1,
            layout: {
                padding: {
                    top: 10,
                    bottom: 10
                }
            },
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
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        color: textColor,
                        font: {
                            size: 11
                        }
                    }
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
        loadMonthlyChart(startDate, endDate);
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

// Edit Transaction Functions
function editTransaction(transactionId) {
    // Fetch transaction details
    fetch(`/api/transactions/${transactionId}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showErrorToast(data.error);
                return;
            }
            
            // Populate edit form
            document.getElementById('edit-transaction-id').value = data.id;
            document.getElementById('edit-amount').value = data.amount;
            document.getElementById('edit-type').value = data.type;
            document.getElementById('edit-date').value = data.date;
            document.getElementById('edit-notes').value = data.notes || '';
            
            // Update category options based on type
            updateEditCategoryOptions(data.type, data.category);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('editTransactionModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error fetching transaction:', error);
            showErrorToast('Error loading transaction details');
        });
}

function updateEditCategoryOptions(selectedType, selectedCategory) {
    const categorySelect = document.getElementById('edit-category');
    categorySelect.innerHTML = '<option value="">Select category...</option>';
    
    if (selectedType && categories[selectedType]) {
        categories[selectedType].forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            if (category === selectedCategory) {
                option.selected = true;
            }
            categorySelect.appendChild(option);
        });
    }
}

// Delete Transaction Functions
function deleteTransaction(transactionId) {
    // Fetch transaction details for confirmation
    fetch(`/api/transactions/${transactionId}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showErrorToast(data.error);
                return;
            }
            
            // Show transaction details in delete modal
            const detailsDiv = document.getElementById('delete-transaction-details');
            detailsDiv.innerHTML = `
                <strong>Date:</strong> ${formatDate(data.date)}<br>
                <strong>Category:</strong> ${data.category}<br>
                <strong>Type:</strong> ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}<br>
                <strong>Amount:</strong> ${formatCurrency(data.amount)}<br>
                <strong>Notes:</strong> ${data.notes || 'None'}
            `;
            
            // Set up delete confirmation
            const confirmBtn = document.getElementById('confirm-delete-btn');
            confirmBtn.onclick = () => confirmDeleteTransaction(transactionId);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('deleteTransactionModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error fetching transaction:', error);
            showErrorToast('Error loading transaction details');
        });
}

function confirmDeleteTransaction(transactionId) {
    fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccessToast('Transaction deleted successfully');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteTransactionModal'));
            modal.hide();
            
            // Refresh dashboard data
            refreshDashboardData();
        } else {
            showErrorToast(data.error || 'Error deleting transaction');
        }
    })
    .catch(error => {
        console.error('Error deleting transaction:', error);
        showErrorToast('Error deleting transaction');
    });
}

// Handle edit transaction form submission
function handleEditTransactionSubmit(e) {
    e.preventDefault();
    
    const transactionId = document.getElementById('edit-transaction-id').value;
    const transactionData = {
        amount: parseFloat(document.getElementById('edit-amount').value),
        type: document.getElementById('edit-type').value,
        category: document.getElementById('edit-category').value,
        date: document.getElementById('edit-date').value,
        notes: document.getElementById('edit-notes').value || ''
    };
    
    // Validate data
    if (!transactionData.amount || !transactionData.type || !transactionData.category || !transactionData.date) {
        showErrorToast('Please fill in all required fields');
        return;
    }
    
    // Submit updated transaction
    fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(transactionData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccessToast('Transaction updated successfully');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editTransactionModal'));
            modal.hide();
            
            // Refresh dashboard data
            refreshDashboardData();
        } else {
            showErrorToast(data.error || 'Error updating transaction');
        }
    })
    .catch(error => {
        console.error('Error updating transaction:', error);
        showErrorToast('Error updating transaction');
    });
}

// Refresh all dashboard data
function refreshDashboardData() {
    loadSummaryData();
    loadTransactions();
    loadCharts();
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
function showSuccessToast(message = 'Operation completed successfully!') {
    const successMessageEl = document.getElementById('success-message');
    if (successMessageEl) {
        successMessageEl.textContent = message;
    }
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

// Theme Management Functions
function initializeTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    // Apply saved theme
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    // Add event listener for theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Listen for theme changes to update charts
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                // Re-render charts when theme changes
                if (monthlyChart || categoryChart) {
                    setTimeout(() => loadCharts(), 100); // Small delay to ensure theme CSS has applied
                }
            }
        });
    });
    
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'bi bi-sun-fill';
            themeToggle.title = 'Switch to light mode';
        } else {
            icon.className = 'bi bi-moon-fill';
            themeToggle.title = 'Switch to dark mode';
        }
    }
}

// CSV Import/Export Functions
function exportCSV() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    let url = '/api/export/csv';
    if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
    }
    
    // Create invisible link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccessToast('CSV export started. Check your downloads folder.');
}

function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Show loading state
    const importBtn = document.querySelector('button[onclick*="csv-import"]');
    const originalText = importBtn.innerHTML;
    importBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Importing...';
    importBtn.disabled = true;
    
    fetch('/api/import/csv', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccessToast(data.message);
            refreshDashboardData(); // Reload all data
        } else {
            showErrorToast(data.error || 'Error importing CSV file');
        }
    })
    .catch(error => {
        console.error('Error importing CSV:', error);
        showErrorToast('Error importing CSV file');
    })
    .finally(() => {
        // Reset button state
        importBtn.innerHTML = originalText;
        importBtn.disabled = false;
        
        // Reset file input
        event.target.value = '';
    });
}