# System Architecture Diagram

This document illustrates the event-driven architecture and processing flow within the API Gateway & Event System, highlighting the shared connection pools, dedicated worker connections, and queue structures.

## System Topology & Flow Diagram

```mermaid
graph TD
    %% Clients and API Gateway
    Client[HTTP Client] -->|1. Request /api/events/*| Gateway[Express API Gateway]
    Gateway -->|2. Get Connection| RedisPool[RedisConnectionFactory]
    
    %% Redis connection separation
    subgraph Connection Pooling
        RedisPool -->|Shared Client Conn| RedisShared[Shared Redis Connection]
        RedisPool -->|Worker Duplicate Conn 1| WorkerConn1[Worker Dedicated Redis Conn]
        RedisPool -->|Worker Duplicate Conn 2| WorkerConn2[Worker Dedicated Redis Conn]
    end

    %% Event Bus
    Gateway -->|3. Publish Event| RedisEventBus[RedisEventBus]
    RedisEventBus -->|Shared Conn| RedisShared
    
    %% Redis Queues
    subgraph Redis BullMQ Event Queues
        Queue1[(Queue: client.created)]
        Queue2[(Queue: document.uploaded)]
        Queue3[(Queue: document.ocr.completed)]
        Queue4[(Queue: document.validation.completed)]
        Queue5[(Queue: review.approved)]
        Queue6[(Queue: face.verification.completed)]
        Queue7[(Queue: crm.sync.completed)]
        DLQ[(Dead Letter Queues: *.dlq)]
    end
    
    RedisShared -->|Enqueue| Queue1
    RedisShared -->|Enqueue| Queue2
    
    %% Workers & Consumers
    subgraph Consumers & Workers
        OCRWorker[OCR Worker]
        ValidationWorker[Validation Worker]
        ReviewWorker[Review Worker]
        FaceWorker[Face Verification Worker]
        CRMWorker[CRM Sync Worker]
        KYCWorker[KYC Completion Worker]
    end
    
    WorkerConn1 -->|BZPOP / Polling| OCRWorker
    WorkerConn2 -->|BZPOP / Polling| ValidationWorker

    %% Flow transitions
    Queue2 -->|OCR Service| OCRWorker
    OCRWorker -->|4. Publish document.ocr.completed| Queue3
    
    Queue3 -->|Validation Service| ValidationWorker
    ValidationWorker -->|5. Publish document.validation.completed| Queue4
    
    Queue4 -->|Review Service| ReviewWorker
    ReviewWorker -->|6. Publish review.approved| Queue5
    
    Queue5 -->|Face Verification Service| FaceWorker
    FaceWorker -->|7. Publish face.verification.completed| Queue6
    
    Queue6 -->|CRM Sync Service| CRMWorker
    CRMWorker -->|8. Publish crm.sync.completed| Queue7
    
    Queue7 -->|KYC Service| KYCWorker
    
    %% DLQ Fallback
    OCRWorker -.->|Fails 5x| DLQ
    ValidationWorker -.->|Fails 5x| DLQ
    ReviewWorker -.->|Fails 5x| DLQ
    
    %% Observability
    Gateway -->|Metrics / Health| Prometheus[Prometheus / metrics]
    Prometheus -->|Live stats| RedisShared
```

## Architectural Highlights

1. **Connection Hardening:** 
   - Non-blocking components (Express Route Handlers, publishers, registries, database updates) share a single primary Redis connection.
   - CPU-blocking and polling components (BullMQ `Worker` threads) duplicate the Redis connection dynamically to guarantee isolated network buffers.
2. **Event Pipeline Chaining:**
   - Event processing is completely decoupled. One consumer finishes processing, saves state to the database, and publishes the next event in the chain to trigger the next worker.
3. **Observability Integration:**
   - The main `/metrics` endpoint dynamically queries the queues for live statistics, updating gauge metrics to show active worker load, backlog queue depth, and dead letters.
