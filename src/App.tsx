import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Abelian from './pages/Abelian'

export default function App() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/abelian">Abelian Sandpile</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/abelian" element={<Abelian />} />
        <Route path="*" element={<h1>Not Found</h1>} />
      </Routes>
    </main>
  )
}
