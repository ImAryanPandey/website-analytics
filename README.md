# Website Analytics Ingestion Service

This project is a high-throughput backend service to capture website analytics events, built as per the problem statement. It consists of three distinct services designed to handle high-volume traffic by decoupling event ingestion from processing.

## Core Services

1. **Ingestion API (Service 1):**  
   A minimal Express.js server on port `3000` that exposes a `POST /event` endpoint.  
   Its only job is to validate the request and add it to an asynchronous queue.  
   It responds immediately, ensuring the client never waits for a database write.

2. **Processor (Service 2):**  
   A background worker script that pulls events from the queue and writes them to the database.

3. **Reporting API (Service 3):**  
   A separate Express.js server on port `3001` that exposes a `GET /stats` endpoint.  
   It queries the MongoDB database using an aggregation pipeline to return summarized analytics.

---

## Architecture Decision

The problem statement required an ingestion endpoint that is **extremely fast** and does **not** make the client wait for a database write.

To achieve this, the system uses an **asynchronous queueing architecture**:

### **Queue: BullMQ + Redis**
- The Ingestion API simply pushes events to a Redis-backed queue (`eventQueue.add()`).
- This operation is in-memory, extremely fast, and completes instantly.
- The Processor service consumes events from this queue and performs the slower MongoDB writes.
- This decouples ingestion from processing and satisfies the speed requirement.

### **Database: MongoDB**
- Document-based structure is ideal for analytics events.
- MongoDB’s **Aggregation Pipeline** (particularly using `$facet`) efficiently computes:
  - total views  
  - unique users  
  - top paths  
- This allows summarization directly in the database instead of in the Node.js application.

---

## Database Schema

**Database:** `analyticsDB`  
**Collection:** `events`

### Document Structure:

```json
{
  "site_id": "site-abc-123",
  "event_type": "page_view",
  "path": "/pricing",
  "user_id": "user-xyz-789",
  "timestamp": "2025-11-12T19:30:01Z"
}
```

### Recommended Indexes:
- `site_id` (for filtering)
- `timestamp` (for date-range filtering)
- `user_id` (for unique user aggregation)

---

## Setup Instructions

These instructions assume a Linux/WSL environment with Node.js, `pnpm`, and Docker installed.

### **1. Clone the repository:**

```bash
git clone https://github.com/ImAryanPandey/website-analytics.git
cd website-analytics
```

### **2. Install Dependencies:**

```bash
pnpm install
```

### **3. Start Databases (Redis & Mongo):**

This project uses `docker-compose` to run the required databases.

```bash
# You may need 'sudo' if your user is not in the 'docker' group
sudo docker compose up -d
```

> These containers do **not** restart automatically. You will need to re-run this command every time you restart your system.

### **4. Run the Services:**

Open **three (3) separate terminals** and run one command in each:

#### **Terminal 1 — Ingestion API:**

```bash
node --watch ingestion-api.js
# Expected: Ingestion API listening on port 3000
```

#### **Terminal 2 — Processor:**

```bash
node --watch processor.js
# Expected: Processor (Service 2) is running and waiting for jobs...
```

#### **Terminal 3 — Reporting API:**

```bash
node --watch reporting-api.js
# Expected: Reporting API (Service 3) listening on port 3001
```

The system is now fully operational.

---

## API Usage

You can test the endpoints using `curl` from a fourth terminal.

---

### **1. POST /event** (Ingestion API)

Send analytics events to this endpoint.  
You should receive an immediate:

```json
{"message":"Event received"}
```

### Example `curl` commands:

```bash
# Send Event 1
curl -X POST 'http://localhost:3000/event' -H 'Content-Type: application/json' \
--data-raw '{
    "site_id": "site-abc-123",
    "event_type": "page_view",
    "path": "/pricing",
    "user_id": "user-xyz-789",
    "timestamp": "2025-11-12T19:30:01Z"
}'
```

```bash
# Send Event 2
curl -X POST 'http://localhost:3000/event' -H 'Content-Type: application/json' \
--data-raw '{
    "site_id": "site-abc-123",
    "event_type": "page_view",
    "path": "/blog/post-1",
    "user_id": "user-abc-111",
    "timestamp": "2025-11-12T19:32:00Z"
}'
```

### Processor Logs (Terminal 2):

```
[Processor] Successfully saved event for site: site-abc-123
[Processor] Job 1 has completed.
...
```

---

### **2. GET /stats** (Reporting API)

Retrieve the summarized statistics for a given `site_id` and date.

### Example command:

```bash
curl 'http://localhost:3001/stats?site_id=site-abc-123&date=2025-11-12'
```

### Example Response:

```json
{
  "site_id": "site-abc-123",
  "date": "2025-11-12",
  "total_views": 2,
  "unique_users": 2,
  "top_paths": [
    { "path": "/pricing", "views": 1 },
    { "path": "/blog/post-1", "views": 1 }
  ]
}
```

---
