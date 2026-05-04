# ⬡ PolkadotCopilot

> AI Developer Assistant for the Polkadot Ecosystem — built to accelerate developer onboarding and reduce friction in the Polkadot ecosystem.

🔴 **Live Demo:** [polkadot-copilot.vercel.app](https://polkadot-copilot.vercel.app)

![PolkadotCopilot](https://img.shields.io/badge/Polkadot-AI%20Copilot-E6007A?style=for-the-badge&logo=polkadot)
![TypeScript](https://img.shields.io/badge/TypeScript-React-3178C6?style=for-the-badge&logo=typescript)
![Python](https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge&logo=fastapi)

## 🧠 What is PolkadotCopilot?

PolkadotCopilot is an AI-powered developer tool that collapses the gap between a developer's intent and their first working Polkadot integration.

The #1 reason developers don't build on Polkadot isn't that docs don't exist — it's that the gap between reading docs and writing working code is massive. PolkadotCopilot bridges that gap.

## ✨ Features

### 💬 Ask Anything
RAG-powered chat grounded in real Polkadot documentation. Ask about parachains, XCM, Substrate, staking, accounts — get accurate, doc-grounded answers instantly.

### ⚡ Intent to Code
Describe what you want to build in plain English. Get back:
- A clear explanation of the approach
- Exact setup commands
- Working Substrate/Polkadot starter code
- Step-by-step next steps

### 📊 Friction Map
A live dashboard that tracks what developers ask about most — showing exactly where the Polkadot ecosystem has the highest developer friction. Gives the Parity Acceleration team a real-time feedback loop on where to invest in docs, tooling, and tutorials.

## 🛠 Tech Stack

**Frontend:** React 18, TypeScript, Recharts

**Backend:** Python, FastAPI, LangChain, ChromaDB, OpenAI

**AI:** RAG pipeline with OpenAI embeddings + GPT-3.5-turbo

## 🚀 Running Locally

### Backend
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm start
```

### Ingest Polkadot Docs
```bash
cd backend
source venv/bin/activate
python3.11 ingest.py
```

## 💡 Why I Built This

The Polkadot Acceleration team's mission is to drive ecosystem growth by reducing friction for developers. PolkadotCopilot is a direct attack on the biggest friction point — the gap between wanting to build on Polkadot and actually shipping something.

Built by [Sudarshan Venkatesh](https://github.com/sudarshanvenkatesh13) — AI Engineer.