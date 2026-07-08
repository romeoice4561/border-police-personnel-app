# Border Patrol Personnel Intelligence Platform (BPPI)

Version : 2.0

Status : In Development

Last Updated : 2026-07-08

---

# Project Vision

Border Patrol Personnel Intelligence Platform (BPPI) คือระบบบริหารข้อมูลกำลังพลอัจฉริยะสำหรับตำรวจตระเวนชายแดน

เป้าหมายของระบบไม่ใช่เพียงการเก็บข้อมูลกำลังพล แต่เป็นแพลตฟอร์มที่ช่วยผู้บังคับบัญชาวิเคราะห์ข้อมูล ประเมินคุณสมบัติ และสนับสนุนการตัดสินใจด้านการบริหารกำลังพล

ระบบจะใช้ AI เป็นผู้ช่วยในการอ่านเอกสาร วิเคราะห์ข้อมูล และแนะนำผลลัพธ์ โดยมีเจ้าหน้าที่เป็นผู้ตรวจสอบและยืนยันความถูกต้องก่อนบันทึกเข้าสู่ฐานข้อมูล

---

# Core Principles

ทุกการพัฒนาจะยึดหลักดังต่อไปนี้

1. Google Drive เป็น Storage ไม่ใช่ Database

2. PostgreSQL คือแหล่งข้อมูลหลักของระบบ (Single Source of Truth)

3. AI มีหน้าที่ช่วยวิเคราะห์ ไม่สามารถบันทึกข้อมูลได้เอง

4. ทุกข้อมูลต้องผ่าน Human Verification

5. Business Rules ต้องอยู่ในฐานข้อมูล ไม่ Hardcode

6. ทุกข้อมูลต้องมี Metadata

7. ทุกการแก้ไขต้องสามารถตรวจสอบย้อนหลังได้ (Audit Log)

8. ระบบต้องรองรับการขยายทุกภาค ทุกกองกำกับ ทุกกองร้อย โดยไม่ต้องแก้โครงสร้าง

---

# Current Project Status

กำลังอยู่ในช่วงออกแบบ Version 2.0

เป้าหมายคือเปลี่ยนระบบจาก

Google Drive Viewer

เป็น

Personnel Intelligence Platform

---

# Development Strategy

ใช้แนวทาง

Architecture While Building

ออกแบบ → พัฒนา → ทดสอบ → Deploy

ทีละ Feature

ไม่เขียนเอกสารจำนวนมากก่อนเริ่มพัฒนา

---

# Major Modules

- Google Drive Sync
- Metadata Engine
- OCR Engine
- AI Extraction
- Human Verification
- Officer Profile
- Timeline Engine
- Gallery Asset Manager
- Promotion Rule Engine
- Commander Dashboard
- AI Assistant
- Notification System
- Data Quality Engine
- Reporting System

---

# Development Phases

Phase 1
Data Foundation

Phase 2
Officer Management

Phase 3
Gallery & Asset Management

Phase 4
OCR + AI

Phase 5
Promotion Engine

Phase 6
Commander Dashboard

Phase 7
Executive AI Assistant

---

# Success Criteria

ระบบสามารถ

✓ จัดเก็บข้อมูลกำลังพล

✓ Sync จาก Google Drive

✓ ใช้ AI อ่าน GP7

✓ คำนวณสิทธิ์การเลื่อนตำแหน่ง

✓ ค้นหาบุคลากรด้วย AI

✓ สร้าง Dashboard สำหรับผู้บังคับบัญชา

✓ รองรับการขยายในอนาคตโดยไม่ต้องรื้อโครงสร้าง