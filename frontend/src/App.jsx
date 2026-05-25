import React, {useState} from 'react'
import axios from 'axios'
import './App.css'

function App(){
    
    const [prompt, setPrompt] = useState("")
    const [response, setResponse] = useState("")
    const [loading, setLoading] = useState(false)
    
    function handleChange(event){
        console.log("On change event trigger")
        setPrompt(event.target.value)
    }
    async function generateResponse(){
        setLoading(true)
        const res= await axios.post('http://127.0.0.1:8000/generate',{prompt:prompt})
        setResponse(res.data.response)
        setLoading(false)
    }
    
     
    return(
        <div className="container">
            <h1>CRT Mini Project 1</h1>
            <textarea placeholder="Enter your prompt" onChange={handleChange}>
            
            </textarea>
            
            <button onClick={generateResponse}>{loading ? "Generating..." : "Generate"}</button>
            
            <div className="response-box">
            <h2> AI Response</h2>
            <p>{response}</p>
            </div>
        </div>
    )
}

export default App
