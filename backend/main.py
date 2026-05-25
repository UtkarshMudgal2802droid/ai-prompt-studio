from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import google.generativeai as genai
import os

load_dotenv()

genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))

model = genai.GenerativeModel("gemini-2.5-flash")

app = FastAPI()

origins = ["http://localhost:5173",]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],   
)

class PromptRequest(BaseModel):
    prompt:str
    
@app.get('/')
def home():
    return {'message':'Welcome to Project'}
    

@app.post('/generate')
def generate_text(request:PromptRequest):
    response = model.generate_content(request.prompt)
    return {"response":response.text}
    

