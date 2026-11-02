import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  collectionData,
  docData,
  QueryConstraint,
  DocumentData,
  WithFieldValue
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  constructor(private firestore: Firestore) {}

  /** Get a single document by collection + document ID */
  getDoc<T>(collectionName: string, docId: string): Observable<T | null> {
    const ref = doc(this.firestore, collectionName, docId);
    return from(getDoc(ref)).pipe(
      map(snap => snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null)
    );
  }

  /** Real-time single document stream */
  watchDoc<T>(collectionName: string, docId: string): Observable<T | null> {
    const ref = doc(this.firestore, collectionName, docId);
    return docData(ref, { idField: 'id' }) as Observable<T | null>;
  }

  /** Query a collection with optional constraints */
  getCollection<T>(
    collectionName: string,
    ...constraints: QueryConstraint[]
  ): Observable<T[]> {
    const ref = collection(this.firestore, collectionName);
    const q = query(ref, ...constraints);
    return from(getDocs(q)).pipe(
      map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as T)))
    );
  }

  /** Real-time collection stream */
  watchCollection<T>(
    collectionName: string,
    ...constraints: QueryConstraint[]
  ): Observable<T[]> {
    const ref = collection(this.firestore, collectionName);
    const q = query(ref, ...constraints);
    return collectionData(q, { idField: 'id' }) as Observable<T[]>;
  }

  /** Set (create/overwrite) a document */
  setDoc<T extends DocumentData>(
    collectionName: string,
    docId: string,
    data: WithFieldValue<T>
  ): Observable<void> {
    const ref = doc(this.firestore, collectionName, docId);
    return from(setDoc(ref, data));
  }

  /** Update specific fields of a document */
  updateDoc(
    collectionName: string,
    docId: string,
    data: Partial<DocumentData>
  ): Observable<void> {
    const ref = doc(this.firestore, collectionName, docId);
    return from(updateDoc(ref, data));
  }

  /** Delete a document */
  deleteDoc(collectionName: string, docId: string): Observable<void> {
    const ref = doc(this.firestore, collectionName, docId);
    return from(deleteDoc(ref));
  }

  // Re-export query helpers for convenience
  where = where;
  orderBy = orderBy;
  limit = limit;
}
