import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Debate from './pages/Debate'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import Login from './pages/Login'
import Play from './pages/Play'
import { Logo } from './components/ui'

function Loading() {
  return (
    <div className="app-loading" role="status" aria-label="Loading">
      <Logo withWord={false} />
    </div>
  )
}

function Private({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading || (user && !profile)) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Public({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Public><Login /></Public>} />
          <Route path="/" element={<Private><Home /></Private>} />
          <Route path="/play" element={<Private><Play /></Private>} />
          <Route path="/debate/:debateId" element={<Private><Debate /></Private>} />
          <Route path="/leaderboard" element={<Private><Leaderboard /></Private>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
