"""
AI Model Serving backend.
Powered by Hugging Face Serverless Inference API.

Routes:
- GET  /api/health
- POST /api/generate
- POST /api/summarize
- POST /api/sentiment
- POST /api/qa
- POST /api/translate
- POST /api/ner
"""

import os
from typing import Any

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from pydantic import BaseModel, Field

# Load environment variables from .env file
load_dotenv()

HF_API_TOKEN = os.getenv("HF_API_TOKEN")
if not HF_API_TOKEN or HF_API_TOKEN == "hf_your_generated_token_here":
    print("WARNING: HF_API_TOKEN is not set or is invalid. Please add it to a .env file.")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    print("WARNING: GOOGLE_API_KEY is not set. Text generation will fail.")

app = FastAPI(title="AI Serverless API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://ai-prompt-studio-liard.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS = {
    "generate": "gemini-2.5-flash",
    "summarize": "facebook/bart-large-cnn",
    "sentiment": "cardiffnlp/twitter-roberta-base-sentiment-latest",
    "qa": "deepset/roberta-large-squad2",
    "translate": "Helsinki-NLP/opus-mt-en-fr",
    "ner": "dslim/bert-large-NER",
}

def query_hf_api(model_id: str, payload: dict) -> Any:
    if not HF_API_TOKEN:
        raise ValueError("Server configuration error: HF_API_TOKEN is missing.")
    
    url = f"https://router.huggingface.co/hf-inference/models/{model_id}"
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 200:
        err_msg = f"Hugging Face API Error ({response.status_code}): {response.text}"
        raise RuntimeError(err_msg)
    return response.json()

class TextPayload(BaseModel):
    text: str = Field(..., min_length=1)

class GeneratePayload(BaseModel):
    text: str = Field(..., min_length=1)
    max_length: int = Field(1000, ge=20, le=2048)

class QAPayload(BaseModel):
    context: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)

class TranslatePayload(BaseModel):
    text: str = Field(..., min_length=1)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "mode": "serverless_api", "model_tasks": list(MODELS.keys())}


@app.post("/api/generate")
def generate(payload: GeneratePayload) -> dict[str, Any]:
    try:
        if not GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY is missing from environment.")
            
        model_id = MODELS["generate"]
        model = genai.GenerativeModel(
            model_name=model_id,
            system_instruction="You are a helpful writing assistant. Write a concise, polished response."
        )
        
        response = model.generate_content(
            payload.text,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                top_p=0.9
            )
        )
        
        return {"task": "generate", "model": model_id, "result": response.text.strip()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/summarize")
def summarize(payload: TextPayload) -> dict[str, Any]:
    try:
        model_id = MODELS["summarize"]
        api_payload = {
            "inputs": payload.text,
            "parameters": {
                "max_length": 140,
                "min_length": 30,
                "do_sample": False
            }
        }
        result = query_hf_api(model_id, api_payload)
        # API returns: [{'summary_text': '...'}]
        text = result[0].get("summary_text", "")
        
        return {"task": "summarize", "model": model_id, "result": text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/sentiment")
def sentiment(payload: TextPayload) -> dict[str, Any]:
    try:
        model_id = MODELS["sentiment"]
        result = query_hf_api(model_id, {"inputs": payload.text})
        # API returns a nested list: [[{'label': 'positive', 'score': 0.99}, ...]]
        # We want the top score
        predictions = result[0]
        top_item = max(predictions, key=lambda x: x["score"])
        
        score = round(float(top_item["score"]), 4)
        return {"task": "sentiment", "model": model_id, "label": top_item["label"], "score": score, "result": f"{top_item['label']} ({score})"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/qa")
def qa(payload: QAPayload) -> dict[str, Any]:
    try:
        model_id = MODELS["qa"]
        api_payload = {
            "inputs": {
                "question": payload.question,
                "context": payload.context
            }
        }
        result = query_hf_api(model_id, api_payload)
        # API returns: {'score': 0.9, 'answer': '...'}
        score = round(float(result.get("score", 0)), 4)
        return {"task": "qa", "model": model_id, "answer": result.get("answer", ""), "score": score, "result": result.get("answer", "")}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/translate")
def translate(payload: TranslatePayload) -> dict[str, Any]:
    try:
        model_id = MODELS["translate"]
        result = query_hf_api(model_id, {"inputs": payload.text})
        # API returns: [{'translation_text': '...'}]
        text = result[0].get("translation_text", "")
        return {"task": "translate", "model": model_id, "result": text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/ner")
def ner(payload: TextPayload) -> dict[str, Any]:
    try:
        model_id = MODELS["ner"]
        result = query_hf_api(model_id, {"inputs": payload.text})
        # API returns list of dicts: [{'entity_group': 'PER', 'score': 0.99, 'word': 'John', ...}]
        entities = []
        for item in result:
            entities.append({
                "text": item.get("word", ""),
                "label": item.get("entity_group", item.get("entity", "")),
                "score": round(float(item.get("score", 0.0)), 4),
                "start": int(item.get("start", 0)),
                "end": int(item.get("end", 0))
            })
        return {"task": "ner", "model": model_id, "entities": entities, "result": entities}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
