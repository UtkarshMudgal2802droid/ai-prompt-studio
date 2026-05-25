"""
AI Model Serving backend.

Routes:
- GET  /api/health
- POST /api/generate
- POST /api/summarize
- POST /api/sentiment
- POST /api/qa
- POST /api/translate
- POST /api/ner
"""

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import pipeline

<<<<<<< HEAD
app = FastAPI(title="AI Model Server", version="1.0.0")
=======
load_dotenv()

genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))

model = genai.GenerativeModel("gemini-2.5-flash")

app = FastAPI()

origins = ["http://localhost:5173","https://ai-prompt-studio-liard.vercel.app"]
>>>>>>> origin/main

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
    "generate": "gpt2",
    "summarize": "facebook/bart-large-cnn",
    "sentiment": "cardiffnlp/twitter-roberta-base-sentiment-latest",
    "qa": "deepset/roberta-base-squad2",
    "translate": "Helsinki-NLP/opus-mt-en-fr",
    "ner": "dslim/bert-base-NER",
}

PIPELINES = {
    "generate": pipeline("text-generation", model=MODELS["generate"]),
    "summarize": pipeline("summarization", model=MODELS["summarize"]),
    "sentiment": pipeline("sentiment-analysis", model=MODELS["sentiment"]),
    "qa": pipeline("question-answering", model=MODELS["qa"]),
    "translate": pipeline("translation_en_to_fr", model=MODELS["translate"]),
    "ner": pipeline(
        "ner",
        model=MODELS["ner"],
        aggregation_strategy="simple",
    ),
}


class TextPayload(BaseModel):
    text: str = Field(..., min_length=1)


class GeneratePayload(BaseModel):
    text: str = Field(..., min_length=1)
    max_length: int = Field(140, ge=20, le=300)


class QAPayload(BaseModel):
    context: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)


class TranslatePayload(BaseModel):
    text: str = Field(..., min_length=1)


@app.get("/api/health")
def health() -> dict[str, Any]:
    """Return API health and available model tasks."""
    return {"status": "ok", "model_tasks": list(MODELS.keys())}


@app.post("/api/generate")
def generate(payload: GeneratePayload) -> dict[str, Any]:
    """Generate text from a prompt."""
    try:
        result = PIPELINES["generate"](
            payload.text,
            max_length=payload.max_length,
            num_return_sequences=1,
            do_sample=True,
        )
        return {
            "task": "generate",
            "model": MODELS["generate"],
            "result": result[0]["generated_text"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/summarize")
def summarize(payload: TextPayload) -> dict[str, Any]:
    """Summarize long input text."""
    try:
        result = PIPELINES["summarize"](
            payload.text,
            max_length=140,
            min_length=30,
            do_sample=False,
        )
        return {
            "task": "summarize",
            "model": MODELS["summarize"],
            "result": result[0]["summary_text"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/sentiment")
def sentiment(payload: TextPayload) -> dict[str, Any]:
    """Analyze sentiment of the given text."""
    try:
        result = PIPELINES["sentiment"](payload.text)
        item = result[0]
        score = round(float(item["score"]), 4)
        return {
            "task": "sentiment",
            "model": MODELS["sentiment"],
            "label": item["label"],
            "score": score,
            "result": f"{item['label']} ({score})",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/qa")
def qa(payload: QAPayload) -> dict[str, Any]:
    """Answer a question from a given context."""
    try:
        result = PIPELINES["qa"](
            context=payload.context,
            question=payload.question,
        )
        score = round(float(result["score"]), 4)
        return {
            "task": "qa",
            "model": MODELS["qa"],
            "answer": result["answer"],
            "score": score,
            "result": result["answer"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/translate")
def translate(payload: TranslatePayload) -> dict[str, Any]:
    """Translate English text to French."""
    try:
        result = PIPELINES["translate"](payload.text)
        return {
            "task": "translate",
            "model": MODELS["translate"],
            "result": result[0]["translation_text"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/ner")
def ner(payload: TextPayload) -> dict[str, Any]:
    """Extract named entities from text."""
    try:
        outputs = PIPELINES["ner"](payload.text)
        entities = []
        for item in outputs:
            entities.append(
                {
                    "text": item.get("word", ""),
                    "label": item.get("entity_group", item.get("entity", "")),
                    "score": round(float(item.get("score", 0.0)), 4),
                    "start": int(item.get("start", 0)),
                    "end": int(item.get("end", 0)),
                }
            )
        return {
            "task": "ner",
            "model": MODELS["ner"],
            "entities": entities,
            "result": entities,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))