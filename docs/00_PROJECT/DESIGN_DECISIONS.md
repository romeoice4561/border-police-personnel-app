# Border Patrol Personnel Intelligence Platform (BPPI)

# Design Decisions

Version : 2.0

Status : Living Document

Purpose

เอกสารนี้รวบรวมเหตุผลของการตัดสินใจเชิงสถาปัตยกรรม (Architecture Decision Record - ADR)

ทุกครั้งที่มีการตัดสินใจเรื่องสำคัญของระบบ ให้เพิ่มรายการใหม่ในเอกสารนี้

Developer และ AI ทุกตัวต้องอ้างอิงเอกสารนี้ก่อนเปลี่ยนแปลง Architecture

---

# ADR-001

Title

Google Drive Is Storage Only

Decision

Google Drive ใช้สำหรับเก็บไฟล์เท่านั้น

Reason

Google Drive ไม่เหมาะสำหรับเป็นฐานข้อมูล

ข้อจำกัด

- Search ช้า
- Metadata จำกัด
- Query ยาก
- ไม่มี Relation
- ไม่มี Transaction

Impact

Web Application อ่านข้อมูลจาก PostgreSQL เท่านั้น

---

# ADR-002

Title

PostgreSQL Is The Single Source Of Truth

Decision

ข้อมูลจริงทั้งหมดอยู่ใน PostgreSQL

Reason

Database รองรับ

- Relation
- Index
- Search
- Transaction
- Analytics
- AI

Impact

ทุก Module ใช้ข้อมูลชุดเดียวกัน

---

# ADR-003

Title

Everything Is An Asset

Decision

ทุกไฟล์ในระบบถือเป็น Asset

ไม่แยก

รูป

PDF

Video

GP7

Reason

ลดความซับซ้อน

ใช้ Workflow เดียวกัน

ใช้ Metadata เดียวกัน

ใช้ Permission เดียวกัน

Impact

Gallery กลายเป็น Asset Manager

---

# ADR-004

Title

Metadata First

Decision

ทุก Asset ต้องมี Metadata

Reason

Folder เปลี่ยนได้

ชื่อไฟล์เปลี่ยนได้

Metadata ไม่ควรเปลี่ยน

Impact

Search

Filter

AI

Dashboard

ใช้ Metadata ทั้งหมด

---

# ADR-005

Title

Folder Has No Business Meaning

Decision

Folder ใช้เพื่อจัดเก็บ

ไม่ใช้เป็น Business Logic

Reason

หากมีการย้าย Folder

ระบบต้องไม่เสีย

Impact

Business Logic อ้างอิง Metadata

---

# ADR-006

Title

Officer UUID Never Changes

Decision

Officer ทุกคนมี UUID ถาวร

Reason

ชื่อเปลี่ยนได้

ยศเปลี่ยนได้

หน่วยเปลี่ยนได้

UUID ห้ามเปลี่ยน

Impact

ทุก Table อ้างอิง Officer UUID

---

# ADR-007

Title

Timeline Is Event Sourcing

Decision

Timeline เก็บเหตุการณ์

ไม่แก้ไขอดีต

Reason

ข้อมูลราชการต้องตรวจสอบย้อนหลังได้

Impact

ทุกการเปลี่ยนแปลงสร้าง Event ใหม่

---

# ADR-008

Title

Promotion Rules Must Be Configurable

Decision

กฎการเลื่อนตำแหน่ง

เก็บใน Database

ไม่ Hardcode

Reason

กฎสามารถเปลี่ยนได้

ไม่ควร Deploy ใหม่ทุกครั้ง

Impact

Promotion Engine อ่าน Rule จาก Database

---

# ADR-009

Title

AI Cannot Modify Official Data

Decision

AI ไม่มีสิทธิ์ Save ข้อมูลจริง

Reason

AI อาจผิดพลาด

Impact

Human Verification เป็นขั้นตอนบังคับ

---

# ADR-010

Title

Human Verification Is Mandatory

Decision

ข้อมูลทุกชุด

ต้องผ่านการตรวจสอบ

ก่อนบันทึก

Workflow

Upload

↓

OCR

↓

AI

↓

Human

↓

Approve

↓

Save

---

# ADR-011

Title

Search Uses Metadata

Decision

Search

ไม่ค้นจากชื่อไฟล์

Reason

ชื่อไฟล์ไม่มีมาตรฐาน

Impact

Search ใช้

Metadata

OCR

Timeline

AI Summary

Tag

---

# ADR-012

Title

Gallery Is Asset Management

Decision

Gallery

ไม่ใช่ Photo Gallery

Reason

ระบบต้องรองรับ

PDF

Video

GP7

Report

Certificate

Map

Structure

Impact

Gallery เป็นศูนย์กลาง Asset

---

# ADR-013

Title

Digital Twin Is The Core Domain

Decision

Officer

ไม่ใช่ Record

Officer คือ Digital Twin

Reason

ข้อมูลทั้งหมดของเจ้าหน้าที่ต้องเชื่อมโยงกัน

Impact

ทุก Module อ้างอิง Officer

---

# ADR-014

Title

AI Is Replaceable

Decision

Architecture

ต้องไม่ผูกกับ AI Provider

Reason

อนาคตอาจเปลี่ยน

OpenAI

Claude

Gemini

Local LLM

Impact

AI Engine แยกเป็น Layer

---

# ADR-015

Title

Commander First

Decision

ทุก Feature

ต้องตอบโจทย์ผู้บังคับบัญชา

Reason

เป้าหมายของระบบคือช่วยตัดสินใจ

Impact

ทุกหน้าต้องสร้างคุณค่าในการบริหารกำลังพล

---

# ADR-016

Title

Master Data Controls Everything

Decision

ข้อมูลมาตรฐาน

เก็บใน Master Data

Reason

ลดการ Hardcode

ลดข้อมูลซ้ำ

Impact

Dropdown

AI

OCR

Dashboard

ใช้ข้อมูลชุดเดียวกัน

---

# ADR-017

Title

Architecture Before Convenience

Decision

ห้ามแก้ปัญหาเฉพาะหน้า

โดยทำลาย Architecture

Reason

โครงการถูกออกแบบให้ใช้งานระยะยาว

Impact

ทุก Pull Request ต้องตรวจสอบ Architecture

---

# ADR-018

Title

Offline Capability

Decision

ระบบยังทำงานได้

แม้ Google Drive ไม่พร้อมใช้งาน

Reason

Google Drive เป็น External Service

Impact

ทุกข้อมูลต้อง Cache ใน Database

---

# ADR-019

Title

Audit By Default

Decision

ทุกการแก้ไข

สร้าง Audit Log อัตโนมัติ

Reason

รองรับการตรวจสอบย้อนหลัง

Impact

ไม่มี Module ใดยกเว้น Audit

---

# ADR-020

Title

Build For National Scale

Decision

Architecture ต้องรองรับ

หลายแสนกำลังพล

หลายล้านไฟล์

Reason

เพื่อรองรับการขยายในอนาคต

Impact

ทุก Module ต้องออกแบบให้ Scale ได้