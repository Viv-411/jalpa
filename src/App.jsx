import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Home from './pages/Home'
import TopicSelect from './pages/TopicSelect'
import Matchmaking from './pages/Matchmaking'
import TopicReveal from './pages/TopicReveal'
import Call from './pages/Call'
import Results from './pages/Results'
import Leaderboard from './pages/Leaderboard'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <p className="app-loading">Loading…</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <p className="app-loading">Loading…</p>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics"
            element={
              <ProtectedRoute>
                <TopicSelect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/matchmaking"
            element={
              <ProtectedRoute>
                <Matchmaking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/debate/:debateId"
            element={
              <ProtectedRoute>
                <TopicReveal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/call/:debateId"
            element={
              <ProtectedRoute>
                <Call />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results/:debateId"
            element={
              <ProtectedRoute>
                <Results />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
