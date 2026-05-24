import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { user } = useAuth()

  return (
    <div>
      <h1>Welcome</h1>
      <p>{user?.email}</p>
    </div>
  )
}
