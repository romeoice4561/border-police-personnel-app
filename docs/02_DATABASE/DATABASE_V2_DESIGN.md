# Border Patrol Personnel Intelligence Platform (BPPI)

# Database V2 Design

Version: 2.0

Status: Draft

Owner: BPPI Core Architecture

Last Updated: 2026-07

---

# 1. Purpose

เอกสารนี้เป็นมาตรฐานการออกแบบฐานข้อมูลของ BPPI

Database ถือเป็นหัวใจของระบบ

ทุก Module

ทุก API

ทุก AI Engine

ทุก Dashboard

ทุก Report

ต้องอ้างอิงโครงสร้างฐานข้อมูลชุดเดียวกัน

ห้ามออกแบบตารางใหม่โดยไม่อ้างอิงเอกสารฉบับนี้

---

# 2. Objectives

Database V2 ถูกออกแบบเพื่อ

- รองรับกำลังพลหลายแสนคน
- รองรับ Asset หลายล้านไฟล์
- รองรับ OCR
- รองรับ AI
- รองรับ Search
- รองรับ Commander Dashboard
- รองรับ Promotion Engine
- รองรับ Audit
- รองรับการขยายในอนาคต

Database ต้องเป็น

Single Source of Truth

ของทั้งระบบ

---

# 3. Design Philosophy

Database ของ BPPI ไม่ได้ออกแบบเพื่อเก็บข้อมูล

แต่ถูกออกแบบเพื่อสร้าง

Personnel Intelligence Platform

ข้อมูลทุกชิ้นต้องสามารถ

- เชื่อมโยงกันได้
- ค้นหาได้
- วิเคราะห์ได้
- ตรวจสอบย้อนหลังได้
- ใช้โดย AI ได้

---

# 4. Core Principles

## Principle 1

PostgreSQL คือฐานข้อมูลหลัก

Google Drive เป็นเพียง Storage

---

## Principle 2

Business Logic

ไม่อยู่ใน Frontend

ไม่อยู่ใน Folder

อยู่ใน Database

---

## Principle 3

ทุก Entity ต้องมี UUID

ห้ามใช้ชื่อ

หรือรหัสหน่วย

เป็น Primary Key

---

## Principle 4

ทุก Entity ต้องรองรับ

Audit

Soft Delete

Versioning

AI

---

## Principle 5

ทุกความสัมพันธ์

ใช้ Foreign Key

ไม่ใช้ Text Matching

---

# 5. Naming Convention

Table

ใช้ snake_case

ตัวอย่าง

officers

career_timelines

promotion_rules

asset_metadata

audit_logs

---

Column

ใช้ snake_case

ตัวอย่าง

first_name

current_rank_id

created_at

updated_at

verified_at

---

Primary Key

ใช้ชื่อ

id

เสมอ

Datatype

UUID

---

Foreign Key

ใช้

entity_id

ตัวอย่าง

officer_id

company_id

rank_id

position_id

asset_id

timeline_id

---

Boolean

ขึ้นต้นด้วย

is_

ตัวอย่าง

is_active

is_deleted

is_verified

is_public

---

Datetime

ลงท้ายด้วย

_at

ตัวอย่าง

created_at

updated_at

verified_at

deleted_at

approved_at

imported_at

---

# 6. Standard Columns

ทุก Table

ต้องมี Column ต่อไปนี้

id

UUID

Primary Key

---

created_at

TIMESTAMP WITH TIME ZONE

NOT NULL

---

updated_at

TIMESTAMP WITH TIME ZONE

NOT NULL

---

created_by

UUID

Nullable

อ้างอิง users.id

---

updated_by

UUID

Nullable

อ้างอิง users.id

---

is_deleted

BOOLEAN

Default FALSE

---

deleted_at

TIMESTAMP

Nullable

---

status

TEXT

Default ACTIVE

---

version

INTEGER

Default 1

ใช้สำหรับ Version Control

---

# 7. UUID Policy

UUID

สร้างโดย Database

ไม่สร้างจาก Frontend

UUID

ห้ามเปลี่ยน

ตลอดอายุข้อมูล

แม้ข้อมูลอื่นจะเปลี่ยน

---

# 8. Soft Delete Policy

BPPI

ห้ามลบข้อมูลจริง

ทุกการลบ

เปลี่ยน

is_deleted

เป็น TRUE

พร้อมบันทึก

deleted_at

และ

deleted_by

เพื่อรองรับ

Audit

และการกู้คืนข้อมูล

---

# 9. Audit Policy

ทุกการเปลี่ยนแปลง

Insert

Update

Delete

Approve

Verify

Import

AI Suggestion

ต้องสร้าง

Audit Log

ทุกครั้ง

ไม่มีข้อยกเว้น

---

# 10. Version Policy

ข้อมูลสำคัญ

เช่น

Officer

Timeline

Promotion

Document

Asset Metadata

ต้องรองรับ Version

ทุกครั้งที่มีการแก้ไข

Version เพิ่มขึ้น

พร้อมเก็บประวัติย้อนหลัง

---

# 11. Character Encoding

Database ทั้งหมด

ใช้ UTF-8

รองรับ

ภาษาไทย

ภาษาอังกฤษ

Unicode

Emoji

เพื่อรองรับข้อมูลราชการทุกประเภท

---

# 12. Timezone Policy

ทุกวันเวลา

เก็บเป็น

UTC

Frontend

แสดงผล

Asia/Bangkok

ห้ามเก็บเวลาเป็น Local Time

ภายใน Database

---

# 13. Search Strategy

Search

ไม่ค้นจากชื่อไฟล์

Search

ไม่ค้นจาก Folder

Search

ใช้ข้อมูลต่อไปนี้

- Metadata
- Officer
- Timeline
- OCR Result
- AI Summary
- Organization
- Rank
- Position
- Asset Type
- Document Type
- Tags

ทุก Search ต้องสามารถใช้ Index ได้

ห้าม Full Table Scan หากหลีกเลี่ยงได้

---

# 14. Relationship Policy

ทุกความสัมพันธ์

ใช้ Foreign Key

ตัวอย่าง

Officer

↓

Timeline

↓

Timeline Event

↓

Asset

↓

OCR

↓

AI Result

ห้ามเก็บข้อมูลซ้ำ

เช่น

ห้ามเก็บชื่อยศไว้หลายตาราง

ให้เก็บเฉพาะ

rank_id

แล้ว Join

Master Rank

---

# 15. Database Layers

Database แบ่งออกเป็น 8 กลุ่ม

1. Master Data

2. Organization

3. Officer

4. Timeline

5. Asset

6. AI

7. Commander

8. System

รายละเอียดของแต่ละกลุ่มจะอธิบายในหัวข้อถัดไป

---

End of Part 1

# 16. Master Data Architecture

Master Data

