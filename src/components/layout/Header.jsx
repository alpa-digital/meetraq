import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronDown, User, Settings, LogOut, Wifi, WifiOff } from 'lucide-react'

const Header = ({ connectionStatus = 'disconnected' }) => {
  const { user, profile, signOut } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          icon: <Wifi className="w-3 h-3" />,
          text: 'Connected',
          className: 'bg-green-100 text-green-800 border-green-200'
        }
      case 'connecting':
        return {
          icon: <div className="w-3 h-3 border border-yellow-600 border-t-transparent rounded-full animate-spin" />,
          text: 'Connecting...',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }
      default:
        return {
          icon: <WifiOff className="w-3 h-3" />,
          text: 'Disconnected',
          className: 'bg-red-100 text-red-800 border-red-200'
        }
    }
  }

  const status = getStatusConfig()

  const handleSignOut = async () => {
    await signOut()
    setIsDropdownOpen(false)
  }

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
      <div className="container">
        <div className="flex items-center justify-between py-3">
          {/* Logo */}
          <div className="flex items-center">
            <a href="#" className="flex items-center gap-3">
              <img 
                src="/meetraq.png" 
                alt="Meetraq" 
                className="h-6 w-auto"
              />
            </a>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${status.className}`}>
              {status.icon}
              <span>{status.text}</span>
            </div>

            {/* User Menu */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-medium text-gray-900">
                      {user.email}
                    </div>
                    <div className="text-xs text-gray-500">
                      {profile?.subscription_status === 'pro' ? 'Pro Plan' : 'Free Plan'}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900">
                        {user.email}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          profile?.subscription_status === 'pro' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {profile?.subscription_status === 'pro' ? 'Pro Plan' : 'Free Plan'}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      onClick={handleSignOut}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header