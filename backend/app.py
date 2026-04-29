from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import requests

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
# LOAD DATASET
# ─────────────────────────────────────────────
with open("ipc_dataset.json", "r") as f:
    ipc_data = json.load(f)

# ─────────────────────────────────────────────
# HOME ROUTE (OPTIONAL)
# ─────────────────────────────────────────────
@app.route("/")
def home():
    return "NyayaAI Backend Running "

# ─────────────────────────────────────────────
# CHAT API  
# ─────────────────────────────────────────────

@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json.get("message", "").lower()

    #HARD FILTER — expanded to cover natural-language legal queries
    legal_keywords = [
        # Core legal terms
        "ipc", "crpc", "law", "legal", "court", "police", "crime", "criminal",
        "section", "act", "rights", "contract", "murder", "cheating", "theft",
        "bail", "anticipatory bail", "arrest", "fir", "complaint", "petition",
        "advocate", "lawyer", "judge", "magistrate", "tribunal", "notice",
        "affidavit", "evidence", "warrant", "custody", "remand", "acquittal",
        "conviction", "sentence", "appeal", "high court", "supreme court",
        "sessions court", "district court", "civil", "criminal", "offence",
        "offense", "penalty", "punishment", "fine", "imprisonment",
        "property", "land", "rent", "tenant", "landlord", "agreement",
        "defamation", "harassment", "domestic violence", "dowry", "rape",
        "assault", "fraud", "forgery", "bribery", "corruption",
        "consumer", "rti", "pil", "writ", "habeas corpus", "injunction",
        "divorce", "maintenance", "custody", "alimony", "marriage",
        "negligence", "damages", "compensation", "liability", "sue",
        "file", "case", "charge", "accused", "victim", "witness",
        "how to", "what is", "can i", "my rights", "what are", "is it",
        "should i", "what happens", "explain", "tell me about", "help me"
    ]

    # SMART FILTER: block obvious off-topic queries, let the AI handle edge cases
    off_topic_keywords = [
        "recipe", "cooking", "food", "weather", "sports", "cricket", "football",
        "movie", "film", "song", "music", "joke", "game", "dating", "relationship advice",
        "stock", "share market", "crypto", "bitcoin", "investment tip",
        "programming", "python", "javascript", "code", "software"
    ]

    is_legal = any(word in user_input for word in legal_keywords)
    is_off_topic = any(word in user_input for word in off_topic_keywords)

    if is_off_topic and not is_legal:
        return jsonify({
            "response": "I can only assist with legal queries related to Indian law. Please ask me about IPC sections, your rights, legal procedures, or specific legal matters."
        })

    #DATASET MATCH (FAST RESPONSE)
    for sec in ipc_data:
        if sec["section"] in user_input or sec["title"].lower() in user_input:
            return jsonify({
                "response": f"{sec['title']}: {sec['description']}"
            })

    #AI (OLLAMA)
    prompt = f"""
    You are a legal assistant specializing ONLY in Indian law.

    Rules:
    - Answer ONLY legal questions
    - If unsure, say you are not certain
    - Be precise and formal

    Question:
    {user_input}
    """

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            }
        )

        return jsonify({
            "response": response.json().get("response", "Error generating response")
        })

    except:
        return jsonify({
            "response": "AI service not available. Please try again."
        })

# ─────────────────────────────────────────────
# DRAFT GENERATOR
# ─────────────────────────────────────────────
@app.route("/draft", methods=["POST"])
def draft():
    data = request.json

    prompt = f"""
You are a legal expert specializing ONLY in Indian law.

Generate a professional legal draft with proper structure:

Include:
- Title (e.g., LEGAL NOTICE)
- Sender & Receiver details
- Subject line
- Formal legal language
- Clear demand or purpose
- Closing

Details:
Sender: {data.get('sender')}
Receiver: {data.get('receiver')}
Subject: {data.get('subject')}
Content: {data.get('details')}
"""

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            }
        )

        return jsonify({
            "draft": response.json().get("response", "Error generating draft")
        })

    except:
        return jsonify({
            "draft": "AI service not available. Please start Ollama."
        })

@app.route("/analyze", methods=["POST"])
def analyze():
    text = request.json.get("text", "")
    is_scanned = request.json.get("isScanned", False)

    #block non-legal docs
    if len(text.strip()) < 20:
        return jsonify({
            "analysis": "Please provide a valid legal document."
        })

    scanned_note = """
IMPORTANT: This text was extracted via OCR from a scanned or photographed document.
The text may contain OCR errors, garbled words, or missing characters.
You MUST work with what is provided — do NOT say the text is unreadable or that you cannot analyze it.
Infer meaning from context even if individual words are garbled. Focus on extracting maximum useful legal information.
""" if is_scanned else ""

    prompt = f"""
You are a senior legal assistant specializing in Indian law with expertise in document analysis.

{scanned_note}

Analyze the following document thoroughly and provide a detailed structured report with:

1. Summary
   - What type of document is this (agreement, notice, petition, order, FIR, etc.)
   - Who are the parties involved
   - What is the core subject matter
   - Date and jurisdiction if mentioned

2. Key Legal Risks
   - Identify specific risks for each party
   - Flag any legally problematic or ambiguous clauses
   - Note any missing standard protections

3. Important Clauses
   - List and explain each significant clause
   - Highlight obligations, rights, penalties, and timelines

4. Applicable Indian Laws
   - Which IPC sections, acts, or legal provisions are relevant
   - Any compliance requirements

5. Recommendations
   - What should each party be cautious about
   - Suggested modifications or precautions

Be specific, cite exact terms from the document where possible, and be thorough.

Document:
{text}
"""

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            }
        )

        return jsonify({
            "analysis": response.json().get("response", "Error analyzing document")
        })

    except:
        return jsonify({
            "analysis": "AI service not available. Please start Ollama."
        })

# ─────────────────────────────────────────────
# RUN SERVER
# ─────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)