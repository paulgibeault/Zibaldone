
# Architecture Guide: Multimodal LLM Harness & File Processing Engine

## 1. The Dual-Path Processing Strategy

A fully capable harness must distinguish between **Immediate Context** (Multimodal) and **Persistent Knowledge** (RAG).

### Path A: Native Multimodal (`/chat/completions`)

* **Purpose:** Real-time reasoning on visual or structural data.
* **Workflow:** The application detects the file type. If it is an image or a complex visual PDF, the harness converts the file to a Base64 string and embeds it directly into the message array.
* **Optimization:** Implement a "Vision Resizer" to ensure images do not exceed the model's optimal input resolution (often 1024x1024), reducing token bloat and VRAM pressure.

### Path B: Knowledge Persistence (`/v1/files`)

* **Purpose:** Long-term storage and retrieval for large datasets or document repositories.
* **Workflow:** Files are uploaded via the `/v1/files` endpoint. The harness assigns a `file_id`.
* **Processing:** An asynchronous background worker triggers the "Ingestion Pipeline" (Parsing -> Chunking -> Embedding -> Vector DB Storage).

---

## 2. The Orchestration Layer (File Type Detection)

The "Harness" serves as the brain, determining which path a file should take based on its extension and metadata.

| File Category | Detection Logic | Recommended Action |
| --- | --- | --- |
| **Images** (PNG, JPG) | MIME-type check | Route to VLM via `/chat/completions`. |
| **Structured Data** (CSV, JSON) | Schema validation | Route to RAG (Path B) or XML-wrap in Path A if small. |
| **Unstructured Text** (PDF, DOCX) | Text-to-Image Ratio | If >20% images/tables: VLM Path. Otherwise: RAG Path. |
| **Code** (PY, JS, CPP) | Language detection | Direct XML injection in Path A for debugging/review. |

---

## 3. Implementing the `/v1/files` API for RAG

To support a robust RAG component, the harness should mimic the OpenAI File API structure to ensure compatibility across frameworks.

### The File Lifecycle

1. **Upload (`POST /v1/files`):** Receive binary data and store it in a staging area (e.g., S3 or local volume).
2. **Indexing:** The harness triggers a script to extract text.
3. **Retrieval:** During inference, the harness queries the Vector DB based on the user's prompt, retrieves the top  relevant chunks, and injects them into the `/chat/completions` call using XML tags like `<context_chunks>`.

---

## 4. LiteLLM Proxy Configuration

LiteLLM acts as the load balancer and protocol translator. To ensure the harness remains efficient:

* **Model Mapping:** Define specific "vision" and "text" aliases in the `config.yaml`.
* **Fallbacks:** Configure LiteLLM to fall back to a more capable model if the initial file processing fails due to context window limits.
* **Caching:** Enable LiteLLM’s semantic caching for RAG results to reduce redundant embedding calculations.

---

## 5. Hardware & VRAM Management

When running local inference, file processing is often limited by GPU memory.

* **Quantization:** Use GGUF or MLX formats (Q4_K_M or Q8_0) to fit larger multimodal models into available VRAM.
* **Context Management:** For long log files or technical docs, implement **Context Pruning**. If a file upload exceeds 80% of the model’s context window, automatically pivot from Path A (Native) to Path B (RAG).

---

## 6. Implementation Checklist for the Application

* [ ] **Middleware:** Build a file-sniffer that checks `magic bytes` rather than just extensions for security.
* [ ] **Base64 Handler:** Create a utility to convert PDFs to high-DPI images for VLM consumption.
* [ ] **Vector Sync:** Ensure the `/v1/files` API deletes the corresponding vector embeddings when a file is deleted.
* [ ] **Logging:** Track token usage per file type to identify cost or performance bottlenecks.