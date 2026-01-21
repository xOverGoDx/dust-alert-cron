const admin = require("firebase-admin");

// ดึงกุญแจ
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Database URL ของคุณ (ใส่ให้ถูกนะ!)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cimd-4e4cc-default-rtdb.asia-southeast1.firebasedatabase.app"
});

async function checkDustAndSend() {
  const db = admin.database();
  
  try {
    // 1. จำลองค่าฝุ่น
    const pm25 = 75; 

    if (pm25 > 50) {
      console.log(`ค่าฝุ่น ${pm25} เกินกำหนด เริ่มทำงาน...`);

      // 2. ดึงรายชื่อ
      const snapshot = await db.ref('tokens').once('value');
      
      if (!snapshot.exists()) {
        console.log("No tokens found.");
        return;
      }

      const tokens = Object.keys(snapshot.val());
      console.log(`Found ${tokens.length} devices.`);

      // 3. วนลูปส่งทีละคน (แก้ปัญหา Error 404 /batch/)
      for (const token of tokens) {
          const message = {
            notification: {
              title: '⚠️ เตือนภัยฝุ่น TU!',
              body: `ขณะนี้ค่าฝุ่น PM2.5 สูงถึง ${pm25} µg/m³ โปรดสวมหน้ากาก`
            },
            token: token // ระบุผู้รับทีละคน
          };

          try {
            await admin.messaging().send(message);
            console.log(`✅ ส่งสำเร็จ: ${token.substring(0, 10)}...`);
          } catch (err) {
            console.log(`❌ ส่งไม่ผ่าน: ${token.substring(0, 10)}...`, err.message);
            // ถ้า Token หมดอายุหรือ Error ก็ข้ามไปคนต่อไป
          }
      }
      
      console.log("จบการทำงาน");
    }
  } catch (error) {
    console.log('Error:', error);
    process.exit(1);
  }
}

checkDustAndSend();
