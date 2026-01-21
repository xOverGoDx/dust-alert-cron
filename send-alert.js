const admin = require("firebase-admin");

// ดึงกุญแจ
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// ใส่ databaseURL ของคุณลงไปตรงนี้ด้วย!
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cimd-4e4cc-default-rtdb.asia-southeast1.firebasedatabase.app"
});

async function checkDustAndSend() {
  const db = admin.database();
  
  try {
    // 1. จำลองค่าฝุ่น (หรือไปดึง API จริงมาใส่ตรงนี้)
    const pm25 = 75; 

    if (pm25 > 50) {
      // 2. ไปอ่านรายชื่อทุกคนจาก Database
      const snapshot = await db.ref('tokens').once('value');
      
      if (!snapshot.exists()) {
        console.log("No tokens found.");
        return;
      }

      const tokens = Object.keys(snapshot.val()); // ดึงเฉพาะรหัส Token ออกมา
      console.log(`Found ${tokens.length} devices.`);

      // 3. เตรียมข้อความ
      const message = {
        notification: {
          title: '⚠️ เตือนภัยฝุ่น TU!',
          body: `ขณะนี้ค่าฝุ่น PM2.5 สูงถึง ${pm25} µg/m³ โปรดสวมหน้ากาก`
        },
        tokens: tokens // ส่งหาทุกคนในลิสต์
      };

      // 4. ส่งข้อความ (Multicast)
      const response = await admin.messaging().sendMulticast(message);
      console.log(response.successCount + ' messages were sent successfully');
    }
  } catch (error) {
    console.log('Error:', error);
    process.exit(1);
  }
}

checkDustAndSend();