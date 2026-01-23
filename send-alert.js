const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAndSendNotifications() {
  try {
    console.log("🔍 บอทเริ่มทำงาน: สแกนหาการแจ้งเตือนล่าสุด...");

    // --- แก้ไข Logic: อ่าน 50 รายการล่าสุด โดยไม่สนว่ามี field pushed ไหม ---
    // (ต้องมั่นใจว่าใน Database มี field 'createdAt' นะครับ ถ้าไม่มีให้เอา .orderBy ออก)
    const snapshot = await db.collection('notifications')
                             .orderBy('createdAt', 'desc') 
                             .limit(50) 
                             .get();

    if (snapshot.empty) {
      console.log("✅ ไม่พบข้อมูลการแจ้งเตือนเลย");
      return;
    }

    console.log(`สแกนเจอ ${snapshot.size} รายการล่าสุด... กำลังคัดกรอง`);

    let sentCount = 0;

    for (const doc of snapshot.docs) {
      const notiData = doc.data();
      
      // 1. เช็คว่าส่งไปหรือยัง? (ถ้ามี field pushed = true แปลว่าส่งแล้ว ให้ข้าม)
      if (notiData.pushed === true) {
        continue;
      }

      const targetUserId = notiData.toUserId;
      if (!targetUserId) continue;

      console.log(`>>> พบรายการใหม่! (ID: ${doc.id}) เตรียมส่งหา ${targetUserId}`);

      // 2. ดึง Token
      const userDoc = await db.collection('users').doc(targetUserId).get();
      if (!userDoc.exists) {
        console.log(`   ❌ ไม่พบข้อมูล User ${targetUserId} ในระบบ`);
        // มาร์คว่า processed เพื่อไม่ให้วนมาเจออีก
        await doc.ref.update({ pushed: true, pushError: 'User Not Found' });
        continue;
      }

      // รองรับทั้ง fcmToken (ตัวเดียว) และ fcmTokens (Array)
      const userData = userDoc.data();
      let tokens = [];
      if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
        tokens = userData.fcmTokens;
      } else if (userData.fcmToken) {
        tokens = [userData.fcmToken];
      }

      if (tokens.length === 0) {
        console.log(`   ⚠️ User นี้ยังไม่เปิดรับแจ้งเตือน (ไม่มี Token)`);
        await doc.ref.update({ pushed: true, pushError: 'No Tokens' });
        continue;
      }

      // 3. ส่ง Push Notification
      const title = notiData.title || "TUwork แจ้งเตือน";
      const body = notiData.message || "มีข้อความใหม่ถึงคุณ";
      const link = notiData.link || "/notifications";

      const sendPromises = tokens.map(token => {
        return admin.messaging().send({
          notification: { title, body },
          data: { url: link, tag: 'tuwork' },
          token: token
        }).catch(e => {
            console.log(`   - Token ตาย/ผิดพลาด: ${e.message}`);
            return null;
        });
      });

      await Promise.all(sendPromises);
      console.log(`   ✅ ส่งสำเร็จ! (${tokens.length} อุปกรณ์)`);

      // 4. ประทับตราว่าส่งแล้ว (สำคัญมาก!)
      await doc.ref.update({ 
        pushed: true,
        pushedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      sentCount++;
    }

    console.log(`สรุป: ส่งแจ้งเตือนใหม่ไปทั้งหมด ${sentCount} รายการ`);

  } catch (error) {
    console.error('System Error:', error);
    process.exit(1);
  }
}

checkAndSendNotifications();