คือข้อมูลมาตรฐานของทั้งระบบ

ทุก Module

ทุก API

ทุก Dashboard

ทุก AI Engine

ต้องอ้างอิง Master Data

ห้าม Hardcode ข้อมูลลงใน Source Code

---

# Master Data Categories

ระบบแบ่ง Master Data ออกเป็น

1. Organization

2. Rank

3. Position

4. Education

5. Training

6. Asset

7. Document

8. Promotion

9. Geography

10. System

---

# 17. master_regions

Purpose

เก็บข้อมูลภาคทั้งหมด

ตัวอย่าง

ภาค 1

ภาค 2

ภาค 3

ภาค 4

ภาคใต้

ศชต.

Columns

id

UUID

PK

---

code

TEXT

UNIQUE

ตัวอย่าง

REGION_1

REGION_2

REGION_SOUTH

---

name_th

TEXT

NOT NULL

---

name_en

TEXT

---

display_order

INTEGER

---

is_active

BOOLEAN

DEFAULT TRUE

---

Standard Columns

ใช้ Standard Columns ทั้งหมด

---

Relationship

master_regions

1

↓

Many

master_commands

---

# 18. master_commands

Purpose

เก็บกองบังคับการทั้งหมด

ตัวอย่าง

บก.ตชด.11

บก.ตชด.12

บก.ตชด.13

...

Columns

id

UUID

PK

---

region_id

FK

master_regions

---

code

TEXT

ตัวอย่าง

BPP11

BPP41

---

name

TEXT

ตัวอย่าง

บก.ตชด.41

---

display_order

INTEGER

---

is_active

BOOLEAN

---

Relationship

Region

1

↓

Many

Command

---

Command

1

↓

Many

Subdivision

---

# 19. master_subdivisions

Purpose

เก็บข้อมูลกองกำกับทั้งหมด

ตัวอย่าง

กก.ตชด.11

กก.ตชด.12

...

กก.ตชด.44

Columns

id

UUID

PK

---

command_id

FK

master_commands

---

code

TEXT

ตัวอย่าง

BPP_SUB_41

---

short_name

TEXT

กก.ตชด.41

---

full_name

TEXT

กองกำกับการตำรวจตระเวนชายแดนที่ 41

---

province

TEXT

Nullable

---

display_order

INTEGER

---

is_active

BOOLEAN

---

Relationship

Subdivision

1

↓

Many

Company

---

# 20. master_companies

Purpose

เก็บข้อมูลกองร้อยทั้งหมด

ตัวอย่าง

ร้อย ตชด.411

ร้อย ตชด.412

...

ร้อย ตชด.447

Columns

id

UUID

PK

---

subdivision_id

FK

master_subdivisions

---

code

TEXT

ตัวอย่าง

BPP411

---

company_no

TEXT

411

412

413

414

...

---

short_name

TEXT

ร้อย ตชด.414

---

full_name

TEXT

กองร้อยตำรวจตระเวนชายแดนที่ 414

---

location

TEXT

ตัวอย่าง

ท่าแซะ

---

province

TEXT

---

latitude

NUMERIC

Nullable

---

longitude

NUMERIC

Nullable

---

display_order

INTEGER

---

is_active

BOOLEAN

---

Relationship

Company

1

↓

Many

Officer

---

# 21. Organization Tree

Hierarchy

Region

↓

Command

↓

Subdivision

↓

Company

↓

Officer

Database

ห้ามเก็บข้อความ

เช่น

กก.ตชด.41

ในตาราง Officer

Officer

ต้องเก็บ

company_id

เท่านั้น

ระบบจะ Join

กลับไปหา

Subdivision

Command

Region

อัตโนมัติ

---

# 22. master_ranks

Purpose

เก็บข้อมูลยศทั้งหมด

ทุกยศ

ตั้งแต่

พลตำรวจ

จนถึง

พลตำรวจเอก

Columns

id

UUID

PK

---

code

TEXT

---

name_th

TEXT

---

abbreviation

TEXT

ตัวอย่าง

ร.ต.ต.

ร.ต.อ.

พ.ต.ต.

พ.ต.อ.

---

level

INTEGER

ใช้เรียงลำดับ

---

group_name

TEXT

ตัวอย่าง

สัญญาบัตร

ชั้นประทวน

---

display_order

INTEGER

---

is_active

BOOLEAN

---

หมายเหตุ

การคำนวณลำดับยศ

ใช้ field

level

ห้ามใช้การเปรียบเทียบข้อความ

---

# 23. master_positions

Purpose

เก็บตำแหน่งมาตรฐานทั้งหมด

ตัวอย่าง

ผบ.หมู่

รอง สว.

สว.

รอง ผกก.

ผกก.

รอง ผบก.

ผบก.

Columns

id

UUID

PK

---

code

TEXT

---

name_th

TEXT

---

position_group

TEXT

---

display_order

INTEGER

---

is_active

BOOLEAN

---

Relationship

Position

1

↓

Many

Timeline

---

# 24. Master Data Rules

Master Data

แก้ไขได้เฉพาะ

Administrator

เท่านั้น

การเพิ่ม

ยศ

ตำแหน่ง

หน่วย

หลักสูตร

ประเภทเอกสาร

ต้องสร้าง Audit Log

ทุกครั้ง

ห้ามลบข้อมูลออกจาก Master Data

ใช้

is_active = FALSE

แทน

---

End of Part 2

# 25. Officer Domain

Officer

คือ Aggregate Root

ของระบบทั้งหมด

Officer หนึ่งคน

มีได้เพียงหนึ่ง Record

Officer UUID

ห้ามเปลี่ยน

ตลอดอายุการใช้งานของระบบ

แม้จะ

- เปลี่ยนชื่อ
- เปลี่ยนยศ
- เปลี่ยนหน่วย
- เปลี่ยนตำแหน่ง

Officer UUID ต้องคงเดิม

---

# 26. officers

Purpose

เก็บข้อมูลตัวตนของกำลังพล

หนึ่งนาย

หนึ่ง Record

Columns

id

UUID

Primary Key

---

citizen_id

TEXT

UNIQUE

เลขบัตรประชาชน

รองรับ NULL

สำหรับข้อมูลที่ยังไม่สมบูรณ์

---

police_id

TEXT

เลขประจำตัวตำรวจ

UNIQUE

Nullable

---

first_name

TEXT

NOT NULL

---

last_name

TEXT

NOT NULL

---

nickname

TEXT

Nullable

---

gender

TEXT

ชาย

หญิง

อื่นๆ

---

birth_date

DATE

Nullable

---

retirement_date

DATE

คำนวณได้

แต่สามารถ Override ได้

---

portrait_asset_id

UUID

FK

assets.id

รูปประจำตัวปัจจุบัน

---

current_rank_id

UUID

FK

master_ranks

---

current_position_id

