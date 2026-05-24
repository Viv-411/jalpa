import { auth } from './firebase'

function App() {
  return (
    <div>
      <h1>Debate App</h1>
      <p>Firebase connected: {auth ? "✓ Yes" : "✗ No"}</p>
    </div>
  )
}

export default App