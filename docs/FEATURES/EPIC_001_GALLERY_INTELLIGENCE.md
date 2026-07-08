# EPIC-001

# Gallery Intelligence V2

Status

Draft

Priority

⭐⭐⭐⭐⭐ Highest

Estimated Version

Version 2.0

---

# Objective

เปลี่ยน Gallery จาก

"หน้าแสดงรูปภาพ"

ให้กลายเป็น

Asset Intelligence Platform

Gallery จะไม่ทำหน้าที่เก็บเฉพาะรูปภาพอีกต่อไป

แต่เป็นศูนย์กลางของ Asset ทุกชนิดในระบบ

ได้แก่

- Profile
- GP7
- Map
- Structure
- Certificate
- Achievement
- Report
- Video
- Document

ทุก Asset จะมี Metadata และสามารถค้นหาได้ทันที

---

# Problems Today

จากการทดสอบระบบจริงพบปัญหาดังนี้

## Problem 1

Gallery รวมทุกกองกำกับไว้หน้าเดียว

แม้ Google Drive จะแยก Folder แล้ว

---

## Problem 2

Search ใช้ข้อความ

ไม่ได้ใช้ Metadata

ทำให้ค้นหาไม่แม่น

---

## Problem 3

ไม่มี Filter

กองกำกับ

กองร้อย

ภาค

ประเภทไฟล์

---

## Problem 4

Profile

Map

Structure

ปะปนกัน

---

## Problem 5

Verification ไม่มีความหมาย

กด "ยืนยัน"

แต่ไม่มี Metadata ให้ยืนยัน

---

## Problem 6

AI ยังไม่มีข้อมูลมาตรฐาน

จึงไม่สามารถจัดหมวดหมู่ได้แม่นยำ

---

# Business Goal

เจ้าหน้าที่

สามารถจัดหมวดหมู่ไฟล์ได้ภายในไม่กี่วินาที

ผู้บังคับบัญชา

ค้นหารูปภาพได้ภายในไม่กี่วินาที

AI

เข้าใจทุก Asset

---

# Functional Requirements

Gallery ต้องรองรับ

✓ รูปภาพ

✓ PDF

✓ GP7

✓ หนังสือราชการ

✓ Video

✓ Certificate

✓ Map

✓ Structure

✓ Timeline Attachment

✓ Achievement

---

# Gallery Layout

ด้านบน

Search

Filter

Sort

Bulk Action

ด้านล่าง

Asset Grid

---

# Search

Search

ต้องค้นหาจาก

Officer Name

Rank

Position

Company

Subdivision

Region

Document Type

Tag

Keyword

AI Metadata

ไม่ใช้ชื่อไฟล์อย่างเดียว

---

# Filters

ต้องมี Filter อย่างน้อย

ประเภทไฟล์

ภาค

กองกำกับ

กองร้อย

Officer

Verified

AI Status

OCR Status

Year

Month

Document Type

Asset Type

---

# Metadata Panel

ทุก Asset

ต้องมี

Type

Region

Subdivision

Company

Officer

Created Date

Verified

AI Confidence

OCR Status

Document Type

Tags

Owner

Drive Link

---

# Verification

Workflow ใหม่

Upload

↓

AI

↓

Metadata

↓

Human Verify

↓

Approve

↓

Save

---

# Bulk Verification

สามารถเลือกหลายไฟล์

แล้วกำหนด

กองกำกับ

กองร้อย

ประเภท

พร้อมกัน

ได้

---

# Manual Edit

เจ้าหน้าที่สามารถแก้

Metadata

ได้

ทุกช่อง

---

# Auto Suggest

AI

แนะนำ

กองกำกับ

กองร้อย

Officer

Document Type

โดยอัตโนมัติ

---

# Gallery Card

แต่ละรูปต้องแสดง

Thumbnail

Officer

ประเภท

กองกำกับ

กองร้อย

Verification

AI Confidence

ปุ่ม Edit

ปุ่ม Preview

---

# Detail Dialog

เมื่อเปิด

ต้องเห็น

Preview

Metadata

Timeline

Drive Link

OCR

AI Summary

History

Audit

---

# Future

รองรับ

Face Recognition

Duplicate Detection

AI Caption

Semantic Search

Natural Language Search

---

# Definition of Done

Gallery

ไม่ใช้ Folder

เป็นตัวกรองอีกต่อไป

Gallery

ใช้ Metadata 100%

Filter

ทำงานครบ

Search

ทำงานครบ

Verification

ใช้งานจริง

Bulk Edit

ใช้งานจริง

AI Suggestion

ใช้งานจริง

Officer Profile

เชื่อมกับ Gallery ได้

Dashboard

ใช้ Metadata จาก Gallery ได้

# Technical Requirements

## Gallery must never read Google Drive directly

Gallery อ่านข้อมูลจาก PostgreSQL เท่านั้น

Google Drive มีหน้าที่เก็บไฟล์

Metadata ทุกอย่างต้องอยู่ใน Database