UUID

FK

master_positions

---

current_company_id

UUID

FK

master_companies

---

service_status

TEXT

ตัวอย่าง

ACTIVE

STUDY

TRANSFER

RETIRED

RESIGNED

DECEASED

---

profile_score

INTEGER

0-100

ระบบคำนวณ

---

search_vector

TSVECTOR

สำหรับ PostgreSQL Full Text Search

---

Standard Columns

ใช้ทั้งหมด

---

Relationship

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

Awards

Officer

1

↓

Many

Promotion

---

# 27. officer_contacts

Purpose

แยกข้อมูลติดต่อ

ออกจากตารางหลัก

เพื่อลดการ Update

Columns

id

UUID

PK

---

officer_id

FK

officers

UNIQUE

หนึ่งคน

หนึ่ง Record

---

mobile_phone

TEXT

---

office_phone

TEXT

---

email

TEXT

---

line_id

TEXT

---

facebook_url

TEXT

---

address

TEXT

---

province

TEXT

---

postal_code

TEXT

---

emergency_contact

TEXT

---

emergency_phone

TEXT

---

Standard Columns

ใช้ทั้งหมด

---

# 28. officer_family

Purpose

ข้อมูลครอบครัว

Columns

id

UUID

PK

---

officer_id

FK

officers

---

marital_status

TEXT

---

spouse_name

TEXT

---

children_count

INTEGER

---

remarks

TEXT

---

Standard Columns

ใช้ทั้งหมด

---

# 29. officer_service_information

Purpose

เก็บข้อมูลราชการ

ที่เปลี่ยนไม่บ่อย

Columns

id

UUID

PK

---

officer_id

FK

officers

UNIQUE

---

academy

TEXT

เช่น

นรต.

กอส.

นายสิบ

---

academy_class

TEXT

---

first_appointment_date

DATE

วันบรรจุ

---

police_service_years

INTEGER

ระบบคำนวณ

---

current_rank_date

DATE

วันที่ได้รับยศปัจจุบัน

---

current_position_date

DATE

วันที่ได้รับตำแหน่งปัจจุบัน

---

retirement_year

INTEGER

---

salary_level

TEXT

เช่น

ส.3

---

salary_step

NUMERIC

---

salary_amount

NUMERIC

---

Standard Columns

ใช้ทั้งหมด

---

# 30. officer_profile_statistics

Purpose

Cache

ข้อมูลที่คำนวณบ่อย

เพื่อลดภาระ Database

Columns

id

UUID

PK

---

officer_id

FK

officers

UNIQUE

---

timeline_count

INTEGER

---

asset_count

INTEGER

---

document_count

INTEGER

---

training_count

INTEGER

---

award_count

INTEGER

---

promotion_score

INTEGER

---

completeness_score

INTEGER

---

ai_confidence

INTEGER

---

last_ai_analysis

TIMESTAMP

---

Standard Columns

ใช้ทั้งหมด

---

# 31. Officer Design Rules

Officer

ห้ามเก็บ

ข้อความของ

ยศ

ตำแหน่ง

หน่วย

โดยตรง

Officer

เก็บเฉพาะ

Foreign Key

แล้ว Join

Master Data

ทุกครั้ง

---

# 32. Officer Search

Search รองรับ

ชื่อ

นามสกุล

ชื่อเล่น

เลขตำรวจ

เลขประชาชน

ยศ

ตำแหน่ง

กองกำกับ

กองร้อย

จังหวัด

Timeline

OCR

AI Summary

Tag

ทั้งหมด

ผ่าน Search Engine

เดียวกัน

---

# 33. Officer Status

Officer

มีสถานะหลัก

ACTIVE

ON_STUDY

TRANSFER

SUSPENDED

RETIRED

RESIGNED

DECEASED

UNKNOWN

ห้ามใช้ข้อความอิสระ

ต้องใช้ Enum

---

# 34. Officer Digital Twin

Officer

ไม่ใช่เพียงข้อมูลส่วนบุคคล

Officer คือ

Digital Twin

ซึ่งเชื่อม

Timeline

↓

Asset

↓

Document

↓

Training

↓

Award

↓

Promotion

↓

AI

↓

Dashboard

ทุก Module

ต้องอ้างอิง

Officer UUID

เป็นศูนย์กลาง

---

End of Part 3

# 35. Timeline Domain

Timeline

คือประวัติราชการทั้งหมดของกำลังพล

Timeline

ไม่ใช่เฉพาะการย้ายหน่วย

แต่เป็น

Career Event

ทุกเหตุการณ์

ตั้งแต่วันบรรจุ

จนถึงเกษียณ

Timeline

เป็นข้อมูลที่สำคัญที่สุด

ของระบบ

AI

Promotion

Dashboard

Search

Report

Commander

ทั้งหมด

อ้างอิง Timeline

---

# 36. career_timelines

Purpose

เก็บเหตุการณ์ราชการทั้งหมด

หนึ่ง Record

แทนหนึ่งเหตุการณ์

Columns

id

UUID

Primary Key

---

officer_id

UUID

FK

officers.id

NOT NULL

---

timeline_type_id

UUID

FK

master_timeline_types

---

event_date

DATE

วันที่เกิดเหตุการณ์

---

effective_date

DATE

วันที่มีผลบังคับ

Nullable

---

rank_id

UUID

FK

master_ranks

Nullable

---

position_id

UUID

FK

master_positions

Nullable

---

company_id

UUID

FK

master_companies

Nullable

---

salary_level

TEXT

Nullable

---

salary_step

NUMERIC

Nullable

---

salary_amount

NUMERIC

Nullable

---

order_number

TEXT

เลขคำสั่ง

Nullable

---

source_document_id

UUID

FK

documents

Nullable

---

notes

TEXT

Nullable

---

verification_status

TEXT

PENDING

AI

VERIFIED

REJECTED

---

confidence_score

INTEGER

0-100

AI Confidence

Nullable

---

Standard Columns

ใช้ทั้งหมด

---

# 37. Timeline Types

Timeline

ต้องไม่ใช้ข้อความอิสระ

ทุกเหตุการณ์

อ้างอิง

master_timeline_types

ตัวอย่าง

Appointment

Transfer

Promotion

Rank

Salary

Education

Training

Award

Certificate

Retirement

Resignation

Leave

Disciplinary

Special Assignment

Mission

Other

---

# 38. master_timeline_types

Columns

id

UUID

---

code

TEXT

UNIQUE

---

name_th

TEXT

---

name_en

TEXT

---

icon

TEXT

Nullable

---

color

TEXT

Nullable

---

display_order

INTEGER

---

is_active

BOOLEAN

---

# 39. Timeline Rules

Timeline

ห้าม Update

เหตุการณ์เก่า

หากมีการเปลี่ยนแปลง

ให้สร้าง Event ใหม่

