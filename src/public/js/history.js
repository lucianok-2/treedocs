const { db, admin } = require('../../firebase');

async function addHistoryEntry({ userId, actionType, entityType, entityId, details = {} }) {
  if (!userId || !actionType) {
    throw new Error('userId and actionType are required for history entry');
  }
  const entry = {
    actionType,
    entityType: entityType || '',
    entityId: entityId || '',
    details,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('historial')
    .doc(userId)
    .collection('cambios')
    .add(entry);
}

async function getUserHistory(userId, limit = 20) {
  const snapshot = await db.collection('historial')
    .doc(userId)
    .collection('cambios')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  const history = [];
  snapshot.forEach(doc => history.push({ id: doc.id, ...doc.data() }));
  return history;
}

module.exports = { addHistoryEntry, getUserHistory };