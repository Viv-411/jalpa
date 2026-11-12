import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

// The name typed on the sign-up form, used when the profile is first created.
let pendingName = ''
export function setPendingName(name) {
  pendingName = name
}

export function cleanName(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeProfile = null

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      unsubscribeProfile?.()
      unsubscribeProfile = null
      setUser(currentUser)

      if (!currentUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      const ref = doc(db, 'users', currentUser.uid)
      let creating = false
      unsubscribeProfile = onSnapshot(
        ref,
        (snapshot) => {
          if (snapshot.exists()) {
            setProfile({ uid: currentUser.uid, ...snapshot.data() })
            setLoading(false)
            return
          }
          if (creating) return
          creating = true
          // First sign-in: every debater starts at 1000.
          setDoc(ref, {
            name: cleanName(pendingName) || cleanName(currentUser.displayName) || 'Debater',
            elo: 1000,
            wins: 0,
            losses: 0,
            debates: 0,
            createdAt: serverTimestamp(),
          }).catch((err) => {
            console.error('Could not create profile', err)
            setLoading(false)
          })
        },
        (err) => {
          console.error('Could not load profile', err)
          setLoading(false)
        },
      )
    })

    return () => {
      unsubscribeProfile?.()
      unsubscribeAuth()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>{children}</AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