เพื่อรักษาประวัติ

ตัวอย่าง

1 เม.ย. 2550

บรรจุ

↓

1 ก.พ. 2551

เลื่อนยศ

↓

1 ต.ค. 2555

ย้ายหน่วย

↓

1 ต.ค. 2561

เลื่อนตำแหน่ง

Timeline

ต้องเรียงตามเวลา

เสมอ

---

# 40. Timeline Attachments

Timeline

สามารถแนบ

Asset

ได้หลายรายการ

ตัวอย่าง

คำสั่ง

PDF

รูปภาพ

GP7

Certificate

Appointment Order

Relationship

Timeline

1

↓

Many

Assets

---

# 41. timeline_assets

Purpose

เชื่อม Timeline

กับ Asset

Columns

id

UUID

PK

---

timeline_id

FK

career_timelines

---

asset_id

FK

assets

---

asset_role

TEXT

ตัวอย่าง

ORDER

PHOTO

GP7

CERTIFICATE

REPORT

OTHER

---

Standard Columns

ใช้ทั้งหมด

---

# 42. Timeline Import

Timeline

สามารถสร้างได้จาก

Manual

OCR

AI

Import

API

ทุก Record

ต้องมี

source_type

MANUAL

OCR

IMPORT

API

AI

---

# 43. Timeline Verification

Timeline

ทุก Record

มีสถานะ

Pending

AI Reviewed

Human Verified

Rejected

Approved

AI

ไม่มีสิทธิ์

Approve

---

# 44. Timeline Search

Timeline

ค้นหาได้จาก

ปี

เดือน

ยศ

ตำแหน่ง

กองกำกับ

กองร้อย

จังหวัด

เลขคำสั่ง

ประเภทเหตุการณ์

คำสำคัญ

OCR

AI Summary

ทั้งหมด

ใช้ Search Engine

เดียวกัน

---

# 45. Timeline Intelligence

Timeline

ไม่ใช่แค่ประวัติ

แต่เป็นข้อมูล

สำหรับคำนวณ

Years In Rank

↓

Years In Position

↓

Promotion Eligibility

↓

Training Gap

↓

Career Pattern

↓

Commander Recommendation

↓

AI Summary

Timeline

จึงเป็น

Knowledge Engine

ของทั้งระบบ

---

# 46. Timeline Calculation

ระบบต้องสามารถคำนวณ

Current Rank Duration

Current Position Duration

Current Company Duration

Total Police Service

Total Timeline Events

Promotion Waiting Time

Average Transfer Interval

Training Frequency

Award Count

Mission Count

โดยไม่ต้องให้ผู้ใช้กรอก

ระบบคำนวณอัตโนมัติ

---

# 47. Timeline Design Principle

Timeline

เป็น Immutable Event Log

ไม่ใช่ Current State

Current State

ของ Officer

จะคำนวณจาก

Timeline ล่าสุด

ไม่ใช่เก็บข้อมูลซ้ำ

ยกเว้น

Current Cache

ที่ใช้เพื่อเพิ่มประสิทธิภาพ

---

End of Part 4

# 48. Asset Domain

ทุกไฟล์ในระบบ

คือ Asset

ไม่ว่าจะเป็น

- รูปภาพ
- PDF
- GP7
- Timeline
- หนังสือราชการ
- คำสั่ง
- Certificate
- แผนที่
- PowerPoint
- Excel
- Video

ระบบจะจัดการทุกอย่างด้วยโครงสร้างเดียวกัน

---

# 49. assets

Purpose

เก็บข้อมูล Asset หลัก

หนึ่งไฟล์

หนึ่ง Record

Columns

id

UUID

Primary Key

---

google_drive_file_id

TEXT

UNIQUE

Google Drive File ID

---

parent_folder_id

TEXT

Google Drive Folder ID

---

storage_provider

TEXT

ตัวอย่าง

GOOGLE_DRIVE

LOCAL

S3

AZURE

---

original_filename

TEXT

ชื่อไฟล์จริง

---

display_name

TEXT

ชื่อที่ระบบแสดง

---

mime_type

TEXT

image/jpeg

application/pdf

video/mp4

...

---

extension

TEXT

jpg

png

pdf

pptx

...

---

file_size

BIGINT

Byte

---

checksum

TEXT

SHA256

ใช้ตรวจไฟล์ซ้ำ

---

thumbnail_url

TEXT

Nullable

---

preview_url

TEXT

Nullable

---

download_url

TEXT

Nullable

---

current_version

INTEGER

Default 1

---

verification_status

TEXT

PENDING

VERIFIED

REJECTED

---

owner_officer_id

UUID

FK

officers

Nullable

---

Standard Columns

ใช้ทั้งหมด

---

# 50. asset_metadata

Purpose

Metadata

ของ Asset

แยกออกจากตารางหลัก

เพื่อรองรับการขยาย

Columns

id

UUID

PK

---

asset_id

FK

assets

UNIQUE

---

asset_type_id

FK

master_asset_types

---

document_type_id

FK

master_document_types

Nullable

---

region_id

FK

master_regions

Nullable

---

command_id

FK

master_commands

Nullable

---

subdivision_id

FK

master_subdivisions

Nullable

---

company_id

FK

master_companies

Nullable

---

officer_id

FK

officers

Nullable

---

timeline_id

FK

career_timelines

Nullable

---

capture_date

DATE

Nullable

---

capture_location

TEXT

Nullable

---

keywords

TEXT[]

Array

---

remarks

TEXT

---

ai_summary

TEXT

Nullable

---

Standard Columns

ใช้ทั้งหมด

---

# 51. master_asset_types

Purpose

ประเภทของ Asset

ตัวอย่าง

Portrait

Timeline

GP7

Certificate

Appointment Order

Training

Award

Map

Organization Chart

Report

Presentation

Document

Video

Image

Spreadsheet

Other

Columns

id

UUID

---

code

TEXT

UNIQUE

---

name_th

TEXT

---

name_en

TEXT

---

icon

TEXT

---

color

TEXT

---

display_order

INTEGER

---

is_active

BOOLEAN

---

# 52. master_document_types

Purpose

ประเภทเอกสาร

ตัวอย่าง

GP7

คำสั่งแต่งตั้ง

คำสั่งย้าย

ประวัติราชการ

วุฒิการศึกษา

หลักสูตร

ใบประกาศ

เครื่องราช

หนังสือราชการ

รายงาน

อื่นๆ

---

# 53. Asset Relationships

Officer

1

↓

Many

Assets

Timeline

1

↓

Many

Assets

Company

1

↓

Many

Assets

Subdivision

1

↓

Many

Assets

Asset

1

↓

One

Metadata

---

# 54. Asset Version

ทุก Asset

รองรับ Version

หากมีการ Upload ใหม่

ไม่ลบของเดิม

