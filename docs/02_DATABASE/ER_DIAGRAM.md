# Border Patrol Personnel Intelligence Platform (BPPI)

# Entity Relationship Design

Version : 2.0

Status : Core Database Blueprint

---

# Purpose

เอกสารฉบับนี้กำหนดความสัมพันธ์ของทุก Entity ภายในระบบ

ใช้เป็นมาตรฐานในการสร้าง

- Prisma Schema
- SQL Migration
- Supabase
- API
- Backend
- AI

ทุกการเปลี่ยนแปลงความสัมพันธ์ของฐานข้อมูล
ต้องอ้างอิงเอกสารนี้

---

# Core Database Domains

ระบบแบ่งออกเป็น 10 Domain

1. Master Data

2. Organization

3. Officer

4. Timeline

5. Asset

6. AI

7. Promotion

8. Commander

9. Search

10. System

---

# High Level ER Diagram

```text
                    Master Data
                         │
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    Organization      Officer      Promotion
          │              │              │
          │              ▼              │
          │         Career Timeline     │
          │              │              │
          │              ▼              │
          │            Assets           │
          │              │              │
          │      ┌───────┼────────┐      │
          │      ▼       ▼        ▼      │
          │     OCR      AI   Verification│
          │                               │
          └──────────────┬────────────────┘
                         ▼
                  Search Index
                         │
                         ▼
                 Analytics Layer
                         │
                         ▼
                Commander Dashboard
```

---

# Organization Relationship

Region

1

↓

Many

Command

Command

1

↓

Many

Subdivision

Subdivision

1

↓

Many

Company

Company

1

↓

Many

Officer

---

# Officer Relationship

Officer

1

↓

Many

Timeline

Officer

1

↓

Many

Assets

Officer

1

↓

Many

Training

Officer

1

↓

Many

Award

Officer

1

↓

Many

Promotion Evaluation

Officer

1

↓

One

Officer Contact

Officer

1

↓

One

Service Information

Officer

1

↓

One

Profile Statistics

---

# Timeline Relationship

Timeline

1

↓

Many

Timeline Assets

Timeline

1

↓

Many

Timeline Events

Timeline

1

↓

Many

AI Results

Timeline

Many

↓

One

Officer

---

# Asset Relationship

Asset

1

↓

One

Metadata

Asset

1

↓

Many

OCR Results

Asset

1

↓

Many

AI Results

Asset

1

↓

Many

Verification

Asset

Many

↓

One

Officer

Asset

Many

↓

One

Timeline

---

# Promotion Relationship

Promotion Rule

1

↓

Many

Promotion Evaluation

Promotion Evaluation

Many

↓

One

Officer

---

# Search Relationship

Officer

↓

Search Index

Timeline

↓

Search Index

Asset

↓

Search Index

Document

↓

Search Index

Promotion

↓

Search Index

Search Index

เป็น Shared Index

ของทั้งระบบ

---

# Commander Relationship

Commander

1

↓

Many

Favorite Officer

Commander

1

↓

Many

Candidate List

Candidate List

1

↓

Many

Candidate Item

Candidate Item

Many

↓

One

Officer

---

# Aggregate Roots

Officer

Organization

Asset

Promotion

ถือเป็น Aggregate Root

Domain อื่น

ต้องอ้างอิงผ่าน Aggregate Root

---

# Cardinality Rules

Officer

1:N

Timeline

Officer

1:N

Asset

Officer

1:N

Promotion

Officer

1:1

Contact

Timeline

1:N

Timeline Asset

Asset

1:N

AI Result

Asset

1:N

OCR Result

Asset

1:N

Verification

---

# Cascade Rules

Officer

ห้าม Cascade Delete

Timeline

ห้าม Cascade Delete

Asset

ห้าม Cascade Delete

Promotion

ห้าม Cascade Delete

ใช้ Soft Delete

ทุก Domain

---

# Referential Integrity

ทุก Foreign Key

ต้องเปิดใช้งาน

ทุก Constraint

ต้องกำหนด

อย่างชัดเจน

ห้ามปล่อย

Orphan Record

---

# Many-to-Many Tables

Timeline

⇄

Asset

ใช้

timeline_assets

Officer

⇄

Training

ใช้

officer_trainings

Officer

⇄

Award

ใช้

officer_awards

Officer

⇄

Favorite

ใช้

commander_favorites

Asset

⇄

Tag

ใช้

asset_tags

---

# Index Strategy

Primary Key

UUID

BTree

Foreign Key

Index

ทุกตัว

Search

GIN

JSONB

GIN

Vector

IVFFlat

เมื่อเปิดใช้

Semantic Search

---

# Entity Priority

Critical

Officer

Timeline

Asset

Organization

Master Data

High

Promotion

AI

OCR

Verification

Medium

Notification

Favorite

Dashboard

Analytics

Low

Cache

Search History

Saved Query

---

# Final Principle

ทุก Entity

ต้องตอบคำถามได้

ข้อมูลนี้

เป็นของใคร

เชื่อมกับอะไร

ค้นหาอย่างไร

ตรวจสอบย้อนหลังได้หรือไม่

ใช้ AI ได้หรือไม่

ถ้าตอบไม่ได้

แสดงว่า

Entity นั้น

ยังออกแบบไม่สมบูรณ์

---

End of Document