---

## Asset Identity

ทุก Asset ต้องมี

Asset ID

และ

Drive File ID

Asset ID เป็น Primary Key ภายในระบบ

Drive File ID ใช้เชื่อมกับ Google Drive

ห้ามใช้ชื่อไฟล์เป็น Primary Identifier

---

## Metadata Schema

ทุก Asset ต้องรองรับ Metadata อย่างน้อยดังนี้

- Asset Type
- Document Type
- Region
- Subdivision
- Company
- Officer
- Rank
- Position
- Timeline Event
- Tags
- Created Date
- Updated Date
- Verified
- OCR Status
- AI Status
- AI Confidence
- Owner
- Drive Folder
- Drive File ID

---

## Search Engine

Search ต้องสามารถค้นหาได้จาก

Officer Name

Officer Code

Rank

Position

Subdivision

Company

Province

Keyword

Tag

Document Type

Asset Type

AI Summary

OCR Text

Search จะไม่ค้นหาเฉพาะชื่อไฟล์

---

## Filter Engine

รองรับ Filter หลายตัวพร้อมกัน

ตัวอย่าง

ภาค 4

+

กก.ตชด.42

+

ร้อย ตชด.425

+

Verified

+

Profile

ผลลัพธ์ต้องถูกต้อง

---

## Sort

รองรับ

Newest

Oldest

Officer Name

Rank

AI Confidence

Recently Updated

File Size

---

## Pagination

Gallery ต้องรองรับ

หลายแสนไฟล์

ห้ามโหลดทั้งหมด

ใช้ Pagination

หรือ Infinite Scroll

---

# Database Impact

ต้องเพิ่มตารางใหม่

Asset

Asset Metadata

Asset Tag

Asset Verification

Asset History

Asset OCR

Asset AI Result

Asset Relation

---

Officer จะเชื่อมกับ Asset ผ่าน

Officer ID

ไม่ใช่ชื่อ

---

# API Requirements

Gallery API

GET /assets

GET /assets/{id}

POST /assets

PATCH /assets/{id}

DELETE /assets/{id}

POST /assets/bulk-update

POST /assets/verify

POST /assets/reclassify

POST /assets/ocr

POST /assets/ai

---

# User Interface

ด้านบน

Search Box

Quick Filter

Advanced Filter

Bulk Action

Refresh

Sync

---

Sidebar

Asset Type

Region

Subdivision

Company

Verified

OCR

AI

---

Card

Thumbnail

Officer

Subdivision

Company

Document Type

AI Confidence

Verified

Preview

Edit

---

Detail

Preview

Metadata

Timeline

OCR

AI

History

Audit

---

# AI Responsibilities

AI ต้องสามารถ

จำแนกประเภทไฟล์

อ่านข้อความ

แนะนำ Officer

แนะนำกองกำกับ

แนะนำกองร้อย

สร้าง Metadata

สรุปเอกสาร

ตรวจจับข้อมูลผิด

ประเมิน Confidence

---

# Human Responsibilities

เจ้าหน้าที่สามารถ

แก้ Metadata

แก้ Officer

แก้หน่วย

Approve

Reject

Merge

Split

Delete

---

# Performance Requirements

เปิด Gallery

ไม่เกิน

2 วินาที

Search

ไม่เกิน

1 วินาที

Filter

ไม่เกิน

1 วินาที

Preview

ไม่เกิน

2 วินาที

---

# Security

เฉพาะ Staff ขึ้นไป

แก้ Metadata

Commander

อ่านได้

Viewer

ดูอย่างเดียว

Admin

ทุกสิทธิ์

---

# Acceptance Criteria

ระบบถือว่าเสร็จเมื่อ

Gallery ไม่ใช้ Folder เป็น Filter

Search ใช้ Metadata

Filter ทำงานครบ

Bulk Edit ใช้งานได้

Verification ใช้งานได้

Officer เชื่อมกับ Asset

AI Suggestion ใช้งานได้

OCR ใช้งานได้

Dashboard ใช้ข้อมูลชุดเดียวกัน

ไม่มีข้อมูลซ้ำ

---

# Claude Build Prompt

Objective

Refactor Gallery ให้เป็น Asset Intelligence Platform

Requirements

- ใช้ Metadata ทั้งหมด
- รองรับ Asset ทุกชนิด
- เพิ่มระบบ Filter
- เพิ่ม Bulk Edit
- เพิ่ม Verification
- รองรับ AI Suggestion
- รองรับ OCR Result
- ใช้ PostgreSQL เป็นแหล่งข้อมูลหลัก
- ห้าม Query Google Drive โดยตรง
- ออกแบบให้รองรับหลายแสน Asset

Definition of Done

ทุก Requirement ในเอกสารฉบับนี้ต้องผ่านก่อน Merge

# UX Design Specification

## Design Principles

Gallery ต้องเป็นเครื่องมือทำงาน

ไม่ใช่แค่หน้าดูรูป