แต่เพิ่ม Version

Version History

สามารถย้อนกลับได้

---

# 55. Duplicate Detection

ระบบตรวจไฟล์ซ้ำ

จาก

Google Drive File ID

และ

SHA256

ห้าม Import

ไฟล์เดียวกัน

ซ้ำ

---

# 56. Asset Verification

Workflow

Upload

↓

Import

↓

OCR

↓

AI Classification

↓

Metadata Suggestion

↓

Human Verification

↓

Approved

↓

Search

↓

Dashboard

ทุก Asset

ต้องผ่าน Verification

ก่อนใช้งานจริง

---

# 57. Asset Intelligence

Asset

ไม่ใช่ไฟล์

แต่เป็น Knowledge Object

AI

สามารถอ่าน

OCR

สามารถวิเคราะห์

Metadata

สามารถค้นหา

Commander

สามารถใช้งาน

ทุก Asset

ต้องเชื่อมกับ

Officer

หรือ

Organization

หรือ

Timeline

อย่างน้อยหนึ่งรายการ

ห้ามเป็นไฟล์ลอย

---

# 58. Asset Design Principles

Asset

ห้ามอ้างอิง Folder

Business Logic

ใช้ Metadata เท่านั้น

Google Drive

เป็นเพียง

Storage Layer

Database

คือ

Source of Truth

---

End of Part 5
# 59. AI Intelligence Domain

Purpose

AI ไม่มีหน้าที่เก็บข้อมูลจริง

AI มีหน้าที่

- อ่านข้อมูล
- วิเคราะห์ข้อมูล
- จำแนกประเภท
- สรุปข้อมูล
- แนะนำ Metadata
- ประเมินความเชื่อมั่น

ผลลัพธ์ทั้งหมด

ต้องถูกเก็บแยก

จากข้อมูลจริง

---

# 60. asset_ai_results

Purpose

เก็บผลการวิเคราะห์ของ AI

หนึ่ง Asset

สามารถถูกวิเคราะห์ได้หลายครั้ง

Columns

id

UUID

Primary Key

---

asset_id

UUID

FK

assets.id

---

ai_provider

TEXT

ตัวอย่าง

OpenAI

Claude

Gemini

Local LLM

---

model_name

TEXT

ตัวอย่าง

GPT-5.5

Claude Opus

Gemini Pro

---

task_type

TEXT

CLASSIFICATION

OCR_ANALYSIS

SUMMARY

TIMELINE_EXTRACTION

PROFILE_MATCHING

TAG_GENERATION

---

confidence_score

INTEGER

0-100

---

raw_response

JSONB

เก็บผลลัพธ์ดิบ

---

structured_result

JSONB

ผลลัพธ์ที่ระบบอ่านได้

---

processing_time_ms

INTEGER

---

token_usage

INTEGER

Nullable

---

status

TEXT

SUCCESS

FAILED

REVIEW_REQUIRED

---

Standard Columns

ใช้ทั้งหมด

---

# 61. OCR Domain

OCR

เป็นคนละ Layer

กับ AI

OCR

อ่านข้อความ

AI

ตีความข้อความ

Architecture

Image

↓

OCR

↓

Raw Text

↓

AI

↓

Metadata

↓

Human

↓

Database

---

# 62. asset_ocr_results

Purpose

เก็บข้อความที่ OCR อ่านได้

Columns

id

UUID

Primary Key

---

asset_id

FK

assets

---

ocr_provider

TEXT

Google Vision

Azure OCR

Tesseract

OpenAI

---

language

TEXT

th

en

---

raw_text

TEXT

ข้อความเต็ม

---

page_count

INTEGER

---

confidence_score

INTEGER

---

processing_time_ms

INTEGER

---

status

TEXT

SUCCESS

FAILED

PARTIAL

---

Standard Columns

ใช้ทั้งหมด

---

# 63. Metadata Suggestions

AI

ไม่มีสิทธิ์

เขียน Metadata จริง

AI

สร้าง

Suggestion

เท่านั้น

Columns

ตัวอย่าง

Suggested Officer

Suggested Company

Suggested Subdivision

Suggested Rank

Suggested Position

Suggested Timeline

Suggested Document Type

Suggested Asset Type

Suggested Keywords

ทุก Suggestion

ต้องมี

Confidence

---

# 64. asset_ai_suggestions

Purpose

เก็บข้อเสนอของ AI

Columns

id

UUID

PK

---

asset_id

FK

assets

---

field_name

TEXT

ตัวอย่าง

company_id

rank_id

officer_id

---

suggested_value

TEXT

---

confidence_score

INTEGER

---

reasoning

TEXT

คำอธิบายสั้น ๆ

---

accepted

BOOLEAN

---

accepted_by

UUID

Nullable

---

accepted_at

TIMESTAMP

Nullable

---

Standard Columns

ใช้ทั้งหมด

---

# 65. Human Verification

Verification

เป็นขั้นตอนบังคับ

Workflow

Upload

↓

OCR

↓

AI

↓

Metadata Suggestion

↓

Human Review

↓

Approve

↓

Database

AI

ไม่มีสิทธิ์

Approve

---

# 66. asset_verifications

Purpose

เก็บผลการตรวจสอบ

Columns

id

UUID

Primary Key

---

asset_id

FK

assets

---

reviewer_id

FK

users

---

verification_status

TEXT

APPROVED

REJECTED

RETURNED

---

review_note

TEXT

---

verified_at

TIMESTAMP

---

Standard Columns

ใช้ทั้งหมด

---

# 67. Confidence Policy

AI Result

80-100

Auto Suggest

แสดงสีเขียว

---

60-79

ต้อง Human Review

แสดงสีเหลือง

---

ต่ำกว่า 60

Needs Manual Review

แสดงสีแดง

ระบบไม่ควรนำไปใช้โดยอัตโนมัติ

---

# 68. AI Versioning

AI Result

ต้องเก็บ Version

เช่น

Version 1

GPT-5.5

↓

Version 2

Claude Opus

↓

Version 3

Future Model

ผลลัพธ์เก่า

ห้ามลบ

เพื่อเปรียบเทียบคุณภาพ

---

# 69. AI Explainability

ทุก Suggestion

ต้องอธิบายได้

ตัวอย่าง

Suggested Company

ร้อย ตชด.414

Reason

พบข้อความ

"กองร้อยตำรวจตระเวนชายแดนที่ 414"

ใน GP.7

Confidence

96%

ระบบต้องไม่แสดง

Suggestion

ที่ไม่มีเหตุผลประกอบ

---

# 70. AI Design Rules

AI

ไม่แก้ข้อมูลจริง

AI

ไม่ลบข้อมูล

AI

ไม่อนุมัติข้อมูล

AI

เป็นผู้ช่วย

ไม่ใช่ผู้ตัดสินใจ

