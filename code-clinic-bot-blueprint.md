# Code Clinic — Debugging Chatbot: Full Blueprint (A → Z)

A chatbot that acts like a **doctor in a "code clinic"**: the user describes a bug/symptom, the bot asks smart diagnostic questions, searches Google when it needs fresh info (new library versions, obscure error strings, recent breaking changes), and gives a step-by-step fix — while remembering what it learned from the user during the session (and optionally across sessions).

---

## 1. High-Level Architecture

```
┌─────────────┐     ┌───────────────┐     ┌────────────────────┐
│  Frontend   │───▶│  Backend API   │───▶│  Orchestrator (LLM)  │
│ (chat UI)   │◀───│ (Node/Python)  │◀───│  + Tool Router       │
└─────────────┘     └───────────────┘     └─────────┬──────────┘
                                                       │
                     ┌─────────────────────────────────┼─────────────────────────────┐
                     ▼                                 ▼                             ▼
           ┌───────────────────┐           ┌────────────────────┐         ┌───────────────────┐
           │ Google Search API  │           │  Memory / Vector DB │         │  Code Sandbox      │
           │ (real-time facts)  │           │ (session + long-term│         │ (optional: run /   │
           │                    │           │  learning)          │         │  lint the snippet) │
           └───────────────────┘           └────────────────────┘         └───────────────────┘
```

**Flow in plain words:**
1. User pastes error/code → Frontend sends it to Backend.
2. Backend hands it to the Orchestrator (the LLM with a system prompt below).
3. Orchestrator decides: *"Do I already know this, or do I need to search / check memory / run code?"*
4. It calls whichever tools it needs, merges the results, and replies with a structured diagnosis.
5. Backend logs the interaction (question, fix, whether it worked) into the Memory store — this is the "learning" loop.

---

## 2. Components You Need to Build

| Layer | Purpose | Suggested tools |
|---|---|---|
| **Frontend (chat UI)** | Where user pastes code/errors, sees streamed replies | React / Next.js, or a simple HTML+JS widget |
| **Backend API** | Auth, rate limiting, routes requests to the LLM, stores logs | Node.js (Express/Fastify) or Python (FastAPI) |
| **LLM Orchestrator** | The "brain" — runs the system prompt, decides which tool to call | Claude / GPT via API, with function-calling (tool use) enabled |
| **Web Search Tool** | Fetches current info the model doesn't know (new APIs, GitHub issues, Stack Overflow threads) | Google Custom Search JSON API, or SerpAPI, or Bing Search API |
| **Memory / Learning Store** | Remembers user's stack, past bugs, what fixes worked | Vector DB (Pinecone, Weaviate, Chroma, or pgvector) + a normal SQL table for structured facts |
| **Code Sandbox (optional but strong)** | Actually run the user's snippet to reproduce the error and verify the fix | Docker container / Judge0 API / E2B sandbox |
| **Feedback loop** | "Did this fix work?" thumbs up/down → retrain retrieval ranking | Simple event logging table |

---

## 3. The "Learning While Student Types" Mechanism

This is the part people usually get wrong — you don't fine-tune the LLM live. Instead:

1. **Session memory**: every message the user sends (their stack trace, their code, their environment) gets summarized and stored as structured facts (language, framework, OS, dependency versions) for the rest of the conversation. The bot re-injects this into every prompt so it doesn't re-ask what it already knows.
2. **Long-term memory (optional)**: if the user returns later, pull their saved profile (e.g. "Allan usually codes in Python/Flask, uses MacBook Pro, prefers concise fixes") from the vector DB and prepend it to the system prompt.
3. **Outcome logging**: after each fix, ask "Did this solve it?" — store the (error signature → fix → success/fail) pair. Next time a similar error signature appears, boost that fix in the search/retrieval step before calling the LLM. This is how the bot "gets smarter" without retraining weights — it's retrieval-augmented generation (RAG), not fine-tuning.

---

## 4. Google Search Integration — When & How

The bot should **not** search on every message (slow, costly). Give the LLM a clear rule (already baked into the system prompt below):

- Search when: the error message is unusual/recent, involves a specific library version, or references something that changes often (framework APIs, cloud service quirks, security advisories).
- Don't search when: it's a well-known, timeless bug (off-by-one error, null pointer, missing semicolon, classic algorithm mistake) — just answer directly.

Implementation: expose a `web_search(query)` function to the LLM via tool-calling/function-calling. The model outputs a tool call, your backend executes it against Google Custom Search API, returns top results (title + snippet + URL) back into the conversation, and the model reasons over them before answering.

---

## 5. The Core System Prompt (copy-paste into your bot)

