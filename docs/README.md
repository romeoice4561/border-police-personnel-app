# Border Patrol Personnel Intelligence Platform (BPPI)

> Master documentation index

Version 2.0

---

# Project Overview

BPPI (Border Patrol Personnel Intelligence Platform) คือระบบฐานข้อมูลกำลังพลอัจฉริยะของตำรวจตระเวนชายแดน

เป้าหมายของระบบ

- รวมข้อมูลกำลังพลทั้งหมดไว้ในระบบเดียว
- เชื่อม Google Drive กับฐานข้อมูล
- ใช้ AI วิเคราะห์ข้อมูล
- สร้าง Digital Twin ของกำลังพลทุกนาย
- วิเคราะห์การเติบโตในสายอาชีพ
- วิเคราะห์สิทธิ์การแต่งตั้ง
- วิเคราะห์กำลังพลเพื่อช่วยผู้บังคับบัญชาตัดสินใจ

---

# Documentation Structure

```
docs/

00_PROJECT
01_ARCHITECTURE
02_DATABASE
10_PRODUCT
FEATURES
```

---

# Reading Order (Very Important)

AI Assistants MUST read documents in this order.

---

## 1. Product

Defines the vision and purpose of the project.

- PRODUCT_VISION.md

---

## 2. Project Governance

Project rules and implementation standards.

Located in

```
docs/00_PROJECT/
```

Read in order

- PROJECT_CONSTITUTION.md
- PROJECT_MASTER_PLAN.md
- CURRENT_SPRINT.md
- DEVELOPMENT_STANDARD.md
- DESIGN_DECISIONS.md
- ARCHITECTURE.md

---

## 3. Architecture

Located in

```
docs/01_ARCHITECTURE/
```

Read in order

- SYSTEM_CONTEXT.md
- PERSONNEL_OPERATING_SYSTEM.md
- OFFICER_DIGITAL_TWIN.md

---

## 4. Database

Located in

```
docs/02_DATABASE/
```

Read in order

- DATABASE_V2_DESIGN.md
- ER_DIAGRAM.md
- DOMAIN_MODEL.md
- MASTER_DATA.md

---

## 5. Feature Specifications

Located in

```
docs/FEATURES/
```

Current Features

- EPIC_001_GALLERY_INTELLIGENCE.md

Future Features

- Promotion Engine
- AI Recommendation Engine
- Commander Dashboard
- Asset Intelligence
- OCR Intelligence
- Metadata Intelligence

---

# Source of Truth

The following documents are considered authoritative.

1.

DATABASE_V2_DESIGN.md

2.

ER_DIAGRAM.md

3.

DOMAIN_MODEL.md

4.

MASTER_DATA.md

5.

PROJECT_CONSTITUTION.md

If implementation conflicts with these documents,

THESE DOCUMENTS WIN.

---

# AI Development Workflow

Every AI session should follow this order.

Step 1

Read README.md

↓

Step 2

Read Current Sprint

↓

Step 3

Read Architecture

↓

Step 4

Read Database Design

↓

Step 5

Read Feature Specification

↓

Step 6

Inspect Current Code

↓

Step 7

Implement

↓

Step 8

Build

↓

Step 9

Test

↓

Step 10

Commit

---

# Coding Philosophy

Never redesign existing architecture.

Never rewrite stable modules.

Prefer extending existing systems.

Backward compatibility is preferred.

No destructive database changes.

Never guess database structures.

Always inspect current implementation before coding.

---

# Current Status

Project Stage

Version 2

Architecture Complete

Database Design Complete

Master Data Design Complete

Digital Twin Design Complete

Gallery Intelligence Design Complete

Implementation in Progress

---

# Long-term Roadmap

Phase 1

Foundation

✅ Completed

---

Phase 2

Gallery Intelligence

In Progress

---

Phase 3

Officer Workspace

In Progress

---

Phase 4

Promotion Intelligence

Planned

---

Phase 5

Commander Dashboard

Planned

---

Phase 6

AI Intelligence

Planned

---

Phase 7

Enterprise Intelligence Platform

Planned

---

# Notes for AI

Before making any implementation,

always read

README.md

first.

Never skip documentation.

Never assume architecture.

The documentation is the single source of truth.