ข้อมูลจริง

เป็นความรับผิดชอบของเจ้าหน้าที่

---

End of Part 6
# 71. Promotion Intelligence Domain

Purpose

Promotion Engine

มีหน้าที่

วิเคราะห์

และคำนวณ

คุณสมบัติการเลื่อนตำแหน่ง

โดยอัตโนมัติ

ระบบ

ไม่ Hardcode

กฎการเลื่อนตำแหน่ง

ทุกกฎ

ต้องอ่านจาก Database

---

# 72. promotion_rules

Purpose

เก็บกฎการเลื่อนตำแหน่ง

Columns

id

UUID

Primary Key

---

rule_code

TEXT

UNIQUE

ตัวอย่าง

PROMOTE_SV

PROMOTE_DEPUTY_SUP

---

rule_name

TEXT

---

from_rank_id

FK

master_ranks

---

to_position_id

FK

master_positions

Nullable

---

minimum_years_in_rank

NUMERIC

---

minimum_years_in_position

NUMERIC

Nullable

---

minimum_total_service

NUMERIC

Nullable

---

required_course_ids

UUID[]

Array

---

required_award_ids

UUID[]

Nullable

---

priority

INTEGER

---

effective_from

DATE

---

effective_to

DATE

Nullable

---

is_active

BOOLEAN

---

Standard Columns

ใช้ทั้งหมด

---

# 73. promotion_evaluations

Purpose

ผลการประเมิน

ของกำลังพลแต่ละนาย

Columns

id

UUID

PK

---

officer_id

FK

officers

---

rule_id

FK

promotion_rules

---

evaluation_date

DATE

---

eligible

BOOLEAN

---

score

INTEGER

0-100

---

years_in_rank

NUMERIC

---

years_in_position

NUMERIC

---

years_of_service

NUMERIC

---

missing_requirements

JSONB

---

evaluation_reason

TEXT

---

next_eligible_date

DATE

Nullable

---

Standard Columns

ใช้ทั้งหมด

---

# 74. Promotion Workflow

Officer

↓

Timeline

↓

Current Rank

↓

Current Position

↓

Courses

↓

Awards

↓

Promotion Rules

↓

Evaluation

↓

Recommendation

↓

Commander Dashboard

---

# 75. Promotion Status

Officer

มีสถานะ

NOT_ELIGIBLE

↓

PARTIALLY_ELIGIBLE

↓

ELIGIBLE

↓

RECOMMENDED

↓

SELECTED

↓

PROMOTED

ทุกสถานะ

ต้องมี Timestamp

---

# 76. Promotion Score

Promotion Score

คำนวณจาก

Years In Rank

+

Years In Position

+

Courses

+

Awards

+

Performance

+

Special Qualification

+

Organization Rules

ผลลัพธ์

0-100

---

# 77. Missing Requirements

ระบบต้องตอบได้ว่า

ยังขาดอะไร

ตัวอย่าง

✓ ครองยศครบ

✓ ครองตำแหน่งครบ

✗ ยังขาดหลักสูตร

✗ ยังขาดเวลาอีก

1 ปี 4 เดือน

✗ เครื่องราชยังไม่ครบ

---

# 78. Recommendation Engine

ระบบต้องสามารถสร้าง

Recommendation

ตัวอย่าง

พร้อมขึ้น สว.

พร้อมขึ้น รอง ผกก.

ควรส่งอบรมหลักสูตร...

ควรพิจารณาแต่งตั้ง

รอครบเวลาอีก 6 เดือน

AI

สามารถอธิบายเหตุผลได้

---

# 79. Commander Candidate List

Commander

สามารถเปิดดู

Candidate List

ตามตำแหน่ง

ตัวอย่าง

ผู้ที่พร้อมขึ้น

สว.

รอง ผกก.

ผกก.

รอง ผบก.

ผบก.

ผลลัพธ์

เรียงตาม

Promotion Score

---

# 80. Favorite Candidate

Commander

สามารถ

กดดาว

หรือ

Favorite

กำลังพล

เพื่อติดตาม

การแต่งตั้ง

ภายหลัง

Favorites

เป็นข้อมูลส่วนตัว

ของผู้ใช้งานแต่ละคน

ไม่ใช้ร่วมกัน

---

# 81. Promotion History

ทุกการประเมิน

ต้องเก็บย้อนหลัง

ระบบต้องสามารถตอบได้ว่า

เมื่อปีที่แล้ว

Officer คนนี้

ยังขาดอะไร

และ

ปัจจุบัน

ครบแล้วหรือไม่

---

# 82. Promotion Rules Design

กฎทุกข้อ

ต้องสามารถเพิ่ม

แก้ไข

ยกเลิก

โดย

Administrator

ไม่ต้อง Deploy ระบบ

---

# 83. Promotion Design Principle

Promotion Engine

ไม่มีข้อมูลของตัวเอง

Promotion

คำนวณจาก

Timeline

+

Officer

+

Training

+

Award

+

Master Data

+

Promotion Rules

ทุกครั้ง

ผลลัพธ์

สามารถ Recalculate

ได้เสมอ

---

End of Part 7

# 84. Commander Intelligence Domain

Purpose

Commander Domain

มีหน้าที่

รวบรวม

วิเคราะห์

สรุป

และแสดงข้อมูล

เพื่อช่วยผู้บังคับบัญชาตัดสินใจ

Commander Domain

ไม่มีข้อมูลต้นฉบับ

ใช้ข้อมูลจาก

Officer

Timeline

Promotion

Training

Asset

AI

แล้วสร้าง

Decision Intelligence

---

# 85. commander_dashboards

Purpose

เก็บ Dashboard Configuration

ของผู้ใช้งานแต่ละคน

Columns

id

UUID

Primary Key

---

user_id

FK

users

---

dashboard_name

TEXT

---

layout

JSONB

ตำแหน่ง Widget

---

filters

JSONB

Filter เริ่มต้น

---

favorite_widgets

JSONB

---

last_opened_at

TIMESTAMP

---

Standard Columns

ใช้ทั้งหมด

---

# 86. commander_favorites

Purpose

ผู้บังคับบัญชา

สามารถติดดาว

กำลังพล

ไว้ติดตาม

Columns

id

UUID

Primary Key

---

user_id

FK

users

---

officer_id

FK

officers

---

favorite_type

TEXT

PROMOTION

SUCCESSION

TRANSFER

GENERAL

---

note

TEXT

Nullable

---

Standard Columns

ใช้ทั้งหมด

---

# 87. commander_candidate_lists

Purpose

เก็บรายการผู้เข้าข่าย

แต่ละตำแหน่ง

Columns

id

UUID

PK

---

user_id

FK

users

---

position_id

FK

master_positions

---

name

TEXT

เช่น

Candidate สว. ปี 2570

---

description

