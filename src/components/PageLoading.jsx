import React from 'react'

/**
 * Centered loading placeholder for full-width page containers.
 * Pass `message` or `className` when a page needs a one-off variant.
 */
export default function PageLoading({ message = 'Loading...', className }) {
  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        width: '100%',
        color: '#666',
        fontSize: '1.1rem',
      }}
    >
      {message}
    </div>
  )
}
