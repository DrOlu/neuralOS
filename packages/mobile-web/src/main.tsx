import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'

export function mountMobileWeb(rootElementId = 'root'): void {
  const root = document.getElementById(rootElementId)

  if (!root) {
    throw new Error(`Missing root element: #${rootElementId}`)
  }

  ReactDOM.createRoot(root).render(<App />)
}
