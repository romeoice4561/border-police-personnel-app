# Border Patrol Personnel Intelligence Platform (BPPI)

# Master Data Design

Version : 2.0

Status : Draft

---

# Purpose

Master Data คือข้อมูลมาตรฐานที่ใช้ร่วมกันทั้งระบบ

ข้อมูลเหล่านี้จะถูกใช้งานโดย

- Database
- API
- Frontend
- AI
- OCR
- Dashboard
- Search
- Report

ห้าม Hardcode ข้อมูลมาตรฐานไว้ใน Source Code

ทุก Module ต้องอ้างอิง Master Data เพียงชุดเดียว

---

# Why Master Data

หากไม่มี Master Data

จะเกิดปัญหา เช่น

- Dropdown แต่ละหน้าไม่เหมือนกัน

- AI สะกดชื่อหน่วยไม่ตรงกัน

- Filter ใช้ไม่ได้

- Search ค้นหาไม่ตรง

- ข้อมูลซ้ำ

- ขยายระบบลำบาก

ดังนั้น Master Data จึงเป็นรากฐานของระบบทั้งหมด

---

# Master Data Categories

ระบบกำหนด Master Data หลักดังต่อไปนี้

1. Region (ภาค)

2. Border Patrol Division (กองบังคับการ)

3. Border Patrol Subdivision (กองกำกับ)

4. Border Patrol Company (กองร้อย)

5. Province

6. Rank

7. Position

8. Training Course

9. Document Type

10. Asset Type

11. Timeline Event Type

12. Promotion Rule

13. User Role

14. Permission

---

# Region

ตัวอย่าง

ภาค 1

ภาค 2

ภาค 3

ภาค 4

ภาค 5

ภาค 6

ภาค 7

---

# Border Patrol Subdivision

ตัวอย่าง

กก.ตชด.11

กก.ตชด.12

กก.ตชด.13

กก.ตชด.14

...

กก.ตชด.44

ข้อมูลนี้จะถูกใช้โดย

- Gallery Filter

- Officer Profile

- Timeline

- AI

- Dashboard

---

# Border Patrol Company

ตัวอย่าง

ร้อย ตชด.111

ร้อย ตชด.112

ร้อย ตชด.113

...

ร้อย ตชด.447

ข้อมูลนี้จะใช้ร่วมกันทั้งระบบ

ห้ามสร้างรายการใหม่จากหน้า Frontend

การเพิ่มหรือแก้ไขต้องทำผ่าน Master Data เท่านั้น

---

# Rank

ตัวอย่าง

พลตำรวจ

สิบตำรวจตรี

สิบตำรวจโท

สิบตำรวจเอก

ดาบตำรวจ

ร้อยตำรวจตรี

ร้อยตำรวจโท

ร้อยตำรวจเอก

พันตำรวจตรี

พันตำรวจโท

พันตำรวจเอก

พลตำรวจตรี

...

ทุก Module ต้องอ้างอิง Rank เดียวกัน

---

# Position

ตัวอย่าง

รอง ผบ.หมู่

ผบ.หมู่

รอง สว.

สว.

รอง ผกก.

ผกก.

รอง ผบก.

ผบก.

ทุกตำแหน่งต้องมีรหัส (Code) และชื่อเต็ม เพื่อป้องกันการสะกดไม่ตรงกัน

---

# Document Type

ตัวอย่าง

GP7

Official Portrait

Appointment Order

Certificate

Training

Map

Structure

Award

Book

Report

PDF

Image

Video

---

# Asset Type

ตัวอย่าง

Profile Image

Gallery Image

Map

Document

Video

Timeline Attachment

Training Certificate

Award

---

# Timeline Event Type

ตัวอย่าง

Appointment

Transfer

Promotion

Rank Change

Training

Award

Salary Change

Retirement

Special Assignment

---

# Promotion Rule

Promotion Rule จะไม่ถูกเขียนใน Source Code

ระบบจะอ้างอิงจาก Master Data ชุดนี้

ตัวอย่าง

Current Rank

Target Position

Minimum Years

Required Courses

Required Conditions

---

# User Role

Administrator

Staff

Commander

Executive

Viewer

---

# Permission

View

Edit

Approve

Delete

Manage Master Data

Import

Export

Run AI

Run OCR

---

# Design Rules

Master Data ทุกประเภท

ต้องมี

- Unique ID
- Code
- Name
- Status
- Created At
- Updated At

ห้ามอ้างอิงด้วยชื่อเพียงอย่างเดียว

ทุกความสัมพันธ์ในฐานข้อมูลต้องอ้างอิงด้วย ID

---

# Future Expansion

Master Data ต้องสามารถรองรับ

- การเพิ่มหน่วยใหม่
- การปรับโครงสร้างหน่วย
- การเพิ่มยศใหม่
- การเปลี่ยนชื่อหลักสูตร
- การเพิ่มประเภทเอกสาร

โดยไม่ต้องแก้ไข Source Code

---

End of Document