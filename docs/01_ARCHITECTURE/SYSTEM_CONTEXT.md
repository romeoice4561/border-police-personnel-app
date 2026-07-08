# Border Patrol Personnel Intelligence Platform (BPPI)

# System Context

Version : 2.0

---

# Purpose

เอกสารฉบับนี้อธิบายภาพรวมของระบบ

- ระบบประกอบด้วยอะไร
- ใครใช้งาน
- ระบบภายนอกที่เชื่อมต่อ
- ข้อมูลไหลอย่างไร

เอกสารนี้ไม่ลงรายละเอียดโค้ด

แต่ใช้กำหนดขอบเขตของระบบทั้งหมด

---

# System Overview

BPPI เป็นศูนย์กลางข้อมูลกำลังพลของตำรวจตระเวนชายแดน

ระบบเชื่อมต่อข้อมูลจากหลายแหล่ง

- Google Drive
- เจ้าหน้าที่
- AI
- OCR
- ผู้บังคับบัญชา

ทุกข้อมูลจะถูกรวมเข้าสู่ฐานข้อมูลกลาง

จากนั้นจึงนำไปวิเคราะห์และแสดงผล

---

# External Systems

BPPI เชื่อมต่อกับระบบภายนอกดังต่อไปนี้

## Google Drive

หน้าที่

เก็บไฟล์

- GP7
- รูปภาพ
- เอกสาร
- PDF
- แผนที่

Google Drive ไม่มีหน้าที่เป็นฐานข้อมูล

---

## Google OAuth

ใช้สำหรับ Login

และกำหนดสิทธิ์

---

## OpenAI

ใช้สำหรับ

- OCR Analysis
- Metadata Extraction
- Timeline Extraction
- Summary
- Natural Language Search

ระบบต้องสามารถเปลี่ยน AI Provider ได้ในอนาคต

---

## Supabase

ใช้เป็น

Backend Platform

ประกอบด้วย

Database

Authentication

Storage (ถ้ามี)

Edge Function

Cron

Realtime

---

# Internal Modules

ระบบแบ่งออกเป็น

## Drive Sync

ตรวจสอบไฟล์ใหม่

Sync Metadata

อัปเดตฐานข้อมูล

---

## Asset Manager

จัดการไฟล์ทั้งหมด

---

## Officer Management

จัดการข้อมูลกำลังพล

---

## Timeline Engine

จัดเก็บประวัติราชการ

---

## OCR Engine

อ่าน GP7

อ่าน PDF

อ่านรูปภาพ

---

## AI Engine

วิเคราะห์ข้อมูล

สร้าง Metadata

สร้าง Timeline

ประเมินความเชื่อมั่น

---

## Verification

เจ้าหน้าที่ตรวจสอบข้อมูล

ก่อน Save

---

## Promotion Engine

คำนวณสิทธิ์

คุณสมบัติ

การเลื่อนตำแหน่ง

---

## Commander Dashboard

ระบบสำหรับผู้บังคับบัญชา

---

## Reporting

สร้างรายงาน

Export

PDF

Excel

---

# User Types

Administrator

Staff

Commander

Executive

Viewer

---

# High Level Flow

เจ้าหน้าที่

↓

Upload GP7

↓

Google Drive

↓

Drive Sync

↓

OCR

↓

AI

↓

Metadata

↓

Human Verify

↓

Approve

↓

Database

↓

Dashboard

↓

Commander

---

# Future Integrations

ในอนาคตระบบสามารถเชื่อมต่อ

- HR System
- GIS
- Training System
- Mobile App
- LINE
- Telegram
- Government API

โดยไม่ต้องเปลี่ยน Architecture

---

# Design Constraint

BPPI

ต้องสามารถทำงานได้

แม้เปลี่ยน

AI

Cloud

Database

Storage

ในอนาคต

Architecture ต้องไม่ผูกกับ Vendor รายใดรายหนึ่ง

---

End of Document