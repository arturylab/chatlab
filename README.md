# 🤖 ChatLab

A simple, modern web application for chatting with local language models using Ollama. Clean interface for general-purpose AI conversations.

🌐 **[Try Live Demo](https://chatlab.opendev.us/)**

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-3.1.1-green.svg)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3.0-purple.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## ✨ Features

- **💬 Real-time streaming** - Live responses as they generate
- **🧠 Multiple models** - Switch between different Ollama models
- **📱 Responsive design** - Works on mobile and desktop
- **📝 Markdown & code support** - Rich text formatting with syntax highlighting
- **💾 Session history** - Conversation context maintained
- **⌨️ Keyboard shortcuts** - Enter to send, Shift+Enter for new line

## 🚀 Quick Start

### Main Interface
```
┌─────────────────────────────────────────────────────────┐
│ [Model: gemma3:1b ▼]     ChatLab      [+ New Chat]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  👤 You: Explain quantum computing                      │
│                                                         │
│  🤖 Assistant: Quantum computing is a revolutionary...  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [Ask me anything...] [📤 Send]                          │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

- **Flask** - Python web framework
- **Ollama** - Local LLM backend  
- **Bootstrap** - Responsive UI
- **JavaScript** - Real-time streaming

## 📋 Requirements

- Python 3.8+
- Ollama running locally

## 🔧 Setup

1. **Clone & install**
   ```bash
   git clone https://github.com/arturylab/chatlab.git
   cd chatlab
   pip install -r requirements.txt
   ```

2. **Start Ollama** (if not running)
   ```bash
   ollama serve
   ollama pull gemma3:1b
   ollama pull qwen3:0.6b
   ```

3. **Run the app**
   ```bash
   python app.py
   ```

4. **Open** http://localhost:5001

## ⚙️ Configuration

**Change models** in `templates/index.html`:
```html
<option value="llama2:7b">Llama 2 7B</option>
<option value="mistral:7b">Mistral 7B</option>
```

**Change port** in `app.py`:
```python
app.run(debug=True, port=5001)
```

## 🎨 Customization

- **Themes**: Edit `static/css/style.css` for colors
- **Models**: Add more options in the dropdown
- **UI**: Bootstrap classes for styling

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

⭐ **Star the repo if you find it useful!**
