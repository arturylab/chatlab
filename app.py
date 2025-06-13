from flask import Flask, render_template, request, Response
import requests
import json
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    
    # Build complete context with history
    context_prompt = build_context_prompt(conversation_history, user_prompt)

    payload = {
        "model": selected_model,
        "prompt": context_prompt,
        "stream": True,
        # Optimization parameters for limited resource server
        "options": {
            "num_ctx": 2048,  # Reduce context for less memory usage
            "num_predict": 512,  # Limit response length
            "temperature": 0.7,
            "top_k": 40,
            "top_p": 0.9,
            "num_thread": 4,  # Limit threads to avoid CPU saturation
            "repeat_penalty": 1.1,
            "seed": -1
        }
    }

    def generate():
        try:
            logger.info(f"Starting request for model: {selected_model}")
            # Use timeout to avoid hanging connections
            response = requests.post(
                OLLAMA_API_URL, 
                json=payload, 
                stream=True,
                timeout=90,  # 90 second timeout
                headers={'Connection': 'close'}  # Close connection after
            )
            response.raise_for_status()
            
            buffer = ""
            token_count = 0
            
            for line in response.iter_lines(decode_unicode=True):
                if line:
                    try:
                        data = json.loads(line)
                        if 'response' in data and data['response']:
                            # Accumulate tokens in buffer to send in larger chunks
                            buffer += data['response']
                            token_count += 1
                            
                            # Send every 5-8 tokens to reduce overhead
                            if len(buffer) >= 8 or token_count % 5 == 0:
                                yield f"data: {json.dumps({'token': buffer})}\n\n"
                                buffer = ""
                                # Small pause to avoid CPU saturation
                                time.sleep(0.02)  # 20ms pause
                        
                        if data.get('done', False):
                            # Send remaining tokens
                            if buffer:
                                yield f"data: {json.dumps({'token': buffer})}\n\n"
                            yield f"data: {json.dumps({'done': True})}\n\n"
                            logger.info(f"Request completed. Tokens processed: {token_count}")
                            break
                            
                    except json.JSONDecodeError as e:
                        logger.warning(f"Error parsing JSON: {e}")
                        continue
                        
        except requests.exceptions.Timeout:
            logger.error("Request timeout")
            yield f"data: {json.dumps({'error': 'Request timeout - Server took too long to respond'})}\n\n"
        except requests.exceptions.ConnectionError:
            logger.error("Connection error to Ollama")
            yield f"data: {json.dumps({'error': 'Could not connect to Ollama. Is it running?'})}\n\n"
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {e}")
            yield f"data: {json.dumps({'error': f'Connection error: {str(e)}'})}\n\n"
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            yield f"data: {json.dumps({'error': f'Internal error: {str(e)}'})}\n\n"

    return Response(
        generate(), 
        mimetype='text/plain',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',  # For nginx if you use it
            'Access-Control-Allow-Origin': '*'
        }
    )

def build_context_prompt(history, new_prompt):
    """Builds a prompt with complete conversation context optimized for performance"""
    
    # System prompt in English
    system_prompt = """You are an expert in mathematics, physics, chemistry, and programming.
    
    IMPORTANT:
    - Always write mathematical formulas or notation in LaTeX format, enclosed between $$...$$
    - Always write programming code using code blocks with ```language...```
    - Keep your responses clear and well-formatted."""
    
    # Build context with history (limit to last 4 messages to save tokens)
    context_parts = [system_prompt]
    
    # Add previous messages (limit to last 4 to reduce token usage)
    recent_history = history[-4:] if len(history) > 4 else history
    
    for message in recent_history:
        if message['role'] == 'user':
            # Truncate very long user messages
            content = message['content'][:300] + "..." if len(message['content']) > 300 else message['content']
            context_parts.append(f"\nUser: {content}")
        elif message['role'] == 'assistant':
            # Truncate very long responses from history to save context
            content = message['content'][:150] + "..." if len(message['content']) > 150 else message['content']
            context_parts.append(f"\nAssistant: {content}")
    
    # Add the new question
    context_parts.append(f"\nUser: {new_prompt}")
    context_parts.append("\nAssistant:")
    
    full_prompt = "".join(context_parts)
    
    # Log for debugging (optional, remove in production)
    logger.info(f"Context length: {len(full_prompt)} characters")
    
    return full_prompt

# Health check endpoint
@app.route("/health")
def health():
    try:
        # Check if Ollama is available
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        if response.status_code == 200:
            return {"status": "healthy", "ollama": "connected"}
        else:
            return {"status": "unhealthy", "ollama": "disconnected"}, 503
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}, 503

if __name__ == "__main__":
    # Optimized configuration for limited resource server
    app.run(
        debug=False,  # Disable debug for better performance
        port=5001,
        threaded=True,  # Use threads for better concurrency
        host='0.0.0.0',  # Allow external connections
        processes=1  # Single instance to avoid overload
    )
