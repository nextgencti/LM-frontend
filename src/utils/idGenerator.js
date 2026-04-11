import { db } from '../firebase';
import { doc, runTransaction } from 'firebase/firestore';

/**
 * Generates an atomic sequential ID for a specific lab using a Firestore transaction.
 * Format: PREFIX-YYYY-XXXX (e.g., PAT-2026-0001)
 * 
 * @param {string} prefix - The ID prefix (e.g., 'PAT', 'BKG', 'REP')
 * @param {string} labId - The lab identifying namespace string
 * @returns {Promise<string>} The generated ID block
 */
export const generateLabId = async (prefix, labId) => {
  if (!labId) {
    throw new Error("labId is required to generate sequential ID");
  }

  const year = new Date().getFullYear();
  
  let counterId;
  if (prefix === 'BL' || prefix === 'RA') {
    counterId = `${labId}_${prefix}`; // Continuous, no yearly reset
  } else {
    counterId = `${labId}_${prefix}_${year}`;
  }

  const counterRef = doc(db, 'system_counters', counterId);

  try {
    const newId = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(counterRef);
      let currentVal = 0;

      if (!docSnap.exists()) {
        currentVal = 1;
        transaction.set(counterRef, { current: 1 });
      } else {
        currentVal = docSnap.data().current + 1;
        transaction.update(counterRef, { current: currentVal });
      }

      const paddedNumber = String(currentVal).padStart(4, '0');
      
      if (prefix === 'BL') return `BL-${paddedNumber}`;
      if (prefix === 'RA') return `RA${paddedNumber}`;
      return `${prefix}-${year}-${paddedNumber}`;
    });

    return newId;
  } catch (error) {
    console.error(`Error generating ID for ${prefix}:`, error);
    // Fallback ID if offline or transaction fails
    const fallback = `${prefix}-ERR-${Math.floor(1000 + Math.random() * 9000)}`;
    return fallback;
  }
};

/**
 * Generates a batch of sequential IDs in a SINGLE transaction.
 * Extremely efficient for creating multiple reports at once.
 */
export const generateBatchIds = async (prefix, labId, count) => {
  if (!labId || count <= 0) return [];

  const year = new Date().getFullYear();
  let counterId;
  if (prefix === 'BL' || prefix === 'RA') {
    counterId = `${labId}_${prefix}`;
  } else {
    counterId = `${labId}_${prefix}_${year}`;
  }

  const counterRef = doc(db, 'system_counters', counterId);

  try {
    const ids = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(counterRef);
      let currentVal = 0;

      if (!docSnap.exists()) {
        currentVal = 0;
        transaction.set(counterRef, { current: count });
      } else {
        currentVal = docSnap.data().current;
        transaction.update(counterRef, { current: currentVal + count });
      }

      const results = [];
      for (let i = 1; i <= count; i++) {
        const nextVal = currentVal + i;
        const paddedNumber = String(nextVal).padStart(4, '0');
        if (prefix === 'BL') results.push(`BL-${paddedNumber}`);
        else if (prefix === 'RA') results.push(`RA${paddedNumber}`);
        else results.push(`${prefix}-${year}-${paddedNumber}`);
      }
      return results;
    });

    return ids;
  } catch (error) {
    console.error(`Error generating batch IDs for ${prefix}:`, error);
    return Array.from({ length: count }, (_, i) => `${prefix}-ERR-${Math.floor(1000 + Math.random() * 9999)}-${i}`);
  }
};
