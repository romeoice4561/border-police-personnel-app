# Border Patrol Personnel Intelligence Platform (BPPI)

# Development Standard

Version : 2.0

Status : Active

---

# Purpose

เอกสารนี้กำหนดมาตรฐานการพัฒนา BPPI

ทุก Developer

ทุก AI

ทุก Pull Request

ต้องปฏิบัติตาม

---

# Core Philosophy

Architecture

มาก่อน

Feature

Feature

มาก่อน

UI

UI

มาก่อน

Cosmetic

---

# Rule 1

Never Hardcode

ห้าม Hardcode

- ยศ
- หน่วย
- กองกำกับ
- กองร้อย
- จังหวัด
- Promotion Rule
- Document Type
- Asset Type

ทั้งหมดต้องอ่านจาก Master Data

---

# Rule 2

Everything Has UUID

ทุก Entity

ต้องมี UUID

ห้ามใช้ชื่อเป็น Primary Key

---

# Rule 3

Database First

ทุก Feature

เริ่มจาก Database

ก่อน

API

ก่อน

Frontend

---

# Rule 4

Business Logic Lives In Backend

Frontend

ห้ามคำนวณ

Promotion

Eligibility

Timeline

Business Rule

Frontend มีหน้าที่แสดงผลเท่านั้น

---

# Rule 5

One Responsibility

หนึ่ง Module

หนึ่งหน้าที่

Officer Module

ไม่จัดการ Asset

Gallery

ไม่คำนวณ Promotion

Promotion

ไม่จัดการ OCR

---

# Rule 6

AI Never Saves

AI

สร้าง Suggestion

เท่านั้น

Human

Approve

ก่อน Save

---

# Rule 7

Metadata Required

ทุก Asset

ต้องมี Metadata

ก่อนใช้งาน

---

# Rule 8

Audit Required

ทุก Update

ทุก Delete

ทุก Approve

ต้องสร้าง Audit

---

# Rule 9

API First

ทุก Feature

ต้องออกแบบ API ก่อน UI

---

# Rule 10

Search Uses Metadata

Search

ไม่ค้นจากชื่อไฟล์

---

# Rule 11

Folder Independent

Business Logic

ห้ามอ้างอิง Folder

---

# Rule 12

No Duplicate Data

ข้อมูลเดียว

เก็บครั้งเดียว

ใช้ Relation

---

# Rule 13

Everything Is Versioned

Document

Rule

Metadata

AI Result

รองรับ Version

---

# Rule 14

Soft Delete

ทุก Table

รองรับ Soft Delete

---

# Rule 15

Future Ready

ทุก Feature

ต้องรองรับ

AI

Automation

Scale
