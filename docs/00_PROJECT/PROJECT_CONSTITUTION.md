# Border Patrol Personnel Intelligence Platform (BPPI)

# Project Constitution

Version : 2.0

Status : Active

Authority : Highest Project Rule

---

# Purpose

เอกสารฉบับนี้เป็นกฎสูงสุดของโครงการ

ทุกการออกแบบ

ทุกการพัฒนา

ทุกการเขียนโค้ด

ทุกการออกแบบฐานข้อมูล

ทุก Prompt AI

ต้องสอดคล้องกับเอกสารฉบับนี้

หากมีข้อขัดแย้ง

Project Constitution ถือเป็นเอกสารที่มีลำดับความสำคัญสูงสุด

---

# Principle 1

Human Makes Decisions

AI Assists

AI มีหน้าที่

- อ่าน

- วิเคราะห์

- แนะนำ

- สรุป

AI ไม่มีสิทธิ์

- Save

- Delete

- Approve

แทนเจ้าหน้าที่

---

# Principle 2

Google Drive Is Storage

Google Drive

มีหน้าที่เก็บไฟล์

เท่านั้น

Google Drive

ไม่ใช่ฐานข้อมูล

Web Application

ห้าม Query Drive โดยตรงเพื่อแสดงข้อมูล

ทุกข้อมูลต้อง Sync ลง Database ก่อน

---

# Principle 3

Database Is Truth

PostgreSQL

คือข้อมูลจริงของระบบ

Web

API

AI

Dashboard

Report

ต้องอ่านข้อมูลจาก Database

ไม่ใช่จาก Google Drive

---

# Principle 4

Metadata First

ทุก Asset

ต้องมี Metadata

ห้ามใช้

ชื่อไฟล์

เป็นข้อมูลหลัก

ตัวอย่าง

ผิด

Map42.jpg

ถูก

Type = Map

Sector = 42

Region = 4

Verified = true

---

# Principle 5

Everything Is An Asset

ระบบนี้ไม่มีคำว่า

"รูปภาพ"

ทุกอย่างคือ Asset

เช่น

Profile

Map

Timeline

Certificate

Document

GP7

Video

Achievement

Book

Report

Asset ทุกชนิด

ใช้โครงสร้างเดียวกัน

---

# Principle 6

Verification Before Save

Workflow ทุกชนิด

ต้องเป็น

Upload

↓

OCR

↓

AI

↓

Human Verify

↓

Approve

↓

Save

ห้าม AI Save เอง

---

# Principle 7

Business Rules Must Not Be Hardcoded

กฎทั้งหมด

เช่น

Promotion

Retirement

Course

Eligibility

ห้ามเขียนใน Source Code

ต้องอยู่ใน Database

---

# Principle 8

Everything Must Be Auditable

ทุกการแก้ไข

ทุกการลบ

ทุกการอนุมัติ

ต้องสามารถตรวจสอบย้อนหลังได้

---

# Principle 9

One Feature One Responsibility

ทุก Module

มีหน้าที่เดียว

Gallery

จัดการ Asset

Officer

จัดการกำลังพล

Timeline

จัดการประวัติ

Promotion

คำนวณสิทธิ์

Dashboard

แสดงผล

AI

วิเคราะห์

ไม่ให้ Module ทำงานซ้ำกัน

---

# Principle 10

Future Expansion

ทุก Feature

ต้องรองรับ

ทุกภาค

ทุกกองกำกับ

ทุกกองร้อย

ไม่ออกแบบเฉพาะข้อมูลชุดปัจจุบัน

---

# Principle 11

AI Is Replaceable

ระบบต้องไม่ผูกกับ AI ตัวเดียว

สามารถเปลี่ยน

OpenAI

Claude

Gemini

หรือ AI อื่น

โดยไม่ต้องเปลี่ยน Architecture

---

# Principle 12

No Duplicate Data

ข้อมูลเดียว

เก็บครั้งเดียว

หากหลาย Module ใช้

ให้อ้างอิงข้อมูลเดียวกัน

---

# Principle 13

Master Data First

ทุกข้อมูลมาตรฐาน

ต้องเป็น Master Data

เช่น

ภาค

กองกำกับ

กองร้อย

ยศ

ตำแหน่ง

จังหวัด

หลักสูตร

ประเภทเอกสาร

ห้าม Hardcode

---

# Principle 14

Search Must Be Metadata Based

ระบบค้นหา

ใช้ Metadata

ไม่ใช้ชื่อไฟล์

ไม่ใช้ Folder

เป็นหลัก

---

# Principle 15

Every Screen Must Create Value

ทุกหน้าของระบบ

ต้องช่วยผู้ใช้งาน

ลดเวลา

ลดความผิดพลาด

หรือเพิ่มคุณค่าของข้อมูล

หากหน้าจอใดไม่มีคุณค่า

ต้องพิจารณาปรับปรุงหรือยกเลิก

---

# Principle 16

Commander First

ระบบนี้

ไม่ได้สร้างเพื่อแสดงข้อมูล

แต่สร้างเพื่อช่วยผู้บังคับบัญชาตัดสินใจ

ทุก Feature ใหม่

ต้องตอบคำถามว่า

"ช่วยให้ผู้บังคับบัญชาตัดสินใจได้ดีขึ้นหรือไม่"

หากไม่

ควรทบทวนการออกแบบ

---

# Principle 17

AI Should Reduce Work

AI ต้องลดงานของเจ้าหน้าที่

ไม่ใช่เพิ่มงาน

หาก AI ทำให้ต้องตรวจสอบมากกว่าเดิม

Workflow นั้นถือว่ายังไม่สมบูรณ์

---

# Principle 18

Architecture Before Convenience

ห้ามแก้ปัญหาเฉพาะหน้า

โดยทำลายสถาปัตยกรรม

เลือกวิธีที่ขยายต่อได้

แม้จะใช้เวลามากกว่าในระยะสั้น

---

# Principle 19

Every New Feature Requires Documentation

ทุก Feature ใหม่

ต้องมี

Purpose

Workflow

Database Impact

API Impact

UI Impact

Test Plan

ก่อน Merge

---

# Principle 20

Build For The Next 10 Years

ทุกการออกแบบ

ต้องตอบคำถามว่า

หากข้อมูลเพิ่มขึ้น

10 เท่า

100 เท่า

หรือมีผู้ใช้งานทั้งประเทศ

Architecture นี้

ยังรองรับได้หรือไม่

หากคำตอบคือ "ไม่"

ต้องออกแบบใหม่