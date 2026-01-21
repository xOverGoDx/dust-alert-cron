const admin = require("firebase-admin");

// ดึงกุญแจจาก GitHub Secrets มาใช้ (ผ่าน Environment Variable)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// ฟังก์ชันจำลองการดึงค่าฝุ่น (แก้เป็น logic จริงของคุณ)
async function checkDustAndSend() {
  try {
    // สมมติ logic ดึงค่าฝุ่น
    const pm25 = 75; // ค่าสมมติ

    if (pm25 > 50) {
      const message = {
        notification: {
          title: 'เตือนภัยฝุ่น TU!',
          body: `ขณะนี้ค่าฝุ่น PM2.5 อยู่ที่ ${pm25} µg/m³`
        },
        topic: 'tu_dust'
      };

      await admin.messaging().send(message);
      console.log('Successfully sent message');
    }
  } catch (error) {
    console.log('Error sending message:', error);
    process.exit(1);
  }
}

checkDustAndSend();