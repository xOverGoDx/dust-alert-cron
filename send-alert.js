const admin = require("firebase-admin");

// 1. Setup Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAndSendNotifications() {
  try {
    console.log("🔍 บอทเริ่มทำงาน: ตรวจหาการแจ้งเตือน...");

    // 2. หา Notification ที่ยังไม่ได้ส่ง (pushed: false)
    const snapshot = await db.collection('notifications')
                             .where('pushed', '==', false)
                             .get();

    if (snapshot.empty) {
      console.log("✅ ไม่มีการแจ้งเตือนใหม่");
      return;
    }

    console.log(`เจอ ${snapshot.size} รายการที่ต้องส่ง`);

    // 3. วนลูปส่งทีละรายการ
    for (const doc of snapshot.docs) {
      const notiData = doc.data();
      const targetUserId = notiData.toUserId; 
      
      // ดึงข้อมูลที่จะแสดง
      const title = notiData.title || "TUwork แจ้งเตือน";
      const body = notiData.message || "คุณมีการแจ้งเตือนใหม่";
      const link = notiData.link || "/"; // ลิ้งค์เผื่อมี

      if (!targetUserId) {
        console.log(`⚠️ ข้าม: ไม่ระบุ toUserId (Doc ID: ${doc.id})`);
        continue;
      }

      // 4. ไปดึง Token จาก Users Collection
      const userDoc = await db.collection('users').doc(targetUserId).get();
      
      if (!userDoc.exists) {
        console.log(`❌ ไม่พบ User ID: ${targetUserId}`);
        await doc.ref.update({ pushed: true, pushError: 'User Not Found' });
        continue;
      }

      const userData = userDoc.data();
      
      // *** จุดสำคัญ: อ่าน fcmTokens (Array) ***
      const tokens = userData.fcmTokens || []; 

      if (tokens.length === 0) {
        console.log(`❌ User ${targetUserId} ยังไม่เปิดแจ้งเตือน (ไม่มี Token)`);
        await doc.ref.update({ pushed: true, pushError: 'No Tokens' });
        continue;
      }

      console.log(`📤 กำลังส่งหา ${targetUserId} (จำนวน ${tokens.length} เครื่อง)...`);

      // 5. ส่งหาทุกเครื่องของ User นั้น (มือถือ + คอม)
      const sendPromises = tokens.map(token => {
        const message = {
          notification: {
            title: title,
            body: body
          },
          data: {
             url: link, // ส่งลิ้งค์ไปด้วย (ให้ SW จัดการเปิด)
             tag: 'tuwork-alert' 
          },
          token: token
        };
        return admin.messaging().send(message)
          .catch(err => {
             console.log(`   - ส่งไม่ผ่านเครื่องนึง: ${err.message}`);
             // อนาคตอาจจะเขียนโค้ดลบ Token ที่ตายแล้วออกตรงนี้ได้
             return null; 
          });
      });

      await Promise.all(sendPromises);
      console.log(`✅ ส่งครบทุกเครื่องแล้ว`);

      // 6. อัปเดตสถานะว่าส่งแล้ว
      await doc.ref.update({ 
          pushed: true,
          pushedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    console.log("จบการทำงาน");

  } catch (error) {
    console.error('System Error:', error);
    process.exit(1);
  }
}

checkAndSendNotifications();
