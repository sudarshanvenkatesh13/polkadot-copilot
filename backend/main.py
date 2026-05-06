import os
import logging
import json
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from openai import OpenAI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

embeddings = None
vectorstore = None
retriever = None
llm = None
openai_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global embeddings, vectorstore, retriever, llm, openai_client
    logger.info("Initializing vector store and LLM...")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = Chroma(
        persist_directory="./chroma_db",
        embedding_function=embeddings,
    )
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, streaming=True)
    openai_client = OpenAI()
    logger.info("Ready.")
    yield


app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRICTION_LOG = "friction_log.json"


def log_query(query: str):
    try:
        logs = []
        if os.path.exists(FRICTION_LOG):
            with open(FRICTION_LOG, "r") as f:
                logs = json.load(f)
        logs.append({"query": query, "timestamp": datetime.now().isoformat()})
        with open(FRICTION_LOG, "w") as f:
            json.dump(logs, f)
    except Exception as e:
        logger.error(f"Failed to log query: {e}")


# --- Models ---

class ChatMessage(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    question: str
    history: list[ChatMessage] = []

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


@app.post("/ask")
@limiter.limit("20/minute")
async def ask(request: Request, body: QueryRequest):
    log_query(body.question)

    docs = retriever.invoke(body.question)
    context = "\n\n".join([d.page_content for d in docs])
    sources = list({
        d.metadata.get("source", "")
        for d in docs
        if d.metadata.get("source")
    })

    lc_messages = [
        SystemMessage(content=(
            "You are PolkadotCopilot, an expert AI assistant for the Polkadot ecosystem.\n"
            "Answer the question based on the context below. Be clear, concise and helpful.\n"
            "If you don't know, say so honestly.\n\n"
            f"Context:\n{context}"
        ))
    ]
    for msg in body.history[-6:]:
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        else:
            lc_messages.append(AIMessage(content=msg.content))
    lc_messages.append(HumanMessage(content=body.question))

    async def generate():
        try:
            async for chunk in llm.astream(lc_messages):
                if chunk.content:
                    yield f"data: {json.dumps({'token': chunk.content})}\n\n"
            yield f"data: {json.dumps({'sources': sources, 'done': True})}\n\n"
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': 'Something went wrong', 'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/friction")
def get_friction():
    if not os.path.exists(FRICTION_LOG):
        return {"queries": [], "total": 0}
    try:
        with open(FRICTION_LOG, "r") as f:
            logs = json.load(f)
        return {"queries": logs, "total": len(logs)}
    except Exception as e:
        logger.error(f"Failed to read friction log: {e}")
        return {"queries": [], "total": 0}


@app.post("/generate", response_model=CodeResponse)
@limiter.limit("10/minute")
async def generate_code(request: Request, body: CodeRequest):
    log_query(f"[CODE] {body.intent}")

    docs = retriever.invoke(body.intent)
    context = "\n\n".join([d.page_content for d in docs])

    prompt = f"""You are PolkadotCopilot, an expert Polkadot and Substrate developer.
A developer wants to build something on Polkadot. Based on the docs context and their intent, generate a practical starter implementation.

Context from Polkadot docs:
{context}

Developer intent: {body.intent}

Respond with a JSON object with exactly these keys:
- "explanation": 2-3 sentences explaining the approach
- "setup": exact terminal commands to install dependencies
- "code": complete working starter code with comments
- "next_steps": 3-4 bullet points of what to do after this
"""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        result = json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"Code generation error: {e}")
        raise

    return CodeResponse(
        explanation=result.get("explanation", ""),
        code=result.get("code", ""),
        setup=result.get("setup", ""),
        next_steps=result.get("next_steps", ""),
    )
