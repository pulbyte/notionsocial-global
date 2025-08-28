import "dotenv/config";
import {applicationDefault, initializeApp, getApps, getApp} from "firebase-admin/app";
import {getFirestore, Firestore} from "firebase-admin/firestore";

let db: Firestore;

function initializeFirebaseApp() {
  // Check if Firebase app already exists
  const existingApps = getApps();
  const app = existingApps.length > 0 ? getApp() : initializeApp({
    credential: applicationDefault(),
  });
  
  if (!db) {
    db = getFirestore(app);
    db.settings({ignoreUndefinedProperties: true});
  }
  
  return db;
}

// Lazy initialization - only initialize when needed
function getDb(): Firestore {
  if (!db) {
    return initializeFirebaseApp();
  }
  return db;
}

export { getDb };

import {dashifyNotionId, removeHyphens} from "./text";
import {FirestoreDoc, NotionDatabase, PostRecord, SocialAccountData, UserData} from "./types";
import {Storage} from "@google-cloud/storage";
import {dog} from "./logging";

const storage = new Storage();

export function getPostRecord(
  pageId,
  time?: number,
  pushId?: string,
  taskName?: string
): Promise<FirestoreDoc<PostRecord> | null> {
  if (!pageId) return;
  const col = getDb().collection("posts");

  let query = col.where("notion_page_id", "==", dashifyNotionId(pageId));
  if (pushId) query = col.where("push_id", "==", pushId);
  else if (time) query = query.where("publish_at", "==", time);
  else if (taskName) query = query.where("cloudtask_name", "==", taskName);
  query = query.orderBy("scheduled_at", "desc").limit(1);

  return query.get().then((_) => {
    const doc = _.docs[0];
    const data = doc?.data() as PostRecord;
    if (doc?.exists) return {data, ref: doc.ref};
    else return Promise.resolve(null);
  });
}
export function getNdbDoc(id): Promise<FirestoreDoc<NotionDatabase> | null> {
  if (!id) return Promise.resolve(null);
  const col = getDb().collection("notion_dbs");

  let query = col.where("link_id", "==", removeHyphens(id));

  return query.get().then((_) => {
    const doc = _.docs[0];
    const data = doc?.data() as NotionDatabase;
    if (doc?.exists) return {data, ref: doc.ref};
    else return Promise.resolve(null);
  });
}
export function getUserPostCount(authorUid) {
  return getDb()
    .collection("posts")
    .where("author_uid", "==", authorUid)
    .where("scheduled_at", ">=", Date.now() - 30 * 60 * 60 * 24 * 1000)
    .where("completed", "==", true)
    .where("status", "in", ["success", "partial_error"])
    .count()
    .get()
    .then((doc) => doc?.data()?.count);
}
export function getUserDoc(id): Promise<FirestoreDoc<UserData>> {
  return new Promise((resolve, reject) => {
    if (!id) reject("No user id provided");
    const ref = getDb().doc(`/users/${id}`);

    ref.get().then((doc) => {
      if (doc?.exists) resolve({data: doc.data() as UserData, ref: doc.ref});
      else reject("User does not exist");
    });
  });
}
export function getUserNdbs(authorUid) {
  const query = getDb().collection("notion_dbs").where("author_uid", "==", authorUid);
  return query.get().then((s) => s.docs?.filter((s) => s.exists) || []);
}
export function getUserWorkspaceNdbs(authorUid, workspaceId) {
  const query = getDb()
    .collection("notion_dbs")
    .where("author_uid", "==", authorUid)
    .where("workspace_id", "==", workspaceId);
  return query.get().then((s) => s.docs?.filter((s) => s.exists) || []);
}
export function getCloudBucketFile(bucket, fileName) {
  return storage.bucket(bucket).file(fileName);
}
export function getSmAccDoc(
  smAccId: string,
  authorUid: string
): Promise<FirestoreDoc<SocialAccountData>> {
  return new Promise(async (res, rej) => {
    const query = getDb()
      .collection(`sm_accs`)
      .where("platform_uid", "==", smAccId)
      .where("author_uid", "==", authorUid);

    return query.get().then((_) => {
      const doc = _.docs[0];
      const data = doc?.data() as SocialAccountData;
      if (doc?.exists) return res({data, ref: doc.ref});
      else return rej("Social account does not exists");
    });
  });
}
export async function getSmAccByPlatformId(
  id: string,
  authorUid?: string
): Promise<FirestoreDoc<SocialAccountData> | null> {
  if (!id) return null;
  let query = getDb().collection("sm_accs").where("platform_uid", "==", id);

  if (authorUid) {
    query = query.where("author_uid", "==", authorUid);
  }

  query = query.limit(1);

  const snapshot = await query.get();
  const doc = snapshot.docs[0];

  if (!doc) {
    dog(`Social account not found for platform id: ${id} and author uid: ${authorUid}`);
    return null;
  }

  return {
    data: doc.data() as SocialAccountData,
    ref: doc.ref,
  };
}
