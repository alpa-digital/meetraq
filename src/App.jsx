import React from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import Header from './components/layout/Header'
import Loading from './components/ui/Loading'

const AppContent = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Loading 
        title="Initializing Meetraq"
        description="Loading AI-powered meeting analytics platform..."
        fullScreen={true}
      />
    )
  }

  // Si no hay usuario, mostrar landing page
  if (!user) {
    return <LandingPage />
  }

  // Si hay usuario, mostrar dashboard con header
  return (
    <div className="min-h-screen bg-gray-50">
      <Header connectionStatus="connected" />
      <main>
        <Dashboard />
      </main>
      
      {/* Preload critical resources */}
      <div style={{ display: 'none' }}>
        <img src="/meetraq.png" alt="" />
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <div className="meetraq-app">
        <AppContent />
        
        {/* Global Error Boundary and Development Tools */}
        {process.env.NODE_ENV === 'development' && (
          <div 
            id="debug-info" 
            style={{
              position: 'fixed',
              bottom: '10px',
              right: '10px',
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '12px',
              zIndex: 9999,
              maxWidth: '300px'
            }}
          >
            <div>Meetraq Enhanced v2.0</div>
            <div>Enhanced Face Detection Active</div>
            <div>React {React.version}</div>
          </div>
        )}
      </div>
    </AuthProvider>
  )
}

export default App