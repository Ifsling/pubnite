"use client"

import { useEffect, useState } from "react"

interface MenuScreenProps {
  onStartGame: () => void
}

export default function MenuScreen({ onStartGame }: MenuScreenProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)

  // Close modals when Escape key is pressed
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (settingsOpen) setSettingsOpen(false)
        if (keysOpen) setKeysOpen(false)
      }
    }

    window.addEventListener("keydown", handleEscKey)
    return () => window.removeEventListener("keydown", handleEscKey)
  }, [settingsOpen, keysOpen])

  return (
    <div className="relative w-full h-screen flex items-center">
      {/* Background */}
      <div className="absolute inset-0 bg-black/50 z-0">
        <img
          src="/images/pubnite-splash-image.png"
          alt="Background"
          className="object-cover w-full h-full"
        />
      </div>

      {/* Left side gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent z-10"></div>

      {/* Logo at top-left */}
      <div className="absolute top-20 left-20 z-30">
        <img
          src="/images/logo-2.png"
          alt="Pubnite Logo"
          className="w-128 h-auto"
        />
      </div>

      {/* Menu content */}
      <div className="relative z-20 w-full max-w-md pl-12 md:pl-24">
        <div className="space-y-4">
          <button
            className="w-full text-xl py-6 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors duration-200 font-medium"
            onClick={onStartGame}
          >
            Start Game
          </button>

          <button
            className="w-full text-xl py-6 px-4 border border-white text-white hover:bg-white/10 rounded-md transition-colors duration-200 font-medium"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>

          <button
            className="w-full text-xl py-6 px-4 border border-white text-white hover:bg-white/10 rounded-md transition-colors duration-200 font-medium"
            onClick={() => setKeysOpen(true)}
          >
            Key Mappings / Usages
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-white rounded-lg max-w-md w-full mx-4 overflow-hidden shadow-xl transform transition-all">
            <div className="p-6">
              <h3 className="text-lg font-medium leading-6 mb-2">Settings</h3>
              <p className="text-sm text-gray-300 mb-4">
                There are no settings available. All you can do is play the
                game.
              </p>
              <div className="flex justify-end">
                <button
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors duration-200"
                  onClick={() => setSettingsOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Mappings Modal */}
      {keysOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-white rounded-lg max-w-md w-full mx-4 overflow-hidden shadow-xl transform transition-all">
            <div className="p-6">
              <h3 className="text-lg font-medium leading-6 mb-4">
                Key Mappings / Usages
              </h3>
              <ul className="space-y-3 text-sm text-gray-300">
                <li>
                  <span className="font-bold text-white">Gun Pickup</span> – G
                </li>
                <li>
                  <span className="font-bold text-white">Reload</span> – R
                </li>
                <li>
                  <span className="font-bold text-white">House enter/exit</span>{" "}
                  – E
                </li>
                <li>
                  <span className="font-bold text-white">Movement</span> – A / S
                  / D / F
                </li>
              </ul>
              <div className="flex justify-end mt-6">
                <button
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors duration-200"
                  onClick={() => setKeysOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