TEXT

Nullable

---

is_default

BOOLEAN

---

Standard Columns

ใช้ทั้งหมด

---

# 88. commander_candidate_items

Purpose

กำลังพล

ใน Candidate List

Columns

id

UUID

PK

---

candidate_list_id

FK

commander_candidate_lists

---

officer_id

FK

officers

---

priority

INTEGER

---

note

TEXT

---

selected

BOOLEAN

---

Standard Columns

ใช้ทั้งหมด

---

# 89. Dashboard Widgets

Dashboard

รองรับ Widget

Officer Summary

Promotion Summary

Upcoming Retirement

Missing Documents

Training Status

AI Review Queue

Timeline Activity

Organization Summary

Favorite Officers

Latest Upload

Document Statistics

Verification Queue

ทุก Widget

ต้องเปิด/ปิดได้

---

# 90. Dashboard Cache

Purpose

ลดภาระ Database

สร้างข้อมูลสรุปล่วงหน้า

Columns

id

UUID

PK

---

cache_key

TEXT

UNIQUE

---

cache_data

JSONB

---

generated_at

TIMESTAMP

---

expire_at

TIMESTAMP

---

# 91. Executive Reports

ระบบต้องสามารถสร้าง

Executive Report

อัตโนมัติ

เช่น

กำลังพลทั้งหมด

แยกตามกองกำกับ

ผู้ครบเลื่อนตำแหน่ง

ผู้ใกล้เกษียณ

ผู้ขาดหลักสูตร

เอกสารค้างตรวจ

AI Summary

ทุก Report

Export ได้

PDF

Excel

CSV

---

# 92. Notification Queue

Purpose

เก็บรายการแจ้งเตือน

Columns

id

UUID

PK

---

user_id

FK

users

---

notification_type

TEXT

PROMOTION

TRAINING

RETIREMENT

DOCUMENT

AI

SYSTEM

---

title

TEXT

---

message

TEXT

---

is_read

BOOLEAN

---

read_at

TIMESTAMP

---

Standard Columns

ใช้ทั้งหมด

---

# 93. Commander Search

ผู้บังคับบัญชา

สามารถค้นหา

จาก

ชื่อ

ยศ

ตำแหน่ง

กองกำกับ

กองร้อย

หลักสูตร

Timeline

ผลงาน

Promotion

AI Summary

OCR

Favorite

Recommendation

ผลลัพธ์

ต้องเปิดหน้า Officer ได้ทันที

---

# 94. Decision Support

Commander Dashboard

ต้องตอบคำถามได้

เช่น

ใครครบขึ้น สว.

ใครจะครบในอีก 6 เดือน

ใครขาดหลักสูตร

ใครใกล้เกษียณ

กองร้อยไหน

กำลังพลขาด

กองกำกับไหน

เอกสารไม่ครบ

ทั้งหมด

ไม่ต้องเขียน SQL

---

# 95. Commander Design Principles

Dashboard

ไม่มีข้อมูลจริง

Dashboard

อ่านจาก

Analytics Layer

Cache Layer

Search Layer

ทุกการคำนวณหนัก

ต้องทำเบื้องหลัง

ห้ามคำนวณ

บนหน้าเว็บ

---

End of Part 8

# 96. Enterprise Search Architecture

Purpose

Search

เป็นหนึ่งใน Engine หลักของ BPPI

Search

ต้องสามารถค้นหา

ข้อมูลทุก Domain

โดยใช้ Search Engine เดียว

Search

ไม่ใช่ Feature

แต่เป็น Shared Infrastructure

ของทั้งระบบ

---

# 97. Global Search Index

ระบบสร้าง

Search Index

แยกจากข้อมูลจริง

เพื่อเพิ่มความเร็ว

Search Index

รวมข้อมูลจาก

Officer

Timeline

Asset

Document

OCR

AI Summary

Training

Award

Promotion

Organization

Metadata

ทุกครั้งที่ข้อมูลเปลี่ยน

Index

ต้อง Update

โดยอัตโนมัติ

---

# 98. search_indexes

Purpose

เก็บ Search Index

Columns

id

UUID

Primary Key

---

entity_type

TEXT

OFFICER

TIMELINE

ASSET

DOCUMENT

PROMOTION

TRAINING

AWARD

---

entity_id

UUID

---

title

TEXT

---

subtitle

TEXT

---

search_text

TEXT

ข้อความทั้งหมด

สำหรับ Full Text Search

---

keywords

TEXT[]

---

embedding_vector

VECTOR

รองรับ Semantic Search

Version 3

---

last_indexed_at

TIMESTAMP

---

Standard Columns

ใช้ทั้งหมด

---

# 99. Search Categories

Search

รองรับ

Officer

Timeline

Promotion

Training

Award

Document

Asset

Organization

Course

Report

Mission

ทุก Category

ค้นพร้อมกันได้

---

# 100. Search Filters

Filter

รองรับ

Region

Command

Subdivision

Company

Rank

Position

Promotion Status

Training

Award

Timeline Type

Asset Type

Document Type

Verification

AI Confidence

Created Date

Updated Date

---

# 101. Advanced Search

ระบบต้องรองรับ

Boolean Search

Phrase Search

Partial Search

Thai Search

English Search

Multi Keyword Search

Search Suggestions

Search History

Recent Search

Saved Search

---

# 102. Semantic Search

Version 3

Search

รองรับ

Natural Language

ตัวอย่าง

"ผู้ที่ใกล้ครบขึ้น สว."

"ผู้ที่เคยอยู่ กก.ตชด.41"

"ผู้ที่ผ่านหลักสูตรพลร่ม"

AI

แปลงเป็น Query

อัตโนมัติ

---

# 103. Analytics Layer

Analytics

แยกจาก Database

Analytics

สร้างข้อมูลสรุป

ล่วงหน้า

ตัวอย่าง

Officer Count

Promotion Count

Timeline Count

Training Statistics

Organization Summary

Verification Queue

Document Status

AI Performance

---

# 104. analytics_snapshots

Purpose

เก็บข้อมูลสรุป

Columns

id

UUID

Primary Key

---

snapshot_type

TEXT

DAILY

WEEKLY

MONTHLY

YEARLY

REALTIME

---

snapshot_key

TEXT

---

snapshot_data

JSONB

---

generated_at

TIMESTAMP

---

expire_at

TIMESTAMP

---

# 105. Materialized Views

BPPI

ใช้ Materialized Views

สำหรับ Query หนัก

ตัวอย่าง

Current Officer Status

Promotion Candidate

Training Summary

Timeline Statistics

Organization Statistics

Document Statistics

Gallery Summary

AI Queue

Dashboard

อ่านจาก View

แทน Table จริง

เมื่อเหมาะสม

---

# 106. Index Strategy

ทุก Foreign Key

ต้องมี Index

