import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Abelian from './pages/Abelian'
import Automaton from './pages/Automaton'

export default function App() {
  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/interactive">Interactive</Link>
        <Link to="/automaton">Automaton</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/interactive" element={<Abelian />} />
        <Route path="/automaton" element={<Automaton />} />
        <Route path="*" element={<h1>Not Found</h1>} />
      </Routes>
    </main>
  )
}