ผู้ใช้ต้องสามารถจัดการ Asset ได้จำนวนมากโดยใช้คลิกให้น้อยที่สุด

---

# Gallery Layout

+---------------------------------------------------------+

Search

---------------------------------------------------------

Region ▼

Subdivision ▼

Company ▼

Asset Type ▼

Verified ▼

AI ▼

OCR ▼

---------------------------------------------------------

Bulk Action

Refresh

Sync

---------------------------------------------------------

Asset Grid

---------------------------------------------------------

Pagination

+---------------------------------------------------------+

---

# Asset Card

ทุก Card ต้องแสดง

Thumbnail

Officer Name

Rank

Subdivision

Company

Asset Type

Verified Badge

AI Confidence

OCR Badge

Updated Date

Quick Action

- Preview

- Edit Metadata

- Open Drive

- History

---

# Bulk Mode

เมื่อเลือกหลาย Asset

Toolbar จะเปลี่ยนเป็น

Assign Region

Assign Subdivision

Assign Company

Assign Officer

Verify

Reclassify

Delete

Run OCR

Run AI

ทั้งหมดในครั้งเดียว

---

# Metadata Edit Dialog

แบ่งเป็น 5 Section

General

Location

Officer

AI

History

ไม่ควรเปิดทั้งหมดในหน้าเดียว

---

# Smart Search

รองรับ

ชื่อ

หน่วย

ยศ

ตำแหน่ง

Tag

Keyword

AI Summary

OCR Text

Document Type

Asset Type

Search พร้อมกันได้

---

# Verification Workflow

Asset ใหม่

↓

AI อ่าน

↓

AI เติม Metadata

↓

Human ตรวจ

↓

Approve

↓

ใช้งานจริง

ห้าม Skip ขั้นตอน

---

# Folder Independence

ระบบห้ามใช้

Folder Name

เป็น Business Logic

Folder

มีไว้เพื่อจัดเก็บไฟล์เท่านั้น

Business Logic ใช้ Metadata

---

# AI Classification

AI ต้องสามารถจำแนก

Profile

Map

Structure

Timeline

GP7

Certificate

Report

Video

Unknown

หาก Confidence ต่ำกว่า Threshold

ส่ง Human Review

---

# OCR Pipeline

Image

↓

OCR

↓

Raw Text

↓

AI

↓

Structured Metadata

↓

Verification

↓

Database

---

# Error Handling

หาก OCR ล้มเหลว

Badge

OCR Failed

หาก AI วิเคราะห์ไม่ได้

Badge

Needs Review

หาก Metadata ไม่ครบ

Badge

Incomplete

---

# Audit Trail

ทุกการแก้ไข

ต้องเก็บ

Old Value

New Value

User

Date

Reason

---

# Offline Safety

หาก Google Drive ล่ม

Gallery ยังเปิดได้

เพราะใช้ข้อมูลจาก Database

Preview ที่ Cache แล้ว

ต้องยังใช้งานได้

---

# Future Roadmap

Gallery V3

Face Recognition

Duplicate Detection

AI Caption

Semantic Search

Visual Similarity Search

Officer Recommendation

Auto Timeline Detection

Auto Profile Matching

Auto Region Detection

Auto Company Detection

---

# Risks

Risk

Metadata ไม่ครบ

Mitigation

Human Verification

---

Risk

AI อ่านผิด

Mitigation

Confidence Score

---

Risk

OCR คุณภาพต่ำ

Mitigation

Manual Edit

---

Risk

Drive เปลี่ยนโครงสร้าง

Mitigation

ใช้ Drive File ID

ไม่ใช้ Folder

---

# Test Cases

Case 1

อัปโหลด GP7

AI ต้องสร้าง Metadata

เจ้าหน้าที่ Verify

Save สำเร็จ

---

Case 2

เลือก 300 รูป

Bulk Assign

กก.ตชด.42

ต้องสำเร็จ

---

Case 3

ค้นหา

กก.ตชด.41

ต้องแสดงเฉพาะ

Asset ของ กก.ตชด.41

---

Case 4

ค้นหา

ร้อย ตชด.414

ต้องแสดงเฉพาะ

ร้อย ตชด.414

---

Case 5

Google Drive Offline

Gallery ยังเปิดได้

---

Case 6

AI Confidence ต่ำ

Asset ต้องเข้าคิว Human Review

---

Case 7

แก้ Metadata

History ต้องถูกสร้างทันที

---

# Success Criteria

Gallery V2 ถือว่าเสร็จเมื่อ

✓ Metadata 100%

✓ Filter 100%

✓ Search 100%

✓ Bulk Edit

✓ Bulk Verify

✓ OCR Pipeline

✓ AI Classification

✓ Human Verification

✓ Audit Trail

✓ PostgreSQL First

✓ Google Drive ใช้เฉพาะ Storage

✓ รองรับมากกว่า 500,000 Assets

✓ พร้อมเชื่อม Commander Dashboard