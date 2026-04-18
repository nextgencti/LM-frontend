import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [labFullName, setLabFullName] = useState('');
  const [allPlans, setAllPlans] = useState([]);
  const [selectedLabId, setSelectedLabId] = useState(localStorage.getItem('selectedLabId') || null);

  const setActiveLabId = (id) => {
    setSelectedLabId(id);
    if (id) {
      localStorage.setItem('selectedLabId', id);
    } else {
      localStorage.removeItem('selectedLabId');
    }
  };

  useEffect(() => {
    const unsubPlans = onSnapshot(collection(db, 'plans'), (snapshot) => {
      const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllPlans(plans);
    });

    return () => unsubPlans();
  }, []);

  useEffect(() => {
    let subUnsub = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !userData) setLoading(true);
      setCurrentUser(user);
      
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            const tokenResult = await user.getIdTokenResult();
            const { role, labId } = tokenResult.claims;
            
            const finalUserData = { ...data, role: role || data.role, labId: labId || data.labId };
            setUserData(finalUserData);

            const currentLabId = labId || data.labId || selectedLabId;
            
            if (currentLabId) {
              // Cleanup previous listener if any
              if (subUnsub) subUnsub();
              
              // New Real-time subscription listener
              subUnsub = onSnapshot(doc(db, 'subscriptions', currentLabId), (docSnap) => {
                if (docSnap.exists()) {
                  setSubscription({ id: docSnap.id, ...docSnap.data() });
                }
              });

              const labSnap = await getDoc(doc(db, 'labs', currentLabId));
              if (labSnap.exists()) {
                setLabFullName(labSnap.data().labName);
              }
            }

            localStorage.setItem('jwt_token', tokenResult.token);
            localStorage.setItem('user_role', role || data.role);
          }
        } catch (error) {
          console.error("Error in Auth State Transition:", error);
        }
      } else {
        setUserData(null);
        setSubscription(null);
        setSelectedLabId(null);
        localStorage.clear();
        if (subUnsub) subUnsub();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (subUnsub) subUnsub();
    };
  }, [selectedLabId]);

  const checkFeature = (featureName) => {
    if (!subscription) return false;
    const planId = subscription.plan || 'basic';
    
    // Always use the master plan record for real-time feature gating
    const masterPlan = allPlans.find(p => p.id === planId.toLowerCase());
    if (!masterPlan) {
      // Fallback to subscription snapshot if master plan not loaded yet
      if (!subscription.features) return false;
      const feat = subscription.features.find(f => f.text.toLowerCase().trim() === featureName.toLowerCase().trim() || f.text.toLowerCase().includes(featureName.toLowerCase().trim()));
      return feat ? feat.available : false;
    }

    // Exact or loose match in the current plan plan
    let feat = masterPlan.features.find(f => f.text.toLowerCase().trim() === featureName.toLowerCase().trim());
    if (!feat) {
       feat = masterPlan.features.find(f => f.text.toLowerCase().includes(featureName.toLowerCase().trim()));
    }

    if (feat) {
      return feat.available;
    }

    // Implicit inheritance: If the feature is missing in Pro/Enterprise completely, but exists in Basic, assume it's inherited.
    if (planId.toLowerCase() === 'pro' || planId.toLowerCase() === 'enterprise') {
        const basicPlan = allPlans.find(p => p.id === 'basic');
        if (basicPlan) {
           const basicFeat = basicPlan.features.find(f => f.text.toLowerCase().trim() === featureName.toLowerCase().trim());
           // If it's a recognized feature from a lower tier, premium plans naturally inherit it
           if (basicFeat) return true;
        }
    }

    return false;
  };

  const value = {
    currentUser,
    userData,
    subscription,
    allPlans,
    labFullName,
    checkFeature,
    loading,
    activeLabId: userData?.labId || selectedLabId,
    setActiveLabId
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
