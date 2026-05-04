import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
import json
from datetime import datetime

load_dotenv()

app = FastAPI()

# Allow React frontend to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load ChromaDB
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = Chroma(
    persist_directory="./chroma_db",
    embedding_function=embeddings
)

# LLM
llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)

# Retriever
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

# Prompt for chat
prompt = ChatPromptTemplate.from_template("""
You are PolkadotCopilot, an expert AI assistant for the Polkadot ecosystem.
Answer the question based on the context below. Be clear, concise and helpful.
If you don't know, say so honestly.

Context: {context}

Question: {question}
""")

def qa_chain(question: str) -> str:
    docs = retriever.invoke(question)
    context = "\n\n".join([d.page_content for d in docs])
    chain = prompt | llm
    result = chain.invoke({"context": context, "question": question})
    return result.content

# Friction logger
FRICTION_LOG = "friction_log.json"

def log_query(query: str):
    """Log query for friction mapping"""
    try:
        logs = []
        if os.path.exists(FRICTION_LOG):
            with open(FRICTION_LOG, "r") as f:
                logs = json.load(f)
        logs.append({
            "query": query,
            "timestamp": datetime.now().isoformat()
        })
        with open(FRICTION_LOG, "w") as f:
            json.dump(logs, f)
    except:
        pass

# --- Models ---

class QueryRequest(BaseModel):
    question: str

class QueryResponse(BaseModel):
    answer: str

class CodeRequest(BaseModel):
    intent: str

class CodeResponse(BaseModel):
    explanation: str
    code: str
    setup: str
    next_steps: str

# --- Routes ---

@app.get("/")
def root():
    return {"status": "PolkadotCopilot API is running"}

@app.post("/ask", response_model=QueryResponse)
async def ask(request: QueryRequest):
    log_query(request.question)
    answer = qa_chain(request.question)
    return QueryResponse(answer=answer)

@app.get("/friction")
def get_friction():
    """Return friction data for the dashboard"""
    if not os.path.exists(FRICTION_LOG):
        return {"queries": [], "total": 0}
    with open(FRICTION_LOG, "r") as f:
        logs = json.load(f)
    return {"queries": logs, "total": len(logs)}

@app.post("/generate", response_model=CodeResponse)
async def generate_code(request: CodeRequest):
    log_query(f"[CODE] {request.intent}")

    # Get relevant docs for context
    docs = retriever.invoke(request.intent)
    context = "\n\n".join([d.page_content for d in docs])

    code_prompt = ChatPromptTemplate.from_template("""
You are PolkadotCopilot, an expert Polkadot and Substrate developer.
A developer wants to build something on Polkadot. Based on the docs context and their intent, generate a practical starter implementation.

Context from Polkadot docs:
{context}

Developer intent: {intent}

Respond in this EXACT format with these EXACT headers:

EXPLANATION:
[2-3 sentences explaining the approach]

SETUP:
[exact terminal commands to install dependencies]

CODE:
[complete working starter code with comments]

NEXT_STEPS:
[3-4 bullet points of what to do after this]
""")

    chain = code_prompt | llm
    result = chain.invoke({"context": context, "intent": request.intent})
    raw = result.content

    def extract(label, next_label, text):
        try:
            start = text.index(f"{label}:") + len(f"{label}:")
            end = text.index(f"{next_label}:") if next_label in text else len(text)
            return text[start:end].strip()
        except:
            return ""

    explanation = extract("EXPLANATION", "SETUP", raw)
    setup = extract("SETUP", "CODE", raw)
    code = extract("CODE", "NEXT_STEPS", raw)
    next_steps = extract("NEXT_STEPS", "", raw)

    return CodeResponse(
        explanation=explanation,
        code=code,
        setup=setup,
        next_steps=next_steps
    )