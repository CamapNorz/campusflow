import Dashboard from "./pages/Dashboard"

export default function App() {
  const params = new URLSearchParams(window.location.search)
  return <Dashboard demo={params.get('demo') === '1'} demoRole={['member', 'teacher'].includes(params.get('role')) ? params.get('role') : 'leader'} />
}