ทุก Search Column

ต้องมี Index

ทุกวันที่

ใช้ค้นหา

ต้องมี Index

ทุก UUID

ต้องเป็น B-Tree Index

Full Text Search

ใช้ GIN Index

JSONB

ใช้ GIN Index

Vector Search

ใช้ Vector Index

เมื่อใช้งานจริง

---

# 107. Performance Targets

Officer Search

< 500 ms

Timeline Search

< 800 ms

Gallery Search

< 1 second

Dashboard Load

< 2 seconds

Promotion Evaluation

Background Job

AI Analysis

Asynchronous

OCR

Queue Based

---

# 108. Background Jobs

ระบบต้องมี Job Queue

สำหรับ

OCR

AI

Search Index

Analytics

Cache Refresh

Notification

Promotion Recalculate

ทุกงานหนัก

ทำแบบ

Async

ห้ามทำใน Request

---

# 109. Search Design Principles

Search

ไม่ Query

Google Drive

Search

ไม่ใช้

File Name

เป็นหลัก

Search

ใช้

Metadata

Timeline

AI Summary

OCR

Tag

Master Data

ทั้งหมด

---

End of Part 9

# 110. Security Architecture

Purpose

Database

ต้องออกแบบโดยยึดหลัก

Least Privilege

ทุก User

เข้าถึงเฉพาะข้อมูล

ที่ได้รับอนุญาต

ห้ามใช้

Administrator

เป็นค่าเริ่มต้น

---

# 111. Permission Model

ระบบแบ่งสิทธิ์ออกเป็น

System Administrator

Organization Administrator

Commander

Staff

Viewer

AI Service

Background Worker

แต่ละ Role

ได้รับ Permission

แตกต่างกัน

Permission

ต้องเก็บใน Database

ไม่ Hardcode

---

# 112. Data Ownership

ข้อมูลทุกชุด

ต้องมี Owner

ตัวอย่าง

Officer

↓

Organization

↓

Commander

↓

Administrator

เพื่อรองรับ

Permission

Audit

และ Workflow

---

# 113. Backup Strategy

Database Backup

Daily Incremental

Weekly Full Backup

Monthly Archive

Backup

ต้องถูกเข้ารหัส

และเก็บต่าง Location

รองรับ

Point In Time Recovery

(PITR)

---

# 114. Disaster Recovery

Recovery Objective

RTO

ไม่เกิน

2 ชั่วโมง

Recovery Point

RPO

ไม่เกิน

15 นาที

ทุก Environment

ต้องทดสอบการ Restore

อย่างน้อย

ทุก 6 เดือน

---

# 115. Archive Strategy

Timeline

Asset

Audit

Notification

AI Result

เมื่อเกินระยะเวลาที่กำหนด

สามารถ Archive

ได้

โดยไม่กระทบ

Search

และ Report

---

# 116. Scalability

Database

ต้องรองรับ

100,000+

Officer

10,000,000+

Timeline Events

20,000,000+

Assets

50,000,000+

Audit Logs

100+

Concurrent Users

Architecture

ต้องสามารถ Scale

ทั้ง Vertical

และ Horizontal

---

# 117. Partition Strategy

Timeline

Partition

ตามปี

Asset

Partition

ตามปี

Audit

Partition

ตามเดือน

Notification

Partition

ตามเดือน

AI Result

Partition

ตามปี

เพื่อเพิ่มประสิทธิภาพ

ในการ Query

---

# 118. Database Migration Strategy

ทุกการเปลี่ยนแปลง Schema

ต้องใช้ Migration

ห้ามแก้ไข

Production Database

โดยตรง

Migration

ต้องสามารถ

Rollback

ได้

ทุกครั้ง

---

# 119. Data Integrity Rules

ทุก Foreign Key

ต้องตรวจสอบ

ทุก Transaction

ต้องใช้

ACID

ทุก Constraint

ต้องกำหนด

ชัดเจน

ห้ามปล่อยข้อมูล

Orphan

ภายในระบบ

---

# 120. Performance Principles

Query

ต้องใช้ Index

Join

ต้องมี Foreign Key

Pagination

ทุกหน้ารายการ

Background Job

สำหรับงานหนัก

Caching

สำหรับ Dashboard

Analytics

Materialized Views

สำหรับ Report

---

# 121. Database Monitoring

ระบบต้องเก็บ

Slow Query

Execution Time

Connection Count

Queue Length

Index Usage

Storage Usage

AI Processing Time

OCR Processing Time

เพื่อใช้ปรับปรุงระบบ

อย่างต่อเนื่อง

---

# 122. Development Checklist

ก่อนเพิ่ม Table ใหม่

ต้องตอบคำถาม

มี UUID หรือไม่

มี Audit หรือไม่

มี Soft Delete หรือไม่

มี Foreign Key หรือไม่

มี Index หรือไม่

รองรับ AI หรือไม่

รองรับ Search หรือไม่

รองรับ Metadata หรือไม่

รองรับ Version หรือไม่

มี Owner หรือไม่

ผ่านแล้ว

จึงสร้าง Table

---

# 123. Database Quality Standards

ทุก Table

ต้องมี

Primary Key

Foreign Key

Indexes

Constraints

Audit

Soft Delete

Version

Created At

Updated At

Status

ห้ามมี Exception

เว้นแต่ได้รับอนุมัติ

จาก Architecture Review

---

# 124. Future Compatibility

Database

ต้องรองรับ

AI หลาย Provider

Face Recognition

Semantic Search

Vector Search

Voice Search

Mobile Application

Offline Sync

National Scale

โดยไม่ต้องเปลี่ยน

Core Architecture

---

# 125. Final Database Principles

Database

ไม่ใช่ที่เก็บข้อมูล

แต่เป็น

Knowledge Platform

ทุกข้อมูล

ต้องเชื่อมโยงกัน

ทุกข้อมูล

ต้องค้นหาได้

ทุกข้อมูล

ต้องตรวจสอบย้อนหลังได้

ทุกข้อมูล

ต้องพร้อมสำหรับ AI

ทุกข้อมูล

ต้องพร้อมสำหรับการตัดสินใจ

Database

คือหัวใจของ

Border Patrol Personnel Intelligence Platform

---

# Database V2 Completion

Database V2 Design

ประกอบด้วย

Part 1

Core Principles

Part 2

Master Data

Part 3

Officer Domain

Part 4

Timeline Domain

Part 5

Asset Intelligence

Part 6

AI / OCR / Verification

Part 7

Promotion Intelligence

Part 8

Commander Intelligence

Part 9

Search / Analytics

Part 10

Security / Scalability / Database Standards

Database Blueprint

Status

Completed

Ready for

Prisma Schema

SQL Migration

Supabase Migration

API Design

Backend Development

Frontend Integration

AI Integration

Production Planning

End of Document