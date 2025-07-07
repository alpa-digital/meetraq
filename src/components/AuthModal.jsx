import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { X, Eye, EyeOff } from 'lucide-react'

const AuthModal = ({ isOpen, onClose, defaultMode = 'signin' }) => {
  const { signIn, signUp } = useAuth()
  const [authMode, setAuthMode] = useState(defaultMode)
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const { error } = authMode === 'signin' 
        ? await signIn(formData.email, formData.password)
        : await signUp(formData.email, formData.password)

      if (error) {
        setError(error.message)
      } else {
        onClose()
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = () => {
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin')
    setError('')
    setFormData({ email: '', password: '' })
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-8">
          <img 
            src="/meetraq.png" 
            alt="Meetraq" 
            className="h-8 mx-auto mt-8 mb-4"
          />
          <h2 className="text-2xl font-semibold text-gray-900">
            {authMode === 'signin' ? 'Welcome Back' : 'Get Started Today'}
          </h2>
          <p className="text-gray-600 mt-2">
            {authMode === 'signin' ? 'Sign in to your account' : 'Create your free account'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter your email"
            />
          </div>
          
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-primary py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {authMode === 'signin' ? 'Signing In...' : 'Creating Account...'}
              </div>
            ) : (
              authMode === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-gray-600 text-sm">
            {authMode === 'signin' ? "Don't have an account?" : "Already have an account?"}
            <button
              onClick={switchMode}
              className="ml-2 text-primary-500 hover:text-primary-600 font-medium"
            >
              {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default AuthModal