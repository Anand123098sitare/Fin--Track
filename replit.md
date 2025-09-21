# FinTrack - Personal Finance Tracker

## Overview
FinTrack is a personal finance tracking web application built with Flask (Python) backend and modern web technologies. It allows users to track income and expenses with comprehensive visualization and filtering capabilities.

## Recent Changes
- **2025-09-21**: Created complete FinTrack application with Flask backend, SQLite database, HTML/CSS/JavaScript frontend, and Chart.js visualizations

## Project Architecture

### Backend (Flask)
- **app.py**: Main Flask application with API endpoints
  - SQLite database integration
  - Transaction CRUD operations
  - Summary and analytics API endpoints
  - Monthly and category-based data aggregation

### Database Schema (SQLite)
- **transactions table**: 
  - id (PRIMARY KEY)
  - amount (REAL)
  - category (TEXT)
  - type (TEXT: 'income' or 'expense')
  - date (TEXT: YYYY-MM-DD format)
  - notes (TEXT, optional)
  - created_at (TIMESTAMP)

### Frontend Structure
- **templates/**:
  - base.html: Base template with Bootstrap and Chart.js
  - index.html: Dashboard with summary cards, charts, and transaction list
  - add.html: Transaction entry form

- **static/**:
  - css/style.css: Custom styling with Bootstrap enhancements
  - js/app.js: JavaScript for dashboard functionality and Chart.js integration

## Features
- ✅ Add income/expense transactions with categorization
- ✅ SQLite database storage
- ✅ Dashboard with financial summary cards
- ✅ Bar chart for monthly income vs expenses
- ✅ Pie chart for expense category distribution
- ✅ Date range filtering
- ✅ Responsive Bootstrap UI
- ✅ Real-time data updates

## Tech Stack
- **Backend**: Flask (Python), SQLite
- **Frontend**: HTML5, CSS3, JavaScript (ES6)
- **UI Framework**: Bootstrap 5
- **Charts**: Chart.js
- **Icons**: Bootstrap Icons

## Current State
The application is fully functional with a running Flask development server on port 5000. All core features are implemented and tested.