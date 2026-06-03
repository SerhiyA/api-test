# Backend Language Benchmark Project

**Task Description & Project Plan**

Version 1.0 · June 3, 2026

---

## 1. Project Overview

This project is a structured exploration and benchmarking exercise designed to compare four modern backend programming languages by building the same REST API in each one. The goal is to evaluate each language across multiple dimensions: syntax and developer experience, raw performance, concurrency handling, I/O efficiency, and ecosystem maturity.

The developer behind this project comes primarily from a JavaScript background with minor exposure to C, Python, and PHP. The chosen languages represent a spectrum from familiar to systems-level, ensuring meaningful learning at each step.

---

## 2. Languages & Frameworks

The four languages were selected for their current relevance in the backend ecosystem. They represent different paradigms and performance profiles, making the comparison rich and instructive.

| # | Language | Framework | Why It Was Chosen |
|---|---|---|---|
| 1 | JavaScript (Node.js) | Express | Developer's primary language — serves as the baseline reference point |
| 2 | Python | FastAPI | Familiar syntax territory, huge ecosystem, async support |
| 3 | Go (Golang) | Gin | Compiled, cloud-native, excellent concurrency model |
| 4 | Rust | Axum | Maximum performance, memory safety, modern systems language |

### Learning Progression

The order is intentional — each language introduces a bigger paradigm shift than the last:

- **JS / Express** — comfort zone, establishes the baseline
- **Python / FastAPI** — gentle step, similar high-level feel
- **Go** — first real paradigm shift, explicit error handling, compiled speed
- **Rust** — the final boss: ownership model, strict compiler, near-metal performance

Performance also scales with the order, from interpreted to compiled:

| Language | Type | Runtime Speed | Learning Curve | Job Market |
|---|---|---|---|---|
| JavaScript | Interpreted | Fast | Low (familiar) | Very Large |
| Python | Interpreted | Medium | Low | Large |
| Go | Compiled | Very Fast | Medium | Growing |
| Rust | Compiled | Fastest | High | Growing |

---

## 3. The Project: Task Manager REST API

All four implementations will build the exact same project — a Task Manager REST API connected to a PostgreSQL database. Using the same project across all languages ensures that performance comparisons are fair and that differences in results reflect the language/framework, not the problem complexity.

### 3.1 API Endpoints

Each implementation must expose the following five endpoints:

| Method | Endpoint | Description |
|---|---|---|
| GET | /tasks | Retrieve all tasks (with pagination) |
| POST | /tasks | Create a new task |
| GET | /tasks/:id | Retrieve a single task by ID |
| PUT | /tasks/:id | Update an existing task |
| DELETE | /tasks/:id | Delete a task |

### 3.2 Data Model

Each task should have the following fields:

- `id` — unique identifier (integer or UUID)
- `title` — short string, required
- `description` — longer text, optional
- `status` — enum: `pending` / `in_progress` / `done`
- `priority` — enum: `low` / `medium` / `high`
- `created_at` — timestamp
- `updated_at` — timestamp

### 3.3 Shared Infrastructure

- **Database:** PostgreSQL (same instance across all implementations)
- **Cache:** Redis (used in the caching benchmark task)
- **Auth:** JWT-based middleware on all routes
- **Response format:** JSON throughout
- **Load testing tool:** JMeter

---

## 4. Benchmark Task Collection

Each implementation will be tested against the same suite of benchmark tasks. These tasks are grouped by what they measure, giving a complete performance profile of each language.

### 4.1 Raw Speed

**Load Handling**

Simulate high concurrent traffic using JMeter. Measure requests per second, average response time, error rate, and throughput under increasing load. This reveals how well each server handles real-world traffic spikes.

**JSON Serialization / Deserialization**

An endpoint that accepts and returns large, deeply nested JSON payloads. Tests how efficiently each language encodes and decodes JSON — a core daily operation in any API.

**CPU-Intensive Task**

An endpoint that performs a CPU-heavy computation (e.g., generating prime numbers up to N, computing Fibonacci sequences). This directly exposes the gap between interpreted languages (JS, Python) and compiled ones (Go, Rust).

### 4.2 I/O Efficiency

**Database Query Performance**

Three sub-tests:
- Simple query — fetch a single record by primary key
- Complex query — multi-table join with filters and pagination
- Bulk insert — insert 1,000 records in a single operation

**File I/O**

An endpoint that reads and writes a file (e.g., CSV export/import of tasks). Measures how efficiently each runtime handles disk operations.

**Caching Layer (Redis)**

Add a Redis cache to a heavy database endpoint. Measure the response time with and without cache. Also tests how naturally each language integrates with an external service.

### 4.3 Concurrency & Scalability

**Parallel Requests**

