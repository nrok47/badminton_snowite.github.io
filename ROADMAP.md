# ROADMAP

เอกสารนี้เป็นแผนพัฒนาต่อแบบ practical สำหรับโปรเจกต์ `badminton_snowite.github.io`

## เป้าหมายหลัก

- ทำให้โปรเจกต์แก้ง่ายขึ้นโดยไม่พัง flow เดิม
- ลดความเสี่ยงจากการมี `index.html` ก้อนเดียวขนาดใหญ่
- เตรียมพื้นที่สำหรับฟีเจอร์ใหม่ในอนาคต

## Phase 1: Stabilize

สิ่งที่ควรทำก่อนเพิ่มฟีเจอร์ใหญ่

1. จัด section comment ใน `index.html` ให้ชัดขึ้น
2. รวม function stub และ helper ให้เป็นกลุ่มเดียวกัน
3. ตั้ง naming ให้สม่ำเสมอในส่วน finance, members, match history
4. ไล่ลบโค้ดที่ไม่ถูกเรียกใช้จริงเท่าที่ตรวจสอบได้อย่างปลอดภัย
5. เพิ่ม smoke checklist สำหรับทดสอบหน้า Ranking, Match, Finance, Rules, Trophy

## Phase 2: Safe Refactor

1. แยก config constants ออกมาไว้บนสุดให้ครบ
2. แยก render functions ตามโดเมน เช่น dashboard, finance, members, rules
3. ลด inline HTML template ที่ซ้ำกัน
4. เพิ่ม utility สำหรับ query DOM และ toast/action patterns
5. ทำ data migration guard สำหรับ schema ใหม่ ถ้าจะมี field เพิ่ม

## Phase 3: Product Improvements

ฟีเจอร์ที่น่าทำต่อและมี impact

1. Search/filter สมาชิกและประวัติแมตช์
2. Dashboard สรุปรายสัปดาห์หรือรายเดือน
3. Export รายงานเป็น CSV/JSON แบบเลือกช่วงเวลา
4. หน้า profile สมาชิกแบบละเอียดขึ้น เช่น trend, คู่หูประจำ, คู่ปรับ
5. ระบบสิทธิ์สมาชิกที่ชัดกว่าเดิม เช่น member self-service มากขึ้น

## Phase 4: Reliability

1. เพิ่ม backup/restore flow ที่ชัดสำหรับ admin
2. เพิ่ม schema version ใน state
3. ตรวจ error ของ Firebase sync ให้เห็นชัดใน UI
4. เพิ่ม conflict-safe guard ตอนหลายคนแก้ข้อมูลใกล้กัน

## งานที่ผมแนะนำให้ทำเป็นชิ้นแรก

ถ้าจะให้ผมลงมือรอบถัดไป แนะนำ 3 ทางเลือกที่คุ้มสุด:

1. Refactor `index.html` แบบไม่เปลี่ยนฟีเจอร์ เพื่อให้อ่านและแก้ง่ายขึ้น
2. ทำระบบค้นหาสมาชิกและค้นหาประวัติแมตช์
3. ทำ dashboard สรุปผลประจำสัปดาห์ให้ใช้โชว์ในก๊วนได้เลย

## หมายเหตุ

- ตอนนี้ `app.js` กับ `style.css` เป็น legacy ไม่ควรใช้เป็นฐานพัฒนาต่อ
- ถ้าจะเปลี่ยนสถาปัตย์เป็น multi-file จริง ควรทำหลังจาก phase stabilize และมีแผน migration ชัดเจน
