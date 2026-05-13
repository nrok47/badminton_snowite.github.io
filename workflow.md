# Workflow Guide — Badminton Club App

คู่มือการใช้งานแอพจัดการก๊วนแบดมินตัน (สำหรับ Admin และ Super Admin)

---

## 1. สร้างห้อง (Room Creation)

1. เปิดแอพ → กด **"สร้างก๊วนใหม่"**
2. กรอก **รหัสห้อง** (5 หลัก ตัวเลข) และ **ชื่อก๊วน**
3. ระบบสร้างห้องใน Firebase ที่ `rooms/{roomCode}`
4. ผู้สร้างกลายเป็น **Admin** อัตโนมัติ
5. แชร์รหัสห้องให้สมาชิกเข้าร่วม

> ห้องใหม่อยู่ใน **Free Tier** — บันทึกได้สูงสุด 15 แมทช์

---

## 2. การจัดการสมาชิก (Member Management)

### เพิ่มสมาชิก
- แท็บ **แข่งขัน** หรือ Dashboard → กด ➕ เพิ่มสมาชิก
- กรอก: ชื่อ, เบอร์โทร (ไม่บังคับ), ระดับมือ (BB / BG1 / BG2 / BG+)
- ELO เริ่มต้นตาม tier ที่เลือก

### แก้ไขสมาชิก
- กดที่การ์ดสมาชิก → แก้ชื่อ, เบอร์ โทร, **หรือ toggle ⚡ Pro Tier** (เฉพาะห้อง Subscribed)
- สมาชิกแก้ชื่อตัวเองได้ (เฉพาะชื่อ) ถ้า claim แล้ว

### Claim Member
- สมาชิกที่ login ด้วย Google สามารถ claim ชื่อของตัวเองได้
- หลัง claim → สามารถเห็น ELO ตัวเอง + แก้ชื่อในเกมได้
- Admin เห็นชื่อ Google ของสมาชิกที่ claim แล้ว

---

## 3. บันทึกแมทช์ (Recording Matches)

### แมทช์ปกติ
1. แท็บ **แข่งขัน** → เลื่อนลงมาที่ "📝 บันทึกผล"
2. เลือกผู้ชนะ 1–2 คน, ผู้แพ้ 1–2 คน
3. กรอกคะแนน (เช่น 21-15)
4. Preview ELO delta จะโผล่อัตโนมัติ
5. กด **✅ บันทึกผลการแข่งขัน**

### ⚡ Pro Match (อัตโนมัติ)
- ถ้าผู้เล่นทั้ง 4 คน มี **Pro Tier ✅** → badge "⚡ Pro Match" โผล่อัตโนมัติ
- ปุ่มเปลี่ยนเป็น **"⚡ บันทึก Pro Match"**
- บันทึกด้วยสูตร Pro ELO แยกต่างหาก (base 50,000, ±3,000)
- ผลไปขึ้น Global Pro Leaderboard ทันที

### Freemium Limit
- ห้อง Free Tier: เตือนเมื่อเหลือ ≤ 10 แมทช์, ล็อคเมื่อครบ 15
- กด "📖 ดูแพ็กเกจ" เพื่อดูรายละเอียดการ Subscribe

---

## 4. RSVP และจัดคอร์ท

1. แท็บ **แข่งขัน** → "📋 RSVP — ใครมา session นี้?"
2. กดชื่อสมาชิกที่มา (toggle on/off)
3. กด **🎲 สุ่มจัดคอร์ท** → จับคู่ผู้เล่นใน RSVP อัตโนมัติ
4. ผลการจับคู่แสดงใน "🎯 จัดคอร์ท"

---

## 5. Dashboard และสถิติ

- **📊 Dashboard**: ELO ranking, top pairs, stats รวม, season progress
- **👥 สมาชิก**: ดูสถิติรายบุคคล (ชนะ/แพ้/ELO chart/ประวัติล่าสุด)
- **📜 ประวัติ**: กรองแมทช์ตามผู้เล่น, ดู ELO delta ย้อนหลัง

---

## 6. ⚡ Global Pro Leaderboard

- แท็บ **⚡ Pro** → กด "🔄 โหลด / รีเฟรช"
- แสดงผู้เล่น Pro **จากทุกก๊วนทั่วแอพ** เรียงจาก Pro ELO สูงสุด
- ทุกคนดูได้ (ไม่ต้อง Subscribe) แต่บันทึก Pro Match ต้องมี Subscription

**Pro ELO formula:**
```
proElo = 50,000 + Σ(delta ของ 10 เกมล่าสุด)
```

---

## 7. การเงิน (Finance)

- แท็บ **💰 การเงิน** → บันทึกค่าใช้จ่ายต่อ session
- ดูยอดรวม, จำนวน sessions, เรทต่อชั่วโมง

---

## 8. กติกา (Rules)

- แท็บ **📋 กติกา** → แสดงสูตร ELO ทั้งหมด
- รวม: **Free Tier limits** และ **Pro Mode scoring**
- Admin แก้ไขกติกาได้ (กด ✏️ แก้ไขกติกา) — เปลี่ยน base points, margin, anti-carry ฯลฯ

---

## 9. Season

- Season bar อยู่ด้านบน (เห็นเฉพาะตอน login)
- Admin กดที่ bar เพื่อตั้งเป้าหมายแมทช์ (Season Goal)
- กด **"🏆 จบ Season"** → บันทึก snapshot ไปที่ Trophy, reset ได้

---

## 10. 🛡️ Super Admin Operations

เฉพาะ email ที่อยู่ใน `SUPER_ADMIN_EMAILS` (nrok47@gmail.com)

### แท็บ Super Admin
1. Login → แท็บ **🛡️ Super** จะโผล่ในเมนู
2. กด Tab → ดูทุกห้องในระบบ

### Toggle Subscription
- แต่ละห้องมีปุ่ม **"✅ เปิด Subscription"** หรือ **"❌ ยกเลิก Subscription"**
- เปิด → ห้องนั้นบันทึกแมทช์ไม่จำกัด + ใช้ Pro Mode ได้
- เขียนไปที่ Firebase: `rooms/{code}/metadata/subscribed = true/false`

### เพิ่ม Super Admin คนที่ 2
1. เปิด `index.html` ใน editor
2. ค้นหา `SUPER_ADMIN_EMAILS`
3. เพิ่ม email: `['nrok47@gmail.com', 'new_admin@gmail.com']`

---

## 11. Firebase Database Rules (ที่ต้องตั้งใน Firebase Console)

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "proPlayers": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null"
      }
    }
  }
}
```

---

## 12. Deployment

แอพ deploy บน GitHub Pages อัตโนมัติจาก branch `main`

1. ทำงานใน feature branch
2. Merge หรือ push ไปที่ `main`
3. GitHub Actions deploy ให้เอง (ไม่มี build step — deploy ตรงจาก `index.html`)

---

## ข้อควรระวัง

| ⚠️ ห้ามทำ | เหตุผล |
|-----------|--------|
| แก้ `localStorage key` (`bcm_v1`) | จะ wipe state ของ user ทุกคน |
| ลบ `esc()` จาก HTML template | XSS vulnerability |
| แก้ไข `index-v*.html` หรือ `old_index.html` | legacy files, ไม่ใช้งาน |
| Hardcode scoring values นอก `RC` | กติกาจะ inconsistent |
| เขียน proMatches ไป Firebase โดยตรง | ใช้ `autoSyncToFirebase` เท่านั้น |
