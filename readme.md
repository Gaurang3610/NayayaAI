# NyayaAI — AI-Powered Legal Assistant for Indian Law

> Understand your rights. Generate legal documents. Analyze contracts.  
> All powered by AI, built for every Indian citizen.

---

## What is NyayaAI?

NyayaAI is a locally-run legal intelligence platform focused exclusively on Indian law. It combines a curated IPC dataset with a locally hosted LLM (via Ollama) to give users instant, structured legal guidance — without sending data to any third-party server.

It is not a substitute for a lawyer. It is a tool to help people understand the law before they walk into a lawyer's office.

---

## Features

### Legal Chat
Ask any question about Indian law in plain language. The assistant filters off-topic queries and responds using either the built-in IPC dataset (for fast, accurate section lookups) or the local LLM for broader legal reasoning.

### Draft Generator
Generate professionally formatted legal documents in a guided 3-step flow. Supported document types:
- Legal Notice
- FIR Complaint
- Bail Application
- Affidavit
- RTI Application
- Rent Agreement
- Consumer Complaint
- Divorce Petition

### Document Analyzer
Upload a legal document (PDF, DOCX, DOC, TXT) and get an AI-generated analysis covering a short summary, key legal risks, and important clauses. Uses mammoth.js for proper DOCX text extraction.

### IPC Sections Explorer
Search the Indian Penal Code by section number or keyword. Each result includes the section title, description, punishment, bailable/cognizable status, an illustrative example, and rights of the accused or victim.

### Chat History
All conversations are stored locally in the browser. No data leaves your device.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Python, Flask, Flask-CORS |
| AI Model | Llama 3 via Ollama (local) |
| Document Parsing | mammoth.js (DOCX extraction) |
| Auth & Storage | localStorage (client-side only) |
| Dataset | Custom IPC JSON dataset |

---

## Getting Started

### Prerequisites
- Python 3.8+
- [Ollama](https://ollama.com) installed and running
- Llama 3 model pulled

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/NyayaAI.git
cd NyayaAI
```

### 2. Install Python dependencies
```bash
pip install flask flask-cors requests
```

### 3. Pull the Llama 3 model
```bash
ollama pull llama3
```

### 4. Start Ollama
```bash
ollama serve
```

### 5. Start the Flask backend
```bash
python app.py
```

### 6. Open the frontend
Open `index.html` in your browser. No build step required.

---

## Project Structure

```
NyayaAI/
├── index.html          # Main app (chat, draft, analyzer, IPC explorer)
├── login.html          # Login page
├── register.html       # Registration page
├── style.css           # All styles
├── script.js           # Frontend logic
├── app.py              # Flask backend (chat, draft, analyze endpoints)
├── ipc_dataset.json    # IPC sections dataset
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/chat` | Send a legal query, receive an AI response |
| POST | `/draft` | Generate a legal document draft |
| POST | `/analyze` | Analyze an uploaded legal document |

---

## Important Disclaimer

NyayaAI provides general legal information based on Indian law for educational purposes only. It does not constitute legal advice. Always consult a qualified advocate for your specific situation.

---
