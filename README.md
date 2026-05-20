# Snowite Badminton Club

เว็บจัดการก๊วนแบดภาษาไทยสำหรับใช้เก็บสมาชิก จัดอันดับ ELO บันทึกผลแข่ง ติดตามการเงิน และซิงก์ข้อมูลผ่าน Firebase Realtime Database

โปรเจกต์นี้ deploy แบบ static site บน GitHub Pages และตั้งใจให้แก้ไขได้ง่ายโดยไม่ต้องมี build step

## จุดสำคัญ

- ใช้ `index.html` เป็นไฟล์ production หลักเพียงไฟล์เดียว
- เขียนด้วย Vanilla HTML/CSS/JavaScript
- รองรับมือถือเป็นหลัก
- ใช้ Firebase Realtime Database สำหรับเก็บ state หลักของแอป
- ไฟล์ `app.js` และ `style.css` เป็น legacy และไม่ได้ใช้งานแล้ว

## โครงสร้างไฟล์

```text
/
|-- index.html          # production file หลัก
|-- CLAUDE.md           # คู่มือโครงสร้างและข้อควรระวังของโปรเจกต์
|-- ROADMAP.md          # แผนพัฒนาต่อที่แนะนำ
|-- firebase_code.txt   # reference config เดิม
|-- manifest.json
|-- icon.png / favicon.ico / icon/
|
|-- legacy files (เก็บไว้ดูย้อนหลัง ไม่ควรแก้)
|-- index-backup.html
|-- index-backup2.html
|-- index-backup-icon.html
|-- index-2.html
|-- index-v3.html
|-- index-v4.html
|-- index_v2.html
|-- indexbwf.html
|-- old_index.html
|-- app.js
`-- style.css
```

## การพัฒนาในเครื่อง

เปิด `index.html` ตรง ๆ ก็ได้ หรือใช้ local server แบบง่าย

```powershell
cd C:\xampp\htdocs\snowite_badminton
php -S localhost:8080
```

จากนั้นเปิด [http://localhost:8080](http://localhost:8080)

ถ้าใช้ XAMPP ตาม path นี้อยู่แล้ว ก็เปิดผ่าน localhost ของ Apache ได้เช่นกัน

## วิธีทำงานของระบบ

- state หลักเก็บใน Firebase ที่ `state`
- สมาชิกเก็บที่ `state/members`
- default กติกาเก็บที่ `defaultRules`
- รายการห้องที่ active ใช้ `activeRooms`
- ฟังก์ชัน `save()` เป็นทางผ่านหลักสำหรับการบันทึกและ sync

## กติกาการแก้โค้ด

- แก้ที่ `index.html` เป็นหลัก
- อย่าแก้ไฟล์ legacy เว้นแต่ตั้งใจทำ migration
- เวลา render ข้อความจาก user ให้ใช้ `esc()` เสมอ
- ถ้าจะเขียนข้อมูล ให้ผ่าน `save()` เพื่อไม่ให้หลุด flow sync

## สถานะปัจจุบันของ repo

- ไฟล์หลัก `index.html` มีขนาดใหญ่ประมาณ 6,000 บรรทัด
- มี legacy หลายเวอร์ชัน ทำให้เริ่มดูแลยากถ้าไม่มีแผนแยกส่วน
- README เดิมยังไม่อธิบายวิธีใช้งานหรือวิธีพัฒนาชัดเจน

## แนะนำลำดับการพัฒนาต่อ

ดูรายละเอียดได้ใน [ROADMAP.md](C:\xampp\htdocs\snowite_badminton\ROADMAP.md)

ลำดับที่คุ้มสุดตอนนี้:

1. จัดระเบียบโค้ดใน `index.html` โดยยังไม่เปลี่ยนสถาปัตย์
2. แยกงาน refactor ที่ปลอดภัย เช่น constants, helpers, render blocks
3. ค่อยเพิ่มฟีเจอร์ใหม่หลังจากอ่านโค้ดง่ายขึ้น

## Repository

- GitHub: [nrok47/badminton_snowite.github.io](https://github.com/nrok47/badminton_snowite.github.io)
- Branch หลัก: `main`
