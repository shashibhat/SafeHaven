import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import { useSystemStore } from './stores/system'
import { initializeMQTT } from './services/mqtt'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Cameras from './pages/Cameras'
import Events from './pages/Events'
import Rules from './pages/Rules'
import CustomModels from './pages/CustomModels'
import Settings from './pages/Settings'

function App() {
  const { user, loading } = useAuthStore()
  const { initializeMQTT } = useSystemStore()

  useEffect(() => {
    if (user && !loading) {
      // Initialize MQTT connection when user is authenticated
      const setupMQTT = async () => {
        try {
          await initializeMQTT()
          console.log('MQTT initialized successfully')
        } catch (error) {
          console.error('Failed to initialize MQTT:', error)
        }
      }
      
      setupMQTT()
      
      // Request notification permission for alerts
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [user, loading])

  if (loading) {
    return (
      <div className="min-h-screen bg-security-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-security-300">Loading Security System...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/cameras" element={<Cameras />} />
          <Route path="/events" element={<Events />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/custom-models" element={<CustomModels />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App