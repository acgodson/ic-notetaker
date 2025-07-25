# 🎙️ ic-notetaker
Immutable, AI-Powered Meeting Notes on the Internet Computer


**IC Notetaker** is a Chrome extension + decentralized protocol on the **Internet Computer (ICP)** for **capturing, transcribing, summarizing, and auditing virtual meetings** — all in a **tamper-proof, on-chain format**.

By combining a lightweight audio-capturing browser extension with ICP’s censorship-resistant canister backend, IC Notetaker makes **meetings indexable, auditable, and analyzable** — with the long-term goal of building a **searchable voice memory layer for the decentralized web**.


### 🌐 Why It Matters

* 🔐 **Immutable Record**: Tamper-proof, on-chain record of spoken meetings
* 🕵️ **Audit Trail**: Verifiable transcript timelines and version history
* 🧠 **AI Knowledge Layer**: Indexed summaries for quick reference across many meetings
* 🎙️ **Voice Embedding & Recognition**: Smart identity tagging, searchable by voice
* 🎫 **Access Control**: NFT-gated or DAO-managed access to sensitive transcripts
* 📚 **[Clanopedia]() & [Blueband]() Integration**: Ties meeting intelligence to broader decentralized knowledge on ICP

---

## Proposed Roadmap

---

### ✅ **Milestone 1 — Foundation & MVP**

#### 🎧 Audio Capture & On-chain Transcription

* Chrome extension captures mic or tab audio (e.g., Google Meet)
* Floating overlay UI for user consent and status
* Sends audio chunks every 30s to ICP backend canister
* ICP backend makes HTTPS outcalls to an STT service (e.g., OpenAI GPT-4 transcribe)
* Stores transcript with timestamps on-chain
* Generates basic meeting summary via OpenAI proxy (hosted externally for now)

---

### ⌛ **Milestone 2 — Decentralized Governance + Semantic Trails**

#### Advanced Access + Governance

* AI summaries run on-chain via **on-chain LLaMA reasoning model** (e.g., via Wasm inference or LLM+prompt caching)
* **NFT or DAO-based access gating** to meeting histories
* **Clanopedia integration**: Link meeting records to community-curated knowledge
* **Blueband DB integration**: Store embeddings & summaries for semantic filtering

---

### ⌛ **Milestone 3 — Voice Profiles & Searchable Memory**

#### Voice Intelligence Layer

* Use **voice embeddings (e.g., ECAPA-TDNN)** for identity recognition
* Build **voice-based search system**: “Find every meeting Juliet spoke in about pricing”
* Add a voice similarity model for detecting near-matches and impersonation attempts
* Long-term speaker tagging across meetings

---

### 🔮 **Milestone 4 — Smart Meeting Agents & Memory Replay**

#### Context-Aware Agents + Temporal Insights

* **Auto-generated “Meeting Memory Agents”** for each community or project — ask it what happened last month, who suggested X, what decisions were made
* **Chronological Topic Mapping**: Track how specific ideas evolved across time
* **Replay Mode**: Feed past summaries + transcript into on-chain agent for **auto-generated decisions, reminders, and insights**
* Optionally support **meeting-to-task sync** (Jira/Notion bridge)

---

## 🧱 Stack Overview

| Layer            | Tooling                                           |
| ---------------- | ------------------------------------------------- |
| Audio Capture    | Chrome Extension (`tabCapture`, `getUserMedia`)   |
| Audio Delivery   | REST to ICP backend                               |
| Transcription    | OpenAI GPT-4 transcribe API                       |
| On-chain Infra   | Motoko/Rust Canisters, HTTPS Outcalls             |
| Storage          | Canister memory + Blueband DB                     |
| Summary/AI       | External initially, then on-chain LLaMA           |
| Access Control   | NFT-gating, DAO logic                             |
| Search & Linking | Blueband semantic embedding, Clanopedia relations |