Simultaneously hit multiple slow endpoints and observe how each language manages parallel work. This is where Go's goroutines and Rust's async model shine compared to Python's GIL and Node's single thread.

**Memory Usage Under Load**

Monitor RAM consumption while running the other benchmark tests. Node.js and Python typically consume more memory than Go and Rust — this test quantifies the difference.

### 4.4 Code Quality

**Error Handling & Validation**

Send intentionally malformed requests — bad JSON, missing required fields, wrong data types, invalid IDs. Evaluate how cleanly and consistently each framework handles and communicates errors. This is as much a developer experience measure as a performance one.

**Middleware & Authentication (JWT)**

Add JWT authentication middleware to all routes. Measure the overhead added per request and evaluate how naturally each framework supports middleware pipelines.

---

**Summary by category:**

| Category | Benchmark Tasks |
|---|---|
| Raw Speed | Load handling, JSON serialization, CPU-intensive task |
| I/O Efficiency | DB queries (simple, complex, bulk), File I/O, Redis caching |
| Concurrency | Parallel requests, Memory usage under load |
| Code Quality | Error handling & validation, Middleware & JWT auth |

---

## 5. What to Measure

For each benchmark task, record the following metrics consistently across all four implementations:

| Metric | How to Measure | Tools |
|---|---|---|
| Requests / second | JMeter load test | JMeter |
| Average response time (ms) | JMeter load test | JMeter |
| P95 / P99 latency | JMeter load test | JMeter |
| Error rate under load | JMeter load test | JMeter |
| Memory usage (MB) | OS monitoring during load | htop / docker stats |
| DB query time (ms) | Query timing in code | Language profiler |
| Cache hit speedup | Compare cached vs uncached | Redis + timer |
| Lines of code | Count per implementation | Manual / wc -l |
| Time to implement | Developer effort | Manual tracking |

---

## 6. Implementation Plan

Each language version should be built as a standalone application in its own directory. Suggested structure:

```
task-benchmark/
├── js-express/
├── python-fastapi/
├── go-gin/
├── rust-axum/
└── shared/
    ├── postgres/     # shared DB schema & seed data
    ├── redis/        # shared Redis config
    ├── jmeter/       # shared load test plans
    └── results/      # benchmark results per language
```

### Build Order

| Phase | Language | Milestone |
|---|---|---|
| 1 | JavaScript / Express | Baseline API — all endpoints working, JWT, PostgreSQL connected |
| 2 | Python / FastAPI | Same endpoints, introduce type hints and async patterns |
| 3 | Go / Gin | First compiled version — goroutines, explicit error handling |
| 4 | Rust / Axum | Final version — ownership model, max performance |
| 5 | Benchmarking | Run all JMeter tests, collect metrics, compare results |

---

## 7. Language & Framework Background

This section provides context on each language and framework for reference during implementation.

### JavaScript / Node.js + Express

JavaScript is the developer's primary language. Node.js brings JS to the server via the V8 engine with a non-blocking, event-driven I/O model. Express is a minimal, unopinionated framework — it provides routing and middleware and leaves everything else to the developer. This makes it flexible but requires more manual setup compared to opinionated frameworks like FastAPI or Rails.

### Python / FastAPI

Python is a high-level, dynamically typed language known for readability and a massive ecosystem. FastAPI is a modern async framework that uses Python type hints to automatically generate validation and API documentation (OpenAPI/Swagger). It is one of the fastest Python frameworks available and is growing rapidly in adoption.

### Go / Gin

Go is a compiled, statically typed language created at Google. It was designed specifically for networked services and cloud infrastructure — Docker, Kubernetes, and many cloud-native tools are written in Go. Its concurrency model (goroutines and channels) is simple and extremely efficient. Gin is a lightweight HTTP framework that adds routing and middleware on top of Go's standard `net/http` library.

### Rust / Axum

Rust is a systems programming language focused on safety and performance. It achieves memory safety without a garbage collector through its ownership model, which the compiler enforces at compile time. This makes it uniquely suited for high-performance services where memory predictability matters. Axum is a modern async web framework built on top of Tokio (Rust's async runtime) and is considered one of the most ergonomic Rust web frameworks today.

---

## 8. Notes & Decisions Log

| Date | Decision | Reason |
|---|---|---|
| 06/03/2026 | Ruby replaced by Rust in the language lineup | Rust is more relevant and modern; Ruby's market share has declined |
| 06/03/2026 | JavaScript added as the first language (baseline) | Developer's primary language; provides a familiar reference point |
| 06/03/2026 | PostgreSQL chosen as the shared database | Consistent across all four implementations for fair comparison |
| 06/03/2026 | JMeter chosen for load testing | Developer familiarity; feature-rich for HTTP load testing |

---

*— End of Document —*