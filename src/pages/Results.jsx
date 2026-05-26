import { useParams } from 'react-router-dom'
import './Results.css'

export default function Results() {
  const { debateId } = useParams()

  return (
    <div className="results-page">
      <div className="results-card">
        <p className="results-message">Processing your debate results…</p>
        <p className="results-debate-id">Debate ID: {debateId}</p>
      </div>
    </div>
  )
}
