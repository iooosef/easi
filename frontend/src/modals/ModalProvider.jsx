import { createContext, useContext, useState, useCallback } from 'react'

export const ModalContext = createContext(null)

/**
 * Base z-index for the backdrop.
 * Each layer uses a step of 2: the layer container sits at BASE_Z + 1 + index*2,
 * and a dim overlay occupies BASE_Z + 2 + index*2 for all non-top layers.
 */
const BASE_Z = 100

let _id = 0
const nextId = () => String(++_id)

/**
 * Renders the active modal stack.
 * The backdrop is a single decorative overlay behind all layers.
 * Non-top layers are dimmed by an overlay that sits between them and the layer above.
 * Backdrop clicks are ignored — modals must be closed via explicit buttons.
 */
function ModalStack({ stack }) {
  if (stack.length === 0) return null

  return (
    <>
      {/* Single shared backdrop — purely visual, sits behind all layers */}
      <div
        className="fixed inset-0 bg-base-300/60 transition duration-300"
        style={{ zIndex: BASE_Z }}
      />

      {stack.map((entry, index) => {
        const isTop = index === stack.length - 1
        const layerZ = BASE_Z + 1 + index * 2
        return (
          <div key={entry.id}>
            {/* Full-screen layer container — centers the modal box */}
            <div
              className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
              style={{ zIndex: layerZ }}
            >
              {entry.content}
            </div>

            {/* Dim overlay — covers this layer when a higher layer is open */}
            {!isTop && (
              <div
                className="fixed inset-0 bg-base-300/50 transition duration-300"
                style={{ zIndex: layerZ + 1 }}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * Provides the modal stack context and renders all active modal layers.
 * Mount once near the app root (e.g. in main.jsx, wrapping App).
 */
export function ModalProvider({ children }) {
  const [stack, setStack] = useState([])

  /** Pushes a new modal on top of the stack. */
  const pushModal = useCallback((content) => {
    setStack(prev => [...prev, { id: nextId(), content }])
  }, [])

  /** Removes the topmost modal. */
  const popModal = useCallback(() => {
    setStack(prev => prev.slice(0, -1))
  }, [])

  /**
   * Replaces the topmost modal with new content.
   * If the stack is empty, behaves like pushModal.
   */
  const replaceModal = useCallback((content) => {
    setStack(prev => {
      const entry = { id: nextId(), content }
      return prev.length === 0 ? [entry] : [...prev.slice(0, -1), entry]
    })
  }, [])

  /** Closes all modal layers at once. */
  const clearModals = useCallback(() => setStack([]), [])

  return (
    <ModalContext.Provider value={{ pushModal, popModal, replaceModal, clearModals }}>
      {children}
      <ModalStack stack={stack} />
    </ModalContext.Provider>
  )
}

/**
 * Returns modal stack controls: pushModal, popModal, replaceModal, clearModals.
 * Must be called inside a ModalProvider.
 */
export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within a ModalProvider')
  return ctx
}
