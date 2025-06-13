from flask import Flask, render_template, request, Response
import requests
import json

app = Flask(__name__)

OLLAMA_API_URL = "http://localhost:11434/api/generate"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    user_prompt = data.get("prompt")
    selected_model = data.get("model", "gemma3:1b")
    conversation_history = data.get("history", [])
    
    # Build the full context with history
    context_prompt = build_context_prompt(conversation_history, user_prompt)

    payload = {
        "model": selected_model,
        "prompt": context_prompt,
        "stream": True
    }

    def generate():
        try:
            response = requests.post(OLLAMA_API_URL, json=payload, stream=True)
            response.raise_for_status()
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode('utf-8'))
                        if 'response' in data:
                            yield f"data: {json.dumps({'token': data['response']})}\n\n"
                        if data.get('done', False):
                            break
                    except json.JSONDecodeError:
                        continue
        except requests.exceptions.RequestException as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype='text/plain')

def build_context_prompt(history, new_prompt):
    """Builds a prompt with full conversation context in English"""
    
    # System prompt in English
    system_prompt = """You are an expert in mathematics, physics, chemistry, and programming.
    
    IMPORTANT:
    - Always write mathematical formulas or notation in LaTeX format, enclosed between $$...$$
    - Always write programming code using code blocks with ```language...```
    - Keep your responses clear and well-formatted."""
    
    # Build the context with history
    context_parts = [system_prompt, "\n\nConversation history:"]
    
    # Add previous messages (limit to last 10 to avoid overload)
    recent_history = history[-10:] if len(history) > 10 else history
    
    for message in recent_history:
        if message['role'] == 'user':
            context_parts.append(f"\nUser: {message['content']}")
        elif message['role'] == 'assistant':
            context_parts.append(f"\nAssistant: {message['content']}")
    
    # Add the new question
    context_parts.append(f"\nUser: {new_prompt}")
    context_parts.append("\nAssistant:")
    
    return "".join(context_parts)

if __name__ == "__main__":
    app.run(debug=True, port=5001)
