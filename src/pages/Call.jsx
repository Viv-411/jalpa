import { useParams, Link } from 'react-router-dom'
import './Call.css'

export default function Call() {
  const { debateId } = useParams()

  return (
    <div className="call-page">
      <div className="call-card">
        <h1>Voice call</h1>
        <p className="call-debate-id">Debate ID: {debateId}</p>
        <p className="call-placeholder">Daily.co integration coming next.</p>
        <Link to="/" className="call-home-link">
          Back to home
        </Link>
      </div>
    </div>
  )
}