```
You are "Dr. Debug" — an AI code clinic doctor. Your job is to diagnose and treat
software bugs the way a doctor treats a patient: listen carefully, ask focused
diagnostic questions, form a hypothesis, verify it, then prescribe a precise fix.

### Your consultation flow
1. INTAKE — When the user reports a bug, first check whether you have enough
   information: language/framework, exact error message or stack trace, what
   they expected vs what happened, and relevant code (only the relevant part,
   not the whole file). If anything critical is missing, ask ONE focused
   clarifying question at a time — don't interrogate with a list.
2. DIAGNOSIS — State your hypothesis about the root cause in plain language
   before jumping to a fix. Explain WHY the bug happens, not just what to
   change — this is a clinic, not a copy-paste shop.
3. DECIDE IF YOU NEED TO SEARCH — Use the web_search tool when:
   - the error references a specific library/framework version that may have
     changed behavior recently,
   - it's an obscure error string you're not fully certain about,
   - it could relate to a recent breaking change, deprecation, or security
     advisory.
   Do NOT search for well-understood, timeless bugs (syntax errors, off-by-one,
   null/undefined access, basic logic mistakes) — just explain and fix directly.
4. TREATMENT — Give the smallest correct fix first (a patch, not a rewrite),
   with a short code block. If there are multiple possible causes, give the
   most likely fix first, then a secondary path ("if that doesn't fix it,
   check X").
5. FOLLOW-UP — Ask whether the fix resolved it. If yes, briefly note how to
   prevent this class of bug in future (a "prescription for prevention").
   If no, go back to step 2 with the new information.

### Tone
Calm, precise, encouraging — like a good senior engineer doing pair debugging,
not a search engine dumping links. Never make the user feel stupid for the bug.

### Rules
- Never guess at a fix with low confidence and present it as certain — say
  "try this first" instead of "this is definitely the problem" when unsure.
- Always ask for the exact error message/stack trace if the user only
  describes symptoms vaguely ("it doesn't work").
- Keep code fixes minimal and scoped to the bug — don't refactor unrelated code
  unless asked.
- If you used web search, briefly mention what you checked (e.g. "checked the
  current React docs") so the user trusts the source, without dumping raw
  links unless useful.
- Remember facts the user has already told you this session (their stack,
  OS, versions) and don't ask again.
- If the bug can't be fully diagnosed from the text alone, suggest a specific
  next diagnostic step (e.g. "add a console.log here", "run with verbose
  logging") rather than guessing blindly.
```

---

## 6. Example Tool Schema (function-calling)

```json
{
  "name": "web_search",
  "description": "Search the web for current information about an error, library version, or recent breaking change.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" }
    },
    "required": ["query"]
  }
}
```

```json
{
  "name": "run_code",
  "description": "Execute a code snippet in a sandbox to reproduce or verify a fix.",
  "parameters": {
    "type": "object",
    "properties": {
      "language": { "type": "string" },
      "code": { "type": "string" }
    },
    "required": ["language", "code"]
  }
}
```

---

## 7. Minimal Backend Orchestration Logic (pseudocode)

```python
def handle_message(user_id, message, session_memory):
    context = build_context(session_memory)          # prior facts about this user's bug
    response = llm.chat(
        system=CODE_CLINIC_SYSTEM_PROMPT,
        messages=context + [message],
        tools=[web_search_tool, run_code_tool],
    )

    if response.tool_calls:
        for call in response.tool_calls:
            if call.name == "web_search":
                results = google_search(call.args["query"])
                response = llm.continue_with_tool_result(call, results)
            elif call.name == "run_code":
                output = sandbox.run(call.args["language"], call.args["code"])
                response = llm.continue_with_tool_result(call, output)

    session_memory.update(extract_facts(message, response))
    log_interaction(user_id, message, response)        # feeds the learning loop
    return response.text
```

---

## 8. Build Order (practical roadmap)

1. **MVP**: chat UI + backend + LLM with the system prompt above, no tools yet. Get the "doctor persona" conversation flow working.
2. **Add web search tool** — biggest value-add for debugging bots (fresh info beats stale training data).
3. **Add session memory** — stop the bot re-asking "what language is this?" every message.
4. **Add feedback logging** ("did this fix it?") — starts your RAG learning loop.
5. **Add code sandbox** (optional, highest effort/reward) — lets the bot actually reproduce and verify bugs instead of guessing.
6. **Add long-term memory / user profiles** — only once you have real usage data to learn from.

---

## 9. Guardrails to Bake In

- Never execute untrusted user code outside a sandboxed container.
- Rate-limit search calls per conversation (cost control).
- Don't let the bot silently fabricate a fix when a search returns nothing relevant — it should say so and ask for more detail instead.
