# Border Patrol Personnel Intelligence Platform (BPPI)

# Domain Model

Version : 2.0

Status : Core Design

---

# Purpose

เอกสารฉบับนี้อธิบาย

Business Object

ของระบบทั้งหมด

ทุก Module

Database

API

AI

ต้องอ้างอิง Domain Model เดียวกัน

ห้ามสร้าง Entity ใหม่โดยไม่มีเหตุผล

---

# Philosophy

ระบบนี้ไม่ได้มี

Officer

เป็นศูนย์กลาง

แต่มี

Personnel Intelligence

เป็นศูนย์กลาง

Officer เป็นเพียงหนึ่งในหลาย Domain

---

# Core Domains

ระบบแบ่งออกเป็น 12 Domain หลัก

Officer

Timeline

Asset

Document

Organization

Promotion

Training

Award

AI

Search

Audit

Master Data

---

# Officer Domain

แทนตัวบุคคล

หนึ่งคน

หนึ่ง Record

Officer ไม่มีข้อมูลซ้ำ

Officer เชื่อมกับทุก Domain

---

Officer

↓

Timeline

↓

Promotion

↓

Documents

↓

Gallery

↓

Training

↓

Awards

---

# Timeline Domain

Timeline

คือประวัติราชการทั้งหมด

ไม่ใช่เฉพาะการย้ายหน่วย

Timeline ประกอบด้วย

แต่งตั้ง

ย้าย

เลื่อนยศ

หลักสูตร

เงินเดือน

คำสั่ง

ผลงาน

เกษียณ

---

# Asset Domain

ทุกไฟล์ในระบบ

คือ Asset

ไม่ว่าจะเป็น

รูป

PDF

Video

GP7

Map

Certificate

Timeline

Report

Book

---

Asset

จะไม่ผูกกับ Google Drive

แต่ผูกกับ

Asset ID

---

# Document Domain

Document

คือข้อมูลที่ AI อ่านได้

เช่น

GP7

คำสั่ง

หนังสือราชการ

หนังสือรับรอง

Certificate

Document สามารถสร้าง

Timeline

ได้

---

# Organization Domain

แทนหน่วยงานทั้งหมด

ภาค

↓

กองบังคับการ

↓

กองกำกับ

↓

กองร้อย

↓

หมวด

↓

ฐาน

ทุกระดับเป็น Tree Structure

---

# Promotion Domain

แทน

คุณสมบัติ

การเลื่อนตำแหน่ง

การเลื่อนยศ

Eligibility

Recommendation

History

---

# Training Domain

เก็บ

หลักสูตร

ชั่วโมง

รุ่น

ปี

ผลการอบรม

ใบประกาศ

---

# Award Domain

เก็บ

รางวัล

เครื่องราช

ประกาศ

เกียรติบัตร

---

# AI Domain

AI ไม่มีข้อมูลถาวร

AI มีหน้าที่

อ่าน

วิเคราะห์

แนะนำ

AI Result

เก็บแยก

ไม่เขียนทับข้อมูลจริง

---

# Search Domain

Search

ไม่ค้นจากชื่อไฟล์

แต่ค้นจาก

Metadata

Timeline

AI Summary

OCR

Tag

Keyword

---

# Audit Domain

ทุกการเปลี่ยนแปลง

สร้าง Audit

เสมอ

ไม่มี Exception

---

# Master Data Domain

Master Data

ควบคุม

Rank

Position

Company

Subdivision

Province

Course

Asset Type

Document Type

Promotion Rule

---

# Domain Relationships

Officer

↓

Timeline

↓

Timeline Event

↓

Asset

↓

Document

↓

AI Result

Officer

↓

Promotion

↓

Eligibility

↓

Recommendation

Officer

↓

Training

↓

Course

↓

Certificate

Officer

↓

Award

↓

Achievement

---

# Aggregate Root

Officer

Asset

Organization

Promotion

ถือเป็น Aggregate Root

Domain อื่น

ต้องอ้างอิง

Aggregate Root

---

# Design Rules

ทุก Domain

ต้องมี

UUID

Created At

Updated At

Status

Created By

Updated By

---

ห้ามใช้ชื่อ

เป็น Primary Key

---

ทุกความสัมพันธ์

ใช้ ID

---

ทุก Domain

รองรับ Soft Delete

---

ทุก Domain

รองรับ Audit

---

ทุก Domain

รองรับ AI

---

End of Document