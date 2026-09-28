# Code Clinic — AI Debugging Doctor

A debugging chatbot system that operates like a **doctor in a code clinic**. Describe symptoms, get focused diagnostic questions, real-time web verification, surgical code patches, and long-term memory.

Built according to [code-clinic-bot-blueprint.md](./code-clinic-bot-blueprint.md) with design implemented in accordance with [DESIGN.md](./DESIGN.md) (Ollama minimalist documentation-first aesthetic).

## Features
- **Dr. Debug Consultation Flow**: Step-by-step diagnostic workflow: intake evaluation, root cause hypothesis, surgical patch, prevention prescription, and follow-up.
- **Patient Medical Chart**: Live session memory tracking detected language, framework, runtime, and error signatures.
- **Web Verification Tool**: Automatically searches live documentation and GitHub issues when encountering obscure errors or recent framework versions.
- **Code ICU Sandbox**: In-browser execution laboratory supporting Node.js and Python in isolated environments.
- **Emergency Room Triage**: Instant pre-loaded cases (Next.js 15 cookies breaking change, Python asyncio closed loop, React undefined map, Docker permission error).
- **RAG Learning Store**: "Learning while student types" feedback loop storing verified cures for instant retrieval in future cases.

## Quickstart
```bash
# Start server
node server.js

# Open in browser
http://127.0.0.1:3000
```
