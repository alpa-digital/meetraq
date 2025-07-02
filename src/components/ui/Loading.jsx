const Loading = ({ 
    title = "Loading Meetraq", 
    description = "Initializing AI components...",
    fullScreen = true 
  }) => {
    if (fullScreen) {
      return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300">
          <div className="text-center text-white p-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
            <div className="relative mb-6">
              <div className="w-10 h-10 border-3 border-white/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
              <div className="absolute inset-0 w-15 h-15 border-2 border-primary-500/30 rounded-full animate-pulse"></div>
            </div>
            <h2 className="text-xl font-semibold mb-2 font-display">{title}</h2>
            <p className="text-sm opacity-80">{description}</p>
          </div>
        </div>
      )
    }
  
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    )
  }
  
  export default Loading