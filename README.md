# BigQuery Release Notes Hub 🚀

A premium web dashboard to browse, search, filter, and share Google Cloud BigQuery release updates. 

This project consists of a Python Flask backend serving a rich, glassmorphic client-side interface built with vanilla HTML5, CSS3, and JavaScript.

---

## ✨ Features

- **Live Fetching**: Re-fetches the official GCP BigQuery Release Notes Atom Feed dynamically.
- **Granular Updates Decomposition**: Splits combined daily release lists into individual interactive update cards.
- **Type Filtering**: Filter updates by their categorization: `Feature`, `Announcement`, `Change`, `Issue`, or `Breaking`.
- **Real-Time Search**: Filter cards instantly on titles, contents, and types.
- **One-Click Share to X (Twitter)**: Selecting any card formats it into a cropped, hash-tagged X post preview and triggers a Web Intent share window.
- **Micro-Animations**: Smooth scale hover transitions, gradient border selections, and active spinning status indicators.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.11, Flask, Requests, XML ElementTree
- **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphism styling), Vanilla JavaScript
- **Icons**: FontAwesome 6

---

## 📂 Project Structure

```text
├── static/
│   ├── script.js        # Frontend interactions, parsing, and share logic
│   └── style.css         # Custom theme stylesheets and animations
├── templates/
│   └── index.html       # Landing page HTML skeleton
├── app.py               # Flask application server
├── .gitignore           # Git ignore configurations
└── README.md            # Project documentation (this file)
```

---

## 🚀 How to Run Locally

This application is built to run on a self-contained portable Python environment or a system-wide Python installation.

### Option A: Using the Portable Python Environment
If you are running the codebase on the original workspace containing `python-embed/`:
1. Run the Flask application server:
   ```bash
   .\python-embed\python.exe app.py
   ```
2. Open your browser and navigate to:
   ```text
   http://127.0.0.1:5001
   ```

### Option B: Using System-Wide Python
If you cloned this repository and want to run it with your own Python environment:
1. Ensure Python 3.9+ is installed on your system.
2. Install the dependencies:
   ```bash
   pip install flask requests
   ```
3. Run the application:
   ```bash
   python app.py
   ```
4. Open your browser and go to:
   ```text
   http://127.0.0.1:5001
   ```
